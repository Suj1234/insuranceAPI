"""
scripts/process_emdat.py

EM-DAT disaster records -> district-level frequency scores.

Input:  data/emdat/public_emdat_custom_request_*.xlsx
Output: data/output/emdat_disaster_summary.csv

Uses GADM Admin Units JSON column to map disasters to districts.
Where only state-level (gid_1) entries exist, all districts in that
state get a fractional count.

Columns produced:
  district_name, state_name,
  flood_events_per_decade, cyclone_events_per_decade,
  earthquake_events_per_decade, disaster_insurance_loss_cr,
  disaster_frequency_score
"""
import os
import json
import glob
import pandas as pd
import numpy as np

EMDAT_GLOB = "data/emdat/*.xlsx"
GADM_JSON  = "data/gadm41_IND_2.json"
OUT_PATH   = "data/output/emdat_disaster_summary.csv"

os.makedirs("data/output", exist_ok=True)

# Load EM-DAT
files = glob.glob(EMDAT_GLOB)
if not files:
    raise FileNotFoundError(f"No EM-DAT Excel files found at {EMDAT_GLOB}")
df = pd.read_excel(files[0])
print(f"Loaded EM-DAT: {len(df)} events from {files[0]}")

# Filter to natural hazards relevant for health insurance underwriting
RELEVANT_TYPES = {"Flood", "Storm", "Earthquake", "Extreme temperature",
                  "Drought", "Mass movement (wet)"}
nat = df[df["Disaster Type"].isin(RELEVANT_TYPES)].copy()
print(f"  Relevant events: {len(nat)}")

# Load GADM for district list + state mapping
import geopandas as gpd
gadm = gpd.read_file(GADM_JSON)

def norm(s):
    if not isinstance(s, str): return ""
    return "".join(w.capitalize() for w in s.strip().split())

gadm["district_name"] = gadm["NAME_2"].apply(norm)
gadm["state_name"]    = gadm["NAME_1"].apply(norm)

# Build state -> list of district names mapping
state_districts = gadm.groupby("state_name")["district_name"].apply(list).to_dict()
# Build gid_2 -> (district_name, state_name)
gid2_map = {
    row["GID_2"]: (row["district_name"], row["state_name"])
    for _, row in gadm.iterrows()
}
# Build gid_1 -> state_name
gid1_map = {}
for gid2, (dist, state) in gid2_map.items():
    gid1 = "_".join(gid2.split("_")[0:1]) + "." + gid2.split(".")[1] + "_1"
    gid1_map[gid1] = state

# Also map from NAME_1 GADM names
state_name_map = {row["NAME_1"]: row["state_name"] for _, row in gadm.iterrows()}

# Accumulate per-district event counts
from collections import defaultdict
flood_cnt    = defaultdict(float)
cyclone_cnt  = defaultdict(float)
quake_cnt    = defaultdict(float)
other_cnt    = defaultdict(float)
insured_loss = defaultdict(float)  # in '000 USD

for _, event in nat.iterrows():
    dtype     = event["Disaster Type"]
    start_yr  = event["Start Year"]
    # Only events from 1990 onwards (3 decades)
    if pd.isna(start_yr) or int(start_yr) < 1990:
        continue

    # Parse GADM Admin Units JSON
    gadm_units = event.get("GADM Admin Units")
    district_keys = []  # list of (district_name, state_name)

    if pd.notna(gadm_units):
        try:
            units = json.loads(gadm_units)
        except Exception:
            units = []

        for unit in units:
            if "gid_2" in unit and unit.get("name_2"):
                d_name = norm(unit["name_2"])
                # Find state from gid_1 prefix
                gid2_full = unit["gid_2"]
                if gid2_full in gid2_map:
                    district_keys.append(gid2_map[gid2_full])
                else:
                    district_keys.append((d_name, ""))
            elif "gid_1" in unit and unit.get("name_1"):
                s_name = norm(unit["name_1"])
                if s_name in state_districts:
                    dists = state_districts[s_name]
                    weight = 1.0 / len(dists)
                    for d in dists:
                        district_keys.append((d, s_name))
    else:
        # Fall back to Location string -> state matching
        loc = str(event.get("Location", ""))
        for raw_state, normed_state in state_name_map.items():
            if raw_state in loc and normed_state in state_districts:
                dists = state_districts[normed_state]
                weight = 1.0 / len(dists)
                for d in dists:
                    district_keys.append((d, normed_state))
                break

    if not district_keys:
        continue

    weight = 1.0 / len(district_keys) if district_keys else 0

    loss_raw = event.get("Insured Damage ('000 US$)")
    loss_val = float(loss_raw) if pd.notna(loss_raw) else 0.0

    for (dist, state) in district_keys:
        key = (dist, state)
        if dtype == "Flood":
            flood_cnt[key]   += weight
        elif dtype == "Storm":
            cyclone_cnt[key] += weight
        elif dtype == "Earthquake":
            quake_cnt[key]   += weight
        else:
            other_cnt[key]   += weight
        insured_loss[key] += loss_val * weight

# Years covered: 1990-2025 = 35 years = 3.5 decades
DECADES = 3.5

# Build output: one row per district in GADM
rows = []
for _, gadm_row in gadm.iterrows():
    key = (gadm_row["district_name"], gadm_row["state_name"])
    flood   = round(flood_cnt.get(key, 0) / DECADES, 2)
    cyclone = round(cyclone_cnt.get(key, 0) / DECADES, 2)
    quake   = round(quake_cnt.get(key, 0) / DECADES, 2)
    other   = round(other_cnt.get(key, 0) / DECADES, 2)
    loss_cr = round(insured_loss.get(key, 0) * 0.084 / 100, 2)  # '000 USD -> Cr INR (approx)

    total_events_per_decade = flood + cyclone + quake + other
    # Score 0-10: log scale, capped at 10
    score = round(min(np.log1p(total_events_per_decade) * 3.5, 10.0), 2)

    rows.append({
        "district_name":              key[0],
        "state_name":                 key[1],
        "flood_events_per_decade":    flood,
        "cyclone_events_per_decade":  cyclone,
        "earthquake_events_per_decade": quake,
        "disaster_insurance_loss_cr": loss_cr,
        "disaster_frequency_score":   score,
    })

out = pd.DataFrame(rows)
out.to_csv(OUT_PATH, index=False)
print(f"Done. {len(out):,} districts -> {OUT_PATH}")
print(out["disaster_frequency_score"].describe())
print("\nTop 10 highest disaster-risk districts:")
print(out.nlargest(10, "disaster_frequency_score")[
    ["district_name","state_name","flood_events_per_decade","cyclone_events_per_decade","disaster_frequency_score"]
].to_string())
