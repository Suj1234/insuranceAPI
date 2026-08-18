"""
Extract JRC Global Surface Water MonthlyHistory for all Indian pincodes via GEE.
Uses 500m buffer + frequencyHistogram. Band name is 'water' (not 'waterClass').

water band: 0=no_data, 1=land, 2=water

Output: data/flood/gee_outputs/gsw_monthly.csv
Columns: pincode, year, month, water_sum, valid_sum

~454 monthly images × 10 batches (at 2000/batch) = 4,540 GEE calls, ~4-6 hrs.
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_monthly.csv"
BATCH_SIZE = 2000
SCALE      = 30
BUFFER_M   = 500


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


def extract_batch(img, fc):
    # Monthly band is 'water': 0=no_data, 1=land, 2=water
    hist_fc = img.select("water").reduceRegions(
        collection=fc, reducer=ee.Reducer.frequencyHistogram(), scale=SCALE,
    )
    results = {}
    for feat in hist_fc.getInfo()["features"]:
        props = feat["properties"]
        pc    = props.get("pincode")
        hist  = props.get("histogram", {}) or {}
        land  = int(hist.get("1", 0) or 0)
        water = int(hist.get("2", 0) or 0)
        results[pc] = {"water_sum": water, "valid_sum": land + water}
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

    imgs_info = ic.aggregate_array("system:index").getInfo()
    ym_pairs  = []
    for s in sorted(imgs_info):
        parts = s.split("_")
        if len(parts) == 2:
            ym_pairs.append((int(parts[0]), int(parts[1])))
    print(f"  {len(ym_pairs)} monthly images")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    # Resume: which (year, month) images are fully done
    done_ym = set()
    if os.path.exists(OUTPUT_CSV):
        existing  = pd.read_csv(OUTPUT_CSV)
        threshold = len(pincodes) * 0.99
        done_ym   = set(
            map(tuple,
                existing.groupby(["year", "month"])
                .filter(lambda g: g["pincode"].nunique() >= threshold)
                [["year", "month"]].drop_duplicates().values.tolist()
            )
        )
        print(f"  Resuming — {len(done_ym)} complete months already done")

    batches   = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    ym_todo   = [(y, m) for y, m in ym_pairs if (y, m) not in done_ym]
    total     = len(ym_todo) * len(batches)
    print(f"  {len(ym_todo)} months remaining x {len(batches)} batches = {total:,} calls")

    call_num = 0
    for year, month in ym_todo:
        img = ic.filter(ee.Filter.eq("year", year)) \
                .filter(ee.Filter.eq("month", month)) \
                .first()

        month_rows = []
        for b_idx, batch in enumerate(batches):
            call_num += 1
            if call_num % 50 == 1:
                print(f"  [{year}-{month:02d}] batch {b_idx+1}/{len(batches)} "
                      f"(call {call_num}/{total})...", end=" ", flush=True)
            fc = build_fc(batch)
            try:
                hist_map = extract_batch(img, fc)
                for _, r in batch.iterrows():
                    pc   = str(int(r["pincode"]))
                    vals = hist_map.get(pc, {"water_sum": 0, "valid_sum": 0})
                    month_rows.append({"pincode": pc, "year": year, "month": month,
                                       "water_sum": vals["water_sum"],
                                       "valid_sum": vals["valid_sum"]})
                if call_num % 50 == 1:
                    print("OK")
            except Exception as e:
                if call_num % 50 == 1:
                    print(f"ERROR: {e}")
                else:
                    print(f"\n  ERROR [{year}-{month:02d}] batch {b_idx+1}: {e}")
                time.sleep(10)

        # Flush per image — resume skips complete months, so partial months re-run safely
        if month_rows:
            flush(month_rows, OUTPUT_CSV)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} rows → {OUTPUT_CSV}")
    print(f"  {final['pincode'].nunique():,} pincodes, "
          f"{final[['year','month']].drop_duplicates().shape[0]} months")


if __name__ == "__main__":
    main()
