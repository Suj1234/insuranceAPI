"""
scripts/patch_track1_columns.py

Adds Track 1 columns to existing district_risk_index_final.csv and
pincode_risk_index.csv WITHOUT re-running the full pipeline.

New columns:
  district_risk_index: pm25_mean_3yr, pm25_trend_5yr_pct, pm25_trend_direction,
                       pm25_3yr_from_year, pm25_3yr_to_year,
                       pm25_5yr_from_year, pm25_5yr_to_year,
                       pm25_national_pctile, composite_national_pctile

  pincode_risk_index:  pm25_blended_3yr_ug, pm25_trend_5yr_pct, pm25_trend_direction,
                       pm25_3yr_from_year, pm25_3yr_to_year,
                       pm25_5yr_from_year, pm25_5yr_to_year,
                       pm25_national_pctile, composite_national_pctile

Sources used (already built):
  data/output/district_air_quality_final.csv  -> 3yr mean + trend for districts
  data/output/district_risk_index_final.csv   -> existing district index
  data/output/pincode_risk_index.csv          -> existing pincode index
  (pincode 3yr/trend derived from district-level data via district name join)
"""
import pandas as pd
import numpy as np
from scipy.stats import percentileofscore

DAQ_CSV     = "data/output/district_air_quality_final.csv"
DRI_CSV     = "data/output/district_risk_index_final.csv"
PRI_CSV     = "data/output/pincode_risk_index.csv"

print("Loading district_risk_index_final (already patched) ...")
dri = pd.read_csv(DRI_CSV, low_memory=False)
print(f"  {len(dri)} districts, columns with new data: "
      f"3yr={dri['pm25_mean_3yr'].notna().sum()}, "
      f"trend={dri['pm25_trend_direction'].notna().sum()}, "
      f"pctile={dri['pm25_national_pctile'].notna().sum()}")

# Derive vintage years from DAQ so we can set them on pincodes too
daq = pd.read_csv(DAQ_CSV, low_memory=False)
all_years = sorted(daq["year"].dropna().unique())
years_5yr = all_years[-5:]
years_3yr = all_years[-3:]
pm25_5yr_from = int(years_5yr[0])
pm25_5yr_to   = int(years_5yr[-1])
pm25_3yr_from = int(years_3yr[0])
pm25_3yr_to   = int(years_3yr[-1])
print(f"  Vintage — 5yr: {pm25_5yr_from}–{pm25_5yr_to}, 3yr: {pm25_3yr_from}–{pm25_3yr_to}")

# ── Patch pincode_risk_index.csv via district join ────────────────────────────
print("\nPatching pincode_risk_index.csv ...")
pri = pd.read_csv(PRI_CSV, low_memory=False)
print(f"  {len(pri)} pincodes loaded")

# Normalise both sides to lowercase for join, then restore original
district_patch = dri[[
    "district_name", "state_name",
    "pm25_mean_3yr", "pm25_trend_5yr_pct", "pm25_trend_direction",
    "pm25_3yr_from_year", "pm25_3yr_to_year",
    "pm25_5yr_from_year", "pm25_5yr_to_year",
]].copy()
district_patch = district_patch.rename(columns={"pm25_mean_3yr": "pm25_blended_3yr_ug"})
district_patch["_join_key"] = (
    district_patch["district_name"].str.lower().str.replace(r"[^a-z]", "", regex=True) + "|" +
    district_patch["state_name"].str.lower().str.replace(r"[^a-z]", "", regex=True)
)

pri["_join_key"] = (
    pri["district_name"].str.lower().str.replace(r"[^a-z]", "", regex=True) + "|" +
    pri["state_name"].str.lower().str.replace(r"[^a-z]", "", regex=True)
)

patch_cols = ["_join_key", "pm25_blended_3yr_ug", "pm25_trend_5yr_pct", "pm25_trend_direction",
              "pm25_3yr_from_year", "pm25_3yr_to_year", "pm25_5yr_from_year", "pm25_5yr_to_year"]
pri = pri.merge(district_patch[patch_cols], on="_join_key", how="left")
pri = pri.drop(columns=["_join_key"])

# National percentiles across all pincodes (use blended 5yr pm25)
pm25_p      = pri["pm25_blended_ug"].fillna(0).values
composite_p = pri["composite_risk_score"].fillna(0).values

pri["pm25_national_pctile"] = [
    round(percentileofscore(pm25_p, v, kind="rank"), 1) for v in pm25_p
]
pri["composite_national_pctile"] = [
    round(percentileofscore(composite_p, v, kind="rank"), 1) for v in composite_p
]

pri.to_csv(PRI_CSV, index=False)
print(f"  Saved {len(pri)} rows -> {PRI_CSV}")
print(f"  3yr mean populated: {pri['pm25_blended_3yr_ug'].notna().sum()} pincodes")
print(f"  Trend populated:    {pri['pm25_trend_direction'].notna().sum()} pincodes")

print("\nDone. Now run load_patch_track1.mjs to push to Neon.")
