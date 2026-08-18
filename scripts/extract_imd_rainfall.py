"""
Download IMD 0.25° gridded daily rainfall (1981-2020) and compute per-pincode stats.

NO REGISTRATION OR EMAIL REQUIRED.
Uses imdlib which downloads directly from imdpune.gov.in.

Install: pip install imdlib scipy

Output: data/flood/gee_outputs/imd_rainfall.csv
Columns: pincode, imd_annual_rainfall_mm, imd_extreme_rain_days_per_yr

Data: 40 years × ~25 MB = ~1 GB total download (downloads year-by-year)
Runtime: ~45-60 min (download + processing)
"""

import os
import numpy as np
import pandas as pd
import imdlib

try:
    from scipy.interpolate import RegularGridInterpolator
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("WARNING: pip install scipy  (needed for bilinear interpolation)")

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)

PINCODE_CSV  = os.path.join(_ROOT, "data/output/pincode_coords.csv")
IMD_DIR      = os.path.join(_ROOT, "data/flood/imd")     # imdlib CWD — creates rain/ here
IMD_RAIN_DIR = os.path.join(_ROOT, "data/flood/imd/rain") # where imdlib saves {year}.grd
OUTPUT_CSV   = os.path.join(_ROOT, "data/flood/gee_outputs/imd_rainfall.csv")

CLIMATOLOGY_START = 1981
CLIMATOLOGY_END   = 2020
EXTREME_THRESHOLD = 100.0  # mm/day — IMD "heavy rainfall" threshold

# IMD grid definition (fixed for 0.25° rainfall product)
LAT_START, LAT_END, LAT_STEP = 6.5,  38.5, 0.25
LON_START, LON_END, LON_STEP = 66.5, 100.0, 0.25
GRID_LATS = np.arange(LAT_START, LAT_END + LAT_STEP, LAT_STEP)
GRID_LONS = np.arange(LON_START, LON_END + LON_STEP, LON_STEP)

def download_year(year):
    """Download one year of daily rainfall. imdlib saves to imd/rain/{year}.grd."""
    # imdlib creates a rain/ subdirectory under its CWD
    cached = os.path.join(IMD_RAIN_DIR, f"{year}.grd")
    if os.path.exists(cached):
        return True
    print(f"  Downloading {year}...", end=" ", flush=True)
    orig_cwd = os.getcwd()
    try:
        os.chdir(IMD_DIR)
        imdlib.get_data("rain", year, year, fn_format="yearwise")
        print("OK")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False
    finally:
        os.chdir(orig_cwd)

def load_year(year):
    """Load one year as numpy array (days, lat=129, lon=135) from raw binary file.
    Reads directly — no imdlib network call, no Fortran markers to strip."""
    cached = os.path.join(IMD_RAIN_DIR, f"{year}.grd")
    if not os.path.exists(cached):
        return None
    raw = np.fromfile(cached, dtype=np.float32)
    days = len(raw) // (129 * 135)
    if days == 0:
        return None
    data = raw[:days * 129 * 135].reshape(days, 129, 135)
    return np.where(data < 0, 0.0, data)  # fill -999 (ocean/missing) with 0

def interpolate_at_points(grid_2d, lats, lons, target_lats, target_lons):
    """Bilinear interpolation of 2D grid at multiple (lat, lon) points."""
    if HAS_SCIPY:
        interp = RegularGridInterpolator(
            (lats, lons), grid_2d,
            method="linear", bounds_error=False, fill_value=0.0
        )
        return interp(list(zip(target_lats, target_lons)))
    else:
        # Nearest-neighbor fallback
        results = []
        for lat, lon in zip(target_lats, target_lons):
            li = np.argmin(np.abs(lats - lat))
            loi = np.argmin(np.abs(lons - lon))
            results.append(float(grid_2d[li, loi]))
        return np.array(results)

def main():
    os.makedirs(IMD_DIR, exist_ok=True)
    os.makedirs(os.path.join(_ROOT, "data/flood/gee_outputs"), exist_ok=True)

    pincodes = pd.read_csv(PINCODE_CSV)
    pincodes["lat"] = pd.to_numeric(pincodes["latitude"], errors="coerce")
    pincodes["lng"] = pd.to_numeric(pincodes["longitude"], errors="coerce")
    pincodes = pincodes[pincodes["lat"].between(6.0, 38.0) & pincodes["lng"].between(67.0, 99.0)]
    pincodes = pincodes.drop_duplicates(subset=["pincode"])
    pin_ids  = pincodes["pincode"].astype(str).values
    lats     = pincodes["lat"].values.astype(np.float32)
    lons     = pincodes["lng"].values.astype(np.float32)
    n        = len(pincodes)
    print(f"Pincodes to process: {n:,}")

    # Accumulators
    annual_total_sum  = np.zeros(n, dtype=np.float64)
    extreme_days_sum  = np.zeros(n, dtype=np.float64)
    years_processed   = 0

    years = list(range(CLIMATOLOGY_START, CLIMATOLOGY_END + 1))
    print(f"\nDownloading and processing {len(years)} years ({CLIMATOLOGY_START}–{CLIMATOLOGY_END})...")

    for year in years:
        ok = download_year(year)
        if not ok:
            print(f"  Skipping {year}")
            continue

        data = load_year(year)
        if data is None:
            continue

        # data shape: (days, lat=129, lon=135) — lat is dim 1, lon is dim 2
        annual_sum   = data.sum(axis=0)                        # (lat=129, lon=135)
        extreme_days = (data > EXTREME_THRESHOLD).sum(axis=0)  # (lat=129, lon=135)

        annual_vals  = interpolate_at_points(annual_sum,   GRID_LATS, GRID_LONS, lats, lons)
        extreme_vals = interpolate_at_points(extreme_days, GRID_LATS, GRID_LONS, lats, lons)

        annual_total_sum += annual_vals
        extreme_days_sum += extreme_vals
        years_processed  += 1
        print(f"  {year}: done ({years_processed}/{len(years)})")

    if years_processed == 0:
        print("No years processed — cannot generate output.")
        return

    df = pd.DataFrame({
        "pincode": pin_ids,
        "imd_annual_rainfall_mm":      np.round(annual_total_sum / years_processed, 1),
        "imd_extreme_rain_days_per_yr": np.round(extreme_days_sum / years_processed, 2),
    })
    df.to_csv(OUTPUT_CSV, index=False)

    print(f"\nDone. {len(df):,} pincodes -> {OUTPUT_CSV}")
    print(f"Years processed: {years_processed}")
    print(f"Max annual rainfall:   {df['imd_annual_rainfall_mm'].max():.0f} mm  ({df.loc[df['imd_annual_rainfall_mm'].idxmax(), 'pincode']})")
    print(f"Max extreme days/yr:   {df['imd_extreme_rain_days_per_yr'].max():.0f}  (pincode {df.loc[df['imd_extreme_rain_days_per_yr'].idxmax(), 'pincode']})")
    print(f"Pincodes >100 days/yr: {(df['imd_extreme_rain_days_per_yr'] > 100).sum():,}")

if __name__ == "__main__":
    main()
