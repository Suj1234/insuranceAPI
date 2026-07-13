"""
scripts/build_district_risk_index.py

Aggregate time series -> district_risk_index table CSV.

Input:  data/output/district_air_quality_final.csv
        data/output/heat_wave_days.csv          (from compute_heat_wave_days.py)
        data/output/emdat_disaster_summary.csv  (manually prepared from EM-DAT)
        data/output/nfhs5_district.csv          (manually prepared from NFHS-5)
Output: data/output/district_risk_index_final.csv

Load into DB after this script:
  psql $DATABASE_URL -c "\COPY district_risk_index FROM 'data/output/district_risk_index_final.csv' CSV HEADER"

emdat_disaster_summary.csv expected columns:
  district_name, state_name, flood_events_per_decade, cyclone_events_per_decade,
  earthquake_events_per_decade, disaster_insurance_loss_cr, disaster_frequency_score

nfhs5_district.csv expected columns:
  district_name, state_name, hypertension_pct, diabetes_pct,
  obesity_pct, tobacco_use_pct, anaemia_pct
"""
import os
import pandas as pd
import numpy as np
from scipy.stats import percentileofscore
from datetime import datetime, timezone

DAQ_CSV      = "data/output/district_air_quality_final.csv"
HEAT_CSV     = "data/output/heat_wave_days.csv"
EMDAT_CSV    = "data/output/emdat_disaster_summary.csv"
NFHS5_CSV    = "data/output/nfhs5_district.csv"
OUT_PATH     = "data/output/district_risk_index_final.csv"

os.makedirs("data/output", exist_ok=True)

MONTH_NAMES = {
    1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
    7:"July",8:"August",9:"September",10:"October",11:"November",12:"December",
}

def pm25_zone(v):
    if pd.isna(v): return None
    if v <= 30:  return "Good"
    if v <= 60:  return "Satisfactory"
    if v <= 90:  return "Moderate"
    if v <= 120: return "Poor"
    if v <= 250: return "Very Poor"
    return "Severe"

def no2_zone(v):
    if pd.isna(v): return None
    if v <= 40:  return "Good"
    if v <= 80:  return "Satisfactory"
    if v <= 180: return "Moderate"
    return "Poor"

def aqi_category_from_mean(v):
    if pd.isna(v): return None
    if v <= 50:  return "Good"
    if v <= 100: return "Satisfactory"
    if v <= 200: return "Moderate"
    if v <= 300: return "Poor"
    if v <= 400: return "Very Poor"
    return "Severe"

def risk_tier(score):
    if score <= 25: return "Low"
    if score <= 50: return "Medium"
    if score <= 75: return "High"
    return "Very High"

# ── Load time series ─────────────────────────────────────────────────────────

print("Loading district_air_quality ...")
daq = pd.read_csv(DAQ_CSV, low_memory=False)

# Use last 5 and last 3 complete years available
all_years = sorted(daq["year"].dropna().unique())
recent_years  = all_years[-5:]
recent_3years = all_years[-3:]
print(f"  5yr window: {recent_years}")
print(f"  3yr window: {recent_3years}")

pm25_5yr_from = int(recent_years[0])
pm25_5yr_to   = int(recent_years[-1])
pm25_3yr_from = int(recent_3years[0])
pm25_3yr_to   = int(recent_3years[-1])

recent   = daq[daq["year"].isin(recent_years)].copy()
recent_3 = daq[daq["year"].isin(recent_3years)].copy()

# ── 5-year aggregates ─────────────────────────────────────────────────────────

print("Aggregating 5-year means ...")
agg = (
    recent.groupby(["district_name", "state_name"])
    .agg(
        pm25_mean_5yr=("pm25_calibrated", "mean"),
        pm25_worst_month_avg=("pm25_calibrated", "max"),
        pm10_mean_5yr=("pm10_calibrated", "mean"),
        pm10_worst_month_avg=("pm10_calibrated", "max"),
        no2_mean_5yr=("no2_cams", "mean"),
        so2_mean_5yr=("so2_cams", "mean"),
        co_mean_5yr=("co_cams", "mean"),
        o3_mean_5yr=("o3_cams", "mean"),
        aqi_annual_mean=("aqi_representative", "mean"),
        aqi_worst_month=("aqi_representative", "max"),
        data_as_of_year=("year", "max"),
        pm25_data_source=("pm25_source", lambda x: x.mode().iloc[0] if len(x) > 0 else None),
    )
    .reset_index()
)

# Worst month name and year
worst_idx = recent.groupby(["district_name", "state_name"])["aqi_representative"].idxmax()
worst_rows = recent.loc[worst_idx, ["district_name", "state_name", "year", "month"]].copy()
worst_rows["aqi_worst_month_name"] = worst_rows["month"].map(MONTH_NAMES)
worst_rows = worst_rows.rename(columns={"year": "aqi_worst_year"})
agg = agg.merge(
    worst_rows[["district_name", "state_name", "aqi_worst_month_name", "aqi_worst_year"]],
    on=["district_name", "state_name"], how="left"
)

# 3-year PM2.5 mean
agg_3yr = (
    recent_3.groupby(["district_name", "state_name"])
    .agg(pm25_mean_3yr=("pm25_calibrated", "mean"))
    .reset_index()
)
agg = agg.merge(agg_3yr, on=["district_name", "state_name"], how="left")

# 20-year PM2.5 mean
agg_20yr = (
    daq.groupby(["district_name", "state_name"])
    .agg(pm25_mean_20yr=("pm25_calibrated", "mean"))
    .reset_index()
)
agg = agg.merge(agg_20yr, on=["district_name", "state_name"], how="left")

# Dominant limiting pollutant over 5 years
lp = (
    recent.groupby(["district_name", "state_name"])["aqi_limiting_pollutant"]
    .apply(lambda x: x.mode().iloc[0] if len(x) > 0 else None)
    .reset_index()
    .rename(columns={"aqi_limiting_pollutant": "aqi_limiting_pollutant"})
)
agg = agg.merge(lp, on=["district_name", "state_name"], how="left")

# ── PM2.5 trend (year N vs year N-4) ─────────────────────────────────────────

print("Computing PM2.5 trend ...")
# Annual mean per district for the 5-year window
annual_means = (
    recent.groupby(["district_name", "state_name", "year"])
    ["pm25_calibrated"].mean()
    .reset_index()
    .rename(columns={"pm25_calibrated": "pm25_annual"})
)

# Earliest and latest year annual mean per district
earliest = (
    annual_means[annual_means["year"] == recent_years[0]]
    [["district_name", "state_name", "pm25_annual"]]
    .rename(columns={"pm25_annual": "pm25_earliest"})
)
latest = (
    annual_means[annual_means["year"] == recent_years[-1]]
    [["district_name", "state_name", "pm25_annual"]]
    .rename(columns={"pm25_annual": "pm25_latest"})
)
trend_df = earliest.merge(latest, on=["district_name", "state_name"], how="inner")
trend_df["pm25_trend_5yr_pct"] = (
    (trend_df["pm25_latest"] - trend_df["pm25_earliest"]) /
    trend_df["pm25_earliest"].replace(0, np.nan) * 100
).round(2)

def trend_direction(pct):
    if pd.isna(pct): return None
    if pct < -10:  return "improving"
    if pct > 10:   return "worsening"
    return "stable"

trend_df["pm25_trend_direction"] = trend_df["pm25_trend_5yr_pct"].apply(trend_direction)
agg = agg.merge(
    trend_df[["district_name", "state_name", "pm25_trend_5yr_pct", "pm25_trend_direction"]],
    on=["district_name", "state_name"], how="left"
)

# ── Vintage year columns ──────────────────────────────────────────────────────

agg["pm25_3yr_from_year"] = pm25_3yr_from
agg["pm25_3yr_to_year"]   = pm25_3yr_to
agg["pm25_5yr_from_year"] = pm25_5yr_from
agg["pm25_5yr_to_year"]   = pm25_5yr_to

# ── Zone classifications ──────────────────────────────────────────────────────

agg["pm25_zone"]        = agg["pm25_mean_5yr"].apply(pm25_zone)
agg["pm10_zone"]        = agg["pm10_mean_5yr"].apply(pm25_zone)   # same breakpoints for zone label
agg["no2_zone"]         = agg["no2_mean_5yr"].apply(no2_zone)
agg["so2_zone"]         = agg["so2_mean_5yr"].apply(no2_zone)
agg["co_zone"]          = None   # no standard zone for CO at annual mean
agg["o3_zone"]          = None
agg["aqi_category_5yr"] = agg["aqi_annual_mean"].apply(aqi_category_from_mean)

# ── Merge heat wave days ──────────────────────────────────────────────────────

if os.path.exists(HEAT_CSV):
    print("Merging heat wave days ...")
    heat = pd.read_csv(HEAT_CSV)
    agg = agg.merge(
        heat[["district_name", "state_name", "heat_wave_days_per_year"]],
        on=["district_name", "state_name"], how="left"
    )
    def heat_stress_zone(d):
        if pd.isna(d): return None
        if d <= 10: return "Low"
        if d <= 20: return "Moderate"
        if d <= 30: return "High"
        return "Extreme"
    agg["heat_stress_zone"] = agg["heat_wave_days_per_year"].apply(heat_stress_zone)
else:
    print("  heat_wave_days.csv not found — skipping heat stress columns")
    agg["heat_wave_days_per_year"] = None
    agg["heat_stress_zone"] = None

# ── Merge EM-DAT disaster data ────────────────────────────────────────────────

if os.path.exists(EMDAT_CSV):
    print("Merging EM-DAT disaster data ...")
    emdat = pd.read_csv(EMDAT_CSV)
    agg = agg.merge(
        emdat[["district_name", "state_name", "flood_events_per_decade",
               "cyclone_events_per_decade", "earthquake_events_per_decade",
               "disaster_insurance_loss_cr", "disaster_frequency_score"]],
        on=["district_name", "state_name"], how="left"
    )
else:
    print("  emdat_disaster_summary.csv not found — skipping disaster columns")
    for col in ["flood_events_per_decade","cyclone_events_per_decade",
                "earthquake_events_per_decade","disaster_insurance_loss_cr","disaster_frequency_score"]:
        agg[col] = None

# ── Merge NFHS-5 disease burden ───────────────────────────────────────────────

if os.path.exists(NFHS5_CSV):
    print("Merging NFHS-5 disease burden ...")
    nfhs = pd.read_csv(NFHS5_CSV)
    agg = agg.merge(
        nfhs[["district_name", "state_name", "hypertension_pct", "diabetes_pct",
              "obesity_pct", "tobacco_use_pct", "anaemia_pct"]],
        on=["district_name", "state_name"], how="left"
    )
else:
    print("  nfhs5_district.csv not found — skipping disease burden columns")
    for col in ["hypertension_pct","diabetes_pct","obesity_pct","tobacco_use_pct","anaemia_pct"]:
        agg[col] = None

# ── Composite risk score (0–100) ──────────────────────────────────────────────
#
#   PM2.5 contribution    (30%) = (pm25_mean_5yr / 250) × 100 × 0.30
#   AQI contribution      (20%) = (aqi_annual_mean / 500) × 100 × 0.20
#   Disaster frequency    (15%) = (disaster_frequency_score / 10) × 100 × 0.15
#   Heat stress           (10%) = (heat_wave_days_per_year / 60) × 100 × 0.10
#   Disease burden        (15%) = ((hypertension_pct + diabetes_pct) / 2 / 50) × 100 × 0.15
#   NO2 contribution      (10%) = (no2_mean_5yr / 200) × 100 × 0.10

print("Computing composite risk score ...")

pm25_score     = (agg["pm25_mean_5yr"].fillna(50)           / 250)  * 100 * 0.30
aqi_score      = (agg["aqi_annual_mean"].fillna(100)        / 500)  * 100 * 0.20
disaster_score = (agg["disaster_frequency_score"].fillna(0) / 10)   * 100 * 0.15
heat_score     = (agg["heat_wave_days_per_year"].fillna(0)  / 60)   * 100 * 0.10
disease_score  = (
    ((agg["hypertension_pct"].fillna(25) + agg["diabetes_pct"].fillna(10)) / 2) / 50
) * 100 * 0.15
no2_score      = (agg["no2_mean_5yr"].fillna(20)            / 200)  * 100 * 0.10

agg["composite_risk_score"] = (
    pm25_score + aqi_score + disaster_score + heat_score + disease_score + no2_score
).clip(0, 100).round(2)

agg["risk_tier"]          = agg["composite_risk_score"].apply(risk_tier)
agg["last_refreshed_at"]  = datetime.now(timezone.utc).isoformat()

# ── National percentile ranks ─────────────────────────────────────────────────
# percentileofscore gives the % of districts with a value <= this district's value.
# Higher = worse (more polluted / higher risk).

print("Computing national percentile ranks ...")
pm25_vals       = agg["pm25_mean_5yr"].fillna(0).values
composite_vals  = agg["composite_risk_score"].fillna(0).values

agg["pm25_national_pctile"] = [
    round(percentileofscore(pm25_vals, v, kind="rank"), 1)
    for v in pm25_vals
]
agg["composite_national_pctile"] = [
    round(percentileofscore(composite_vals, v, kind="rank"), 1)
    for v in composite_vals
]

agg.to_csv(OUT_PATH, index=False)
print(f"\nDone. {len(agg):,} districts -> {OUT_PATH}")
print(f"Risk tier distribution:\n{agg['risk_tier'].value_counts()}")
