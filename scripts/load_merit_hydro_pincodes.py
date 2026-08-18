"""
Load MERIT Hydro PIN code extraction CSV into pincode_terrain table.

Run AFTER extract_merit_hydro_pincodes.py completes.
Run AFTER npx drizzle-kit push creates the pincode_terrain table.

Input:  data/output/merit_hydro_pincodes.csv
Output: pincode_terrain table in Neon DB
"""

import os
import pandas as pd
import psycopg2
import psycopg2.extras

INPUT_CSV    = "data/output/merit_hydro_pincodes.csv"
PINCODE_CSV  = "data/output/pincode_coords.csv"
DATA_AS_OF   = "2026-07-22"

DIR_LABELS = {
    1: "east", 2: "southeast", 4: "south", 8: "southwest",
    16: "west", 32: "northwest", 64: "north", 128: "northeast",
    0: "river_mouth", -1: "inland_depression", -9: "undefined",
}

def classify_hand(hand_m):
    if hand_m is None:      return None
    if hand_m <= 2:         return "extreme"
    if hand_m <= 5:         return "very_high"
    if hand_m <= 10:        return "high"
    if hand_m <= 20:        return "moderate"
    if hand_m <= 30:        return "low"
    return "very_low"

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
    raise RuntimeError("DATABASE_URL not found. Set it in .env.local or as environment variable.")

def main():
    print(f"Loading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    df["pincode"] = df["pincode"].astype(str)
    print(f"  {len(df):,} rows")

    # Load lat/lon from pincode_coords to include in the table
    coords = pd.read_csv(PINCODE_CSV)
    coords["pincode"] = coords["pincode"].astype(str)
    coords = coords.rename(columns={"latitude": "lat", "longitude": "lon"})
    coords["lat"] = pd.to_numeric(coords["lat"], errors="coerce")
    coords["lon"] = pd.to_numeric(coords["lon"], errors="coerce")
    coords.loc[~coords["lat"].between(-90, 90),   "lat"] = None
    coords.loc[~coords["lon"].between(-180, 180), "lon"] = None
    df = df.merge(coords[["pincode", "lat", "lon"]], on="pincode", how="left")

    # Derived / calculated fields
    df["flow_direction_label"] = df["flow_direction_code"].map(DIR_LABELS)
    df["flood_risk_class"]     = df["hand_m"].apply(classify_hand)
    df["coastal_surge_risk"]   = df["elevation_m"].apply(
        lambda v: bool(float(v) < 5.0) if pd.notna(v) else None
    )
    df["inland_depression"]    = df["flow_direction_code"].apply(
        lambda v: bool(int(v) == -1) if pd.notna(v) else False
    )
    df["adjacent_to_river"]    = (
        (df["on_permanent_water"].fillna(0).astype(int) == 1) |
        (df["river_width_m"].fillna(0) > 0)
    )
    df["data_as_of_date"]    = DATA_AS_OF
    df["on_permanent_water"] = df["on_permanent_water"].apply(
        lambda v: bool(int(v)) if pd.notna(v) else None
    )

    # Replace NaN with None for psycopg2
    df = df.where(pd.notna(df), None)

    DB_COLS = [
        "pincode", "lat", "lon",
        "hand_m", "elevation_m", "upstream_area_km2",
        "river_width_m", "on_permanent_water", "flow_direction_code",
        "flow_direction_label",
        "flood_risk_class", "coastal_surge_risk",
        "inland_depression", "adjacent_to_river",
        "data_as_of_date",
    ]

    # Only keep columns that exist in the dataframe
    cols = [c for c in DB_COLS if c in df.columns]
    missing = [c for c in DB_COLS if c not in df.columns]
    if missing:
        print(f"  Warning — missing columns (will be null): {missing}")
    for c in missing:
        df[c] = None

    db_url = get_db_url()
    conn   = psycopg2.connect(db_url, sslmode="require")
    cur    = conn.cursor()

    cur.execute("TRUNCATE TABLE pincode_terrain")
    conn.commit()
    print("  Truncated pincode_terrain")

    col_names    = ", ".join(DB_COLS)
    placeholders = ", ".join(["%s"] * len(DB_COLS))
    upsert_sql   = f"""
        INSERT INTO pincode_terrain ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (pincode) DO UPDATE SET
            {", ".join(f"{c} = EXCLUDED.{c}" for c in DB_COLS if c != "pincode")},
            updated_at = now()
    """

    rows = [
        tuple(row[c] for c in DB_COLS)
        for _, row in df.iterrows()
    ]

    psycopg2.extras.execute_batch(cur, upsert_sql, rows, page_size=1000)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM pincode_terrain")
    count = cur.fetchone()[0]
    print(f"  Loaded {count:,} rows into pincode_terrain")

    # Print distribution
    dist = df["flood_risk_class"].value_counts()
    print("\nFlood risk class distribution (terrain):")
    for cls in ["extreme", "very_high", "high", "moderate", "low", "very_low"]:
        n   = dist.get(cls, 0)
        pct = n / len(df) * 100
        print(f"  {cls:12s}: {n:6,} ({pct:.1f}%)")

    cur.close()
    conn.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
