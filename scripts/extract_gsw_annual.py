"""
Aggregate JRC MonthlyHistory by year (1984-2021) for all Indian pincodes via GEE.
Each year: sum all 12 monthly images server-side, then reduceRegions.

38 years x 10 batches = 380 GEE calls, ~5-6 hours.

Output: data/flood/gee_outputs/gsw_annual.csv
Columns: pincode, year, water_sum, valid_sum, month_count

Provides: occurrence_stddev_pct, trend_direction, risk_acceleration,
          extreme_events (worst_flood_year, severe_flood_years, return_period),
          yearly_profile.seasonality_months, yearly_profile.months_with_obs
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_annual.csv"
BATCH_SIZE = 2000
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


def extract_batch(ic_year, month_count, fc):
    # Sum water and valid flags across all months in this year — server-side
    water_sum_img = ic_year.map(lambda img: img.select("water").eq(2).rename("water_sum")).sum()
    valid_sum_img = ic_year.map(lambda img: img.select("water").gt(0).rename("valid_sum")).sum()
    combined      = water_sum_img.addBands(valid_sum_img)
    reduced       = combined.reduceRegions(collection=fc, reducer=ee.Reducer.sum(), scale=SCALE)

    results = {}
    for feat in reduced.getInfo()["features"]:
        props = feat["properties"]
        pc    = props.get("pincode")
        results[pc] = {
            "water_sum":   int(props.get("water_sum", 0) or 0),
            "valid_sum":   int(props.get("valid_sum", 0) or 0),
            "month_count": month_count,
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
    ic = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    done = set()
    if os.path.exists(OUTPUT_CSV):
        existing = pd.read_csv(OUTPUT_CSV)
        done = set(
            existing.groupby("year")
            .filter(lambda g: g["pincode"].nunique() >= len(pincodes) * 0.99)
            ["year"].unique()
        )
        print(f"  Resuming -- {len(done)} years done")

    batches    = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    years_todo = [y for y in YEARS if y not in done]
    print(f"  {len(years_todo)} years x {len(batches)} batches = {len(years_todo)*len(batches)} calls")

    for year in years_todo:
        ic_year     = ic.filter(ee.Filter.calendarRange(year, year, "year"))
        month_count = ic_year.size().getInfo()  # 12 for complete years, may vary at edges
        year_rows   = []

        for b_idx, batch in enumerate(batches):
            print(f"  [year {year}] batch {b_idx+1}/{len(batches)} ({month_count} months)...",
                  end=" ", flush=True)
            fc = build_fc(batch)
            try:
                hist_map = extract_batch(ic_year, month_count, fc)
                for _, r in batch.iterrows():
                    pc = str(int(r["pincode"]))
                    v  = hist_map.get(pc, {"water_sum": 0, "valid_sum": 0, "month_count": month_count})
                    year_rows.append({"pincode": pc, "year": year,
                                      "water_sum": v["water_sum"], "valid_sum": v["valid_sum"],
                                      "month_count": month_count})
                print("OK")
            except Exception as e:
                print(f"ERROR: {e}")
                time.sleep(10)

        # Flush per year — partial years re-run cleanly on resume
        if year_rows:
            flush(year_rows, OUTPUT_CSV)
            print(f"  Year {year} written ({len(year_rows):,} rows)")

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} rows -> {OUTPUT_CSV}")
    print(f"  {final['pincode'].nunique():,} pincodes x {final['year'].nunique()} years")


if __name__ == "__main__":
    main()
