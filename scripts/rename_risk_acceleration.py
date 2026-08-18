import psycopg2, os

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

cur.execute("""
UPDATE pincode_gsw_cache
SET data = (data - 'risk_acceleration')
        || jsonb_build_object('recent_deviation_pct', data->'risk_acceleration')
WHERE data ? 'risk_acceleration'
""")
print(f"Renamed field in {cur.rowcount:,} rows")
conn.commit()

# Verify
cur.execute("""
SELECT pincode,
       data->>'recent_deviation_pct' AS new_field,
       data->>'risk_acceleration'    AS old_field
FROM pincode_gsw_cache
WHERE pincode IN ('682001','400001','302001')
""")
for row in cur.fetchall():
    print(f"  {row[0]}: recent_deviation_pct={row[1]}  risk_acceleration={row[2]}")

conn.close()
print("Done.")
