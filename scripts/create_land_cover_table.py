"""
Create pincode_land_cover table directly in Neon DB.

Bypasses drizzle-kit push to avoid touching existing tables.
Safe to run multiple times (CREATE TABLE IF NOT EXISTS).
"""

import os
import psycopg2

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
    raise RuntimeError("DATABASE_URL not found")

SQL = """
CREATE TABLE IF NOT EXISTS pincode_land_cover (
    pincode               varchar(6) PRIMARY KEY,
    lat                   numeric(9,6),
    lon                   numeric(9,6),

    built_area_pct_2017   numeric(5,2),  trees_pct_2017      numeric(5,2),
    crops_pct_2017        numeric(5,2),  water_pct_2017      numeric(5,2),
    flooded_veg_pct_2017  numeric(5,2),  grass_pct_2017      numeric(5,2),
    scrub_shrub_pct_2017  numeric(5,2),  bare_ground_pct_2017 numeric(5,2),

    built_area_pct_2018   numeric(5,2),  trees_pct_2018      numeric(5,2),
    crops_pct_2018        numeric(5,2),  water_pct_2018      numeric(5,2),
    flooded_veg_pct_2018  numeric(5,2),  grass_pct_2018      numeric(5,2),
    scrub_shrub_pct_2018  numeric(5,2),  bare_ground_pct_2018 numeric(5,2),

    built_area_pct_2019   numeric(5,2),  trees_pct_2019      numeric(5,2),
    crops_pct_2019        numeric(5,2),  water_pct_2019      numeric(5,2),
    flooded_veg_pct_2019  numeric(5,2),  grass_pct_2019      numeric(5,2),
    scrub_shrub_pct_2019  numeric(5,2),  bare_ground_pct_2019 numeric(5,2),

    built_area_pct_2020   numeric(5,2),  trees_pct_2020      numeric(5,2),
    crops_pct_2020        numeric(5,2),  water_pct_2020      numeric(5,2),
    flooded_veg_pct_2020  numeric(5,2),  grass_pct_2020      numeric(5,2),
    scrub_shrub_pct_2020  numeric(5,2),  bare_ground_pct_2020 numeric(5,2),

    built_area_pct_2021   numeric(5,2),  trees_pct_2021      numeric(5,2),
    crops_pct_2021        numeric(5,2),  water_pct_2021      numeric(5,2),
    flooded_veg_pct_2021  numeric(5,2),  grass_pct_2021      numeric(5,2),
    scrub_shrub_pct_2021  numeric(5,2),  bare_ground_pct_2021 numeric(5,2),

    built_area_pct_2022   numeric(5,2),  trees_pct_2022      numeric(5,2),
    crops_pct_2022        numeric(5,2),  water_pct_2022      numeric(5,2),
    flooded_veg_pct_2022  numeric(5,2),  grass_pct_2022      numeric(5,2),
    scrub_shrub_pct_2022  numeric(5,2),  bare_ground_pct_2022 numeric(5,2),

    built_area_pct_2023   numeric(5,2),  trees_pct_2023      numeric(5,2),
    crops_pct_2023        numeric(5,2),  water_pct_2023      numeric(5,2),
    flooded_veg_pct_2023  numeric(5,2),  grass_pct_2023      numeric(5,2),
    scrub_shrub_pct_2023  numeric(5,2),  bare_ground_pct_2023 numeric(5,2),

    built_area_pct_2024   numeric(5,2),  trees_pct_2024      numeric(5,2),
    crops_pct_2024        numeric(5,2),  water_pct_2024      numeric(5,2),
    flooded_veg_pct_2024  numeric(5,2),  grass_pct_2024      numeric(5,2),
    scrub_shrub_pct_2024  numeric(5,2),  bare_ground_pct_2024 numeric(5,2),

    urban_growth_rate_pct_per_yr  numeric(6,3),
    urban_growth_class            text,
    built_area_change_pct         numeric(5,2),
    trees_change_pct              numeric(5,2),
    crops_change_pct              numeric(5,2),
    water_change_pct              numeric(5,2),
    flooded_veg_change_pct        numeric(5,2),
    grass_change_pct              numeric(5,2),
    greenery_loss_pct             numeric(5,2),
    cropland_to_urban_pct         numeric(5,2),
    flooded_veg_max_pct           numeric(5,2),
    flooded_vegetation_trend      text,
    dominant_use_2017             text,
    dominant_use_2024             text,
    land_use_shifted              boolean,

    data_as_of_date  text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plc_lat_lon ON pincode_land_cover (lat, lon);
"""

def main():
    db_url = get_db_url()
    conn   = psycopg2.connect(db_url, sslmode="require")
    cur    = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM pincode_land_cover")
    print(f"pincode_land_cover created. Current row count: {cur.fetchone()[0]}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
