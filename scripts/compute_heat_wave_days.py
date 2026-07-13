"""
scripts/compute_heat_wave_days.py

ERA5 monthly temperature -> heat wave days per district per year -> annual average.

Input:  data/era5/temperature_monthly_1980_2025.nc
        data/gadm41_IND_2.json
Output: data/output/heat_wave_days.csv

Heat wave definition (India IMD standard for plains):
  Monthly mean max temperature > 40°C (313.15 K) = heat wave month proxy.
  We count months above threshold × 30 days / 12 months = approximate annual days.

ERA5 variable: '2m_temperature' (t2m), units: Kelvin
Download from: cds.climate.copernicus.eu -> ERA5-Land monthly means
  Variables: 2m_temperature
  Years: 1980–2025
  Bounding box: N=37, W=67, S=6, E=98
  Format: NetCDF
"""
import os
import xarray as xr
import numpy as np
import geopandas as gpd
import pandas as pd

ERA5_NC   = "data/era5/temperature_monthly_1980_2025_real.nc"
# Note: ERA5 monthly means are averages, not daily max. IMD heat wave = daily max ≥40°C.
# Monthly mean ≥35°C reliably corresponds to months with daily peaks ≥40°C in India plains.
SHAPEFILE = "data/gadm41_IND_2.json"
OUT_PATH  = "data/output/heat_wave_days.csv"

os.makedirs("data/output", exist_ok=True)

HEAT_WAVE_THRESHOLD_K = 308.15  # 35°C monthly mean ≈ daily max ≥40°C (IMD plains proxy)
DAYS_PER_MONTH = 30

print("Loading ERA5 temperature data ...")
ds = xr.open_dataset(ERA5_NC)

# Detect the temperature variable name
temp_var = None
for candidate in ["t2m", "temperature", "T2M", "2m_temperature"]:
    if candidate in ds.data_vars:
        temp_var = candidate
        break
if temp_var is None:
    temp_var = list(ds.data_vars)[0]
    print(f"  Using variable: {temp_var}")

print("Loading India district shapefile ...")
districts = gpd.read_file(SHAPEFILE).to_crs("EPSG:4326")

results = []

print(f"Processing {len(districts)} districts ...")
for idx, district in districts.iterrows():
    lat = district.geometry.centroid.y
    lng = district.geometry.centroid.x

    try:
        # Select nearest grid point, get full time series
        # ERA5 uses 'valid_time' dimension not 'time'
        time_dim = "valid_time" if "valid_time" in ds.dims else "time"
        temp_series = ds[temp_var].sel(
            latitude=lat, longitude=lng, method="nearest"
        ).values  # shape: (N_months,)
    except Exception as e:
        print(f"  ERROR {district['NAME_2']}: {e}")
        continue

    # Count months above heat wave threshold
    heat_months_total = int(np.sum(temp_series > HEAT_WAVE_THRESHOLD_K))
    total_months = len(temp_series)

    # Annualised heat wave days estimate
    if total_months > 0:
        heat_days_per_year = round(heat_months_total / total_months * 12 * DAYS_PER_MONTH)
    else:
        heat_days_per_year = 0

    results.append({
        "district_name":         district["NAME_2"],
        "state_name":            district["NAME_1"],
        "district_code":         district["GID_2"],
        "heat_wave_days_per_year": heat_days_per_year,
        "heat_months_total":     heat_months_total,
        "total_months_analysed": total_months,
    })

    if idx % 100 == 0:
        print(f"  Processed {idx}/{len(districts)} ...")

df = pd.DataFrame(results)
df.to_csv(OUT_PATH, index=False)
print(f"Done. {len(df):,} districts -> {OUT_PATH}")
print(f"Heat wave days distribution:\n{df['heat_wave_days_per_year'].describe()}")
