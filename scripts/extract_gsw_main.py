"""
Extract JRC Global Surface Water v1.4 main bands for all Indian pincodes via GEE.
Uses 500m buffer + proper reducers (not point sampling).

Output: data/flood/gee_outputs/gsw_main.csv
4 GEE calls per batch of 500 pincodes → ~160 calls total, ~45 min.
"""

import ee
import json
import os
import time
import pandas as pd
import psycopg2

KEY_FILE  = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT   = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")

OUTPUT_CSV = "data/flood/gee_outputs/gsw_main.csv"
BATCH_SIZE = 500
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
        "SELECT pincode, lat::float AS lat, lng::float AS lng, "
        "district_name AS district, state_name AS state "
        "FROM pincode_coords ORDER BY pincode",
        conn,
    )
    conn.close()
    return df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)].reset_index(drop=True)


def build_buffer_fc(rows):
    feats = []
    for _, r in rows.iterrows():
        pt  = ee.Geometry.Point([float(r["lng"]), float(r["lat"])])
        buf = pt.buffer(BUFFER_M)
        feats.append(ee.Feature(buf, {
            "pincode":  str(int(r["pincode"])),
            "lat":      float(r["lat"]),
            "lng":      float(r["lng"]),
            "district": str(r["district"]) if pd.notna(r["district"]) else "",
            "state":    str(r["state"])    if pd.notna(r["state"])    else "",
        }))
    return ee.FeatureCollection(feats)


def build_point_fc(rows):
    feats = []
    for _, r in rows.iterrows():
        pt = ee.Geometry.Point([float(r["lng"]), float(r["lat"])])
        feats.append(ee.Feature(pt, {"pincode": str(int(r["pincode"]))}))
    return ee.FeatureCollection(feats)


def extract_batch(gsw, rows):
    buf_fc = build_buffer_fc(rows)
    pt_fc  = build_point_fc(rows)
    ever   = gsw.select("max_extent")

    # Call 1: mean of water-masked continuous bands + area_ever_water_frac
    masked   = gsw.select(["occurrence", "recurrence", "seasonality", "change_abs", "change_norm"]) \
                  .updateMask(ever)
    call1    = masked.addBands(ever.rename("area_ever_water_frac"))
    mean_fc  = call1.reduceRegions(collection=buf_fc, reducer=ee.Reducer.mean(), scale=SCALE)

    # Call 2: mode of transition
    mode_fc  = gsw.select("transition").reduceRegions(collection=buf_fc, reducer=ee.Reducer.mode(), scale=SCALE)

    # Call 3: pixel counts
    perm_px  = gsw.select("occurrence").gte(75).rename("perm_px")
    flood_px = gsw.select("occurrence").gt(0).And(gsw.select("occurrence").lt(75)).rename("flood_px")
    never_px = ever.Not().rename("never_px")
    total_px = ee.Image.constant(1).rename("total_px")
    sum_fc   = perm_px.addBands(flood_px).addBands(never_px).addBands(total_px) \
                      .reduceRegions(collection=buf_fc, reducer=ee.Reducer.sum(), scale=SCALE)

    # Call 4: point sample — center_is_water + distance to nearest water pixel
    # distance() finds nearest nonzero pixel — max_extent=1 at water pixels
    dist_img = ever.distance(ee.Kernel.euclidean(radius=7500, units="meters")).rename("dist_m")
    pt_img   = ever.rename("center_is_water").addBands(dist_img)
    pt_fc_r  = pt_img.reduceRegions(collection=pt_fc, reducer=ee.Reducer.first(), scale=SCALE)

    mean_map = {f["properties"]["pincode"]: f["properties"] for f in mean_fc.getInfo()["features"]}
    mode_map = {f["properties"]["pincode"]: f["properties"] for f in mode_fc.getInfo()["features"]}
    sum_map  = {f["properties"]["pincode"]: f["properties"] for f in sum_fc.getInfo()["features"]}
    pt_map   = {f["properties"]["pincode"]: f["properties"] for f in pt_fc_r.getInfo()["features"]}

    def rnd(v, n=4):
        return round(float(v), n) if v is not None else None

    results = []
    for _, r in rows.iterrows():
        pc = str(int(r["pincode"]))
        m  = mean_map.get(pc, {})
        mo = mode_map.get(pc, {})
        s  = sum_map.get(pc, {})
        p  = pt_map.get(pc, {})

        results.append({
            "pincode":              pc,
            "lat":                  float(r["lat"]),
            "lng":                  float(r["lng"]),
            "district":             str(r["district"]) if pd.notna(r["district"]) else None,
            "state":                str(r["state"])    if pd.notna(r["state"])    else None,
            "occurrence":           rnd(m.get("occurrence")),
            "recurrence":           rnd(m.get("recurrence")),
            "seasonality_2021":     rnd(m.get("seasonality")),
            "change_abs":           rnd(m.get("change_abs")),
            "change_norm":          rnd(m.get("change_norm")),
            "area_ever_water_frac": rnd(m.get("area_ever_water_frac")),
            "transition":           int(mo["mode"]) if mo.get("mode") is not None else None,
            "perm_water_pixels":    int(s["perm_px"])  if s.get("perm_px")  is not None else None,
            "flood_zone_pixels":    int(s["flood_px"]) if s.get("flood_px") is not None else None,
            "never_water_pixels":   int(s["never_px"]) if s.get("never_px") is not None else None,
            "total_buffer_pixels":  int(s["total_px"]) if s.get("total_px") is not None else None,
            "center_is_water":      bool(p.get("first", 0)),
            "distance_to_water_m":  rnd(p.get("dist_m"), 1),
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
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    print("Loaded JRC/GSW1_4/GlobalSurfaceWater")

    pincodes = load_pincodes()
    print(f"  {len(pincodes):,} pincodes loaded")

    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"  Resuming — {len(done):,} already done")
    pincodes = pincodes[~pincodes["pincode"].astype(str).isin(done)].reset_index(drop=True)

    batches = [pincodes.iloc[i:i+BATCH_SIZE] for i in range(0, len(pincodes), BATCH_SIZE)]
    print(f"  {len(batches)} batches remaining")

    for idx, batch in enumerate(batches):
        print(f"  Batch {idx+1}/{len(batches)}...", end=" ", flush=True)
        try:
            rows = extract_batch(gsw, batch)
            flush(rows, OUTPUT_CSV)   # flush every batch — no data loss on kill
            print("OK")
        except Exception as e:
            print(f"ERROR: {e}")
            time.sleep(10)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} pincodes → {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
