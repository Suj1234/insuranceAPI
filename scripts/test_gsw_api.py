"""
Test: compare DB cache directly vs HTTP API response for 6 pincodes.
Verifies the API layer correctly serves DB data and the full finalized schema is present.
"""
import json, os, urllib.request, urllib.error, psycopg2

API_BASE = "http://localhost:3001/api/environmental/gsw"
API_KEY  = "f29f84eb0fdefc4d5dc599592c30bf627318b53e705a40081f17cc715877f3f9"

PINCODES = [
    ("110002", "Delhi — urban, low water"),
    ("400001", "Mumbai — coastal"),
    ("700001", "Kolkata — flood-prone, river delta"),
    ("682001", "Kochi — coastal Kerala"),
    ("302001", "Jaipur — arid Rajasthan"),
    ("560001", "Bangalore — Deccan plateau"),
]

# Expected top-level keys in the data payload
EXPECTED_DATA_KEYS = {
    "occurrence_pct", "monthly_pattern", "flood_season_timing",
    "overall_classification", "extreme_events", "trend_direction",
    "yearly_profile", "windows", "seasonality", "transition_history",
    "trend_magnitude", "risk_acceleration", "cloud_bias_flag",
    "kharif_season_pct", "rabi_season_pct", "return_period_years",
    "worst_year", "stable_classification",
}

# ── DB direct query ────────────────────────────────────────────────────────────
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()
cur.execute(
    "SELECT pincode, data FROM pincode_gsw_cache WHERE pincode = ANY(%s)",
    ([p for p, _ in PINCODES],)
)
db_rows = {r[0]: r[1] for r in cur.fetchall()}
conn.close()

# ── HTTP API call ──────────────────────────────────────────────────────────────
def api_get(pincode):
    url = f"{API_BASE}?mode=pincode&pincode={pincode}"
    req = urllib.request.Request(url, headers={"x-api-key": API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "body": e.read().decode()[:300]}
    except Exception as e:
        return {"error": str(e)}

# ── Compare ────────────────────────────────────────────────────────────────────
SEP = "=" * 70

all_ok = True
for pincode, label in PINCODES:
    print(f"\n{SEP}")
    print(f"PINCODE {pincode}  ({label})")
    print(SEP)

    db_data  = db_rows.get(pincode)
    api_resp = api_get(pincode)

    # ── DB result ──────────────────────────────────────────────────────────
    if not db_data:
        print("  [DB]  NOT FOUND")
        all_ok = False
    else:
        print(f"  [DB]  found — {len(db_data)} top-level keys")

    # ── API result ─────────────────────────────────────────────────────────
    if "error" in api_resp and "success" not in api_resp:
        print(f"  [API] ERROR: {api_resp}")
        all_ok = False
        continue

    if not api_resp.get("success"):
        print(f"  [API] FAILED: {api_resp}")
        all_ok = False
        continue

    api_data   = api_resp.get("data", {})
    api_source = api_resp.get("source", "?")
    api_meta   = api_resp.get("meta", {})
    latency    = api_meta.get("total_api_latency_ms", "?")

    print(f"  [API] source={api_source}  latency={latency}ms")
    print(f"  [API] {len(api_data)} top-level keys in data")

    # ── Schema check ───────────────────────────────────────────────────────
    missing = EXPECTED_DATA_KEYS - set(api_data.keys())
    extra   = set(api_data.keys()) - EXPECTED_DATA_KEYS
    if missing:
        print(f"  [SCHEMA] MISSING keys: {missing}")
        all_ok = False
    if extra:
        print(f"  [SCHEMA] extra keys (not in expected set): {extra}")

    # ── DB vs API data match ───────────────────────────────────────────────
    if db_data:
        match = (json.dumps(db_data, sort_keys=True) == json.dumps(api_data, sort_keys=True))
        print(f"  [MATCH] DB == API data: {'YES' if match else 'NO — MISMATCH'}")
        if not match:
            all_ok = False

    # ── Print full finalized response ──────────────────────────────────────
    print("\n  --- Full API response ---")
    print(json.dumps({
        "success": api_resp["success"],
        "source":  api_source,
        "meta":    api_meta,
        "data":    api_data,
    }, indent=2))

print(f"\n{SEP}")
print(f"RESULT: {'ALL PINCODES OK' if all_ok else 'SOME CHECKS FAILED'}")
print(SEP)
