"""
scripts/build_pincode_risk_index.py

Extract environmental risk data at pincode level by lat/lng point sampling.
Sources:
  1. CAMS EAC4 - NO2, SO2, CO, O3, PM2.5, PM10 (monthly NetCDF, 2003-2025)
  2. ERA5-Land  - Heat wave days (monthly NetCDF, 1980-2025)
  3. SEDAC      - Satellite PM2.5 annual mean (GeoTIFF, 2000-2022)
  4. NFHS-5     - Health indicators (district-level CSV -> parent map for new districts)
  5. EM-DAT     - Disaster frequency (district-level CSV -> parent map for new districts)

Output: data/output/pincode_risk_index.csv
  One row per pincode with all risk metrics + composite score.

This eliminates the district-name matching gap: pincodes have lat/lng,
rasters cover the full geography, NFHS/EM-DAT fallback to parent district.
"""
import os, sys, glob, warnings
import numpy as np
import pandas as pd
import xarray as xr
import rasterio
from rasterio.transform import rowcol

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
CAMS_DIR        = "data/cams"
ERA5_FILE       = "data/era5/temperature_monthly_1980_2025_real.nc"
SEDAC_DIR       = "data/sedac/pm25"
NFHS_CSV        = "data/output/nfhs5_district.csv"
EMDAT_CSV       = "data/output/emdat_disaster_summary.csv"
PINCODE_CSV     = "data/output/pincode_coords.csv"
OUT_PATH        = "data/output/pincode_risk_index.csv"

HEAT_WAVE_THRESHOLD_K = 308.15   # 35 deg C monthly mean proxy for daily max >=40 deg C
CAMS_YEARS_RECENT  = list(range(2015, 2026))   # 10-year recent average
SEDAC_YEARS_RECENT = list(range(2013, 2023))   # 10-year recent average
SEDAC_YEARS_5YR    = list(range(2018, 2023))   # 5yr window (2018–2022)
SEDAC_YEARS_3YR    = list(range(2020, 2023))   # 3yr window (2020–2022)
PM25_5YR_FROM = SEDAC_YEARS_5YR[0]
PM25_5YR_TO   = SEDAC_YEARS_5YR[-1]
PM25_3YR_FROM = SEDAC_YEARS_3YR[0]
PM25_3YR_TO   = SEDAC_YEARS_3YR[-1]
DECADES = 3.5                    # 1990-2025

# CAMS EAC4 surface PM fields overestimate by ~2-3x in South Asia (known model bias).
# Correction factors derived by comparing CAMS 2020 annual means against:
#   - SEDAC satellite PM2.5 (independent ground-truth; CAMS/SEDAC ratio = 2.35 for Delhi)
#   - CPCB 2020 annual PM10 (~211 ug/m3 for Delhi)
# CO overestimate (~2x) is consistent with the general South Asia CAMS surface bias.
CAMS_PM25_BIAS = 0.43   # CAMS PM2.5 (kg/m3 x 1e9 x 0.43 -> ug/m3)
CAMS_PM10_BIAS = 0.60   # CAMS PM10 (kg/m3 x 1e9 x 0.60 -> ug/m3)
CAMS_CO_BIAS   = 0.50   # CAMS CO   (kg/kg x 1e6 x 0.50 -> ppm)

os.makedirs("data/output", exist_ok=True)

# ── CAMS variable map: filename prefix -> (nc var name, unit scale factor) ──
# Gas species (kg/kg mass mixing ratio): scale to ppb/ppm using naive x1e9/x1e6.
#   The naive formula gives rank-order correct values that align with CPCB references
#   (e.g. NO2 x1e9 = 44 ppb for Delhi vs CPCB ~40-50 ppb).
# PM species (kg/m3 volumetric): scale x1e9 then apply CAMS_PM*_BIAS correction.
# CO gets an additional CAMS_CO_BIAS correction (CAMS CO overestimates ~2x in South Asia).
CAMS_VARS = {
    "nitrogen_dioxide":   ("no2",  1e9),     # kg/kg -> ppb (naive)
    "sulphur_dioxide":    ("so2",  1e9),     # kg/kg -> ppb (informational only)
    "carbon_monoxide":    ("co",   1e6),     # kg/kg -> ppm (x CAMS_CO_BIAS applied below)
    "ozone":              ("go3",  1e9),     # kg/kg -> ppb
    "particulate_matter_2.5um": ("pm2p5", 1e9),  # kg/m3 -> ug/m3 (x CAMS_PM25_BIAS below)
    "particulate_matter_10um":  ("pm10",  1e9),  # kg/m3 -> ug/m3 (x CAMS_PM10_BIAS below)
}

print("Loading pincode coordinates...")
pc = pd.read_csv(PINCODE_CSV, dtype={"pincode": str})
# Normalise column names — raw CSV uses 'latitude'/'longitude', DB export uses 'lat'/'lng'
if "latitude" in pc.columns:
    pc = pc.rename(columns={"latitude": "lat", "longitude": "lng"})
if "district" in pc.columns and "district_name" not in pc.columns:
    pc = pc.rename(columns={"district": "district_name"})
if "statename" in pc.columns and "state_name" not in pc.columns:
    pc = pc.rename(columns={"statename": "state_name"})

# Filter to pincodes with valid lat/lng
pc = pc.dropna(subset=["lat", "lng"]).copy()

def to_float(val):
    """Convert decimal or DMS-like string to float, return NaN on failure."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return float("nan")

pc["lat"] = pc["lat"].apply(to_float)
pc["lng"] = pc["lng"].apply(to_float)
pc = pc.dropna(subset=["lat", "lng"]).copy()
# Drop rows with out-of-range coordinates (catches swapped lat/lng like pincode 785690)
valid_coords = (pc["lat"].abs() <= 90) & (pc["lng"].abs() <= 180)
dropped = (~valid_coords).sum()
if dropped:
    print(f"  Dropped {dropped} rows with invalid coordinates (swapped lat/lng)")
pc = pc[valid_coords].copy()
# Deduplicate pincodes (keep first valid occurrence)
pc = pc.drop_duplicates(subset=["pincode"]).reset_index(drop=True)
print(f"  {len(pc):,} pincodes with lat/lng")

lats = pc["lat"].values
lngs = pc["lng"].values
pincodes = pc["pincode"].values


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CAMS: extract recent annual mean at each pincode lat/lng
# ═══════════════════════════════════════════════════════════════════════════════

def extract_cams_var(var_prefix, nc_var, scale):
    """Return array of annual mean values for each pincode (recent years)."""
    annual_sums = np.zeros(len(pincodes), dtype=np.float64)
    count = 0
    for year in CAMS_YEARS_RECENT:
        pattern = os.path.join(CAMS_DIR, f"{var_prefix}_{year}.nc")
        files = glob.glob(pattern)
        if not files:
            continue
        ds = xr.open_dataset(files[0])
        da = ds[nc_var]
        # Squeeze out model_level if present
        if "model_level" in da.dims:
            da = da.isel(model_level=0)
        # Annual mean across months
        annual_mean = da.mean(dim="valid_time")   # (lat, lng)
        # Nearest-neighbour point extraction for all pincodes
        vals = annual_mean.sel(
            latitude=xr.DataArray(lats, dims="pts"),
            longitude=xr.DataArray(lngs, dims="pts"),
            method="nearest"
        ).values
        annual_sums += vals * scale
        count += 1
        ds.close()
    if count == 0:
        return np.zeros(len(pincodes))
    return annual_sums / count

print("Extracting CAMS variables...")
cams_results = {}
for prefix, (nc_var, scale) in CAMS_VARS.items():
    short = prefix.replace("particulate_matter_", "pm").replace("_dioxide", "").replace("_monoxide", "").replace("nitrogen", "no2").replace("sulphur", "so2").replace("carbon", "co").replace("ozone", "o3")
    # Cleaner key names
    key_map = {
        "nitrogen_dioxide": "no2_ppb",
        "sulphur_dioxide": "so2_ppb",
        "carbon_monoxide": "co_ppm",
        "ozone": "o3_ppb",
        "particulate_matter_2.5um": "pm25_cams_ug",
        "particulate_matter_10um": "pm10_cams_ug",
    }
    bias_map = {
        "particulate_matter_2.5um": CAMS_PM25_BIAS,
        "particulate_matter_10um":  CAMS_PM10_BIAS,
        "carbon_monoxide":          CAMS_CO_BIAS,
    }
    key = key_map[prefix]
    print(f"  {prefix} -> {key} ...", end=" ", flush=True)
    raw_vals = extract_cams_var(prefix, nc_var, scale)
    bias = bias_map.get(prefix, 1.0)
    cams_results[key] = raw_vals * bias
    print(f"done (min={cams_results[key].min():.2f}, max={cams_results[key].max():.2f})")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ERA5: heat wave days per year at each pincode
# ═══════════════════════════════════════════════════════════════════════════════

print("Extracting ERA5 heat wave days...")
ds_era5 = xr.open_dataset(ERA5_FILE)
t2m = ds_era5["t2m"]   # (time, lat, lng)

# Extract all months at all pincode points
t_vals = t2m.sel(
    latitude=xr.DataArray(lats, dims="pts"),
    longitude=xr.DataArray(lngs, dims="pts"),
    method="nearest"
).values  # shape: (n_months, n_pincodes)

# Count months >= threshold per year, average over all years
times = pd.to_datetime(t2m.valid_time.values)
years = times.year
unique_years = sorted(set(years))
heat_months_per_year = np.zeros(len(pincodes), dtype=np.float64)
for yr in unique_years:
    mask = years == yr
    hot_months = (t_vals[mask] >= HEAT_WAVE_THRESHOLD_K).sum(axis=0)
    heat_months_per_year += hot_months
heat_wave_days = heat_months_per_year / len(unique_years)  # avg hot months/year
ds_era5.close()
print(f"  done (min={heat_wave_days.min():.2f}, max={heat_wave_days.max():.2f})")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SEDAC: satellite PM2.5 annual mean at each pincode
# ═══════════════════════════════════════════════════════════════════════════════

print("Extracting SEDAC PM2.5 (full / 5yr / 3yr windows + trend)...")

def extract_sedac_mean(year_list):
    sums  = np.zeros(len(pincodes), dtype=np.float64)
    count = 0
    for year in year_list:
        pattern = os.path.join(SEDAC_DIR, f"*{year}-geotiff.tif")
        files = glob.glob(pattern)
        if not files:
            continue
        with rasterio.open(files[0]) as src:
            rows_arr, cols_arr = rowcol(src.transform, lngs, lats)
            rows_arr = np.clip(np.array(rows_arr), 0, src.height - 1)
            cols_arr = np.clip(np.array(cols_arr), 0, src.width - 1)
            band   = src.read(1)
            nodata = src.nodata
            vals   = band[rows_arr, cols_arr].astype(np.float64)
            if nodata is not None:
                vals[vals == nodata] = np.nan
            sums = np.where(np.isnan(vals), sums, sums + vals)
            count += 1
    return np.where(count > 0, sums / count, 0.0), count

pm25_sedac,      cnt_full = extract_sedac_mean(SEDAC_YEARS_RECENT)
pm25_sedac_5yr,  cnt_5yr  = extract_sedac_mean(SEDAC_YEARS_5YR)
pm25_sedac_3yr,  cnt_3yr  = extract_sedac_mean(SEDAC_YEARS_3YR)

# Trend: earliest year vs latest year in the 5yr window
pm25_earliest, _ = extract_sedac_mean([SEDAC_YEARS_5YR[0]])
pm25_latest,   _ = extract_sedac_mean([SEDAC_YEARS_5YR[-1]])

with np.errstate(invalid="ignore", divide="ignore"):
    pm25_trend_pct = np.where(
        pm25_earliest > 0,
        (pm25_latest - pm25_earliest) / pm25_earliest * 100,
        np.nan
    )

def _trend_dir(pct):
    if np.isnan(pct): return None
    if pct < -10:  return "improving"
    if pct > 10:   return "worsening"
    return "stable"

pm25_trend_dir = [_trend_dir(p) for p in pm25_trend_pct]

print(f"  full ({cnt_full} yrs): min={np.nanmin(pm25_sedac):.1f}, max={np.nanmax(pm25_sedac):.1f}")
print(f"  5yr  ({cnt_5yr} yrs):  min={np.nanmin(pm25_sedac_5yr):.1f}, max={np.nanmax(pm25_sedac_5yr):.1f}")
print(f"  3yr  ({cnt_3yr} yrs):  min={np.nanmin(pm25_sedac_3yr):.1f}, max={np.nanmax(pm25_sedac_3yr):.1f}")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. NFHS-5: join by district name, fallback to parent district map
# ═══════════════════════════════════════════════════════════════════════════════

print("Joining NFHS-5 health indicators...")

from parent_district_map import PARENT_MAP

def norm(s):
    if not isinstance(s, str): return ""
    import re
    return re.sub(r'[^a-z]', '', s.lower())

def norm_key(district, state):
    return f"{norm(district)}|{norm(state)}"

# Build canonical map from PARENT_MAP (key format: "NormDistrict|NormState")
parent_lookup = {}
for raw_key, parent_val in PARENT_MAP.items():
    d, s = raw_key.split("|")
    parent_lookup[norm_key(d, s)] = parent_val

# Alias map: pincode CSV name variants -> NFHS/EM-DAT names
# Format: norm_key(pincode_district, pincode_state) -> (nfhs_district, nfhs_state)
ALIAS_MAP = {
    # Karnataka - city renames
    "bengaluruurban|karnataka":         ("Bangalore", "Karnataka"),
    "bengalururural|karnataka":         ("BangaloreRural", "Karnataka"),
    # Maharashtra
    "mumbai|maharashtra":               ("MumbaiSuburban", "Maharashtra"),
    # Gujarat
    "ahmadabad|gujarat":                ("Ahmedabad", "Gujarat"),
    "panchmahals|gujarat":              ("Panchmahal", "Gujarat"),
    # Haryana
    "gurugram|haryana":                 ("Gurgaon", "Haryana"),
    # Delhi - state name variant (pincode says DELHI, NFHS says NctofDelhi)
    "northeast|delhi":                  ("NorthEast", "NctofDelhi"),
    "north|delhi":                      ("North", "NctofDelhi"),
    "northwest|delhi":                  ("NorthWest", "NctofDelhi"),
    "south|delhi":                      ("South", "NctofDelhi"),
    "newdelhi|delhi":                   ("NewDelhi", "NctofDelhi"),
    "west|delhi":                       ("West", "NctofDelhi"),
    "southwest|delhi":                  ("SouthWest", "NctofDelhi"),
    "shahdara|delhi":                   ("Shahdara", "NctofDelhi"),
    "east|delhi":                       ("East", "NctofDelhi"),
    "central|delhi":                    ("Central", "NctofDelhi"),
    "southeast|delhi":                  ("SouthEast", "NctofDelhi"),
    # Andaman - state name variant
    "southandamans|andamanandnicobarislands":        ("SouthAndaman", "AndamanandNicobar"),
    "northandmiddleandaman|andamanandnicobarislands": ("NorthandMiddleAndaman", "AndamanandNicobar"),
    "nicobars|andamanandnicobarislands":             ("NicobarIslands", "AndamanandNicobar"),
    # Telangana - Warangal split
    "warangal|telangana":               ("WarangalUrban", "Telangana"),
    "hanumakonda|telangana":            ("WarangalUrban", "Telangana"),  # Hanamkonda = old Warangal Urban
    # West Bengal - 24 Paraganas
    "paraganassouth|westbengal":        ("South24Parganas", "WestBengal"),
    "paraganasnorth|westbengal":        ("North24Parganas", "WestBengal"),
    "alipurduar|westbengal":            ("Jalpaiguri", "WestBengal"),    # carved from Jalpaiguri 2014
    # J&K - state name variant
    "baramulla|jammuandkashmir":        ("Baramula", "JammuandKashmir"),
    "bandipora|jammuandkashmir":        ("Bandipore", "JammuandKashmir"),
    "poonch|jammuandkashmir":           ("Punch", "JammuandKashmir"),
    # UT name variants
    "daman|thedadraandnagarhavelianddamananddiu":  ("Daman", "DamanandDiu"),
    "diu|thedadraandnagarhavelianddamananddiu":    ("Diu", "DamanandDiu"),
    "dadraandnagarhaveli|thedadraandnagarhavelianddamananddiu": ("DadraandNagarHaveli", "DadraandNagarHaveli"),
    # Others
    "spsrnellore|andhrapradesh":        ("Nellore", "AndhraPradesh"),
    "gurdaspur|punjab":                 ("Gurdaspur", "Punjab"),
}

nfhs = None
nfhs_cols = ["hypertension_pct","diabetes_pct","obesity_pct","tobacco_use_pct","anaemia_pct"]
if os.path.exists(NFHS_CSV):
    nfhs = pd.read_csv(NFHS_CSV)
    # Build lookup: normed_key -> row
    nfhs["_key"] = nfhs.apply(lambda r: norm_key(r["district_name"], r["state_name"]), axis=1)
    nfhs_dict = nfhs.set_index("_key")[nfhs_cols].to_dict("index")
    print(f"  Loaded {len(nfhs)} NFHS districts")
else:
    nfhs_dict = {}
    print("  NFHS CSV not found, all health columns will be null")

def get_nfhs(district, state):
    k = norm_key(district, state)
    if k in nfhs_dict:
        return nfhs_dict[k]
    # Try alias map (name variants between pincode CSV and NFHS)
    if k in ALIAS_MAP:
        alias_d, alias_s = ALIAS_MAP[k]
        ak = norm_key(alias_d, alias_s)
        if ak in nfhs_dict:
            return nfhs_dict[ak]
    # Try parent map
    parent = parent_lookup.get(k)
    if parent:
        pk = norm_key(parent, state)
        if pk in nfhs_dict:
            return nfhs_dict[pk]
        # Also try parent in aliased state
        if k in ALIAS_MAP:
            _, alias_s = ALIAS_MAP[k]
            pk2 = norm_key(parent, alias_s)
            if pk2 in nfhs_dict:
                return nfhs_dict[pk2]
    return {c: None for c in nfhs_cols}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. EM-DAT: join disaster scores by district, fallback to parent
# ═══════════════════════════════════════════════════════════════════════════════

print("Joining EM-DAT disaster scores...")
emdat_cols = ["flood_events_per_decade","cyclone_events_per_decade",
              "earthquake_events_per_decade","disaster_insurance_loss_cr",
              "disaster_frequency_score"]
emdat_dict = {}
if os.path.exists(EMDAT_CSV):
    emdat = pd.read_csv(EMDAT_CSV)
    emdat["_key"] = emdat.apply(lambda r: norm_key(r["district_name"], r["state_name"]), axis=1)
    emdat_dict = emdat.set_index("_key")[emdat_cols].to_dict("index")
    print(f"  Loaded {len(emdat)} EM-DAT districts")
else:
    print("  EM-DAT CSV not found, disaster columns will be null")

def get_emdat(district, state):
    k = norm_key(district, state)
    if k in emdat_dict:
        return emdat_dict[k]
    # Try alias map
    if k in ALIAS_MAP:
        alias_d, alias_s = ALIAS_MAP[k]
        ak = norm_key(alias_d, alias_s)
        if ak in emdat_dict:
            return emdat_dict[ak]
    # Try parent map
    parent = parent_lookup.get(k)
    if parent:
        pk = norm_key(parent, state)
        if pk in emdat_dict:
            return emdat_dict[pk]
        if k in ALIAS_MAP:
            _, alias_s = ALIAS_MAP[k]
            pk2 = norm_key(parent, alias_s)
            if pk2 in emdat_dict:
                return emdat_dict[pk2]
    return {c: None for c in emdat_cols}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Composite risk score per pincode
# ═══════════════════════════════════════════════════════════════════════════════

def aqi_score_from_pm25(pm25):
    """Score 0-10 based on PM2.5 ug/m3 (WHO guidelines: 5 annual mean)."""
    if pm25 is None or np.isnan(pm25): return 5.0
    # 0=clean(<=5), 10=severe(>=150)
    return round(min(float(pm25) / 150 * 10, 10.0), 2)

def no2_score(no2_ppb):
    """Score 0-10, WHO guideline 10 ppb annual."""
    if no2_ppb is None or np.isnan(no2_ppb): return 5.0
    return round(min(float(no2_ppb) / 50 * 10, 10.0), 2)

def heat_score(hw_days):
    """Score 0-10 from heat wave months/year."""
    if hw_days is None or np.isnan(hw_days): return 5.0
    return round(min(float(hw_days) / 4 * 10, 10.0), 2)

def disease_score(hyp, diab, obes):
    """Score 0-10 from NFHS health burden."""
    vals = [v for v in [hyp, diab, obes] if v is not None]
    if not vals: return 5.0
    avg = np.mean(vals)
    return round(min(avg / 40 * 10, 10.0), 2)

def disaster_score(freq_score):
    if freq_score is None: return 0.0
    return round(float(freq_score), 2)


# ── Weights (same as district_risk_index) ─────────────────────────────────────
W_PM25     = 0.30
W_AQI      = 0.20
W_DISASTER = 0.15
W_DISEASE  = 0.15
W_NO2      = 0.10
W_HEAT     = 0.10


print("Building pincode risk index...")
rows_out = []
nfhs_miss = 0
emdat_miss = 0

for i, (pincode, lat, lng, district, state) in enumerate(
    zip(pincodes, lats, lngs,
        pc["district_name"].values, pc["state_name"].values)
):
    no2   = cams_results["no2_ppb"][i]
    pm25c = cams_results["pm25_cams_ug"][i]
    pm10c = cams_results["pm10_cams_ug"][i]
    so2   = cams_results["so2_ppb"][i]
    co    = cams_results["co_ppm"][i]
    o3    = cams_results["o3_ppb"][i]
    hw    = heat_wave_days[i]
    pm25s      = pm25_sedac[i]
    pm25s_5yr  = pm25_sedac_5yr[i]
    pm25s_3yr  = pm25_sedac_3yr[i]
    pm25_tpct  = pm25_trend_pct[i]
    pm25_tdir  = pm25_trend_dir[i]

    # Blended PM2.5: SEDAC preferred, CAMS fallback
    pm25_final     = pm25s     if pm25s     > 0 else pm25c
    pm25_final_5yr = pm25s_5yr if pm25s_5yr > 0 else pm25c
    pm25_final_3yr = pm25s_3yr if pm25s_3yr > 0 else pm25c

    # NFHS + EM-DAT
    nfhs_row  = get_nfhs(district, state)
    emdat_row = get_emdat(district, state)
    if nfhs_row["hypertension_pct"] is None:
        nfhs_miss += 1
    if emdat_row["disaster_frequency_score"] is None:
        emdat_miss += 1

    hyp  = nfhs_row.get("hypertension_pct")
    diab = nfhs_row.get("diabetes_pct")
    obes = nfhs_row.get("obesity_pct")
    freq = emdat_row.get("disaster_frequency_score")

    s_pm25     = aqi_score_from_pm25(pm25_final)
    s_aqi      = aqi_score_from_pm25(pm10c * 0.6) if pm10c > 0 else s_pm25 * 0.8
    s_no2      = no2_score(no2)
    s_heat     = heat_score(hw)
    s_disease  = disease_score(hyp, diab, obes)
    s_disaster = disaster_score(freq)

    composite = round(
        s_pm25 * W_PM25 +
        s_aqi  * W_AQI  +
        s_disaster * W_DISASTER +
        s_disease  * W_DISEASE +
        s_no2  * W_NO2 +
        s_heat * W_HEAT,
        2
    )

    risk_tier = (
        "very_high" if composite >= 7.5 else
        "high"      if composite >= 5.5 else
        "moderate"  if composite >= 3.5 else
        "low"
    )

    rows_out.append({
        "pincode":                    pincode,
        "district_name":              district,
        "state_name":                 state,
        "lat":                        round(lat, 6),
        "lng":                        round(lng, 6),
        # Air quality
        "no2_ppb":                    round(float(no2), 3),
        "so2_ppb":                    round(float(so2), 3),
        "co_ppm":                     round(float(co), 3),
        "o3_ppb":                     round(float(o3), 3),
        "pm25_cams_ug":               round(float(pm25c), 2),
        "pm10_cams_ug":               round(float(pm10c), 2),
        "pm25_sedac_ug":              round(float(pm25s), 2),
        "pm25_blended_ug":            round(float(pm25_final), 2),
        "pm25_blended_3yr_ug":        round(float(pm25_final_3yr), 2),
        "pm25_trend_5yr_pct":         round(float(pm25_tpct), 2) if not np.isnan(pm25_tpct) else None,
        "pm25_trend_direction":       pm25_tdir,
        "pm25_3yr_from_year":         PM25_3YR_FROM,
        "pm25_3yr_to_year":           PM25_3YR_TO,
        "pm25_5yr_from_year":         PM25_5YR_FROM,
        "pm25_5yr_to_year":           PM25_5YR_TO,
        # Climate
        "heat_wave_months_per_year":  round(float(hw), 2),
        # NFHS health burden
        "hypertension_pct":           hyp,
        "diabetes_pct":               diab,
        "obesity_pct":                obes,
        "tobacco_use_pct":            nfhs_row.get("tobacco_use_pct"),
        "anaemia_pct":                nfhs_row.get("anaemia_pct"),
        # Disaster
        "flood_events_per_decade":    emdat_row.get("flood_events_per_decade"),
        "cyclone_events_per_decade":  emdat_row.get("cyclone_events_per_decade"),
        "earthquake_events_per_decade": emdat_row.get("earthquake_events_per_decade"),
        "disaster_insurance_loss_cr": emdat_row.get("disaster_insurance_loss_cr"),
        "disaster_frequency_score":   freq,
        # Composite
        "composite_risk_score":       composite,
        "risk_tier":                  risk_tier,
        # Component scores (for transparency)
        "score_pm25":                 s_pm25,
        "score_aqi":                  s_aqi,
        "score_no2":                  s_no2,
        "score_heat":                 s_heat,
        "score_disease":              s_disease,
        "score_disaster":             s_disaster,
    })

from scipy.stats import percentileofscore

out = pd.DataFrame(rows_out)

# National percentile ranks across all pincodes
print("Computing national percentile ranks ...")
pm25_all       = out["pm25_blended_ug"].fillna(0).values
composite_all  = out["composite_risk_score"].fillna(0).values

out["pm25_national_pctile"] = [
    round(percentileofscore(pm25_all, v, kind="rank"), 1)
    for v in pm25_all
]
out["composite_national_pctile"] = [
    round(percentileofscore(composite_all, v, kind="rank"), 1)
    for v in composite_all
]

out.to_csv(OUT_PATH, index=False)

print(f"\nDone. {len(out):,} pincodes -> {OUT_PATH}")
print(f"  NFHS not found for {nfhs_miss:,} pincodes ({nfhs_miss/len(out)*100:.1f}%)")
print(f"  EM-DAT not found for {emdat_miss:,} pincodes ({emdat_miss/len(out)*100:.1f}%)")
print()
print("Risk tier distribution:")
print(out["risk_tier"].value_counts())
print()
print("Composite score stats:")
print(out["composite_risk_score"].describe())
print()
print("Top 10 highest risk pincodes:")
print(out.nlargest(10, "composite_risk_score")[
    ["pincode","district_name","state_name","pm25_blended_ug","composite_risk_score","risk_tier"]
].to_string())
