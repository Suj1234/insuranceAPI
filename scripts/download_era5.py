"""
scripts/download_era5.py

Download ERA5-Land monthly mean 2m temperature for India (1980-2025).

Pre-requisite:
  pip install cdsapi
  ~/.cdsapirc must exist with CDS credentials

Output: data/era5/temperature_monthly_1980_2025.nc

India bounding box: N=37, W=67, S=6, E=98
"""
import os
import urllib3
import cdsapi

urllib3.disable_warnings()
os.makedirs("data/era5", exist_ok=True)

OUT_PATH = "data/era5/temperature_monthly_1980_2025.nc"

import requests

def download_with_retry(url, dest, max_retries=10):
    for attempt in range(1, max_retries + 1):
        try:
            print(f"  Download attempt {attempt} ...")
            r = requests.get(url, stream=True, verify=False, timeout=120)
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            downloaded = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
            if total and downloaded < total:
                print(f"  Incomplete: {downloaded} of {total} bytes — retrying")
                continue
            print(f"  Downloaded {downloaded:,} bytes")
            return True
        except Exception as e:
            print(f"  Attempt {attempt} failed: {e}")
    return False

if os.path.exists(OUT_PATH):
    print(f"Already exists: {OUT_PATH} — skipping")
else:
    print("Submitting ERA5-Land request ...")
    c = cdsapi.Client(
        url="https://cds.climate.copernicus.eu/api",
        key="4a5c9303-499b-4e0a-9272-6e15db940c33",
        verify=False,
    )
    result = c.retrieve(
        "reanalysis-era5-land-monthly-means",
        {
            "product_type": "monthly_averaged_reanalysis",
            "variable": "2m_temperature",
            "year": [str(y) for y in range(1980, 2026)],
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": "00:00",
            "format": "netcdf",
            "area": [37, 67, 6, 98],
        },
    )
    print(f"Request successful. Downloading file ...")
    ok = download_with_retry(result.location, OUT_PATH)
    if ok:
        print(f"Saved → {OUT_PATH}")
    else:
        print("Download failed after all retries. Check internet connection.")

print("ERA5 download complete.")
