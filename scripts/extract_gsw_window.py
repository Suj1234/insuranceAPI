"""
Aggregate JRC MonthlyHistory over 5 time windows for all Indian pincodes via GEE.
Server-side sum over all images in each window, then reduceRegions.

5 windows x 10 batches = 50 GEE calls, ~1-2 hours.

Output: data/flood/gee_outputs/gsw_window.csv
Columns: pincode, window, water_sum, valid_sum, month_count
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_window.csv"
BATCH_SIZE = 2000
SCALE      = 30
BUFFER_M   = 500

# (start_year, start_month, end_year, end_month) — all inclusive
WINDOWS = {
    "full": (1984,  1, 2021, 12),
    "w20":  (2002,  1, 2021, 12),
    "w10":  (2012,  1, 2021, 12),
    "w5":   (2017,  1, 2021, 12),
    "w2":   (2020,  1, 2021, 12),
}


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


def window_month_count(sy, sm, ey, em):
    return (ey - sy) * 12 + (em - sm + 1)


def filter_to_window(ic, sy, sm, ey, em):
    # filterDate end is exclusive -> advance by 1 month
    start = f"{sy}-{sm:02d}-01"
    if em == 12:
        end = f"{ey + 1}-01-01"
    else:
        end = f"{ey}-{em + 1:02d}-01"
    return ic.filterDate(start, end)


def extract_batch(ic_window, fc):
    # Sum water flags and valid flags across all images in window — all server-side
    water_sum_img = ic_window.map(lambda img: img.select("water").eq(2).rename("water_sum")).sum()
    valid_sum_img = ic_window.map(lambda img: img.select("water").gt(0).rename("valid_sum")).sum()
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
    ic = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    done = set()
    if os.path.exists(OUTPUT_CSV):
        existing = pd.read_csv(OUTPUT_CSV)
        done = set(
            existing.groupby("window")
            .filter(lambda g: g["pincode"].nunique() >= len(pincodes) * 0.99)
            ["window"].unique()
        )
        print(f"  Resuming -- {len(done)} windows done: {sorted(done)}")

    batches   = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    wins_todo = [(name, *params) for name, params in WINDOWS.items() if name not in done]
    total     = len(wins_todo) * len(batches)
    print(f"  {len(wins_todo)} windows x {len(batches)} batches = {total} calls")

    for win_name, sy, sm, ey, em in wins_todo:
        n_months  = window_month_count(sy, sm, ey, em)
        ic_window = filter_to_window(ic, sy, sm, ey, em)
        win_rows  = []

        for b_idx, batch in enumerate(batches):
            print(f"  [{win_name}] batch {b_idx+1}/{len(batches)}...", end=" ", flush=True)
            fc = build_fc(batch)
            try:
                hist_map = extract_batch(ic_window, fc)
                for _, r in batch.iterrows():
                    pc = str(int(r["pincode"]))
                    v  = hist_map.get(pc, {"water_sum": 0, "valid_sum": 0})
                    win_rows.append({"pincode": pc, "window": win_name,
                                     "water_sum": v["water_sum"], "valid_sum": v["valid_sum"],
                                     "month_count": n_months})
                print("OK")
            except Exception as e:
                print(f"ERROR: {e}")
                time.sleep(10)

        if win_rows:
            flush(win_rows, OUTPUT_CSV)
            print(f"  Window {win_name} written ({len(win_rows):,} rows)")

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} rows -> {OUTPUT_CSV}")
    print(f"  {final['pincode'].nunique():,} pincodes x {final['window'].nunique()} windows")


if __name__ == "__main__":
    main()
