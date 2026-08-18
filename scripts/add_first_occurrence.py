import psycopg2, os

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

cur.execute("""
UPDATE pincode_gsw_cache
SET data = jsonb_set(
  data,
  '{year_of_first_occurrence}',
  COALESCE(
    (SELECT to_jsonb(min((elem->>'year')::int))
     FROM jsonb_array_elements(data->'yearly_profile') AS elem
     WHERE (elem->>'occurrence_pct')::float > 0),
    'null'::jsonb
  )
)
""")
print(f"Updated rows: {cur.rowcount:,}")
conn.commit()

# Verify 3 samples
cur.execute("""
SELECT pincode, data->>'year_of_first_occurrence' AS first_yr
FROM pincode_gsw_cache
WHERE pincode IN ('110002','400001','302001','682001','560001','700001')
ORDER BY pincode
""")
for row in cur.fetchall():
    print(f"  {row[0]}: year_of_first_occurrence = {row[1]}")

conn.close()
print("Done.")
