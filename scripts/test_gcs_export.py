"""
Quick sanity test — exports a tiny 0.2°×0.2° patch (Mumbai) to GCS,
downloads it, and samples one coordinate from it.

Tests: GCS write permission + download + rasterio read all work.
Runtime: ~3–5 minutes total.
"""

import ee
import json
import os
import time
import tempfile
from google.cloud import storage
from google.oauth2 import service_account
import rasterio

KEY_FILE    = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")
BUCKET_NAME = "insuretech-merit-hydro"
TEST_OBJECT = "test/test_hand.tif"

TEST_LAT, TEST_LON = 19.07, 72.87  # central Mumbai

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def wait_for_task(task, timeout=600):
    print("  Waiting for task to complete", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        status = task.status()
        state  = status["state"]
        if state == "COMPLETED":
            print(" COMPLETED ✓")
            return True
        if state in ("FAILED", "CANCELLED"):
            print(f" {state}")
            print(f"  Error: {status.get('error_message', 'unknown')}")
            return False
        print(".", end="", flush=True)
        time.sleep(10)
    print(" TIMEOUT")
    return False

def main():
    print("=" * 50)
    print("GCS EXPORT TEST — Mumbai patch, hnd band")
    print("=" * 50)

    # Step 1: Init GEE
    print("\n[1/4] Initialising GEE...")
    init_gee()
    print("      OK")

    # Step 2: Submit tiny export
    print("\n[2/4] Submitting test export to GCS...")
    test_region = ee.Geometry.Rectangle([72.8, 18.9, 73.0, 19.1])
    image = ee.Image("MERIT/Hydro/v1_0_1").select(["hnd"])
    task  = ee.batch.Export.image.toCloudStorage(
        image=image,
        description="test_hand",
        bucket=BUCKET_NAME,
        fileNamePrefix=TEST_OBJECT.replace(".tif", ""),
        region=test_region,
        scale=92.77,
        crs="EPSG:4326",
        maxPixels=1e9,
        fileFormat="GeoTIFF",
    )
    task.start()
    print(f"      Submitted → gs://{BUCKET_NAME}/{TEST_OBJECT}")

    # Step 3: Wait for completion
    print("\n[3/4] Waiting for GEE to finish (~2–5 min)...")
    if not wait_for_task(task):
        print("\nTEST FAILED at export step.")
        return

    # Step 4: Download + sample
    print("\n[4/4] Downloading and sampling...")
    creds  = service_account.Credentials.from_service_account_file(KEY_FILE)
    client = storage.Client(credentials=creds, project=creds.project_id)
    bucket = client.bucket(BUCKET_NAME)
    blob   = bucket.blob(TEST_OBJECT)

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        tmp_path = f.name

    blob.download_to_filename(tmp_path)
    print(f"      Downloaded to temp file")

    with rasterio.open(tmp_path) as ds:
        row, col = ds.index(TEST_LON, TEST_LAT)
        val = float(ds.read(1, window=rasterio.windows.Window(col, row, 1, 1))[0, 0])
        print(f"      HAND at Mumbai ({TEST_LAT}, {TEST_LON}): {val:.2f} m")

    os.unlink(tmp_path)
    bucket.blob(TEST_OBJECT).delete()
    print("      Cleaned up test file from GCS")

    print("\n" + "=" * 50)
    print("ALL TESTS PASSED — safe to run full export")
    print("=" * 50)

if __name__ == "__main__":
    main()
