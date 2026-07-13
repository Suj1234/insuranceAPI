"""
scripts/build_district_air_quality.py

Merge all sources -> district_air_quality table CSV with AQI sub-indices.

Input:  data/output/district_pm25_sedac_1998_2022.csv
        data/output/district_monthly_cpcb_2015_2025.csv
        data/output/district_monthly_cams_2003_2025.csv
        data/output/pm25_bias_factors.csv
Output: data/output/district_air_quality_final.csv

Load into DB after this script:
  psql $DATABASE_URL -c "\COPY district_air_quality FROM 'data/output/district_air_quality_final.csv' CSV HEADER"
"""
import os
import pandas as pd
import numpy as np

SEDAC_CSV = "data/output/district_pm25_sedac_2000_2022.csv"
CPCB_CSV  = "data/output/district_monthly_cpcb_2015_2025.csv"
CAMS_CSV  = "data/output/district_monthly_cams_2003_2025.csv"
BIAS_CSV  = "data/output/pm25_bias_factors.csv"
OUT_PATH  = "data/output/district_air_quality_final.csv"

os.makedirs("data/output", exist_ok=True)

# ── AQI sub-index functions (CPCB breakpoints) ──────────────────────────────

def _interpolate(c, breakpoints):
    for bplo, bphi, ilo, ihi in breakpoints:
        if bplo <= c <= bphi:
            return round(((ihi - ilo) / (bphi - bplo)) * (c - bplo) + ilo, 2)
    return 500.0

def pm25_subindex(c):
    if pd.isna(c): return None
    bp = [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)]
    return _interpolate(c, bp)

def pm10_subindex(c):
    if pd.isna(c): return None
    bp = [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)]
    return _interpolate(c, bp)

def no2_subindex(c):
    if pd.isna(c): return None
    bp = [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,1000,401,500)]
    return _interpolate(c, bp)

def so2_subindex(c):
    if pd.isna(c): return None
    bp = [(0,40,0,50),(40,80,51,100),(80,380,101,200),(380,800,201,300),(800,1600,301,400),(1600,3000,401,500)]
    return _interpolate(c, bp)

def co_subindex(c):
    if pd.isna(c): return None
    bp = [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,100,401,500)]
    return _interpolate(c, bp)

def o3_subindex(c):
    if pd.isna(c): return None
    bp = [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1200,401,500)]
    return _interpolate(c, bp)

def aqi_category(aqi):
    if pd.isna(aqi): return None
    if aqi <= 50:  return "Good"
    if aqi <= 100: return "Satisfactory"
    if aqi <= 200: return "Moderate"
    if aqi <= 300: return "Poor"
    if aqi <= 400: return "Very Poor"
    return "Severe"

# ── Load sources ─────────────────────────────────────────────────────────────

print("Loading sources ...")
sedac = pd.read_csv(SEDAC_CSV)
cams  = pd.read_csv(CAMS_CSV,  low_memory=False)

# ── Base = CAMS (widest coverage 2003–2025, all pollutants) ─────────────────
base = cams.copy()

# Add CPCB values where available (optional — skipped if not present)
if os.path.exists(CPCB_CSV):
    cpcb = pd.read_csv(CPCB_CSV, low_memory=False)
    cpcb_cols = ["district_name", "state_name", "year", "month",
                 "pm25_raw_cpcb", "pm10_raw_cpcb"]
    cpcb_cols = [c for c in cpcb_cols if c in cpcb.columns]
    base = base.merge(cpcb[cpcb_cols], on=["district_name", "state_name", "year", "month"], how="left")
    print("  CPCB data merged.")
else:
    print("  CPCB CSV not found — skipping CPCB columns")
    base["pm25_raw_cpcb"] = None
    base["pm10_raw_cpcb"] = None

# Add SEDAC annual PM2.5 (broadcast to all 12 months of that year)
sedac_annual = sedac[["district_name", "state_name", "year", "pm25_sedac_raw"]].copy()
base = base.merge(sedac_annual, on=["district_name", "state_name", "year"], how="left")

# Add bias factors (optional — use 1.0 if not present)
if os.path.exists(BIAS_CSV):
    bias = pd.read_csv(BIAS_CSV)
    base = base.merge(
        bias[["district_name", "state_name", "final_bias_factor"]],
        on=["district_name", "state_name"], how="left"
    )
    print("  Bias factors merged.")
else:
    print("  Bias CSV not found — using bias factor = 1.0 (no CPCB calibration)")
    base["final_bias_factor"] = None
base["final_bias_factor"] = base["final_bias_factor"].fillna(1.0)

# ── Calibrated PM2.5 ─────────────────────────────────────────────────────────

print("Computing calibrated PM2.5 ...")

def get_pm25_calibrated(row):
    if pd.notna(row.get("pm25_raw_cpcb")) and row["year"] >= 2015:
        return row["pm25_raw_cpcb"], "cpcb_direct", None
    if pd.notna(row.get("pm25_sedac_raw")):
        calibrated = row["pm25_sedac_raw"] * row["final_bias_factor"]
        return calibrated, "sedac_calibrated", row["final_bias_factor"]
    if pd.notna(row.get("pm25_raw_cams")):
        return row["pm25_raw_cams"], "cams_gap_fill", None
    return None, "missing", None

results = base.apply(lambda r: pd.Series(get_pm25_calibrated(r)), axis=1)
base[["pm25_calibrated", "pm25_source", "pm25_bias_factor"]] = results

# PM10 calibrated: CPCB preferred, CAMS fallback
base["pm10_calibrated"] = base.get("pm10_raw_cpcb", pd.Series(dtype=float)).combine_first(
    base.get("pm10_raw_cams", pd.Series(dtype=float))
)
base["pm10_source"] = base.apply(
    lambda r: "cpcb_direct" if pd.notna(r.get("pm10_raw_cpcb")) else "cams_gap_fill",
    axis=1
)

# ── AQI sub-indices ──────────────────────────────────────────────────────────

print("Computing AQI sub-indices ...")
base["aqi_pm25_subindex"] = base["pm25_calibrated"].apply(pm25_subindex)
base["aqi_pm10_subindex"] = base["pm10_calibrated"].apply(pm10_subindex)
base["aqi_no2_subindex"]  = base.get("no2_cams",      pd.Series(dtype=float)).apply(no2_subindex)
base["aqi_so2_subindex"]  = base.get("so2_cams",      pd.Series(dtype=float)).apply(so2_subindex)
base["aqi_co_subindex"]   = base.get("co_cams",       pd.Series(dtype=float)).apply(co_subindex)
base["aqi_o3_subindex"]   = base.get("o3_cams",       pd.Series(dtype=float)).apply(o3_subindex)

subindex_cols = ["aqi_pm25_subindex","aqi_pm10_subindex","aqi_no2_subindex",
                 "aqi_so2_subindex","aqi_co_subindex","aqi_o3_subindex"]
pollutant_names = ["pm25","pm10","no2","so2","co","o3"]

base["aqi_representative"]     = base[subindex_cols].max(axis=1)
base["aqi_limiting_pollutant"] = (
    base[subindex_cols]
    .idxmax(axis=1)
    .str.replace("aqi_", "")
    .str.replace("_subindex", "")
)
base["aqi_category"] = base["aqi_representative"].apply(aqi_category)

# Cap AQI at 500
base["aqi_representative"] = base["aqi_representative"].clip(upper=500)

# ── Rename columns to match DB schema ────────────────────────────────────────

rename = {
    "pm25_sedac_raw": "pm25_raw_sedac",
}
base = base.rename(columns=rename)

# Select only DB columns
db_cols = [
    "district_name", "state_name", "district_code", "year", "month",
    "pm25_raw_sedac", "pm25_raw_cpcb", "pm25_raw_cams",
    "pm25_calibrated", "pm25_source", "pm25_bias_factor",
    "pm10_raw_cpcb", "pm10_raw_cams", "pm10_calibrated", "pm10_source",
    "no2_cams", "no2_source",
    "so2_cams", "so2_source",
    "co_cams",  "co_source",
    "o3_cams",  "o3_source",
    "aqi_pm25_subindex", "aqi_pm10_subindex", "aqi_no2_subindex",
    "aqi_so2_subindex",  "aqi_co_subindex",   "aqi_o3_subindex",
    "aqi_representative", "aqi_limiting_pollutant", "aqi_category",
]
available = [c for c in db_cols if c in base.columns]
out = base[available].copy()

# Drop rows where pm25_calibrated is still missing
out = out[out["pm25_calibrated"].notna()]

out.to_csv(OUT_PATH, index=False)
print(f"Done. {len(out):,} district-month records -> {OUT_PATH}")
print(f"  Sources breakdown:\n{out['pm25_source'].value_counts()}")
