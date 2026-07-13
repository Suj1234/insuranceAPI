"""
scripts/patch_track1_pincodes.py

Patches pincode_risk_index.csv with Track 1 new columns using the same
three-layer district lookup (direct norm → ALIAS_MAP → PARENT_MAP) that
build_pincode_risk_index.py uses for NFHS and EM-DAT joins.

Source of truth for pm25 trend/3yr values: district_risk_index_final.csv
(already fully patched with all 676 districts having values).

Cleans up any _x/_y duplicate columns left by previous merge attempts.

New columns added:
  pm25_blended_3yr_ug, pm25_trend_5yr_pct, pm25_trend_direction,
  pm25_3yr_from_year, pm25_3yr_to_year, pm25_5yr_from_year, pm25_5yr_to_year,
  pm25_national_pctile, composite_national_pctile
"""
import re
import pandas as pd
import numpy as np
from scipy.stats import percentileofscore

# Bring in PARENT_MAP from the existing file
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from parent_district_map import PARENT_MAP

DRI_CSV = "data/output/district_risk_index_final.csv"
PRI_CSV = "data/output/pincode_risk_index.csv"

# ── Three-layer lookup helpers (same as build_pincode_risk_index.py) ──────────

def norm(s):
    if not isinstance(s, str): return ""
    return re.sub(r'[^a-z]', '', s.lower())

def norm_key(district, state):
    return f"{norm(district)}|{norm(state)}"

# Layer 3: PARENT_MAP normalised
parent_lookup = {}
for raw_key, parent_val in PARENT_MAP.items():
    d, s = raw_key.split("|")
    parent_lookup[norm_key(d, s)] = parent_val

# Layer 2: ALIAS_MAP (copied verbatim from build_pincode_risk_index.py)
ALIAS_MAP = {
    "bengaluruurban|karnataka":         ("Bangalore", "Karnataka"),
    "bengalururural|karnataka":         ("BangaloreRural", "Karnataka"),
    "mumbai|maharashtra":               ("MumbaiSuburban", "Maharashtra"),
    "ahmadabad|gujarat":                ("Ahmedabad", "Gujarat"),
    "panchmahals|gujarat":              ("Panchmahal", "Gujarat"),
    "gurugram|haryana":                 ("Gurgaon", "Haryana"),
    "northeast|delhi":                  ("NorthEast", "NctofDelhi"),
    "north|delhi":                      ("North", "NctofDelhi"),
    "northwest|delhi":                  ("NorthWest", "NctofDelhi"),
    "south|delhi":                      ("South", "NctofDelhi"),
    "newdelhi|delhi":                   ("NewDelhi", "NctofDelhi"),
    "west|delhi":                       ("West", "NctofDelhi"),
    "southwest|delhi":                  ("SouthWest", "NctofDelhi"),
    "shahdara|delhi":                   ("Shahdara", "NctofDelhi"),
    "east|delhi":                       ("East", "NctofDelhi"),
    "central|delhi":                    ("Central", "NctofDelhi"),
    "southeast|delhi":                  ("SouthEast", "NctofDelhi"),
    "southandamans|andamanandnicobarislands":        ("SouthAndaman", "AndamanandNicobar"),
    "northandmiddleandaman|andamanandnicobarislands": ("NorthandMiddleAndaman", "AndamanandNicobar"),
    "nicobars|andamanandnicobarislands":             ("NicobarIslands", "AndamanandNicobar"),
    "warangal|telangana":               ("WarangalUrban", "Telangana"),
    "hanumakonda|telangana":            ("WarangalUrban", "Telangana"),
    "paraganassouth|westbengal":        ("South24Parganas", "WestBengal"),
    "paraganasnorth|westbengal":        ("North24Parganas", "WestBengal"),
    "alipurduar|westbengal":            ("Jalpaiguri", "WestBengal"),
    "baramulla|jammuandkashmir":        ("Baramula", "JammuandKashmir"),
    "bandipora|jammuandkashmir":        ("Bandipore", "JammuandKashmir"),
    "poonch|jammuandkashmir":           ("Punch", "JammuandKashmir"),
    "daman|thedadraandnagarhavelianddamananddiu":    ("Daman", "DamanandDiu"),
    "diu|thedadraandnagarhavelianddamananddiu":      ("Diu", "DamanandDiu"),
    "dadraandnagarhaveli|thedadraandnagarhavelianddamananddiu": ("DadraandNagarHaveli", "DadraandNagarHaveli"),
    "spsrnellore|andhrapradesh":        ("Nellore", "AndhraPradesh"),
    "gurdaspur|punjab":                 ("Gurdaspur", "Punjab"),
    # Pincode CSV name -> DRI name mismatches discovered during patch
    "ahmednagar|maharashtra":           ("Ahmadnagar", "Maharashtra"),
    "ayodhya|uttarpradesh":             ("Faizabad", "UttarPradesh"),      # renamed 2018
    "anakapalli|andhrapradesh":         ("Visakhapatnam", "AndhraPradesh"), # carved 2022
    "kheri|uttarpradesh":               ("LakhimpurKheri", "UttarPradesh"),
    "kargil|ladakh":                    ("Kargil", "JammuandKashmir"),      # Ladakh UT carved from J&K 2019
    "lehladakh|ladakh":                 ("LehLadakh", "JammuandKashmir"),
}


# ── Load district patch values (source of truth) ──────────────────────────────

print("Loading district_risk_index_final.csv ...")
dri = pd.read_csv(DRI_CSV, low_memory=False)
patch_cols = [
    "pm25_mean_3yr", "pm25_trend_5yr_pct", "pm25_trend_direction",
    "pm25_3yr_from_year", "pm25_3yr_to_year",
    "pm25_5yr_from_year", "pm25_5yr_to_year",
]
dri["_key"] = dri.apply(lambda r: norm_key(r["district_name"], r["state_name"]), axis=1)
dri_dupes = dri.duplicated("_key", keep=False).sum()
if dri_dupes:
    print(f"  Deduplicating {dri_dupes} rows with duplicate district keys (keeping first)")
    dri = dri.drop_duplicates(subset=["_key"], keep="first")
dri_dict = dri.set_index("_key")[patch_cols].to_dict("index")
print(f"  {len(dri_dict)} districts in lookup")


def get_district_patch(district, state):
    """Three-layer lookup → returns dict of patch_cols or all-None."""
    k = norm_key(district, state)

    # Layer 1: direct normalised match
    if k in dri_dict:
        return dri_dict[k]

    # Layer 2: ALIAS_MAP
    if k in ALIAS_MAP:
        alias_d, alias_s = ALIAS_MAP[k]
        ak = norm_key(alias_d, alias_s)
        if ak in dri_dict:
            return dri_dict[ak]

    # Layer 3: PARENT_MAP
    parent = parent_lookup.get(k)
    if parent:
        pk = norm_key(parent, state)
        if pk in dri_dict:
            return dri_dict[pk]
        # Also try parent in aliased state
        if k in ALIAS_MAP:
            _, alias_s = ALIAS_MAP[k]
            pk2 = norm_key(parent, alias_s)
            if pk2 in dri_dict:
                return dri_dict[pk2]

    return {c: None for c in patch_cols}


# ── Load pincode CSV ───────────────────────────────────────────────────────────

print("\nLoading pincode_risk_index.csv ...")
pri = pd.read_csv(PRI_CSV, dtype={"pincode": str}, low_memory=False)
print(f"  {len(pri)} pincodes loaded")

# Drop ALL _x / _y columns and existing new columns (clean rebuild)
stale = [c for c in pri.columns if c.endswith("_x") or c.endswith("_y")]
if stale:
    print(f"  Dropping {len(stale)} stale _x/_y columns: {stale[:6]}{'...' if len(stale)>6 else ''}")
    pri = pri.drop(columns=stale)

existing_new = [c for c in patch_cols + ["pm25_blended_3yr_ug",
    "pm25_national_pctile", "composite_national_pctile"] if c in pri.columns]
if existing_new:
    print(f"  Dropping {len(existing_new)} existing new columns for clean rebuild")
    pri = pri.drop(columns=existing_new)


# ── Apply three-layer lookup to every pincode ─────────────────────────────────

print("\nApplying three-layer lookup ...")
patch_rows = pri.apply(
    lambda r: get_district_patch(r["district_name"], r["state_name"]),
    axis=1,
    result_type="expand"
)

# Rename pm25_mean_3yr -> pm25_blended_3yr_ug for pincode table
patch_rows = patch_rows.rename(columns={"pm25_mean_3yr": "pm25_blended_3yr_ug"})

pri = pd.concat([pri, patch_rows], axis=1)

matched   = pri["pm25_blended_3yr_ug"].notna().sum()
unmatched = pri["pm25_blended_3yr_ug"].isna().sum()
print(f"  Matched:   {matched} pincodes ({matched/len(pri)*100:.1f}%)")
print(f"  Unmatched: {unmatched} pincodes ({unmatched/len(pri)*100:.1f}%)")

if unmatched > 0:
    sample = pri[pri["pm25_blended_3yr_ug"].isna()][["pincode","district_name","state_name"]].head(10)
    print(f"\n  Sample unmatched:")
    print(sample.to_string(index=False))


# ── National percentiles across all 19,560 pincodes ──────────────────────────

print("\nComputing national percentiles ...")
pm25_vals      = pri["pm25_blended_ug"].fillna(0).values
composite_vals = pri["composite_risk_score"].fillna(0).values

pri["pm25_national_pctile"] = [
    round(percentileofscore(pm25_vals, v, kind="rank"), 1) for v in pm25_vals
]
pri["composite_national_pctile"] = [
    round(percentileofscore(composite_vals, v, kind="rank"), 1) for v in composite_vals
]

print(f"  pm25_national_pctile: min={pri['pm25_national_pctile'].min()}, max={pri['pm25_national_pctile'].max()}")
print(f"  composite_national_pctile: min={pri['composite_national_pctile'].min()}, max={pri['composite_national_pctile'].max()}")


# ── Save ──────────────────────────────────────────────────────────────────────

pri.to_csv(PRI_CSV, index=False)
print(f"\nSaved {len(pri)} rows -> {PRI_CSV}")

final_cols = ["pm25_blended_3yr_ug","pm25_trend_5yr_pct","pm25_trend_direction",
              "pm25_3yr_from_year","pm25_3yr_to_year","pm25_5yr_from_year","pm25_5yr_to_year",
              "pm25_national_pctile","composite_national_pctile"]
print("\nFinal column coverage:")
for c in final_cols:
    if c in pri.columns:
        print(f"  {c}: {pri[c].notna().sum()} / {len(pri)}")
    else:
        print(f"  MISSING: {c}")

print("\nDone. Run: node scripts/load_track1_patch.mjs")
