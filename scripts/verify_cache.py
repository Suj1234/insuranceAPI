import psycopg2, os
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

cur.execute("SELECT COUNT(*) FROM pincode_gsw_cache")
print(f"Total rows: {cur.fetchone()[0]:,}")

cur.execute("SELECT pincode, data FROM pincode_gsw_cache WHERE pincode = '110002'")
row = cur.fetchone()
if row:
    d = row[1]
    print(f"Pincode 110002:")
    print(f"  occurrence_pct:         {d['occurrence_pct']}")
    print(f"  monthly_pattern:        {d['monthly_pattern']}")
    print(f"  flood_season_timing:    {d['flood_season_timing']}")
    print(f"  overall_classification: {d['overall_classification']}")
    print(f"  extreme_events:         {d['extreme_events']}")
    print(f"  trend_direction:        {d['trend_direction']}")
    print(f"  yearly_profile rows:    {len(d['yearly_profile'])}")

conn.close()
