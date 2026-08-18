"""
Extract JRC GloFAS v2.1 flood hazard data for all Indian pincodes via GEE.

Output: data/flood/gee_outputs/jrc_glofas.csv
Columns: pincode, jrc_rp10_depth_m, jrc_rp20_depth_m, jrc_rp50_depth_m,
         jrc_rp75_depth_m, jrc_rp100_depth_m, jrc_rp200_depth_m,
         jrc_rp500_depth_m, jrc_rp100_class, jrc_spurious_depth_flag

Runtime: ~30-60 min for ~50,000 pincodes
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

PINCODE_CSV  = "data/output/pincode_coords.csv"
OUTPUT_CSV   = "data/flood/gee_outputs/jrc_glofas.csv"
BATCH_SIZE   = 500
SCALE        = 90  # JRC GloFAS native resolution

DEPTH_BANDS  = ["RP10_depth", "RP20_depth", "RP50_depth", "RP75_depth",
                "RP100_depth", "RP200_depth", "RP500_depth"]
CLASS_BANDS  = ["RP100_depth_category", "spurious_depth_category"]
ALL_BANDS    = DEPTH_BANDS + CLASS_BANDS

COLUMN_MAP = {
    "RP10_depth":              "jrc_rp10_depth_m",
    "RP20_depth":              "jrc_rp20_depth_m",
    "RP50_depth":              "jrc_rp50_depth_m",
    "RP75_depth":              "jrc_rp75_depth_m",
    "RP100_depth":             "jrc_rp100_depth_m",
    "RP200_depth":             "jrc_rp200_depth_m",
    "RP500_depth":             "jrc_rp500_depth_m",
    "RP100_depth_category":    "jrc_rp100_class",
    "spurious_depth_category": "jrc_spurious_depth_flag",
}

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def load_pincodes():
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    return df[["pincode", "lat", "lng"]].reset_index(drop=True)

def extract_batch(image, rows):
    features = []
    for _, r in rows.iterrows():
        pt = ee.Geometry.Point([float(r["lng"]), float(r["lat"])])
        feat = ee.Feature(pt, {"pincode": str(int(r["pincode"]))})
        features.append(feat)

    fc = ee.FeatureCollection(features)
    sampled = image.select(ALL_BANDS).reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=SCALE,
    )

    results = []
    for feat in sampled.getInfo()["features"]:
        props = feat["properties"]
        row = {"pincode": props.get("pincode")}
        for band, col in COLUMN_MAP.items():
            val = props.get(band)
            row[col] = round(float(val), 2) if val is not None else None
        results.append(row)
    return results

def main():
    print("Initialising GEE...")
    init_gee()

    # mosaic() merges all tiles — fixes the single-tile bug from .first()
    print("Loading JRC GloFAS v2.1 (mosaicking all tiles)...")
    image = ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1").mosaic()

    print(f"Loading pincodes from {PINCODE_CSV}...")
    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes with valid India coords")

    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"  Resuming — {len(done):,} already done")

    pincodes = pincodes[~pincodes["pincode"].astype(str).isin(done)]

    all_rows = []
    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]

    for idx, batch in enumerate(batches):
        print(f"  Batch {idx+1}/{len(batches)} ({len(batch)} pincodes)...", end=" ", flush=True)
        try:
            rows = extract_batch(image, batch)
            all_rows.extend(rows)
            print(f"OK — {len(rows)} values")
        except Exception as e:
            print(f"ERROR: {e}")
            time.sleep(5)
            continue

        if (idx + 1) % 10 == 0:
            df = pd.DataFrame(all_rows)
            if os.path.exists(OUTPUT_CSV):
                existing = pd.read_csv(OUTPUT_CSV)
                df = pd.concat([existing, df], ignore_index=True)
            df.to_csv(OUTPUT_CSV, index=False)
            all_rows = []
            print(f"    Checkpoint saved")

    if all_rows:
        df = pd.DataFrame(all_rows)
        if os.path.exists(OUTPUT_CSV):
            existing = pd.read_csv(OUTPUT_CSV)
            df = pd.concat([existing, df], ignore_index=True)
        df.to_csv(OUTPUT_CSV, index=False)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} pincodes written to {OUTPUT_CSV}")
    print(f"Coverage: {final['jrc_rp100_depth_m'].notna().sum():,} with rp100 depth data")

if __name__ == "__main__":
    main()
