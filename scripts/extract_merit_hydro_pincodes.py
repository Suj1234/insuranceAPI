"""
Extract all MERIT Hydro v1.0.1 bands for all Indian PIN codes via GEE.

Bands extracted:
  hnd  → hand_m              (height above nearest drainage, metres)
  elv  → elevation_m         (hydrologically adjusted elevation, metres)
  upa  → upstream_area_km2   (upstream drainage area, km²)
  wth  → river_width_m       (river channel width, metres)
  wat  → on_permanent_water  (permanent water body: 0 or 1)
  dir  → flow_direction_code (D8 direction integer)

Output: data/output/merit_hydro_pincodes.csv
Runtime: ~2–3 hours for 19,000 PIN codes (runs unattended)
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE   = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT    = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/output/merit_hydro_pincodes.csv"
BATCH_SIZE  = 250   # smaller batches — 6 bands per point is more data than single-band
SCALE       = 92    # MERIT Hydro native resolution (~92.77m)

BANDS = ['hnd', 'elv', 'upa', 'wth', 'wat', 'dir']

COL_MAP = {
    'hnd': 'hand_m',
    'elv': 'elevation_m',
    'upa': 'upstream_area_km2',
    'wth': 'river_width_m',
    'wat': 'on_permanent_water',
    'dir': 'flow_direction_code',
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

def safe_float(val, decimals=3):
    try:
        return round(float(val), decimals) if val is not None else None
    except (TypeError, ValueError):
        return None

def extract_batch(image, rows):
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]),
            {"pincode": str(r["pincode"])}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)

    # sampleRegions returns one feature per point with all band values as properties
    sampled = image.sampleRegions(
        collection=fc,
        scale=SCALE,
        geometries=False,
    )

    results = []
    for feat in sampled.getInfo()["features"]:
        props = feat["properties"]
        results.append({
            "pincode":             props.get("pincode"),
            "hand_m":              safe_float(props.get("hnd"), 2),
            "elevation_m":         safe_float(props.get("elv"), 2),
            "upstream_area_km2":   safe_float(props.get("upa"), 3),
            "river_width_m":       safe_float(props.get("wth"), 1),
            "on_permanent_water":  int(props.get("wat", 0)) if props.get("wat") is not None else None,
            "flow_direction_code": int(props.get("dir")) if props.get("dir") is not None else None,
        })
    return results

def save(rows, path):
    df_new = pd.DataFrame(rows)
    if os.path.exists(path):
        df_new = pd.concat([pd.read_csv(path), df_new], ignore_index=True)
    df_new.to_csv(path, index=False)

def main():
    print("Initialising GEE...")
    init_gee()

    image = ee.Image("MERIT/Hydro/v1_0_1").select(BANDS)
    print(f"Loaded MERIT Hydro v1.0.1 — bands: {BANDS}")

    pincodes = load_pincodes()
    print(f"Loaded {len(pincodes):,} PIN codes")

    # Resume support — skip already-done PIN codes
    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"Resuming — {len(done):,} already done, {len(pincodes) - len(done):,} remaining")
    pincodes = pincodes[~pincodes["pincode"].astype(str).isin(done)].reset_index(drop=True)

    batches   = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    all_rows  = []
    errors    = 0

    print(f"Running {len(batches)} batches of {BATCH_SIZE}...")

    for idx, batch in enumerate(batches):
        print(f"  Batch {idx+1}/{len(batches)} ({len(batch)} PIN codes)...", end=" ", flush=True)
        try:
            rows = extract_batch(image, batch)
            all_rows.extend(rows)
            print(f"OK — {len(rows)} rows")
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1
            time.sleep(10)
            continue

        # Flush to CSV every 10 batches
        if (idx + 1) % 10 == 0:
            save(all_rows, OUTPUT_CSV)
            print(f"    → Saved checkpoint ({(idx+1)*BATCH_SIZE} processed)")
            all_rows = []

    if all_rows:
        save(all_rows, OUTPUT_CSV)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} PIN codes → {OUTPUT_CSV}")
    print(f"Errors: {errors} batches")
    print(f"Median HAND: {final['hand_m'].median():.1f} m")
    print(f"HAND <= 2m (extreme risk): {(final['hand_m'] <= 2).sum():,} PIN codes")
    print(f"On permanent water: {(final['on_permanent_water'] == 1).sum():,} PIN codes")
    print(f"Inland depressions: {(final['flow_direction_code'] == -1).sum():,} PIN codes")

if __name__ == "__main__":
    main()
