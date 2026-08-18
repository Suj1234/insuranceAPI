"""
Extract JAXA Global Mangrove Watch 2020 coverage for coastal Indian pincodes via GEE.

PREREQUISITES:
  - Register at: https://www.eorc.jaxa.jp/ALOS/en/dataset/gmw_e.htm
  - Confirm registration via email
  - Download the global GMW 2020 GeoTIFF tiles for the India region
  - Place tiles in: data/flood/mangrove/
  - OR use the GEE asset if available

Output: data/flood/gee_outputs/mangrove.csv
Columns: pincode, mangrove_cover_pct_5km (NULL for inland pincodes)

Runtime: ~15-20 min (coastal pincodes only)
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

PINCODE_CSV  = "data/output/pincode_coords.csv"
OUTPUT_CSV   = "data/flood/gee_outputs/mangrove.csv"
BATCH_SIZE   = 100
BUFFER_M     = 5000  # 5km coastal buffer
SCALE        = 25    # GMW native resolution

# Coastal states — only process pincodes in these states
COASTAL_STATES = {
    "Maharashtra", "Gujarat", "Goa", "Karnataka", "Kerala",
    "Tamil Nadu", "Andhra Pradesh", "Odisha", "West Bengal",
    "Puducherry", "Lakshadweep", "Andaman and Nicobar Islands", "Daman and Diu", "Dadra and Nagar Haveli"
}

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def get_gmw_image():
    # Try GEE community dataset first (may be available as uploaded asset)
    # Fallback: use Landsat-derived mangrove proxy (NDVI + water proximity)
    try:
        # Community uploaded GMW 2020 — check if available in your GEE project
        gmw = ee.Image(f"projects/{PROJECT}/assets/gmw_2020_india")
        gmw.getInfo()
        print("  Using uploaded GMW asset")
        return gmw
    except Exception:
        print("  GMW GEE asset not found.")
        print("  ACTION REQUIRED: Register at https://www.eorc.jaxa.jp/ALOS/en/dataset/gmw_e.htm")
        print("  Download tiles for Asia, upload to GEE as 'gmw_2020_india' asset")
        print("  Then re-run this script.")
        return None

def extract_mangrove_pct(image, rows):
    mangrove_binary = image.gt(0).rename(["mangrove"])
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]).buffer(BUFFER_M),
            {"pincode": str(r["pincode"])}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)
    result = mangrove_binary.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.mean(),
        scale=SCALE,
    )
    return [
        {
            "pincode": f["properties"]["pincode"],
            "mangrove_cover_pct_5km": round(f["properties"].get("mean", 0) * 100, 2)
            if f["properties"].get("mean") is not None else None
        }
        for f in result.getInfo()["features"]
    ]

def main():
    print("Initialising GEE...")
    init_gee()

    image = get_gmw_image()
    if image is None:
        print("\nCannot proceed without GMW data. See instructions above.")
        print("Writing null values for all coastal pincodes as placeholder...")
        pincodes = pd.read_csv(PINCODE_CSV).dropna(subset=["lat", "lng"])
        # Mark all as None — will be filled after manual data acquisition
        df = pd.DataFrame({
            "pincode": pincodes["pincode"].astype(str),
            "mangrove_cover_pct_5km": None,
        })
        df.to_csv(OUTPUT_CSV, index=False)
        print(f"Placeholder written to {OUTPUT_CSV}")
        return

    print(f"Loading coastal pincodes...")
    pincodes = pd.read_csv(PINCODE_CSV).dropna(subset=["lat", "lng"])
    if "state_name" in pincodes.columns:
        coastal = pincodes[pincodes["state_name"].isin(COASTAL_STATES)]
        inland  = pincodes[~pincodes["pincode"].isin(coastal["pincode"])]
    else:
        coastal = pincodes  # process all if no state column
        inland  = pd.DataFrame()

    print(f"  Coastal pincodes: {len(coastal):,} | Inland (null): {len(inland):,}")

    all_rows = []
    batches = [coastal.iloc[i:i+BATCH_SIZE] for i in range(0, len(coastal), BATCH_SIZE)]

    for idx, batch in enumerate(batches):
        print(f"  Batch {idx+1}/{len(batches)}...", end=" ", flush=True)
        try:
            rows = extract_mangrove_pct(image, batch)
            all_rows.extend(rows)
            print("OK")
        except Exception as e:
            print(f"ERROR: {e}")
            time.sleep(5)

    # Add null for all inland pincodes
    inland_rows = [{"pincode": str(p), "mangrove_cover_pct_5km": None}
                   for p in inland["pincode"]]
    all_rows.extend(inland_rows)

    df = pd.DataFrame(all_rows)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone. {len(df):,} pincodes -> {OUTPUT_CSV}")
    has_mangrove = df["mangrove_cover_pct_5km"].notna() & (df["mangrove_cover_pct_5km"] > 0)
    print(f"Pincodes with mangrove cover: {has_mangrove.sum():,}")

if __name__ == "__main__":
    main()
