"""
Extract MERIT Hydro HAND (Height Above Nearest Drainage) for all Indian pincodes via GEE.

Dataset: MERIT/Hydro/v1_0_1 band "hnd"
Replaces deprecated WWF/HydroSHEDS/03HAND.

Verified: Patna=2m, Chennai=0m, Haridwar=6.4m

Output: data/flood/gee_outputs/hand_terrain.csv
Columns: pincode, hand_elevation_m

Runtime: ~20-30 min
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/hand_terrain.csv"
BATCH_SIZE  = 500
SCALE       = 90  # MERIT Hydro native resolution

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
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]),
            {"pincode": str(int(r["pincode"]))}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)
    sampled = image.rename(["hand_elevation_m"]).reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=SCALE,
    )
    results = []
    for feat in sampled.getInfo()["features"]:
        props = feat["properties"]
        # single-band reduceRegions(first()) returns property named 'first', not the band name
        val = props.get("first")
        results.append({
            "pincode": props.get("pincode"),
            "hand_elevation_m": round(float(val), 2) if val is not None else None,
        })
    return results

def main():
    print("Initialising GEE...")
    init_gee()

    # MERIT/Hydro/v1_0_1 band "hnd" = height above nearest drainage
    print("Loading MERIT Hydro v1.0.1 band hnd...")
    image = ee.Image("MERIT/Hydro/v1_0_1").select("hnd")

    print(f"Loading pincodes from {PINCODE_CSV}...")
    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes with valid India coords")

    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"  Resuming -- {len(done):,} done")
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
    print(f"Median HAND elevation: {final['hand_elevation_m'].median():.1f} m")
    low_lying = (final["hand_elevation_m"] <= 2).sum()
    print(f"Low-lying (HAND <=2m): {low_lying:,} pincodes")

if __name__ == "__main__":
    main()
