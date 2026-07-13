"""
scripts/compute_pm25_bias.py

Compute SEDAC→CPCB bias correction factor per district using 2015–2022 overlap.

Input:  data/output/district_pm25_sedac_1998_2022.csv
        data/output/district_monthly_cpcb_2015_2025.csv
Output: data/output/pm25_bias_factors.csv

Columns: district_name, state_name, pm25_bias_factor (district-level),
         state_bias_factor (state-level fallback), final_bias_factor,
         overlap_years (how many years used for district estimate)

Notes:
  - Bias factor = mean(CPCB_annual / SEDAC_annual) over 2015–2022 overlap
  - Districts without CPCB station use state-level mean bias factor
  - If no state data either, bias factor = 1.0 (no correction)
  - Factors capped at [0.5, 1.5] to guard against outliers
"""
import os
import pandas as pd
import numpy as np

SEDAC_CSV = "data/output/district_pm25_sedac_1998_2022.csv"
CPCB_CSV  = "data/output/district_monthly_cpcb_2015_2025.csv"
OUT_PATH  = "data/output/pm25_bias_factors.csv"

os.makedirs("data/output", exist_ok=True)

print("Loading SEDAC PM2.5 …")
sedac = pd.read_csv(SEDAC_CSV)

print("Loading CPCB monthly data …")
cpcb = pd.read_csv(CPCB_CSV, low_memory=False)

# Collapse CPCB monthly → annual mean per district
cpcb_annual = (
    cpcb.groupby(["district_name", "state_name", "year"])
    .agg(pm25_cpcb_annual=("pm25_raw_cpcb", "mean"))
    .reset_index()
)

# Overlap period 2015–2022 (both sources available)
sedac_overlap = sedac[(sedac["year"] >= 2015) & (sedac["year"] <= 2022)].copy()

overlap = sedac_overlap.merge(
    cpcb_annual,
    on=["district_name", "state_name", "year"],
    how="inner",
)

overlap = overlap.dropna(subset=["pm25_sedac_raw", "pm25_cpcb_annual"])
overlap = overlap[(overlap["pm25_sedac_raw"] > 0)]

overlap["bias_factor"] = overlap["pm25_cpcb_annual"] / overlap["pm25_sedac_raw"]

# Cap outliers
overlap["bias_factor"] = overlap["bias_factor"].clip(0.5, 1.5)

print(f"  Overlap records: {len(overlap):,} (district-years with both sources)")

# District-level mean bias
district_bias = (
    overlap.groupby(["district_name", "state_name"])
    .agg(
        pm25_bias_factor=("bias_factor", "mean"),
        overlap_years=("year", "count"),
    )
    .reset_index()
)

# State-level fallback
state_bias = (
    overlap.groupby("state_name")
    .agg(state_bias_factor=("bias_factor", "mean"))
    .reset_index()
)

district_bias = district_bias.merge(state_bias, on="state_name", how="left")

district_bias["final_bias_factor"] = (
    district_bias["pm25_bias_factor"]
    .fillna(district_bias["state_bias_factor"])
    .fillna(1.0)
)

print(f"  Districts with own bias factor: {district_bias['pm25_bias_factor'].notna().sum()}")
print(f"  Districts using state fallback:  {(district_bias['pm25_bias_factor'].isna() & district_bias['state_bias_factor'].notna()).sum()}")
print(f"  Districts using default (1.0):   {(district_bias['final_bias_factor'] == 1.0).sum()}")

district_bias.to_csv(OUT_PATH, index=False)
print(f"Done → {OUT_PATH}")
