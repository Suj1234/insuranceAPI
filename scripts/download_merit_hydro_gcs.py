"""
Download exported MERIT Hydro TIF files from GCS to a local folder.

Run AFTER all 6 GEE export tasks show COMPLETED in the Tasks tab.
Uses the service account key — no gsutil or gcloud needed.

Output: data/output/merit_hydro_tifs/
"""

import os
import json
from google.cloud import storage
from google.oauth2 import service_account

KEY_FILE    = os.environ.get("GEE_KEY_FILE", "gee-key.json")
BUCKET_NAME = os.environ.get("GCS_BUCKET",   "insuretech-merit-hydro")
GCS_FOLDER  = "merit_hydro_india"
DEST_DIR    = "data/output/merit_hydro_tifs"

EXPECTED = [
    "india_hand.tif",
    "india_elevation.tif",
    "india_upstream_area.tif",
    "india_river_width.tif",
    "india_water_mask.tif",
    "india_flow_direction.tif",
]

def main():
    os.makedirs(DEST_DIR, exist_ok=True)

    creds  = service_account.Credentials.from_service_account_file(KEY_FILE)
    client = storage.Client(credentials=creds, project=creds.project_id)
    bucket = client.bucket(BUCKET_NAME)

    # List what's actually in the bucket
    blobs = list(bucket.list_blobs(prefix=f"{GCS_FOLDER}/"))
    tifs  = [b for b in blobs if b.name.endswith(".tif")]

    if not tifs:
        print(f"No TIF files found in gs://{BUCKET_NAME}/{GCS_FOLDER}/")
        print("Make sure all 6 GEE tasks show COMPLETED before running this.")
        return

    print(f"Found {len(tifs)} TIF files in GCS. Downloading to {DEST_DIR}/\n")

    for blob in tifs:
        filename = os.path.basename(blob.name)
        dest     = os.path.join(DEST_DIR, filename)
        size_mb  = blob.size / 1_048_576

        if os.path.exists(dest) and os.path.getsize(dest) == blob.size:
            print(f"  SKIP {filename} (already downloaded)")
            continue

        print(f"  {filename}  ({size_mb:.0f} MB)...", end=" ", flush=True)
        blob.download_to_filename(dest)
        print("done")

    print(f"\nAll files saved to {DEST_DIR}/")

    missing = [f for f in EXPECTED if not os.path.exists(os.path.join(DEST_DIR, f))]
    if missing:
        print(f"\nWARNING — missing files (tasks may still be running): {missing}")
    else:
        print("All 6 files present. Ready to SCP to SSH server.")
        print()
        for f in EXPECTED:
            print(f"  scp -P 1729 {DEST_DIR}/{f} sujeetk@172.17.4.105:/opt/raster-india/")

if __name__ == "__main__":
    main()
