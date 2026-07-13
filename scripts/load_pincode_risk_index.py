"""
scripts/load_pincode_risk_index.py

Create pincode_risk_index table in Neon PostgreSQL and bulk-load
data/output/pincode_risk_index.csv into it via COPY for speed.
"""
import os, io
import psycopg2
import pandas as pd

# Load env
with open('.env.local') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

print("Connecting to Neon...")
conn = psycopg2.connect(os.environ['DATABASE_URL'])
conn.autocommit = False
cur = conn.cursor()
print("Connected.")

# Create table
print("Creating pincode_risk_index table...")
cur.execute("""
CREATE TABLE IF NOT EXISTS pincode_risk_index (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pincode                     VARCHAR(10) NOT NULL,
    district_name               TEXT,
    state_name                  TEXT,
    lat                         NUMERIC(9,6),
    lng                         NUMERIC(9,6),
    no2_ppb                     NUMERIC(7,3),
    so2_ppb                     NUMERIC(7,3),
    co_ppm                      NUMERIC(7,3),
    o3_ppb                      NUMERIC(7,3),
    pm25_cams_ug                NUMERIC(7,2),
    pm10_cams_ug                NUMERIC(7,2),
    pm25_sedac_ug               NUMERIC(7,2),
    pm25_blended_ug             NUMERIC(7,2),
    heat_wave_months_per_year   NUMERIC(4,2),
    hypertension_pct            NUMERIC(5,2),
    diabetes_pct                NUMERIC(5,2),
    obesity_pct                 NUMERIC(5,2),
    tobacco_use_pct             NUMERIC(5,2),
    anaemia_pct                 NUMERIC(5,2),
    flood_events_per_decade     NUMERIC(5,2),
    cyclone_events_per_decade   NUMERIC(5,2),
    earthquake_events_per_decade NUMERIC(5,2),
    disaster_insurance_loss_cr  NUMERIC(10,2),
    disaster_frequency_score    NUMERIC(4,2),
    composite_risk_score        NUMERIC(5,2) NOT NULL,
    risk_tier                   TEXT NOT NULL,
    score_pm25                  NUMERIC(5,2),
    score_aqi                   NUMERIC(5,2),
    score_no2                   NUMERIC(5,2),
    score_heat                  NUMERIC(5,2),
    score_disease               NUMERIC(5,2),
    score_disaster              NUMERIC(5,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
""")
cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_pri_pincode ON pincode_risk_index(pincode);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_pri_district ON pincode_risk_index(district_name, state_name);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_pri_risk_tier ON pincode_risk_index(risk_tier);")
conn.commit()
print("  Table ready.")

# Truncate
print("Truncating...")
cur.execute("TRUNCATE TABLE pincode_risk_index")
conn.commit()

# Load CSV
print("Loading CSV...")
df = pd.read_csv('data/output/pincode_risk_index.csv', dtype={'pincode': str})
df = df.drop_duplicates(subset=['pincode'])

COLS = [
    'pincode','district_name','state_name','lat','lng',
    'no2_ppb','so2_ppb','co_ppm','o3_ppb','pm25_cams_ug','pm10_cams_ug',
    'pm25_sedac_ug','pm25_blended_ug','heat_wave_months_per_year',
    'hypertension_pct','diabetes_pct','obesity_pct','tobacco_use_pct','anaemia_pct',
    'flood_events_per_decade','cyclone_events_per_decade','earthquake_events_per_decade',
    'disaster_insurance_loss_cr','disaster_frequency_score',
    'composite_risk_score','risk_tier',
    'score_pm25','score_aqi','score_no2','score_heat','score_disease','score_disaster',
]

df_load = df[COLS].copy()
# Replace NaN with empty string for CSV null sentinel
df_load = df_load.where(pd.notnull(df_load), None)

# Write to in-memory CSV buffer with \N for NULLs
buf = io.StringIO()
for _, row in df_load.iterrows():
    parts = []
    for v in row:
        if v is None:
            parts.append('\\N')
        else:
            parts.append(str(v))
    buf.write('\t'.join(parts) + '\n')
buf.seek(0)

print(f"  COPY {len(df_load):,} rows...")
cur.copy_from(buf, 'pincode_risk_index', columns=COLS, null='\\N')
conn.commit()
print("  Done.")

# Verify
cur.execute("SELECT COUNT(*) FROM pincode_risk_index")
total = cur.fetchone()[0]
cur.execute("SELECT risk_tier, COUNT(*) FROM pincode_risk_index GROUP BY risk_tier ORDER BY risk_tier")
tiers = dict(cur.fetchall())
cur.execute("SELECT MIN(composite_risk_score), MAX(composite_risk_score), AVG(composite_risk_score) FROM pincode_risk_index")
stats = cur.fetchone()
conn.close()

print(f"\nLoaded {total:,} rows into pincode_risk_index")
print("Risk tier distribution:", tiers)
print(f"Score: min={stats[0]}, max={stats[1]}, avg={float(stats[2]):.3f}")
print("\nSample pincode lookup test:")
print("  400001 (Mumbai GPO) -> query manually after load")
