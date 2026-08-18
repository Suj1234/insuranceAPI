"""
Verify which WRI Aqueduct v2 images actually exist in GEE.
Run this BEFORE extract_aqueduct.py to know exactly what data you'll get.

python scripts/verify_aqueduct_images.py

Takes ~5 minutes. Prints a table of EXISTS / MISSING for every image.
"""

import ee
import json
import os

KEY_FILE   = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT    = os.environ.get("GEE_PROJECT",  "insuretech-data-platform")
COLLECTION = "WRI/Aqueduct_Flood_Hazard_Maps/V2"

RPS       = [10, 25, 50, 100, 250, 500, 1000]
SCENARIOS = [
    ("rcp4p5", "2030", "rcp45_2030"),
    ("rcp8p5", "2030", "rcp85_2030"),
    ("rcp4p5", "2050", "rcp45_2050"),
    ("rcp8p5", "2050", "rcp85_2050"),
    ("rcp4p5", "2080", "rcp45_2080"),
    ("rcp8p5", "2080", "rcp85_2080"),
]

def riv_rp(n): return f"rp{n:05d}"
def cst_rp(n): return f"rp{n:04d}"


def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)


def check_image(image_id):
    try:
        ee.Image(f"{COLLECTION}/{image_id}").getInfo()
        return True
    except Exception:
        return False


def check_filter(filters):
    try:
        col = ee.ImageCollection(COLLECTION)
        for term in filters:
            col = col.filter(ee.Filter.stringContains("system:index", term))
        count = col.size().getInfo()
        return count > 0, count
    except Exception:
        return False, 0


def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print('─'*60)


def row(label, ok, extra=""):
    status = "✓  EXISTS" if ok else "✗  MISSING"
    print(f"  {status}  {label}{extra}")


init_gee()
print("GEE initialised. Checking all image IDs...\n")

missing = []

# ── 1. Riverine baseline ──────────────────────────────────────────────────────
section("Riverine baseline 1980 (WATCH)")
for rp in RPS:
    img_id = f"inunriver_historical_000000000WATCH_1980_{riv_rp(rp)}"
    ok = check_image(img_id)
    row(img_id, ok)
    if not ok: missing.append(img_id)

# ── 2. Riverine projections (ensemble via filter) ─────────────────────────────
section("Riverine projections (ensemble mean)")
for gee_scen, year, label in SCENARIOS:
    for rp in RPS:
        filters = ["inunriver", gee_scen, year, riv_rp(rp)]
        ok, count = check_filter(filters)
        row(f"inunriver / {gee_scen} / {year} / {riv_rp(rp)}", ok, f"  ({count} GCMs)")
        if not ok: missing.append(str(filters))

# ── 3. Coastal nosub historical ───────────────────────────────────────────────
section("Coastal nosub historical (p95 only)")
for rp in RPS:
    img_id = f"inuncoast_historical_nosub_hist_{cst_rp(rp)}_0"
    ok = check_image(img_id)
    row(img_id, ok)
    if not ok: missing.append(img_id)

# ── 4. Coastal nosub projected ────────────────────────────────────────────────
section("Coastal nosub projected (p95 + p50)")
for gee_scen, year, label in SCENARIOS:
    for rp in [100, 500]:  # spot-check two RPs per scenario first
        for suffix, pct in [("_0", "p95"), ("_0_perc_50", "p50")]:
            img_id = f"inuncoast_{gee_scen}_nosub_{year}_{cst_rp(rp)}{suffix}"
            ok = check_image(img_id)
            row(img_id, ok)
            if not ok: missing.append(img_id)

# ── 5. Coastal wtsub baseline ─────────────────────────────────────────────────
section("Coastal wtsub baseline_2030 (p95 only)")
for rp in RPS:
    img_id = f"inuncoast_historical_wtsub_2030_{cst_rp(rp)}_0"
    ok = check_image(img_id)
    row(img_id, ok)
    if not ok: missing.append(img_id)

# ── 6. Coastal wtsub projected ────────────────────────────────────────────────
section("Coastal wtsub projected (p95 + p50) — spot-check rp100")
for gee_scen, year, label in SCENARIOS:
    for suffix, pct in [("_0", "p95"), ("_0_perc_50", "p50")]:
        img_id = f"inuncoast_{gee_scen}_wtsub_{year}_{cst_rp(100)}{suffix}"
        ok = check_image(img_id)
        row(img_id, ok)
        if not ok: missing.append(img_id)

# ── 7. Coastal other return periods — spot-check rcp8p5 nosub ────────────────
section("Coastal RP spot-check — rcp8p5 nosub 2030 all RPs (p95)")
for rp in RPS:
    img_id = f"inuncoast_rcp8p5_nosub_2030_{cst_rp(rp)}_0"
    ok = check_image(img_id)
    row(img_id, ok)
    if not ok: missing.append(img_id)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
if missing:
    print(f"  {len(missing)} MISSING images — these columns will be null in output:")
    for m in missing:
        print(f"    • {m}")
    print("\n  → Review extract_aqueduct.py QUERIES and remove non-existent images")
    print("    before running the full extraction.")
else:
    print("  All spot-checked images exist — safe to run extract_aqueduct.py")
print('='*60)
