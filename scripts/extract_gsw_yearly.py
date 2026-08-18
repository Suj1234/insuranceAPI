"""
Extract JRC Global Surface Water YearlyHistory (1984-2021) for all Indian pincodes via GEE.
Uses 500m buffer + frequencyHistogram.

waterClass: 0=no_data, 1=land, 2=seasonal_water, 3=permanent_water

Output: data/flood/gee_outputs/gsw_yearly.csv
1 GEE call per batch per year → 38 years × 39 batches = ~1,480 calls, ~1.3 hrs.
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_yearly.csv"
BATCH_SIZE = 500
SCALE      = 30
BUFFER_M   = 500
YEARS      = list(range(1984, 2022))


def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)


def load_pincodes():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    df = pd.read_sql(
        "SELECT pincode, lat::float AS lat, lng::float AS lng FROM pincode_coords ORDER BY pincode",
        conn,
    )
    conn.close()
    return df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)].reset_index(drop=True)


def build_fc(rows):
    feats = []
    for _, r in rows.iterrows():
        pt  = ee.Geometry.Point([float(r["lng"]), float(r["lat"])])
        buf = pt.buffer(BUFFER_M)
        feats.append(ee.Feature(buf, {"pincode": str(int(r["pincode"]))}))
    return ee.FeatureCollection(feats)


def extract_year_batch(annual_img, fc):
    hist_fc = annual_img.select("waterClass").reduceRegions(
        collection=fc, reducer=ee.Reducer.frequencyHistogram(), scale=SCALE,
    )
    results = []
    for feat in hist_fc.getInfo()["features"]:
        props = feat["properties"]
        hist  = props.get("histogram", {}) or {}
        land     = int(hist.get("1", 0) or 0)
        seasonal = int(hist.get("2", 0) or 0)
        perm     = int(hist.get("3", 0) or 0)
        results.append({
            "pincode":      props.get("pincode"),
            "perm_pixels":  perm,
            "seas_pixels":  seasonal,
            "land_pixels":  land,
            "total_pixels": land + seasonal + perm,
        })
    return results


def flush(rows, path):
    df = pd.DataFrame(rows)
    if os.path.exists(path):
        df = pd.concat([pd.read_csv(path), df], ignore_index=True)
    df.to_csv(path, index=False)


def main():
    print("Initialising GEE...")
    init_gee()
    ic = ee.ImageCollection("JRC/GSW1_4/YearlyHistory")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    done_years = set()
    if os.path.exists(OUTPUT_CSV):
        existing    = pd.read_csv(OUTPUT_CSV)
        done_years  = set(
            existing.groupby("year")
            .filter(lambda g: g["pincode"].nunique() >= len(pincodes) * 0.99)
            ["year"].unique()
        )
        print(f"  Resuming — {len(done_years)} complete years already done")

    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    years_todo = [y for y in YEARS if y not in done_years]
    print(f"  {len(years_todo)} years remaining × {len(batches)} batches")

    for year in years_todo:
        annual_img = ic.filter(ee.Filter.eq("year", year)).first()
        year_rows  = []

        for b_idx, batch in enumerate(batches):
            print(f"  Year {year} batch {b_idx+1}/{len(batches)}...", end=" ", flush=True)
            fc = build_fc(batch)
            try:
                rows = extract_year_batch(annual_img, fc)
                for row in rows:
                    year_rows.append({"pincode": row["pincode"], "year": year,
                                      "perm_pixels": row["perm_pixels"],
                                      "seas_pixels": row["seas_pixels"],
                                      "land_pixels": row["land_pixels"],
                                      "total_pixels": row["total_pixels"]})
                print("OK")
            except Exception as e:
                print(f"ERROR: {e}")
                time.sleep(10)

        # Flush entire year at once — if any batch failed, the year will re-run on resume
        if year_rows:
            flush(year_rows, OUTPUT_CSV)
            print(f"  Year {year} written ({len(year_rows):,} rows)")

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} rows → {OUTPUT_CSV}")
    print(f"  {final['pincode'].nunique():,} pincodes × {final['year'].nunique()} years")


if __name__ == "__main__":
    main()
