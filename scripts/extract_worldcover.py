"""
Extract ESA WorldCover 2021 land cover fractions for all Indian pincodes via GEE.

Extracts two classes within a 500m buffer around each pincode centroid:
  Class 50 = Built-up / impervious surface -> impervious_surface_pct
  Class 95 = Mangroves -> mangrove_cover_pct

Replaces JAXA Mangrove Watch (website blocked). ESA WorldCover class 95
confirmed working — Sundarbans mangrove area verified.

Output: data/flood/gee_outputs/worldcover.csv
Columns: pincode, impervious_surface_pct, mangrove_cover_pct

Runtime: ~30-45 min
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/worldcover.csv"
BATCH_SIZE  = 300
SCALE       = 10   # ESA WorldCover native resolution
BUFFER_M    = 500  # buffer radius around centroid for zonal stats

BUILT_UP_CLASS = 50  # impervious / built-up
MANGROVE_CLASS = 95  # mangroves

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
    """
    For each pincode buffer compute fraction of built-up (class 50)
    and mangrove (class 95) pixels. Returns 0–100 percent.
    """
    map_band = image.select("Map")
    built_up  = map_band.eq(BUILT_UP_CLASS).rename(["built_up"])
    mangrove  = map_band.eq(MANGROVE_CLASS).rename(["mangrove"])
    combined  = built_up.addBands(mangrove)

    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]).buffer(BUFFER_M),
            {"pincode": str(int(r["pincode"]))}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)

    means = combined.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.mean(),
        scale=SCALE,
    )

    results = []
    for feat in means.getInfo()["features"]:
        props = feat["properties"]
        built_mean    = props.get("built_up")
        mangrove_mean = props.get("mangrove")
        results.append({
            "pincode": props.get("pincode"),
            "impervious_surface_pct": round(float(built_mean) * 100, 2) if built_mean is not None else None,
            "mangrove_cover_pct":     round(float(mangrove_mean) * 100, 2) if mangrove_mean is not None else None,
        })
    return results

def main():
    print("Initialising GEE...")
    init_gee()

    print("Loading ESA WorldCover 2021...")
    image = ee.ImageCollection("ESA/WorldCover/v200").first()

    print(f"Loading pincodes from {PINCODE_CSV}...")
    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes with valid India coords")

    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"  Resuming — {len(done):,} done")
    pincodes = pincodes[~pincodes["pincode"].astype(str).isin(done)]

    all_rows = []
    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]

    for idx, batch in enumerate(batches):
        print(f"  Batch {idx+1}/{len(batches)}...", end=" ", flush=True)
        try:
            rows = extract_batch(image, batch)
            all_rows.extend(rows)
            print("OK")
        except Exception as e:
            print(f"ERROR: {e}")
            time.sleep(5)

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
    high_urban = (final["impervious_surface_pct"] > 60).sum()
    mangrove   = (final["mangrove_cover_pct"] > 0).sum()
    print(f"High impervious (>60%): {high_urban:,} pincodes")
    print(f"Any mangrove cover:     {mangrove:,} pincodes")

if __name__ == "__main__":
    main()
