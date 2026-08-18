"""
Download ESRI 10m Annual Land Cover India tiles from S3 and upload to Hugging Face.

Source: s3://io-10m-annual-lulc (public, no credentials)
Dest:   Suj-1234/esri-land-cover-india (HF dataset)

Flow: S3 --> temp file (~200MB) --> HF upload --> delete temp file
Peak disk: ~500MB. No 22GB needed locally.

Resume-safe: skips tiles already on HF.
Pre-flight: HEAD-checks each S3 tile and skips 404s.

Usage:
  pip install huggingface_hub requests python-dotenv
  python scripts/upload_esri_to_hf.py
"""

import os
import sys
import tempfile
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from huggingface_hub import HfApi

# Load .env.local from project root (two levels up from scripts/)
load_dotenv(Path(__file__).parent.parent / ".env.local")

HF_TOKEN = os.environ["HF_TOKEN"]
HF_REPO  = "Suj-1234/esri-land-cover-india"
S3_BASE  = "https://io-10m-annual-lulc.s3.us-west-2.amazonaws.com"
YEARS    = list(range(2017, 2025))

# All possible India UTM tiles (zones 42-47, bands N-T)
# Non-existent ones are skipped via HEAD check
ZONES = list(range(42, 48))
BANDS = list("NPQRST")
ALL_TILES = [f"{z:02d}{b}" for z in ZONES for b in BANDS]  # 36 combos


def main():
    api = HfApi(token=HF_TOKEN)

    # Create repo once (no-op if already exists)
    api.create_repo(HF_REPO, repo_type="dataset", exist_ok=True, private=False)
    print(f"HF repo: https://huggingface.co/datasets/{HF_REPO}")

    # Files already on HF — skip these
    existing = set(api.list_repo_files(HF_REPO, repo_type="dataset"))
    print(f"Already on HF: {len(existing)} files\n")

    total_tiles = len(ALL_TILES) * len(YEARS)
    uploaded = 0
    skipped  = 0
    missing  = 0
    errors   = 0

    for year in YEARS:
        print(f"=== Year {year} ===")
        for tile in ALL_TILES:
            fname = f"{tile}_{year}.tif"

            if fname in existing:
                skipped += 1
                continue

            url = f"{S3_BASE}/{fname}"

            # Quick HEAD check — many tile combos won't exist on S3
            try:
                head = requests.head(url, timeout=10)
            except Exception as e:
                print(f"  {fname}: HEAD failed ({e}), skipping")
                errors += 1
                continue

            if head.status_code == 404:
                missing += 1
                continue

            size_mb = int(head.headers.get("Content-Length", 0)) / 1e6
            print(f"  {fname}  ({size_mb:.0f} MB) ...", end=" ", flush=True)
            t0 = time.time()

            tmp_path = None
            try:
                # Stream download to temp file
                with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
                    tmp_path = tmp.name

                with requests.get(url, stream=True, timeout=300) as r:
                    r.raise_for_status()
                    with open(tmp_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                            f.write(chunk)

                # Upload to HF
                api.upload_file(
                    path_or_fileobj=tmp_path,
                    path_in_repo=fname,
                    repo_id=HF_REPO,
                    repo_type="dataset",
                    token=HF_TOKEN,
                )

                elapsed = time.time() - t0
                print(f"done ({elapsed:.0f}s)")
                uploaded += 1

            except Exception as e:
                print(f"ERROR: {e}")
                errors += 1

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)

        print()

    print("=" * 50)
    print(f"Uploaded : {uploaded}")
    print(f"Skipped  : {skipped}  (already on HF)")
    print(f"Missing  : {missing}  (not on S3 — expected for sparse tiles)")
    print(f"Errors   : {errors}")
    print(f"\nDataset: https://huggingface.co/datasets/{HF_REPO}")
    if uploaded + skipped > 0:
        print("\nNext step:")
        print("  python scripts/extract_esri_from_hf.py   # fill pincode table")
        print("  python scripts/land_cover_raster_service.py  # lat/lon API")


if __name__ == "__main__":
    main()
