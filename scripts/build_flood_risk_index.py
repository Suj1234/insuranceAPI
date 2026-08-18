"""
Merge all flood extraction outputs into a single index and load to DB.

Reads every CSV from data/flood/gee_outputs/ and merges on pincode.
Writes ALL raw columns to pincode_flood_index table (nothing discarded).
Also computes flood_risk_score (0-100) and flood_risk_class.

Run after all extraction scripts complete:
  - data/flood/gee_outputs/jrc_glofas.csv
  - data/flood/gee_outputs/jrc_gsw.csv
  - data/flood/gee_outputs/aqueduct.csv
  - data/flood/gee_outputs/hand_terrain.csv
  - data/flood/gee_outputs/worldcover.csv
  - data/flood/gee_outputs/river_distance.csv
  - data/flood/gee_outputs/dam_watch.csv
  - data/flood/gee_outputs/ndma_districts.csv
  - data/flood/gee_outputs/imd_rainfall.csv
  - data/output/emdat_disaster_summary.csv (optional)
  - data/output/pincode_coords.csv (for identity fields)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

# -- Config ---------------------------------------------------------------------

PINCODE_CSV   = "data/output/pincode_coords.csv"
GEE_DIR       = "data/flood/gee_outputs"
EMDAT_CSV     = "data/output/emdat_disaster_summary.csv"
OUTPUT_CSV    = "data/output/flood_risk_index.csv"

def gee(filename):
    return os.path.join(GEE_DIR, filename)

# -- Load base pincode table ---------------------------------------------------

def load_pincodes():
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    df["pincode"] = df["pincode"].astype(str)
    return df[["pincode", "district", "statename", "lat", "lng"]].rename(columns={
        "district":  "district_name",
        "statename": "state_name",
    })

# -- Scoring helpers ------------------------------------------------------------

def clamp(arr, lo=0.0, hi=100.0):
    return np.clip(arr, lo, hi)

def score_glofas(df):
    """RP100 flood depth -> 0-100. null=0, >=3m=100."""
    depth = df.get("jrc_rp100_depth_m", pd.Series(dtype=float))
    return clamp(pd.to_numeric(depth, errors="coerce").fillna(0) / 3.0 * 100)

def score_gsw(df):
    """Historical occurrence % -> 0-100."""
    occ = df.get("gsw_occurrence_pct", pd.Series(dtype=float))
    return clamp(pd.to_numeric(occ, errors="coerce").fillna(0))

def score_aqueduct(df):
    """Riverine RP100 depth -> 0-100. 0 = outside zone (not null). >=3m=100."""
    depth = df.get("aqd_riverine_rp100_m", pd.Series(dtype=float))
    vals  = pd.to_numeric(depth, errors="coerce").fillna(0)
    return clamp(vals / 3.0 * 100)

def score_hand(df):
    """Low HAND = high risk. 0m=100, >=20m=0."""
    hand = df.get("hand_elevation_m", pd.Series(dtype=float))
    vals = pd.to_numeric(hand, errors="coerce").fillna(20)
    return clamp(100 - vals / 20.0 * 100)

def score_rainfall(df):
    """Extreme rain days per year -> 0-100. >=30 days/yr=100."""
    days = df.get("imd_extreme_rain_days_per_yr", pd.Series(dtype=float))
    return clamp(pd.to_numeric(days, errors="coerce").fillna(0) / 30.0 * 100)

def score_dam(df):
    """Upstream flood-control dam = high risk (can fail). Dam present = 40 base score."""
    present = df.get("upstream_dam_present", pd.Series(dtype=object))
    dam_type = df.get("upstream_dam_type", pd.Series(dtype=object))
    score = pd.Series(0.0, index=df.index)
    has_dam = present.fillna(False).astype(bool)
    is_flood_ctrl = dam_type.str.lower().str.contains("flood", na=False)
    score = np.where(is_flood_ctrl, 60.0, np.where(has_dam, 40.0, 0.0))
    return clamp(pd.Series(score, index=df.index))

WEIGHTS = {
    "score_glofas":   0.30,
    "score_gsw":      0.20,
    "score_aqueduct": 0.20,
    "score_hand":     0.15,
    "score_rainfall": 0.10,
    "score_dam":      0.05,
}

def classify(score):
    if score >= 70:   return "Very High"
    if score >= 45:   return "High"
    if score >= 20:   return "Medium"
    return "Low"

# -- DB load -------------------------------------------------------------------

def get_db_url():
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    for fname in [".env.local", ".env", ".env.production.local"]:
        if os.path.exists(fname):
            with open(fname) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL"):
                        return line.split("=", 1)[1].strip()
    return None

def load_to_db(df, db_url):
    conn = psycopg2.connect(db_url, sslmode="require")
    cur  = conn.cursor()

    # Truncate and reload (idempotent)
    cur.execute("TRUNCATE TABLE pincode_flood_index")
    conn.commit()

    cols = list(df.columns)
    placeholders = ", ".join(["%s"] * len(cols))
    col_names    = ", ".join(cols)

    insert_sql = f"""
        INSERT INTO pincode_flood_index ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (pincode) DO UPDATE SET
            {", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "pincode")},
            updated_at = now()
    """

    rows = [tuple(None if (isinstance(v, float) and np.isnan(v)) else v
                  for v in row)
            for row in df.itertuples(index=False)]

    psycopg2.extras.execute_batch(cur, insert_sql, rows, page_size=1000)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM pincode_flood_index")
    count = cur.fetchone()[0]
    print(f"  Loaded {count:,} rows to pincode_flood_index")

    cur.close()
    conn.close()

# -- Main ----------------------------------------------------------------------

def main():
    print("Loading base pincodes...")
    df = load_pincodes()
    print(f"  {len(df):,} pincodes")

    # Merge each source file
    sources = {
        "jrc_glofas.csv":     "pincode",
        "jrc_gsw.csv":        "pincode",
        "aqueduct.csv":       "pincode",
        "hand_terrain.csv":   "pincode",
        "worldcover.csv":     "pincode",
        "river_distance.csv": "pincode",
        "dam_watch.csv":      "pincode",
        "imd_rainfall.csv":   "pincode",
    }

    for fname, key in sources.items():
        fpath = gee(fname)
        if not os.path.exists(fpath):
            print(f"  SKIP {fname} -- not found (run extraction script first)")
            continue
        src = pd.read_csv(fpath)
        src[key] = src[key].astype(str)
        before = len(df)
        df = df.merge(src, on=key, how="left")
        print(f"  Merged {fname}: {len(src):,} rows")
        assert len(df) == before, f"Row count changed after merging {fname}"

    # NDMA districts (join on district+state name)
    ndma_path = gee("ndma_districts.csv")
    if os.path.exists(ndma_path):
        ndma = pd.read_csv(ndma_path)
        ndma["district_name_norm"] = ndma["district_name"].str.strip().str.upper()
        ndma["state_name_norm"]    = ndma["state_name"].str.strip().str.upper()
        df["district_name_norm"]   = df["district_name"].str.strip().str.upper()
        df["state_name_norm"]      = df["state_name"].str.strip().str.upper()
        ndma_set = set(zip(ndma["district_name_norm"], ndma["state_name_norm"]))
        df["ndma_flood_prone_district"] = list(
            zip(df["district_name_norm"], df["state_name_norm"])
        )
        df["ndma_flood_prone_district"] = df["ndma_flood_prone_district"].isin(ndma_set)
        df = df.drop(columns=["district_name_norm", "state_name_norm"])
        print(f"  NDMA: {df['ndma_flood_prone_district'].sum():,} flood-prone pincodes")

    # EM-DAT (district-level, join on district+state — normalize to uppercase)
    if os.path.exists(EMDAT_CSV):
        emdat = pd.read_csv(EMDAT_CSV)
        if "district_name" in emdat.columns and "state_name" in emdat.columns:
            emdat = emdat.rename(columns={
                "flood_events_per_decade": "emdat_flood_events_per_decade",
                "disaster_insurance_loss_cr": "emdat_flood_loss_cr",
            })
            # emdat uses concatenated CamelCase (no spaces); pincode uses UPPER WITH SPACES
            # normalize both to uppercase with no spaces for matching
            emdat["_dist_key"] = emdat["district_name"].str.replace(" ", "", regex=False).str.upper()
            emdat["_state_key"] = emdat["state_name"].str.replace(" ", "", regex=False).str.upper()
            # deduplicate emdat on normalized key (GADM sometimes has duplicate district entries)
            emdat = emdat.drop_duplicates(subset=["_dist_key", "_state_key"])
            df["_dist_key"]  = df["district_name"].str.replace(" ", "", regex=False).str.upper()
            df["_state_key"] = df["state_name"].str.replace(" ", "", regex=False).str.upper()
            df = df.merge(
                emdat[["_dist_key", "_state_key",
                       "emdat_flood_events_per_decade", "emdat_flood_loss_cr"]],
                on=["_dist_key", "_state_key"],
                how="left"
            )
            df = df.drop(columns=["_dist_key", "_state_key"])
            matched = df["emdat_flood_events_per_decade"].notna().sum()
            print(f"  EM-DAT merged — {matched:,} pincodes with flood event data")

    # -- Scoring ----------------------------------------------------------------
    df["score_glofas"]   = score_glofas(df).values
    df["score_gsw"]      = score_gsw(df).values
    df["score_aqueduct"] = score_aqueduct(df).values
    df["score_hand"]     = score_hand(df).values
    df["score_rainfall"] = score_rainfall(df).values
    df["score_dam"]      = score_dam(df).values

    df["flood_risk_score"] = sum(
        df[col] * w for col, w in WEIGHTS.items()
    ).round(2)

    df["flood_risk_class"] = df["flood_risk_score"].apply(classify)
    df["data_as_of_date"]  = "2026-07-14"

    # -- Save CSV ---------------------------------------------------------------
    os.makedirs("data/output", exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved {len(df):,} rows -> {OUTPUT_CSV}")

    dist = df["flood_risk_class"].value_counts()
    print("\nFlood risk distribution:")
    for cls in ["Very High", "High", "Medium", "Low"]:
        n = dist.get(cls, 0)
        pct = n / len(df) * 100
        print(f"  {cls:12s}: {n:6,} ({pct:.1f}%)")

    # -- Load to DB -------------------------------------------------------------
    db_url = get_db_url()
    if not db_url:
        print("\nNO DATABASE_URL -- skipping DB load. Set DATABASE_URL and rerun.")
        return

    print("\nLoading to database...")

    # Rename columns to match DB snake_case
    col_map = {
        "district_name":        "district_name",
        "state_name":           "state_name",
        # All other columns already match DB column names (snake_case)
    }

    # Select only columns that exist in the DB schema
    DB_COLS = [
        "pincode", "district_name", "state_name", "lat", "lng",
        "jrc_rp10_depth_m", "jrc_rp20_depth_m", "jrc_rp50_depth_m",
        "jrc_rp75_depth_m", "jrc_rp100_depth_m", "jrc_rp200_depth_m",
        "jrc_rp500_depth_m", "jrc_rp100_class", "jrc_spurious_depth_flag",
        "gsw_occurrence_pct", "gsw_seasonality_months", "gsw_recurrence_pct",
        "gsw_transition_class", "gsw_max_extent", "gsw_change_abs",
        "aqd_riverine_rp100_m", "aqd_riverine_rp500_m",
        "aqd_coastal_rp100_m", "aqd_coastal_rp500_m", "aqd_coastal_rp100_wtsub_2030_m",
        "aqd_2030_rcp85_rp100_m", "aqd_2050_rcp45_rp100_m",
        "aqd_2050_rcp85_rp100_m", "aqd_2080_rcp85_rp100_m",
        "hand_elevation_m",
        "impervious_surface_pct", "mangrove_cover_pct",
        "distance_to_river_km",
        "upstream_dam_present", "upstream_dam_name", "upstream_dam_type",
        "upstream_dam_height_m", "upstream_dam_river", "upstream_dam_main_use",
        "upstream_dam_year",
        "ndma_flood_prone_district",
        "imd_annual_rainfall_mm", "imd_extreme_rain_days_per_yr",
        "emdat_flood_events_per_decade", "emdat_flood_loss_cr",
        "flood_risk_score", "flood_risk_class",
        "score_glofas", "score_gsw", "score_aqueduct",
        "score_hand", "score_rainfall", "score_dam",
        "data_as_of_date",
    ]

    available_cols = [c for c in DB_COLS if c in df.columns]
    missing_cols   = [c for c in DB_COLS if c not in df.columns]
    if missing_cols:
        print(f"  Missing columns (will be null in DB): {missing_cols}")

    # Add missing cols as null
    for c in missing_cols:
        df[c] = None

    load_to_db(df[DB_COLS], db_url)
    print("Done.")

if __name__ == "__main__":
    main()
