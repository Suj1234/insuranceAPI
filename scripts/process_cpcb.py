"""
scripts/process_cpcb.py

CPCB daily AQI CSV → district monthly means.

Input:  data/cpcb/daily_aqi_2015_2025.csv
        data/cpcb/station_district_mapping.csv
Output: data/output/district_monthly_cpcb_2015_2025.csv

Expected CPCB CSV columns:
  station_name, city, state, date, pm25, pm10, no2, so2, co, o3, aqi

station_district_mapping.csv columns:
  station_name, district_name, state_name, lat, lng
"""
import os
import pandas as pd
import numpy as np

CPCB_CSV  = "data/cpcb/daily_aqi_2015_2025.csv"
MAPPING   = "data/cpcb/station_district_mapping.csv"
OUT_PATH  = "data/output/district_monthly_cpcb_2015_2025.csv"

os.makedirs("data/output", exist_ok=True)

print("Loading CPCB data …")
cpcb = pd.read_csv(CPCB_CSV, low_memory=False)

cpcb["date"]  = pd.to_datetime(cpcb["date"], errors="coerce")
cpcb["year"]  = cpcb["date"].dt.year
cpcb["month"] = cpcb["date"].dt.month

# Drop rows with invalid dates or out of range
cpcb = cpcb[(cpcb["year"] >= 2015) & (cpcb["year"] <= 2025)]

print("Merging station → district mapping …")
mapping = pd.read_csv(MAPPING)
cpcb = cpcb.merge(mapping[["station_name", "district_name", "state_name"]], on="station_name", how="left")

unmapped = cpcb["district_name"].isna().sum()
if unmapped > 0:
    print(f"  WARNING: {unmapped:,} rows have no district mapping — dropping")
cpcb = cpcb.dropna(subset=["district_name"])

# Cast pollutant columns to numeric
for col in ["pm25", "pm10", "no2", "so2", "co", "o3"]:
    if col in cpcb.columns:
        cpcb[col] = pd.to_numeric(cpcb[col], errors="coerce")

print("Aggregating to district monthly means …")
monthly = (
    cpcb.groupby(["district_name", "state_name", "year", "month"])
    .agg(
        pm25_raw_cpcb=("pm25", "mean"),
        pm10_raw_cpcb=("pm10", "mean"),
        no2_cpcb=("no2", "mean"),
        so2_cpcb=("so2", "mean"),
        co_cpcb=("co", "mean"),
        o3_cpcb=("o3", "mean"),
        station_count=("station_name", "nunique"),
        reading_count=("pm25", "count"),
    )
    .reset_index()
)

monthly.to_csv(OUT_PATH, index=False)
print(f"Done. {len(monthly):,} district-month records → {OUT_PATH}")
