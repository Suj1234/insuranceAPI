"""
Extract WRI Aqueduct Floods v2 — complete expansion.

Columns: 231 data columns across riverine + coastal (nosub + wtsub).
  Riverine baseline (7 RPs)                        =   7
  Riverine projections (6 scenarios × 7 RPs)       =  42
  Coastal nosub historical (7 RPs, p95 only)        =   7
  Coastal nosub projected  (6 scenarios × 7 × 2)   =  84
  Coastal wtsub baseline_2030 (7 RPs, p95 only)     =   7
  Coastal wtsub projected  (6 scenarios × 7 × 2)   =  84
  ──────────────────────────────────────────────────────
  Total                                             = 231

Checkpointing: per-column via aqueduct_done_cols.txt — skips completed columns
on resume. Safe to interrupt and restart at any time.

Runtime: ~8-14 hours depending on GEE latency.
"""

import ee
import json
import os
import time
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

KEY_FILE    = os.environ.get("GEE_KEY_FILE",  "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT",   "insuretech-data-platform")
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/aqueduct_full.csv"
DONE_FILE   = "data/flood/gee_outputs/aqueduct_done_cols.txt"
BATCH_SIZE   = 300
SCALE        = 1000
COLLECTION   = "WRI/Aqueduct_Flood_Hazard_Maps/V2"
BATCH_WORKERS = 3  # parallel GEE batch calls per column

RPS = [10, 25, 50, 100, 250, 500, 1000]

# (gee_scenario_name, year_string, column_label)
SCENARIOS = [
    ("rcp4p5", "2030", "rcp45_2030"),
    ("rcp8p5", "2030", "rcp85_2030"),
    ("rcp4p5", "2050", "rcp45_2050"),
    ("rcp8p5", "2050", "rcp85_2050"),
    ("rcp4p5", "2080", "rcp45_2080"),
    ("rcp8p5", "2080", "rcp85_2080"),
]

def riv_rp(n): return f"rp{n:05d}"  # riverine: rp00010 … rp01000
def cst_rp(n): return f"rp{n:04d}"  # coastal:  rp0010 … rp1000


def build_queries():
    queries = []

    # ── 1. Riverine baseline 1980 (WATCH reanalysis) ─────────────────────────
    for rp in RPS:
        queries.append({
            "id": f"inunriver_historical_000000000WATCH_1980_{riv_rp(rp)}",
            "out_col": f"riverine_rp{rp}_m",
        })

    # ── 2. Riverine projections — ensemble mean of 5 CMIP5 GCMs ─────────────
    for gee_scen, year, label in SCENARIOS:
        for rp in RPS:
            queries.append({
                "filters": ["inunriver", gee_scen, year, riv_rp(rp)],
                "out_col": f"riverine_{label}_rp{rp}_m",
            })

    # ── 3. Coastal nosub historical (~1986-2005, p95 only) ───────────────────
    for rp in RPS:
        queries.append({
            "id": f"inuncoast_historical_nosub_hist_{cst_rp(rp)}_0",
            "out_col": f"coastal_nosub_hist_rp{rp}_p95_m",
        })

    # ── 4. Coastal nosub projected — p95 (_0) and p50 (_0_perc_50) ──────────
    for gee_scen, year, label in SCENARIOS:
        for rp in RPS:
            queries.append({
                "id": f"inuncoast_{gee_scen}_nosub_{year}_{cst_rp(rp)}_0",
                "out_col": f"coastal_nosub_{label}_rp{rp}_p95_m",
            })
            queries.append({
                "id": f"inuncoast_{gee_scen}_nosub_{year}_{cst_rp(rp)}_0_perc_50",
                "out_col": f"coastal_nosub_{label}_rp{rp}_p50_m",
            })

    # ── 5. Coastal wtsub baseline_2030 (historical label, p95 only) ─────────
    for rp in RPS:
        queries.append({
            "id": f"inuncoast_historical_wtsub_2030_{cst_rp(rp)}_0",
            "out_col": f"coastal_wtsub_hist_rp{rp}_p95_m",
        })

    # ── 6. Coastal wtsub projected — p95 and p50 ────────────────────────────
    for gee_scen, year, label in SCENARIOS:
        for rp in RPS:
            queries.append({
                "id": f"inuncoast_{gee_scen}_wtsub_{year}_{cst_rp(rp)}_0",
                "out_col": f"coastal_wtsub_{label}_rp{rp}_p95_m",
            })
            queries.append({
                "id": f"inuncoast_{gee_scen}_wtsub_{year}_{cst_rp(rp)}_0_perc_50",
                "out_col": f"coastal_wtsub_{label}_rp{rp}_p50_m",
            })

    return queries


QUERIES = build_queries()
ALL_COLS = [q["out_col"] for q in QUERIES]


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


def get_image(q):
    if "id" in q:
        return ee.Image(f"{COLLECTION}/{q['id']}")
    col = ee.ImageCollection(COLLECTION)
    for term in q["filters"]:
        col = col.filter(ee.Filter.stringContains("system:index", term))
    count = col.size().getInfo()
    if count == 0:
        raise ValueError(f"No images for filters: {q['filters']}")
    print(f"  ({count} images — ensemble mean)")
    return col.select("inundation_depth").mean()


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


def load_done():
    if os.path.exists(DONE_FILE):
        with open(DONE_FILE) as f:
            return set(f.read().splitlines())
    return set()


def mark_done(col):
    with open(DONE_FILE, "a") as f:
        f.write(col + "\n")


def main():
    print("Initialising GEE...")
    init_gee()

    print(f"Loading pincodes from {PINCODE_CSV}...")
    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes")

    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    print(f"  {len(batches)} batches of {BATCH_SIZE}")

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    # Load or create the output DataFrame
    if os.path.exists(OUTPUT_CSV):
        print(f"Resuming from {OUTPUT_CSV}...")
        result_df = pd.read_csv(OUTPUT_CSV, dtype={"pincode": str})
    else:
        result_df = pd.DataFrame({"pincode": pincodes["pincode"].astype(str)})

    # Ensure all output columns exist (NaN if new)
    for col in ALL_COLS:
        if col not in result_df.columns:
            result_df[col] = None

    done = load_done()
    total = len(QUERIES)
    print(f"\n{len(done)}/{total} columns already done — {total - len(done)} to run\n")

    for qi, q in enumerate(QUERIES, 1):
        col = q["out_col"]
        if col in done:
            print(f"  [{qi:3d}/{total}] skip {col}")
            continue

        label = q.get("id", str(q.get("filters")))
        print(f"\n[{qi:3d}/{total}] {col}")
        print(f"  src: {label}")

        try:
            image = get_image(q)
        except Exception as e:
            print(f"  SKIP — image not found: {e}")
            mark_done(col)  # mark as done (null column) to avoid retrying
            continue

        errors = 0
        col_failed = False
        with ThreadPoolExecutor(max_workers=BATCH_WORKERS) as ex:
            futures = [ex.submit(sample_image, image, b) for b in batches]
            done_count = 0
            for future in as_completed(futures):
                done_count += 1
                if col_failed:
                    continue  # drain remaining futures without writing
                print(f"  batch {done_count}/{len(batches)}", end=" ", flush=True)
                try:
                    values = future.result()
                    for pincode, val in values.items():
                        mask = result_df["pincode"] == str(pincode)
                        result_df.loc[mask, col] = round(float(val), 3) if val is not None else None
                    print("ok")
                except Exception as e:
                    errors += 1
                    print(f"ERR({errors}): {e}")
                    if errors >= 5:
                        print(f"  Too many errors on {col} — will skip")
                        col_failed = True

        result_df.to_csv(OUTPUT_CSV, index=False)
        mark_done(col)
        print(f"  saved — {col}")

    print(f"\nDone. {OUTPUT_CSV} — {len(result_df):,} pincodes × {len(ALL_COLS)} columns")


if __name__ == "__main__":
    main()
