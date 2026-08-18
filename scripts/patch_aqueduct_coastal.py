"""
Patch script: extract the 8 coastal columns that failed due to wrong GEE image IDs.
Merges results into the existing aqueduct_full.csv without re-running completed queries.
"""

import ee
import json
import os
import pandas as pd

KEY_FILE    = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT", "insuretech-data-platform")
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/aqueduct_full.csv"
BATCH_SIZE  = 200
SCALE       = 1000
COLLECTION  = "WRI/Aqueduct_Flood_Hazard_Maps/V2"

# Historical nosub/wtsub 2030 images have NO _perc_50 variant.
# For p50 we use the nearest projected equivalent (rcp8p5 2030).
PATCH_QUERIES = [
    {"id": "inuncoast_rcp8p5_nosub_2030_rp0100_0_perc_50",  "out_col": "coastal_nosub_rp100_slr_p50_m"},
    {"id": "inuncoast_rcp8p5_nosub_2030_rp0500_0_perc_50",  "out_col": "coastal_nosub_rp500_slr_p50_m"},
    {"id": "inuncoast_historical_wtsub_2030_rp0100_0",       "out_col": "coastal_wtsub_2030_rp100_slr_p95_m"},
    {"id": "inuncoast_rcp8p5_wtsub_2030_rp0100_0_perc_50",  "out_col": "coastal_wtsub_2030_rp100_slr_p50_m"},
    {"id": "inuncoast_rcp8p5_wtsub_2050_rp0100_0",          "out_col": "coastal_wtsub_2050_rp100_slr_p95_m"},
    {"id": "inuncoast_rcp8p5_wtsub_2050_rp0100_0_perc_50",  "out_col": "coastal_wtsub_2050_rp100_slr_p50_m"},
    {"id": "inuncoast_rcp8p5_wtsub_2080_rp0100_0",          "out_col": "coastal_wtsub_2080_rp100_slr_p95_m"},
    {"id": "inuncoast_rcp8p5_wtsub_2080_rp0100_0_perc_50",  "out_col": "coastal_wtsub_2080_rp100_slr_p50_m"},
]

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def sample_image(image, rows):
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]),
            {"pincode": str(int(r["pincode"]))}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)
    sampled = image.select("inundation_depth").reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=SCALE,
    )
    return {
        feat["properties"]["pincode"]: feat["properties"].get("first")
        for feat in sampled.getInfo()["features"]
    }

def main():
    print("Initialising GEE...")
    init_gee()

    print(f"Loading CSV from {OUTPUT_CSV}...")
    df = pd.read_csv(OUTPUT_CSV)
    df["pincode"] = df["pincode"].astype(str)
    print(f"  {len(df):,} rows")

    print(f"Loading pincodes from {PINCODE_CSV}...")
    pc = pd.read_csv(PINCODE_CSV)
    pc["lat"] = pd.to_numeric(pc["latitude"], errors="coerce")
    pc["lng"] = pd.to_numeric(pc["longitude"], errors="coerce")
    pc = pc[pc["lat"].between(6.0, 38.0) & pc["lng"].between(67.0, 99.0)]
    pc = pc.drop_duplicates(subset=["pincode"])
    pincodes = pc[["pincode", "lat", "lng"]].reset_index(drop=True)
    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    print(f"  {len(pincodes):,} pincodes, {len(batches)} batches")

    for q in PATCH_QUERIES:
        print(f"\nExtracting: {q['out_col']}  [{q['id']}]")
        image = ee.Image(f"{COLLECTION}/{q['id']}")
        for idx, batch in enumerate(batches):
            print(f"  batch {idx+1}/{len(batches)}", end=" ", flush=True)
            try:
                values = sample_image(image, batch)
                for pincode, val in values.items():
                    mask = df["pincode"] == str(pincode)
                    df.loc[mask, q["out_col"]] = round(float(val), 3) if val is not None else None
                print("ok")
            except Exception as e:
                print(f"ERROR: {e}")
        df.to_csv(OUTPUT_CSV, index=False)
        print(f"  checkpoint saved -- {q['out_col']}")

    print(f"\nDone. {OUTPUT_CSV} updated.")

if __name__ == "__main__":
    main()
