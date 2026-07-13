"""
scripts/process_nfhs5.py

Pivot NFHS-5 long-format India.csv -> one row per district with 5 health columns.

Input:  data/nfhs/India.csv
Output: data/output/nfhs5_district.csv

Columns produced:
  district_name, state_name,
  hypertension_pct, diabetes_pct, obesity_pct, tobacco_use_pct, anaemia_pct
"""
import os
import pandas as pd
import numpy as np

IN_PATH  = "data/nfhs/India.csv"
OUT_PATH = "data/output/nfhs5_district.csv"

os.makedirs("data/output", exist_ok=True)

df = pd.read_csv(IN_PATH, low_memory=False)

# Map indicator strings -> column names
# We average male+female where both exist
INDICATOR_MAP = {
    "hypertension_pct": [
        "Female Elevated blood pressure or taking medicine to control blood pressure (%)",
        "Male Elevated blood pressure or taking medicine to control blood pressure (%)",
    ],
    "diabetes_pct": [
        "Female Blood sugar level  high or very high (>140 mg/dl) or taking medicine to control blood sugar level (%)",
        "Male Blood sugar level  high or very high (>140 mg/dl) or taking medicine to control blood sugar level (%)",
    ],
    "obesity_pct": [
        "Women who are overweight or obese",
        "Men who are overweight or obese (BMI 25.0 kg/m2)",
    ],
    "tobacco_use_pct": [
        "Women age 15 years and above who use any kind of tobacco (%)",
        "Men age 15 years and above who use any kind of tobacco (%)",
    ],
    "anaemia_pct": [
        "All women age 15-49 years who are anaemic (%)",
    ],
}

def norm_name(s):
    if not isinstance(s, str): return ""
    return "".join(w.capitalize() for w in s.strip().split())

df["district_name"] = df["District"].apply(norm_name)
df["state_name"] = df["State"].apply(norm_name)
df["value"] = pd.to_numeric(df["NFHS 5"], errors="coerce")

results = []
for (district, state), grp in df.groupby(["district_name", "state_name"]):
    row = {"district_name": district, "state_name": state}
    for col, indicators in INDICATOR_MAP.items():
        vals = grp[grp["Indicator"].isin(indicators)]["value"].dropna()
        row[col] = round(float(vals.mean()), 2) if len(vals) > 0 else None
    results.append(row)

out = pd.DataFrame(results)
out.to_csv(OUT_PATH, index=False)
print(f"Done. {len(out):,} districts -> {OUT_PATH}")
print(out[["hypertension_pct","diabetes_pct","obesity_pct","tobacco_use_pct","anaemia_pct"]].describe())
