"""
Export MERIT Hydro v1.0.1 India-extent rasters to Google Cloud Storage.

Run this script ONCE. It submits 6 export tasks to GEE — they run in GEE's
cloud and deposit files into your GCS bucket.

After all 6 tasks complete (check GEE Console → Tasks tab):
  1. Run the gsutil download command printed below
  2. SCP each file to the SSH server

Output files in GCS (gs://insuretech-merit-hydro/merit_hydro_india/):
  india_hand.tif             ~250 MB
  india_elevation.tif        ~300 MB
  india_upstream_area.tif    ~250 MB
  india_river_width.tif      ~150 MB
  india_water_mask.tif       ~50  MB
  india_flow_direction.tif   ~100 MB
"""

import ee
import json
import os
import time

KEY_FILE   = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT    = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")
GCS_BUCKET = os.environ.get("GCS_BUCKET",   "insuretech-merit-hydro")
GCS_FOLDER = "merit_hydro_india"
SCALE      = 92.77   # MERIT Hydro native resolution

EXPORTS = [
    ("hnd", "india_hand"),
    ("elv", "india_elevation"),
    ("upa", "india_upstream_area"),
    ("wth", "india_river_width"),
    ("wat", "india_water_mask"),
    ("dir", "india_flow_direction"),
]

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def main():
    print("Initialising GEE...")
    init_gee()

    india = ee.Geometry.Rectangle([67.0, 6.0, 98.0, 38.0])
    image = ee.Image("MERIT/Hydro/v1_0_1")
    print("Loaded MERIT Hydro v1.0.1")
    print(f"Submitting {len(EXPORTS)} export tasks to gs://{GCS_BUCKET}/{GCS_FOLDER}/...\n")

    tasks = []
    for band, filename in EXPORTS:
        task = ee.batch.Export.image.toCloudStorage(
            image=image.select([band]),
            description=filename,
            bucket=GCS_BUCKET,
            fileNamePrefix=f"{GCS_FOLDER}/{filename}",
            region=india,
            scale=SCALE,
            crs='EPSG:4326',
            maxPixels=1e13,
            fileFormat='GeoTIFF',
        )
        task.start()
        tasks.append((band, filename, task))
        print(f"  Submitted: {filename}.tif  (band: {band})")
        time.sleep(1)

    print(f"""
All {len(tasks)} tasks submitted to GEE.

── What to do now ────────────────────────────────────────────────
1. Go to https://code.earthengine.google.com/ → Tasks tab
2. Wait for all {len(tasks)} tasks to show "COMPLETED" (20–60 min each)

── After COMPLETED: download to your laptop ──────────────────────
Run this single command (downloads all 6 files in parallel):

  gsutil -m -o "Credentials:gs_service_key_file=gee-key.json" \\
    cp gs://{GCS_BUCKET}/{GCS_FOLDER}/*.tif .

── Then copy to SSH server ───────────────────────────────────────
  scp -P 1729 india_hand.tif            sujeetk@172.17.4.105:/opt/raster-india/
  scp -P 1729 india_elevation.tif       sujeetk@172.17.4.105:/opt/raster-india/
  scp -P 1729 india_upstream_area.tif   sujeetk@172.17.4.105:/opt/raster-india/
  scp -P 1729 india_river_width.tif     sujeetk@172.17.4.105:/opt/raster-india/
  scp -P 1729 india_water_mask.tif      sujeetk@172.17.4.105:/opt/raster-india/
  scp -P 1729 india_flow_direction.tif  sujeetk@172.17.4.105:/opt/raster-india/
──────────────────────────────────────────────────────────────────
""")

if __name__ == "__main__":
    main()
