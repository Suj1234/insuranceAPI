"""
scripts/download_cams.py

Pull CAMS EAC4 monthly reanalysis NetCDFs for NO2, SO2, CO, O3, PM2.5, PM10.

Pre-requisite:
  pip install cdsapi
  ~/.cdsapirc must exist with ADS credentials

Downloads to: data/cams/{variable}_{year}.nc

India bounding box: N=37, W=67, S=6, E=98
"""
import os
import urllib3
import cdsapi

urllib3.disable_warnings()
os.makedirs("data/cams", exist_ok=True)

VARIABLES = [
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "carbon_monoxide",
    "ozone",
    "particulate_matter_2.5um",
    "particulate_matter_10um",
]

c = cdsapi.Client(
    url="https://ads.atmosphere.copernicus.eu/api",
    key="4a5c9303-499b-4e0a-9272-6e15db940c33",
    verify=False,
)

for year in range(2003, 2026):
    for var in VARIABLES:
        out_path = f"data/cams/{var}_{year}.nc"
        if os.path.exists(out_path):
            print(f"  Already exists: {out_path} — skipping")
            continue

        print(f"  Downloading {var} {year} …")
        try:
            c.retrieve(
                "cams-global-reanalysis-eac4-monthly",
                {
                    "variable": var,
                    "year": str(year),
                    "month": [f"{m:02d}" for m in range(1, 13)],
                    "product_type": "monthly_mean",
                    "time": "00:00",
                    "model_level": "60",
                    "format": "netcdf",
                    "area": [37, 67, 6, 98],
                },
                out_path,
            )
            print(f"    Saved → {out_path}")
        except Exception as e:
            print(f"    ERROR: {var} {year}: {e}")

print("CAMS download complete.")
