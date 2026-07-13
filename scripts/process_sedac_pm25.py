"""
scripts/process_sedac_pm25.py

NASA SEDAC V5.GL.04 GeoTIFFs -> district annual PM2.5 CSV.

Input:  data/sedac/pm25/sdei-global-annual-gwr-pm2-5-modis-misr-seawifs-viirs-aod-v5-gl-04-{YEAR}-geotiff.tif
        data/gadm41_IND_2.json  (India district shapefile, GADM level 2)
Output: data/output/district_pm25_sedac_2000_2022.csv

Columns: district_name, state_name, district_code, year,
         pm25_sedac_raw, pm25_sedac_median, pm25_sedac_std
"""
import os
import rasterio
import geopandas as gpd
from rasterstats import zonal_stats
import pandas as pd

SHAPEFILE = "data/gadm41_IND_2.json"
SEDAC_DIR = "data/sedac/pm25"
OUT_PATH  = "data/output/district_pm25_sedac_2000_2022.csv"

os.makedirs("data/output", exist_ok=True)

print("Loading India district shapefile ...")
districts = gpd.read_file(SHAPEFILE).to_crs("EPSG:4326")

results = []

for year in range(2000, 2023):
    raster_path = os.path.join(
        SEDAC_DIR,
        f"sdei-global-annual-gwr-pm2-5-modis-misr-seawifs-viirs-aod-v5-gl-04-{year}-geotiff.tif",
    )
    if not os.path.exists(raster_path):
        print(f"  MISSING: {year} — skipping")
        continue

    print(f"  Processing {year} ...")
    with rasterio.open(raster_path) as src:
        array    = src.read(1)
        transform = src.transform
        nodata   = src.nodata

    stats = zonal_stats(
        districts,
        array,
        affine=transform,
        stats=["mean", "median", "std", "min", "max"],
        nodata=nodata,
    )

    for i, row in districts.iterrows():
        results.append({
            "district_name":    row["NAME_2"],
            "state_name":       row["NAME_1"],
            "district_code":    row["GID_2"],
            "year":             year,
            "pm25_sedac_raw":   stats[i]["mean"],
            "pm25_sedac_median": stats[i]["median"],
            "pm25_sedac_std":   stats[i]["std"],
        })

df = pd.DataFrame(results)
df.to_csv(OUT_PATH, index=False)
print(f"Done. {len(df):,} district-year records -> {OUT_PATH}")
