import psycopg2, os, json

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

# Mix of urban, coastal, flood-prone, dry, and water-adjacent pincodes
PINCODES = [
    "110002",  # Delhi — urban, low water
    "400001",  # Mumbai — coastal
    "700001",  # Kolkata — flood-prone, river delta
    "682001",  # Kochi — coastal Kerala
    "302001",  # Jaipur — arid Rajasthan
    "560001",  # Bangalore — Deccan plateau
]

cur.execute(
    "SELECT pincode, data FROM pincode_gsw_cache WHERE pincode = ANY(%s)",
    (PINCODES,)
)
rows = {r[0]: r[1] for r in cur.fetchall()}
conn.close()

for pc in PINCODES:
    d = rows.get(pc)
    if not d:
        print(f"\n{'='*60}\nPINCODE {pc}: NOT FOUND IN CACHE\n")
        continue
    print(f"\n{'='*60}")
    print(f"PINCODE {pc}")
    print(f"{'='*60}")
    print(json.dumps(d, indent=2))
