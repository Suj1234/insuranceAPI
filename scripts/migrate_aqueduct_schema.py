"""
Create pincode_aqueduct table in the database.

Stores all 25 WRI Aqueduct Floods v2 columns per pincode for the standalone
Aqueduct API. Run once before loading extracted data.

Prerequisites: DATABASE_URL env var set, psycopg2 installed.
Run: DATABASE_URL=... python scripts/migrate_aqueduct_schema.py
"""

import os
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "")

DDL = """
CREATE TABLE IF NOT EXISTS pincode_aqueduct (
    pincode  varchar(6) PRIMARY KEY,

    -- Riverine baseline 1980 (WATCH reanalysis, 1960-1999 climatology)
    -- 0 = outside flood zone; null = no data
    riverine_rp10_m    decimal(6,3),
    riverine_rp25_m    decimal(6,3),
    riverine_rp50_m    decimal(6,3),
    riverine_rp100_m   decimal(6,3),
    riverine_rp250_m   decimal(6,3),
    riverine_rp500_m   decimal(6,3),
    riverine_rp1000_m  decimal(6,3),

    -- Riverine projections (ensemble mean of 5 CMIP5 GCMs)
    rcp85_2030_rp100_m  decimal(6,3),
    rcp85_2030_rp500_m  decimal(6,3),
    rcp45_2050_rp100_m  decimal(6,3),
    rcp45_2050_rp500_m  decimal(6,3),
    rcp85_2050_rp100_m  decimal(6,3),
    rcp85_2050_rp500_m  decimal(6,3),
    rcp85_2080_rp100_m  decimal(6,3),
    rcp85_2080_rp500_m  decimal(6,3),

    -- Coastal baseline, no subsidence
    -- p95 = high SLR scenario (suffix _0); p50 = median SLR scenario (suffix _0_perc_50)
    coastal_nosub_rp100_slr_p95_m  decimal(6,3),
    coastal_nosub_rp100_slr_p50_m  decimal(6,3),
    coastal_nosub_rp500_slr_p95_m  decimal(6,3),
    coastal_nosub_rp500_slr_p50_m  decimal(6,3),

    -- Coastal with land subsidence at RP100
    coastal_wtsub_2030_rp100_slr_p95_m  decimal(6,3),
    coastal_wtsub_2030_rp100_slr_p50_m  decimal(6,3),
    coastal_wtsub_2050_rp100_slr_p95_m  decimal(6,3),
    coastal_wtsub_2050_rp100_slr_p50_m  decimal(6,3),
    coastal_wtsub_2080_rp100_slr_p95_m  decimal(6,3),
    coastal_wtsub_2080_rp100_slr_p50_m  decimal(6,3),

    data_as_of_date  text,
    created_at       timestamp with time zone NOT NULL DEFAULT now(),
    updated_at       timestamp with time zone NOT NULL DEFAULT now()
);
"""

def main():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        return

    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    cur  = conn.cursor()

    print("Creating pincode_aqueduct table...")
    cur.execute(DDL)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM pincode_aqueduct")
    count = cur.fetchone()[0]
    print(f"Table ready. Current rows: {count:,}")

    cur.close()
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
