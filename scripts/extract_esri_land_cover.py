"""
Extract ESRI 10m Annual Land Cover class percentages for all Indian pincodes via GEE.

For each pincode centroid, for each year 2017-2024:
  - Buffer 500m around centroid
  - Use frequencyHistogram reducer to count pixels per class (one GEE call per batch)
  - Convert counts to percentages

Classes (ESRI codes):
  1=water  2=trees  3=grass  4=flooded_veg  5=crops
  6=scrub_shrub  7=built_area  8=bare_ground  9=snow_ice

Output: data/output/esri_land_cover_raw.csv
Columns: pincode, year, built_area_pct, trees_pct, crops_pct, water_pct,
         flooded_veg_pct, grass_pct, scrub_shrub_pct, bare_ground_pct

Runtime: ~30-40 hours for 19k pincodes x 8 years (runs unattended, resumes safely)
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE    = os.environ.get("GEE_KEY_FILE",  "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT",   "insuretech-data-platform")
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/output/esri_land_cover_raw.csv"
BATCH_SIZE  = 200
SCALE       = 10      # ESRI native 10m
BUFFER_M    = 500
YEARS       = list(range(2017, 2025))
GEE_ASSET   = "projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS"

CLASS_MAP = {
    1: "water_pct",
    2: "trees_pct",
    3: "grass_pct",
    4: "flooded_veg_pct",
    5: "crops_pct",
    6: "scrub_shrub_pct",
    7: "built_area_pct",
    8: "bare_ground_pct",
    9: "snow_ice_pct",
}

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def load_pincodes():
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"],  errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    df["pincode"] = df["pincode"].astype(str)
    return df[["pincode", "lat", "lng"]].reset_index(drop=True)

def get_year_image(collection, year):
    # Filter to the target year and mosaic (handles multi-tile overlap)
    return (
        collection
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .mosaic()
        .select("b1")
    )

def extract_batch(image, rows, year):
    """
    Use frequencyHistogram reducer — one GEE call returns all class pixel counts
    for all pincodes in the batch. Divide counts by total to get percentages.
    """
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]).buffer(BUFFER_M),
            {"pincode": str(r["pincode"])}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)

    reduced = image.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.frequencyHistogram(),
        scale=SCALE,
    )

    results = []
    for feat in reduced.getInfo()["features"]:
        props    = feat["properties"]
        pincode  = props.get("pincode")
        hist     = props.get("histogram") or {}

        # hist keys are string class codes e.g. {"7": 1234, "5": 567}
        total = sum(hist.values()) if hist else 0
        row   = {"pincode": pincode, "year": year}
        for code, col in CLASS_MAP.items():
            count    = hist.get(str(code), hist.get(str(float(code)), 0))
            row[col] = round(count / total * 100, 2) if total > 0 else 0.0
        results.append(row)
    return results

def load_done():
    """Return set of (pincode, year) tuples already extracted."""
    if not os.path.exists(OUTPUT_CSV):
        return set()
    df = pd.read_csv(OUTPUT_CSV, usecols=["pincode", "year"])
    return set(zip(df["pincode"].astype(str), df["year"].astype(int)))

def save(rows):
    df_new = pd.DataFrame(rows)
    if os.path.exists(OUTPUT_CSV):
        df_new = pd.concat([pd.read_csv(OUTPUT_CSV), df_new], ignore_index=True)
    df_new.to_csv(OUTPUT_CSV, index=False)

def main():
    print("Initialising GEE...")
    init_gee()

    print(f"Loading ESRI Land Cover collection: {GEE_ASSET}")
    collection = ee.ImageCollection(GEE_ASSET)

    pincodes = load_pincodes()
    print(f"Loaded {len(pincodes):,} pincodes")

    done = load_done()
    print(f"Already done: {len(done):,} (pincode, year) pairs")

    total_batches = len(YEARS) * ((len(pincodes) + BATCH_SIZE - 1) // BATCH_SIZE)
    batch_num = 0
    errors    = 0

    for year in YEARS:
        print(f"\n-- Year {year} ------------------------------------------")
        image = get_year_image(collection, year)

        # Skip pincodes already done for this year
        remaining = pincodes[
            ~pincodes["pincode"].isin({pc for pc, yr in done if yr == year})
        ].reset_index(drop=True)

        if len(remaining) == 0:
            print(f"  All {len(pincodes):,} pincodes already done for {year}, skipping.")
            continue

        print(f"  {len(remaining):,} pincodes remaining")
        batches   = [remaining.iloc[i:i+BATCH_SIZE] for i in range(0, len(remaining), BATCH_SIZE)]
        all_rows  = []

        for idx, batch in enumerate(batches):
            batch_num += 1
            print(f"  [{year}] Batch {idx+1}/{len(batches)} ({len(batch)} pincodes)...",
                  end=" ", flush=True)
            try:
                rows = extract_batch(image, batch, year)
                all_rows.extend(rows)
                print(f"OK")
            except Exception as e:
                print(f"ERROR: {e}")
                errors += 1
                time.sleep(15)
                continue

            # Checkpoint every 10 batches
            if (idx + 1) % 10 == 0:
                save(all_rows)
                all_rows = []
                print(f"    → Checkpoint saved ({(idx+1)*BATCH_SIZE} done for {year})")

        if all_rows:
            save(all_rows)

        print(f"  Year {year} complete.")

    if os.path.exists(OUTPUT_CSV):
        final = pd.read_csv(OUTPUT_CSV)
        print(f"\nDone. {len(final):,} (pincode, year) rows → {OUTPUT_CSV}")
        print(f"Errors: {errors} batches")
        print(f"\nNext step: python scripts/compute_land_cover_trends.py")
    else:
        print("\nNo output produced — check errors above.")

if __name__ == "__main__":
    main()
