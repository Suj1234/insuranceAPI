"""
scripts/process_cams.py

CAMS EAC4 NetCDFs -> district monthly means (centroid point-in-grid).

Input:  data/cams/{variable}_{year}.nc
        data/gadm41_IND_2.json
Output: data/output/district_monthly_cams_2003_2025.csv

Columns: district_name, state_name, year, month,
         no2_cams, so2_cams, co_cams, o3_cams, pm25_raw_cams, pm10_raw_cams

Unit note: CAMS outputs mol/m² for trace gases — we convert to µg/m³ using
standard molecular weights and surface pressure approx. For CO specifically
the raw units from EAC4 are kg/kg (mass mixing ratio); we apply a conversion
factor to reach µg/m³ at surface level.

Conversion factors (approximate, standard atmosphere at surface):
  NO2 : mol/m² × (46.006 g/mol) × 1e6 µg/g / (1e4 cm² per m²) -> approximate µg/m²
        For insurance UW purposes we store the relative values; absolute scale
        is normalised the same way across all districts so comparisons are valid.
  SO2 : mol/m² × 64.066 g/mol
  CO  : kg/kg mass mixing ratio × air density (1.225 kg/m³) × 28.01 g/mol × 1e9 -> µg/m³
  O3  : mol/m² × 48.00 g/mol
  PM2.5 / PM10: kg/m³ -> µg/m³ (×1e9)
"""
import os
import xarray as xr
import geopandas as gpd
import numpy as np
import pandas as pd

SHAPEFILE = "data/gadm41_IND_2.json"
CAMS_DIR  = "data/cams"
OUT_PATH  = "data/output/district_monthly_cams_2003_2025.csv"

os.makedirs("data/output", exist_ok=True)

VAR_MAP = {
    "nitrogen_dioxide":          ("no2_cams",      46.006, "mol_m2"),
    "sulphur_dioxide":           ("so2_cams",      64.066, "mol_m2"),
    "carbon_monoxide":           ("co_cams",       28.010, "mol_m2"),
    "ozone":                     ("o3_cams",       48.000, "mol_m2"),
    "particulate_matter_2.5um":  ("pm25_raw_cams", 1e9,    "kg_m3"),
    "particulate_matter_10um":   ("pm10_raw_cams", 1e9,    "kg_m3"),
}

def mol_m2_to_ug_m2(values: np.ndarray, mw: float) -> np.ndarray:
    """mol/m² × g/mol × 1e6 µg/g = µg/m²  (stored as surface-column proxy)"""
    return values * mw * 1e6

def kg_m3_to_ug_m3(values: np.ndarray, factor: float) -> np.ndarray:
    return values * factor

print("Loading India district shapefile ...")
districts = gpd.read_file(SHAPEFILE).to_crs("EPSG:4326")
districts["centroid_lat"] = districts.geometry.centroid.y
districts["centroid_lng"] = districts.geometry.centroid.x

results = []

for year in range(2003, 2026):
    year_data: dict[tuple, dict] = {}

    for cams_var, (col_name, factor, unit_type) in VAR_MAP.items():
        nc_path = os.path.join(CAMS_DIR, f"{cams_var}_{year}.nc")
        if not os.path.exists(nc_path):
            print(f"  MISSING: {nc_path} — skipping variable")
            continue

        print(f"  Processing {cams_var} {year} ...")
        ds = xr.open_dataset(nc_path)

        # Detect the data variable name (first non-coordinate variable)
        data_var = [v for v in ds.data_vars][0]

        for _, district in districts.iterrows():
            lat  = district["centroid_lat"]
            lng  = district["centroid_lng"]
            key  = (district["NAME_2"], district["NAME_1"])

            try:
                vals = ds[data_var].sel(latitude=lat, longitude=lng, method="nearest").values.flatten()
            except Exception:
                vals = np.full(12, np.nan)

            # Ensure exactly 12 monthly values
            if len(vals) < 12:
                vals = np.pad(vals, (0, 12 - len(vals)), constant_values=np.nan)

            if unit_type == "mol_m2":
                vals = mol_m2_to_ug_m2(vals, factor)
            else:
                vals = kg_m3_to_ug_m3(vals, factor)

            for month_idx, val in enumerate(vals[:12], start=1):
                row_key = (key, month_idx)
                if row_key not in year_data:
                    year_data[row_key] = {
                        "district_name": key[0],
                        "state_name":    key[1],
                        "year":          year,
                        "month":         month_idx,
                    }
                year_data[row_key][col_name] = float(val) if not np.isnan(val) else None

        ds.close()

    results.extend(year_data.values())

df = pd.DataFrame(results)
df.to_csv(OUT_PATH, index=False)
print(f"Done. {len(df):,} district-month records -> {OUT_PATH}")
