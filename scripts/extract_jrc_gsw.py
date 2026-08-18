"""
Extract JRC Global Surface Water v1.4 (1984-2021) for all Indian pincodes via GEE.

Output: data/flood/gee_outputs/jrc_gsw.csv
Columns: pincode, gsw_occurrence_pct, gsw_seasonality_months, gsw_recurrence_pct,
         gsw_transition_class, gsw_max_extent, gsw_change_abs

Note: null values mean pixel was NEVER flooded — this is correct GSW behavior.
      API should return ever_flooded=false for null occurrence, not an error.

Runtime: ~30-60 min for ~50,000 pincodes
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/jrc_gsw.csv"
BATCH_SIZE  = 500
SCALE       = 30  # JRC GSW native resolution

BANDS = ["occurrence", "seasonality", "recurrence", "transition", "max_extent", "change_abs"]

COLUMN_MAP = {
    "occurrence":  "gsw_occurrence_pct",
    "seasonality": "gsw_seasonality_months",
    "recurrence":  "gsw_recurrence_pct",
    "transition":  "gsw_transition_class",
    "max_extent":  "gsw_max_extent",
    "change_abs":  "gsw_change_abs",
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
    sampled = image.select(BANDS).reduceRegions(
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
            if col == "gsw_max_extent":
                row[col] = bool(val) if val is not None else False
            elif val is not None:
                row[col] = round(float(val), 2)
            else:
                row[col] = None  # null = never flooded, intentional
        results.append(row)
    return results

def main():
    print("Initialising GEE...")
    init_gee()

    print("Loading JRC Global Surface Water v1.4...")
    image = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")

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
        print(f"  Batch {idx+1}/{len(batches)}...", end=" ", flush=True)
        try:
            rows = extract_batch(image, batch)
            all_rows.extend(rows)
            print(f"OK")
        except Exception as e:
            print(f"ERROR: {e}")
            time.sleep(5)
            continue

        if (idx + 1) % 10 == 0:
            df = pd.DataFrame(all_rows)
            if os.path.exists(OUTPUT_CSV):
                df = pd.concat([pd.read_csv(OUTPUT_CSV), df], ignore_index=True)
            df.to_csv(OUTPUT_CSV, index=False)
            all_rows = []

    if all_rows:
        df = pd.DataFrame(all_rows)
        if os.path.exists(OUTPUT_CSV):
            df = pd.concat([pd.read_csv(OUTPUT_CSV), df], ignore_index=True)
        df.to_csv(OUTPUT_CSV, index=False)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} pincodes -> {OUTPUT_CSV}")
    print(f"Ever flooded (max_extent=True): {final['gsw_max_extent'].sum():,} pincodes")

if __name__ == "__main__":
    main()
