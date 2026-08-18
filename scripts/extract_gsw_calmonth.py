"""
Aggregate JRC MonthlyHistory by calendar month (Jan-Dec) across all years for Indian pincodes.
Each month: sum all 38 yearly images server-side, then reduceRegions.

12 months x 10 batches = 120 GEE calls, ~2-3 hours.

Output: data/flood/gee_outputs/gsw_calmonth.csv
Columns: pincode, month, water_sum, valid_sum, year_count

Provides: monthly_pattern[12], flood_season_timing, season_aggregates, pmfby_windows,
          cloud_bias_flag (months with low valid_sum relative to others)
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_calmonth.csv"
BATCH_SIZE = 2000
SCALE      = 30
BUFFER_M   = 500
MONTHS     = list(range(1, 13))
YEAR_COUNT = 38  # 1984-2021 inclusive


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


def extract_batch(ic_month, fc):
    # Sum water and valid flags across all years for this calendar month — server-side
    water_sum_img = ic_month.map(lambda img: img.select("water").eq(2).rename("water_sum")).sum()
    valid_sum_img = ic_month.map(lambda img: img.select("water").gt(0).rename("valid_sum")).sum()
    combined      = water_sum_img.addBands(valid_sum_img)
    reduced       = combined.reduceRegions(collection=fc, reducer=ee.Reducer.sum(), scale=SCALE)

    results = {}
    for feat in reduced.getInfo()["features"]:
        props = feat["properties"]
        pc    = props.get("pincode")
        results[pc] = {
            "water_sum": int(props.get("water_sum", 0) or 0),
            "valid_sum": int(props.get("valid_sum", 0) or 0),
        }
    return results


def flush(rows, path):
    df = pd.DataFrame(rows)
    if os.path.exists(path):
        df = pd.concat([pd.read_csv(path), df], ignore_index=True)
    df.to_csv(path, index=False)


def main():
    print("Initialising GEE...")
    init_gee()
    ic = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory").filterDate("1984-01-01", "2022-01-01")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    done = set()
    if os.path.exists(OUTPUT_CSV):
        existing = pd.read_csv(OUTPUT_CSV)
        done = set(
            existing.groupby("month")
            .filter(lambda g: g["pincode"].nunique() >= len(pincodes) * 0.99)
            ["month"].unique()
        )
        print(f"  Resuming -- {len(done)} months done: {sorted(done)}")

    batches     = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    months_todo = [m for m in MONTHS if m not in done]
    print(f"  {len(months_todo)} months x {len(batches)} batches = {len(months_todo)*len(batches)} calls")

    for month in months_todo:
        ic_month   = ic.filter(ee.Filter.calendarRange(month, month, "month"))
        month_rows = []

        for b_idx, batch in enumerate(batches):
            print(f"  [month {month:02d}] batch {b_idx+1}/{len(batches)}...", end=" ", flush=True)
            fc = build_fc(batch)
            try:
                hist_map = extract_batch(ic_month, fc)
                for _, r in batch.iterrows():
                    pc = str(int(r["pincode"]))
                    v  = hist_map.get(pc, {"water_sum": 0, "valid_sum": 0})
                    month_rows.append({"pincode": pc, "month": month,
                                       "water_sum": v["water_sum"], "valid_sum": v["valid_sum"],
                                       "year_count": YEAR_COUNT})
                print("OK")
            except Exception as e:
                print(f"ERROR: {e}")
                time.sleep(10)

        if month_rows:
            flush(month_rows, OUTPUT_CSV)
            print(f"  Month {month:02d} written ({len(month_rows):,} rows)")

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} rows -> {OUTPUT_CSV}")
    print(f"  {final['pincode'].nunique():,} pincodes x {final['month'].nunique()} months")


if __name__ == "__main__":
    main()
