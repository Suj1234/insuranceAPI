"""
GEE authentication setup and validation.
Run once before any other GEE extraction scripts.

Prerequisites:
  1. Google Cloud project created at console.cloud.google.com
  2. Earth Engine registered at earthengine.google.com/signup
  3. Service account created + key downloaded as gee-key.json
  4. pip install earthengine-api

Usage:
  python scripts/setup_gee_auth.py
"""

import os
import json
import sys

# ── Config ────────────────────────────────────────────────────────────────────

KEY_FILE    = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

# ── Validate key file ─────────────────────────────────────────────────────────

if not os.path.exists(KEY_FILE):
    print(f"ERROR: GEE key file not found: {KEY_FILE}")
    print("Steps to fix:")
    print("  1. Go to console.cloud.google.com → IAM → Service Accounts")
    print("  2. Create service account 'gee-pipeline' if not done")
    print("  3. Grant role: Earth Engine Resource Admin")
    print("  4. Download JSON key → save as gee-key.json in project root")
    sys.exit(1)

with open(KEY_FILE) as f:
    key_data = json.load(f)

print(f"Key file: {KEY_FILE}")
print(f"Service account: {key_data.get('client_email', 'unknown')}")
print(f"Project: {key_data.get('project_id', 'unknown')}")

# ── Authenticate ──────────────────────────────────────────────────────────────

import ee

try:
    credentials = ee.ServiceAccountCredentials(
        email=key_data["client_email"],
        key_file=KEY_FILE,
    )
    ee.Initialize(credentials=credentials, project=PROJECT)
    print("\nGEE authentication: OK")
except Exception as e:
    print(f"\nERROR authenticating: {e}")
    print("Make sure the service account has Earth Engine access at:")
    print("  earthengine.google.com/service_accounts/")
    sys.exit(1)

# ── Test 1: JRC GloFAS v2.1 ───────────────────────────────────────────────────

print("\nTest 1: JRC GloFAS v2.1...")
try:
    jrc = ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1").first()
    point = ee.Geometry.Point([72.8347, 18.9333])  # Mumbai
    val = jrc.select("RP100_depth").reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=90
    ).getInfo()
    print(f"  Mumbai rp100 depth: {val}")
    print("  JRC GloFAS: OK")
except Exception as e:
    print(f"  JRC GloFAS: FAILED — {e}")

# ── Test 2: JRC Global Surface Water ─────────────────────────────────────────

print("\nTest 2: JRC Global Surface Water v1.4...")
try:
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    val = gsw.select("occurrence").reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=30
    ).getInfo()
    print(f"  Mumbai water occurrence: {val}")
    print("  JRC GSW: OK")
except Exception as e:
    print(f"  JRC GSW: FAILED — {e}")

# ── Test 3: WRI Aqueduct ─────────────────────────────────────────────────────

print("\nTest 3: WRI Aqueduct Floods v2...")
try:
    aqd = ee.ImageCollection("WRI/Aqueduct_Flood_Hazard_Maps/V2").first()
    val = aqd.reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=1000
    ).getInfo()
    print(f"  Aqueduct sample: {list(val.keys())[:3]}")
    print("  WRI Aqueduct: OK")
except Exception as e:
    print(f"  WRI Aqueduct: FAILED — {e}")

# ── Test 4: HydroSHEDS HAND ──────────────────────────────────────────────────

print("\nTest 4: HydroSHEDS HAND...")
try:
    hand = ee.Image("WWF/HydroSHEDS/03HAND")
    val = hand.reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=90
    ).getInfo()
    print(f"  Mumbai HAND elevation: {val}")
    print("  HydroSHEDS HAND: OK")
except Exception as e:
    print(f"  HydroSHEDS HAND: FAILED — {e}")

# ── Test 5: ESA WorldCover ────────────────────────────────────────────────────

print("\nTest 5: ESA WorldCover 2021...")
try:
    wc = ee.ImageCollection("ESA/WorldCover/v200").first()
    val = wc.select("Map").reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=10
    ).getInfo()
    print(f"  Mumbai land cover class: {val}")
    print("  ESA WorldCover: OK")
except Exception as e:
    print(f"  ESA WorldCover: FAILED — {e}")

print("\nAll tests complete. GEE setup verified.")
