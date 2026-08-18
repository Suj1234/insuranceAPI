"""
Add pincode_flood_index table to the database.

Stores all raw flood data for each pincode -- every column from every source,
not just the ones used in scoring. Run once before loading extracted data.

Prerequisites: DATABASE_URL env var set.
"""

import os
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "")

DDL = """
CREATE TABLE IF NOT EXISTS pincode_flood_index (
    -- Identity
    pincode              varchar(6)  PRIMARY KEY,
    district_name        text,
    state_name           text,
    lat                  decimal(9,6),
    lng                  decimal(9,6),

    -- JRC GloFAS v2.1: flood depth at return periods (null = no flood zone at 90m)
    jrc_rp10_depth_m     decimal(6,2),
    jrc_rp20_depth_m     decimal(6,2),
    jrc_rp50_depth_m     decimal(6,2),
    jrc_rp75_depth_m     decimal(6,2),
    jrc_rp100_depth_m    decimal(6,2),
    jrc_rp200_depth_m    decimal(6,2),
    jrc_rp500_depth_m    decimal(6,2),
    jrc_rp100_class      integer,       -- 0=no hazard ... 4=severe
    jrc_spurious_depth_flag integer,    -- quality flag

    -- JRC Global Surface Water v1.4 (1984-2021)
    -- null = pixel never flooded (correct, not missing)
    gsw_occurrence_pct      decimal(5,2),
    gsw_seasonality_months  decimal(4,1),
    gsw_recurrence_pct      decimal(5,2),
    gsw_transition_class    integer,
    gsw_max_extent          boolean,    -- true = pixel ever water
    gsw_change_abs          decimal(5,2),

    -- WRI Aqueduct v2 -- 0 = outside flood zone, null = no data
    -- Riverine historical 1980
    aqd_riverine_rp100_m             decimal(6,3),
    aqd_riverine_rp500_m             decimal(6,3),
    -- Coastal historical (no subsidence)
    aqd_coastal_rp100_m              decimal(6,3),
    aqd_coastal_rp500_m              decimal(6,3),
    -- Coastal with subsidence projected to 2030
    aqd_coastal_rp100_wtsub_2030_m   decimal(6,3),
    -- Climate projections (ensemble mean of 5 GCMs)
    aqd_2030_rcp85_rp100_m           decimal(6,3),
    aqd_2050_rcp45_rp100_m           decimal(6,3),
    aqd_2050_rcp85_rp100_m           decimal(6,3),
    aqd_2080_rcp85_rp100_m           decimal(6,3),

    -- MERIT Hydro HAND: height above nearest drainage (terrain flood proxy)
    hand_elevation_m     decimal(6,2),

    -- ESA WorldCover 2021 (fraction within 500m buffer)
    impervious_surface_pct  decimal(5,2),
    mangrove_cover_pct      decimal(5,2),

    -- HydroRIVERS v1.0
    distance_to_river_km    decimal(7,3),

    -- Global Dam Watch v1.0 (nearest upstream dam within 100km)
    upstream_dam_present    boolean,
    upstream_dam_name       text,
    upstream_dam_type       text,       -- flood_control/irrigation/hydropower/water_supply/multipurpose
    upstream_dam_height_m   decimal(6,1),  -- null if -99 in source
    upstream_dam_river      text,
    upstream_dam_main_use   text,       -- raw MAIN_USE field from GDW
    upstream_dam_year       integer,

    -- NDMA flood-prone district flag (joined from district list)
    ndma_flood_prone_district boolean,

    -- IMD 0.25 degree rainfall (1981-2020 climatology)
    imd_annual_rainfall_mm       decimal(7,1),
    imd_extreme_rain_days_per_yr decimal(5,2),

    -- EM-DAT historical disasters (district level, joined)
    emdat_flood_events_per_decade decimal(5,1),
    emdat_flood_loss_cr           decimal(10,2),

    -- Computed flood risk score
    flood_risk_score       decimal(5,2),  -- 0-100
    flood_risk_class       text,          -- Low / Medium / High / Very High

    -- Component sub-scores (each 0-100)
    score_glofas           decimal(5,2),
    score_gsw              decimal(5,2),
    score_aqueduct         decimal(5,2),
    score_hand             decimal(5,2),
    score_rainfall         decimal(5,2),
    score_dam              decimal(5,2),

    -- Metadata
    data_as_of_date  date,
    created_at       timestamp with time zone NOT NULL DEFAULT now(),
    updated_at       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfi_district ON pincode_flood_index (district_name, state_name);
CREATE INDEX IF NOT EXISTS idx_pfi_risk_class ON pincode_flood_index (flood_risk_class);
CREATE INDEX IF NOT EXISTS idx_pfi_state ON pincode_flood_index (state_name);
"""

def main():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        return

    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    cur  = conn.cursor()

    print("Creating pincode_flood_index table...")
    cur.execute(DDL)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM pincode_flood_index")
    count = cur.fetchone()[0]
    print(f"Table ready. Current rows: {count:,}")

    cur.close()
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
