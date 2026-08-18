"""
Load ESRI land cover wide CSV into pincode_land_cover table.

Run AFTER compute_land_cover_trends.py.
Run AFTER npx drizzle-kit push creates the pincode_land_cover table.

Input:  data/output/esri_land_cover_wide.csv
Output: pincode_land_cover table in Neon DB
"""

import os
import pandas as pd
import psycopg2
import psycopg2.extras

INPUT_CSV   = "data/output/esri_land_cover_wide.csv"
PINCODE_CSV = "data/output/pincode_coords.csv"
DATA_AS_OF  = "2026-07-23"
YEARS       = list(range(2017, 2025))

BANDS = [
    "built_area_pct", "trees_pct", "crops_pct", "water_pct",
    "flooded_veg_pct", "grass_pct", "scrub_shrub_pct", "bare_ground_pct",
]

# All raw columns: band_year (64 cols)
RAW_COLS = [f"{band}_{yr}" for yr in YEARS for band in BANDS]

CALC_COLS = [
    "urban_growth_rate_pct_per_yr",
    "urban_growth_class",
    "built_area_change_pct",
    "trees_change_pct",
    "crops_change_pct",
    "water_change_pct",
    "flooded_veg_change_pct",
    "grass_change_pct",
    "greenery_loss_pct",
    "cropland_to_urban_pct",
    "flooded_veg_max_pct",
    "flooded_vegetation_trend",
    "dominant_use_2017",
    "dominant_use_2024",
    "land_use_shifted",
]

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
    raise RuntimeError("DATABASE_URL not found in environment or .env.local")

def main():
    print(f"Loading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    df["pincode"] = df["pincode"].astype(str)
    print(f"  {len(df):,} rows")

    # Merge lat/lon from pincode_coords
    coords = pd.read_csv(PINCODE_CSV)
    coords["pincode"] = coords["pincode"].astype(str)
    coords = coords.rename(columns={"latitude": "lat", "longitude": "lon"})
    coords["lat"] = pd.to_numeric(coords["lat"], errors="coerce")
    coords["lon"] = pd.to_numeric(coords["lon"], errors="coerce")
    df = df.merge(coords[["pincode", "lat", "lon"]], on="pincode", how="left")

    df["data_as_of_date"] = DATA_AS_OF

    # land_use_shifted must be bool
    if "land_use_shifted" in df.columns:
        df["land_use_shifted"] = df["land_use_shifted"].apply(
            lambda v: bool(v) if pd.notna(v) else False
        )

    # Replace NaN with None
    df = df.where(pd.notna(df), None)

    DB_COLS = ["pincode", "lat", "lon"] + RAW_COLS + CALC_COLS + ["data_as_of_date"]

    # Fill missing columns with None
    for c in DB_COLS:
        if c not in df.columns:
            print(f"  Warning — column not found, will be null: {c}")
            df[c] = None

    db_url = get_db_url()
    conn   = psycopg2.connect(db_url, sslmode="require")
    cur    = conn.cursor()

    cur.execute("TRUNCATE TABLE pincode_land_cover")
    conn.commit()
    print("  Truncated pincode_land_cover")

    col_names    = ", ".join(DB_COLS)
    placeholders = ", ".join(["%s"] * len(DB_COLS))
    upsert_sql   = f"""
        INSERT INTO pincode_land_cover ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (pincode) DO UPDATE SET
            {", ".join(f"{c} = EXCLUDED.{c}" for c in DB_COLS if c != "pincode")},
            updated_at = now()
    """

    rows = [tuple(row[c] for c in DB_COLS) for _, row in df.iterrows()]

    psycopg2.extras.execute_batch(cur, upsert_sql, rows, page_size=500)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM pincode_land_cover")
    count = cur.fetchone()[0]
    print(f"  Loaded {count:,} rows into pincode_land_cover")

    # Summary
    rapid = df["urban_growth_class"].eq("rapid").sum()
    shifted = df["land_use_shifted"].sum()
    print(f"\nUrban growth class distribution:")
    for cls in ["rapid", "moderate", "stable", "declining"]:
        n = df["urban_growth_class"].eq(cls).sum()
        print(f"  {cls:10s}: {n:6,} ({n/len(df)*100:.1f}%)")
    print(f"\nLand use shifted 2017→2024: {shifted:,} ({shifted/len(df)*100:.1f}%)")

    cur.close()
    conn.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
