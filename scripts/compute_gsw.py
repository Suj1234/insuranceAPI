"""
compute_gsw.py — Live JRC Global Surface Water v1.4 computation.

Queries 3 JRC/GSW1_4 collections from GEE for a single lat/lng + buffer (3 getInfo calls).
MonthlyRecurrence is omitted — equivalent values are computed directly from MonthlyHistory.
Outputs complete JSON to stdout. Errors go to stderr.

Usage:
  python scripts/compute_gsw.py \
    --lat 9.9312 --lng 76.2673 \
    --buffer_m 500 \
    --windows w2,w5,w10,w20,full \
    [--pincode 682001] [--district Ernakulam] [--state Kerala]

Collections used:
  JRC/GSW1_4/GlobalSurfaceWater  — main bands (occurrence, seasonality, recurrence, transition, max_extent, change_abs, change_norm)
  JRC/GSW1_4/YearlyHistory       — annual water classification 1984-2021
  JRC/GSW1_4/MonthlyHistory      — monthly observations 1984-2021 (~454 images)

Note: JRC/GSW1_4/YearlyTransitionMask is an internal masking dataset; year-to-year
      transitions are computed directly from YearlyHistory consecutive-year comparison.
"""

import argparse
import json
import math
import os
import statistics
import sys
import time
from datetime import datetime, timezone

import ee

# ── Constants ────────────────────────────────────────────────────────────────

KEY_FILE = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT  = os.environ.get("GEE_PROJECT", "insuretech-data-platform")

SCALE = 30  # JRC native resolution in metres

MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun",
               "jul", "aug", "sep", "oct", "nov", "dec"]

MONTH_LABELS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"]

WINDOW_DEFS = {
    "full": {
        "label": "Full Record", "start": 1984, "end": 2021,
        "reliability": "high",
        "reliability_note": (
            "38yr record. Pre-2000 Landsat 5 has lower observation density (~8/yr vs "
            "~20/yr post-2000). Still statistically robust for long-term risk assessment."
        ),
    },
    "w20": {
        "label": "Recent 20 Years", "start": 2002, "end": 2021,
        "reliability": "high",
        "reliability_note": (
            "2002-2021: Full Landsat 7 ETM+ + Landsat 8 OLI era. "
            "~20 observations/month. Most reliable sub-window."
        ),
    },
    "w10": {
        "label": "Recent 10 Years", "start": 2012, "end": 2021,
        "reliability": "high",
        "reliability_note": (
            "2012-2021: Landsat 7 + Landsat 8 OLI. ~22 observations/month. "
            "Captures decadal climate variability."
        ),
    },
    "w5": {
        "label": "Recent 5 Years", "start": 2017, "end": 2021,
        "reliability": "moderate",
        "reliability_note": (
            "2017-2021: Landsat 8 OLI only — best radiometric quality. "
            "5yr is minimum for meaningful statistics. Single extreme events can dominate."
        ),
    },
    "w2": {
        "label": "Recent 2 Years", "start": 2020, "end": 2021,
        "reliability": "indicative",
        "reliability_note": (
            "2yr is statistically insufficient for trend or recurrence analysis. "
            "Use only for: recent event detection, 'was there water in the past 2 years?'"
        ),
    },
}

# JRC transition band classification (epoch1=1984-1999 vs epoch2=2000-2021)
TRANSITION_META = {
    1:  ("No Change — Not Water",       "stable"),
    2:  ("Permanent Water",             "stable"),
    3:  ("New Permanent Water",         "increasing"),   # red flag: was dry, now permanent
    4:  ("Lost Permanent Water",        "decreasing"),
    5:  ("Seasonal → Permanent Water",  "increasing"),   # red flag: intensifying
    6:  ("Permanent → Seasonal Water",  "decreasing"),
    7:  ("Seasonal → Not Water",        "decreasing"),
    8:  ("New Seasonal Water",          "increasing"),   # red flag: new flood zone
    9:  ("Seasonal Water",              "stable"),
    10: ("Lost Seasonal Water",         "decreasing"),
}

WATER_CLASS_LABEL = {
    0: "no_data",
    1: "land",
    2: "seasonal_water",
    3: "permanent_water",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def rnd(v, n=1):
    if v is None:
        return None
    try:
        return round(float(v), n)
    except (TypeError, ValueError):
        return None

def to_int(v):
    if v is None:
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None

def safe_div(num, denom, scale=100, decimals=1):
    if not num or not denom or denom == 0:
        return None
    return rnd(float(num) / float(denom) * scale, decimals)

def safe_mean(lst):
    lst = [x for x in lst if x is not None]
    return statistics.mean(lst) if lst else None

def safe_stdev(lst):
    lst = [x for x in lst if x is not None]
    return round(statistics.stdev(lst), 1) if len(lst) > 1 else 0.0

# ── GEE init ─────────────────────────────────────────────────────────────────

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

# ── GEE data fetch (3 getInfo calls) ─────────────────────────────────────────

def fetch_all_gee_data(lat, lng, buffer_m):
    """
    Executes 3 GEE getInfo calls (+ optional 4th for distance_to_water).
    All heavy computation (reduceRegion, map) runs server-side in GEE.
    """
    point = ee.Geometry.Point([lng, lat])
    geom  = point.buffer(buffer_m)

    gsw    = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    yh_col = ee.ImageCollection("JRC/GSW1_4/YearlyHistory")
    mh_col = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")
    # JRC/GSW1_4/MonthlyRecurrence is the 12-month climatology, but we compute
    # identical values from MonthlyHistory so we can cover any sub-window uniformly.
    # Removed to save one GEE round trip (~5-10s).

    water_mask = gsw.select("max_extent")  # 1 = ever water, 0 = never water

    # ── Call 1: Main bands + spatial distribution ─────────────────────────────
    # Occurrence / recurrence / change: mean over water-masked pixels only
    masked_gsw = gsw.updateMask(water_mask)

    # Each reduceRegion returns a dict; combine into one server-side Dictionary
    main_stats = ee.Dictionary({
        # A-fix: raw seasonality band = count of months with water in 2021 specifically
        "seasonality_2021":    masked_gsw.select("seasonality").reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("seasonality"),
        # Main occurrence over full record (JRC band, water-pixel masked)
        "occurrence":          masked_gsw.select("occurrence").reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("occurrence"),
        # Recurrence: % of years with water (JRC band)
        "recurrence":          masked_gsw.select("recurrence").reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("recurrence"),
        # B-fix: transition class (mode = most common class in buffer)
        "transition":          gsw.select("transition").reduceRegion(
                                   ee.Reducer.mode(), geom, SCALE).get("transition"),
        # JRC epoch-level change bands (epoch1=1984-1999 vs epoch2=2000-2021)
        "change_abs":          masked_gsw.select("change_abs").reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("change_abs"),
        "change_norm":         masked_gsw.select("change_norm").reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("change_norm"),
        # E-fix: spatial distribution within buffer
        "area_ever_water_frac": water_mask.reduceRegion(
                                   ee.Reducer.mean(), geom, SCALE).get("max_extent"),
        "perm_water_pixels":   gsw.select("occurrence").gt(90).And(water_mask.eq(1)).rename("w").reduceRegion(
                                   ee.Reducer.sum(), geom, SCALE).get("w"),
        "flood_zone_pixels":   gsw.select("occurrence").gte(10).And(
                                   gsw.select("occurrence").lte(90)).And(water_mask.eq(1)).rename("w").reduceRegion(
                                   ee.Reducer.sum(), geom, SCALE).get("w"),
        "never_water_pixels":  water_mask.eq(0).rename("w").reduceRegion(
                                   ee.Reducer.sum(), geom, SCALE).get("w"),
        "total_buffer_pixels": water_mask.gte(0).rename("w").reduceRegion(
                                   ee.Reducer.sum(), geom, SCALE).get("w"),
        # F-fix: is the center point itself a water pixel?
        "center_is_water":     gsw.select("max_extent").reduceRegion(
                                   ee.Reducer.first(), point, SCALE).get("max_extent"),
    })
    main_vals = main_stats.getInfo()

    # ── Call 2: YearlyHistory — annual water class per year (38 features) ──────
    def tag_yearly(img):
        wc = img.select("waterClass")
        return ee.Feature(None, {
            "year":         img.date().get("year"),
            "mode":         wc.reduceRegion(ee.Reducer.mode(), geom, SCALE).get("waterClass"),
            "perm_pixels":  wc.eq(3).rename("w").reduceRegion(ee.Reducer.sum(), geom, SCALE).get("w"),
            "seas_pixels":  wc.eq(2).rename("w").reduceRegion(ee.Reducer.sum(), geom, SCALE).get("w"),
            "land_pixels":  wc.eq(1).rename("w").reduceRegion(ee.Reducer.sum(), geom, SCALE).get("w"),
            "total_pixels": wc.gte(0).rename("w").reduceRegion(ee.Reducer.sum(), geom, SCALE).get("w"),
        })

    yh_raw = yh_col.sort("system:time_start").map(tag_yearly).getInfo()
    yearly_records = [f["properties"] for f in yh_raw["features"]]

    # ── Call 3: MonthlyHistory — water pixel counts per month (≈454 features) ─
    # Apply water mask so only historically-wet pixels are counted (JRC methodology)
    mh_masked = mh_col.map(lambda img: img.updateMask(water_mask))

    def tag_monthly(img):
        is_water = img.eq(2).rename("w")
        is_valid = img.gt(0).rename("v")   # valid = class 1 (land) or 2 (water), not no-data
        return ee.Feature(None, {
            "year":      img.date().get("year"),
            "month":     img.date().get("month"),
            "water_sum": is_water.reduceRegion(ee.Reducer.sum(), geom, SCALE).get("w"),
            "valid_sum": is_valid.reduceRegion(ee.Reducer.sum(), geom, SCALE).get("v"),
        })

    mh_raw = mh_masked.sort("system:time_start").map(tag_monthly).getInfo()
    monthly_records = [f["properties"] for f in mh_raw["features"]]

    # ── Distance to nearest water (F-fix) ─────────────────────────────────────
    # Computed separately only if center point is not itself water
    if main_vals.get("center_is_water") == 1:
        distance_to_water_m = 0
    else:
        try:
            dist_img = water_mask.selfMask().distance(
                ee.Kernel.euclidean(2000, "meters"), False
            )
            dist_val = dist_img.reduceRegion(
                reducer=ee.Reducer.min(),
                geometry=point.buffer(150),
                scale=SCALE,
            ).getInfo().get("max_extent")
            distance_to_water_m = rnd(dist_val, 0) if dist_val is not None else None
        except Exception:
            distance_to_water_m = None

    return {
        "main_vals":            main_vals,
        "yearly_records":       yearly_records,
        "monthly_records":      monthly_records,
        "distance_to_water_m":  distance_to_water_m,
    }

# ── Per-window metrics ────────────────────────────────────────────────────────

def compute_occurrence_metrics(monthly_records, start_yr, end_yr):
    """
    Returns (occurrence_pct, occurrence_stddev_pct, seasonality_months_per_yr).
    occurrence_pct: water observations / total valid observations (water-masked).
    occurrence_stddev_pct: std dev of per-year occurrence values (D-fix).
    """
    recs = [r for r in monthly_records
            if r.get("year") is not None and start_yr <= int(r["year"]) <= end_yr]
    if not recs:
        return None, None, None

    # Yearly aggregates for stddev and seasonality
    by_year = {}
    for r in recs:
        yr = int(r["year"])
        m  = int(r["month"])
        ws = r.get("water_sum") or 0
        vs = r.get("valid_sum") or 0
        if yr not in by_year:
            by_year[yr] = {"water": 0, "valid": 0, "wet_months": 0}
        by_year[yr]["water"] += ws
        by_year[yr]["valid"] += vs
        if ws > 0:
            by_year[yr]["wet_months"] += 1

    yearly_occ_vals = [
        v["water"] / v["valid"] * 100
        for v in by_year.values()
        if v["valid"] > 0
    ]
    seasonality_vals = [v["wet_months"] for v in by_year.values() if v["valid"] > 0]

    total_water = sum(r.get("water_sum") or 0 for r in recs)
    total_valid = sum(r.get("valid_sum") or 0 for r in recs)

    occurrence_pct   = rnd(total_water / total_valid * 100) if total_valid > 0 else None
    occurrence_std   = safe_stdev(yearly_occ_vals)
    seasonality_avg  = rnd(safe_mean(seasonality_vals))

    return occurrence_pct, occurrence_std, seasonality_avg


def compute_recurrence_metrics(yearly_records, start_yr, end_yr):
    """
    Returns (recurrence_pct, seasonal_years, permanent_years, water_permanence_pct,
             area_ever_flooded_pct, years_with_valid_data).
    """
    recs = [r for r in yearly_records
            if r.get("year") is not None and start_yr <= int(r["year"]) <= end_yr]
    if not recs:
        return None, 0, 0, None, None, 0

    years_with_water  = [r for r in recs if (r.get("mode") or 0) >= 2]
    years_with_valid  = [r for r in recs if (r.get("mode") or 0) >= 1]
    seasonal_years    = sum(1 for r in recs if (r.get("mode") or 0) == 2)
    permanent_years   = sum(1 for r in recs if (r.get("mode") or 0) == 3)

    recurrence_pct      = safe_div(len(years_with_water), len(years_with_valid))
    water_permanence    = safe_div(permanent_years, seasonal_years + permanent_years) if (seasonal_years + permanent_years) > 0 else None

    # area_ever_flooded: max water pixel fraction across years in window
    max_water_frac = 0.0
    for r in recs:
        tp = r.get("total_pixels") or 0
        wp = (r.get("perm_pixels") or 0) + (r.get("seas_pixels") or 0)
        if tp > 0:
            max_water_frac = max(max_water_frac, wp / tp * 100)

    area_ever_flooded   = rnd(max_water_frac) if max_water_frac > 0 else 0.0
    years_with_valid_data = len(years_with_valid)

    return recurrence_pct, seasonal_years, permanent_years, water_permanence, area_ever_flooded, years_with_valid_data


def compute_within_window_change(monthly_records, start_yr, end_yr):
    """
    Splits window into two halves; computes occurrence change second_half - first_half.
    Returns (first_occ, second_occ, change_pp, trend_direction, trend_magnitude).
    For w2: returns all None (window too short to split).
    """
    if end_yr - start_yr < 3:
        return None, None, None, None, None

    mid           = (start_yr + end_yr) // 2
    first_occ, _, _ = compute_occurrence_metrics(monthly_records, start_yr, mid)
    second_occ, _, _ = compute_occurrence_metrics(monthly_records, mid + 1, end_yr)

    if first_occ is None or second_occ is None:
        return None, None, None, None, None

    change = rnd(second_occ - first_occ)
    if abs(change) < 3:
        direction = "stable"
        magnitude = "negligible"
    elif abs(change) < 10:
        direction = "increasing" if change > 0 else "declining"
        magnitude = "moderate"
    else:
        direction = "increasing" if change > 0 else "declining"
        magnitude = "strong"

    return first_occ, second_occ, change, direction, magnitude


def compute_risk_acceleration(monthly_records, end_yr=2021):
    """Compare latest 5yr vs prior 5yr to detect accelerating/decelerating risk."""
    recent_occ, _, _ = compute_occurrence_metrics(monthly_records, end_yr - 4, end_yr)
    prior_occ, _, _  = compute_occurrence_metrics(monthly_records, end_yr - 9, end_yr - 5)
    if recent_occ is None or prior_occ is None:
        return "insufficient_data", None
    diff = recent_occ - prior_occ
    if diff > 3:
        label = "accelerating"
    elif diff < -3:
        label = "decelerating"
    else:
        label = "stable"
    detail = (
        f"Latest 5yr ({end_yr-4}-{end_yr}): {recent_occ:.1f}% vs "
        f"Prior 5yr ({end_yr-9}-{end_yr-5}): {prior_occ:.1f}% — "
        f"diff {diff:+.1f}pp"
    )
    return label, detail


def compute_flood_free(yearly_records, start_yr, end_yr):
    """
    Returns (flood_free_years, last_flood_free_year, consecutive_flood_max, consecutive_dry_max).
    """
    recs = sorted(
        [r for r in yearly_records
         if r.get("year") is not None and start_yr <= int(r["year"]) <= end_yr],
        key=lambda x: int(x["year"])
    )
    dry_years    = [int(r["year"]) for r in recs if (r.get("mode") or 0) == 1]
    last_dry     = max(dry_years) if dry_years else None

    max_flood = max_dry = cur_flood = cur_dry = 0
    for r in recs:
        m = r.get("mode") or 0
        if m >= 2:
            cur_flood += 1
            cur_dry    = 0
            max_flood  = max(max_flood, cur_flood)
        elif m == 1:
            cur_dry   += 1
            cur_flood  = 0
            max_dry    = max(max_dry, cur_dry)
        # m == 0 (no data): don't reset streaks

    return len(dry_years), last_dry, max_flood, max_dry


def detect_cloud_bias(monthly_pattern):
    """
    Returns (flag, detail_str).
    Cloud bias = monsoon avg (Jun-Sep) < dry season avg (Oct-May) AND overall > 20%.
    """
    monsoon_recs = [m["recurrence_pct"] for m in monthly_pattern
                    if m["month"] in (6, 7, 8, 9) and m.get("recurrence_pct") is not None]
    dry_recs     = [m["recurrence_pct"] for m in monthly_pattern
                    if m["month"] in (10, 11, 12, 1, 2, 3, 4, 5)
                    and m.get("recurrence_pct") is not None]

    if not monsoon_recs or not dry_recs:
        return False, None

    mon_avg = sum(monsoon_recs) / len(monsoon_recs)
    dry_avg = sum(dry_recs)     / len(dry_recs)
    all_recs = monsoon_recs + dry_recs
    overall  = sum(all_recs)    / len(all_recs)

    if mon_avg < dry_avg and overall > 20:
        return True, (
            f"Monsoon avg recurrence ({mon_avg:.1f}%) < dry season avg ({dry_avg:.1f}%). "
            "Landsat cannot observe through monsoon clouds — Jun-Sep flood exposure is "
            "systematically understated. Use dry-season values as the reliable baseline."
        )
    return False, None


def compute_monthly_pattern(monthly_records, start_yr, end_yr, full_monthly_pattern=None):
    """
    Per-calendar-month recurrence and cloud flags for this window.
    Returns list of 12 month dicts + deviation_from_baseline list.
    """
    recs = [r for r in monthly_records
            if r.get("year") is not None and start_yr <= int(r["year"]) <= end_yr]

    year_count = end_yr - start_yr + 1
    pattern = []

    for mo in range(1, 13):
        mo_recs = [r for r in recs if int(r.get("month", 0)) == mo]
        years_with_water = sum(1 for r in mo_recs if (r.get("water_sum") or 0) > 0)
        years_with_obs   = sum(1 for r in mo_recs if (r.get("valid_sum") or 0) > 0)
        recurrence = rnd(years_with_water / years_with_obs * 100) if years_with_obs > 0 else None
        pattern.append({
            "month":          mo,
            "name":           MONTH_LABELS[mo - 1],
            "recurrence_pct": recurrence,
            "observation_completeness_pct": rnd(years_with_obs / year_count * 100),
            "cloud_flag":     False,  # set below after cloud bias detection
        })

    # Cloud bias flag
    cloud_flag, cloud_detail = detect_cloud_bias(pattern)
    if cloud_flag:
        for m in pattern:
            if m["month"] in (6, 7, 8, 9):
                m["cloud_flag"] = True

    # Deviation from full-window baseline (if this is a sub-window)
    deviations = []
    if full_monthly_pattern is not None:
        baseline = {m["month"]: m["recurrence_pct"] for m in full_monthly_pattern}
        for m in pattern:
            base = baseline.get(m["month"])
            if m["recurrence_pct"] is not None and base is not None:
                dev = rnd(m["recurrence_pct"] - base)
            else:
                dev = None
            deviations.append({"month": m["month"], "deviation_pp": dev})
    else:
        deviations = [{"month": m["month"], "deviation_pp": 0.0} for m in pattern]

    return pattern, deviations, cloud_flag, cloud_detail


def compute_season_aggregates(monthly_pattern, cloud_flag):
    """Returns season_aggregates and pmfby_windows dicts."""
    def avg_rec(months):
        vals = [m["recurrence_pct"] for m in monthly_pattern
                if m["month"] in months and m["recurrence_pct"] is not None]
        return rnd(sum(vals) / len(vals)) if vals else None

    def cloud_imp(months):
        return cloud_flag and any(m["month"] in months for m in monthly_pattern if m.get("cloud_flag"))

    season_agg = {
        "monsoon_jun_sep": {
            "months": [6, 7, 8, 9],
            "avg_recurrence_pct": avg_rec([6, 7, 8, 9]),
            "cloud_impacted": cloud_imp([6, 7, 8, 9]),
            "label": "Southwest Monsoon",
        },
        "kharif_jun_oct": {
            "months": [6, 7, 8, 9, 10],
            "avg_recurrence_pct": avg_rec([6, 7, 8, 9, 10]),
            "cloud_impacted": cloud_imp([6, 7, 8, 9, 10]),
            "label": "Kharif Crop Season",
        },
        "rabi_nov_mar": {
            "months": [11, 12, 1, 2, 3],
            "avg_recurrence_pct": avg_rec([11, 12, 1, 2, 3]),
            "cloud_impacted": cloud_imp([11, 12, 1, 2, 3]),
            "label": "Rabi Crop Season",
        },
        "dry_oct_may": {
            "months": [10, 11, 12, 1, 2, 3, 4, 5],
            "avg_recurrence_pct": avg_rec([10, 11, 12, 1, 2, 3, 4, 5]),
            "cloud_impacted": cloud_imp([10, 11, 12, 1, 2, 3, 4, 5]),
            "label": "Non-Monsoon Season",
        },
    }

    pmfby = {
        "kharif_sowing_jun_jul":  {
            "avg_recurrence_pct": avg_rec([6, 7]),
            "cloud_impacted": cloud_imp([6, 7]),
            "note": "Kharif sowing — cloud bias likely understates flood exposure",
        },
        "kharif_growing_aug_sep": {
            "avg_recurrence_pct": avg_rec([8, 9]),
            "cloud_impacted": cloud_imp([8, 9]),
            "note": "Kharif growing season",
        },
        "kharif_harvest_oct_nov": {
            "avg_recurrence_pct": avg_rec([10, 11]),
            "cloud_impacted": cloud_imp([10, 11]),
            "note": "Kharif harvest",
        },
        "rabi_sowing_oct_nov": {
            "avg_recurrence_pct": avg_rec([10, 11]),
            "cloud_impacted": cloud_imp([10, 11]),
            "note": "Rabi sowing season",
        },
        "rabi_harvest_mar_apr": {
            "avg_recurrence_pct": avg_rec([3, 4]),
            "cloud_impacted": cloud_imp([3, 4]),
            "note": "Rabi harvest",
        },
    }

    return season_agg, pmfby


def compute_confidence_score(years_with_valid, year_count, mean_obs_per_month, cloud_flag, buffer_m, reliability):
    """0.0-1.0 composite confidence score."""
    obs_completeness = min((years_with_valid / max(year_count, 1)), 1.0)
    scene_density    = min(mean_obs_per_month / 25.0, 1.0)  # 25 = theoretical Landsat max/month
    cloud_factor     = 0.6 if cloud_flag else 1.0
    buffer_factor    = 1.0 if buffer_m >= 500 else 0.7

    score = (0.4 * obs_completeness) + (0.3 * scene_density) + (0.2 * cloud_factor) + (0.1 * buffer_factor)
    if reliability == "indicative":
        score *= 0.65
    elif reliability == "moderate":
        score *= 0.88

    return round(score, 2)


def build_period(wkey, monthly_records, yearly_records, full_monthly_pattern, buffer_m, risk_accel_tuple):
    """Build the complete metrics dict for one time window."""
    wdef = WINDOW_DEFS[wkey]
    start_yr, end_yr = wdef["start"], wdef["end"]
    year_count = end_yr - start_yr + 1

    # ── Core occurrence ───────────────────────────────────────────────────────
    occurrence_pct, occurrence_std, seasonality_avg = compute_occurrence_metrics(
        monthly_records, start_yr, end_yr
    )
    recurrence_pct, seasonal_yrs, permanent_yrs, water_permanence, area_ever_flooded, years_valid = \
        compute_recurrence_metrics(yearly_records, start_yr, end_yr)

    # ── Change / trend ────────────────────────────────────────────────────────
    first_occ, second_occ, change_pp, trend_dir, trend_mag = \
        compute_within_window_change(monthly_records, start_yr, end_yr)

    # ── Flood-free profile ────────────────────────────────────────────────────
    flood_free_yrs, last_dry_yr, max_flood_streak, max_dry_streak = \
        compute_flood_free(yearly_records, start_yr, end_yr)

    # ── Monthly pattern ───────────────────────────────────────────────────────
    is_full = (wkey == "full")
    monthly_pattern, deviations, cloud_flag, cloud_detail = compute_monthly_pattern(
        monthly_records, start_yr, end_yr,
        full_monthly_pattern=None if is_full else full_monthly_pattern,
    )
    season_agg, pmfby = compute_season_aggregates(monthly_pattern, cloud_flag)

    # ── Mean monthly observation completeness (% of years with ≥1 valid scene) ─
    mo_recs = [r for r in monthly_records
               if r.get("year") is not None and start_yr <= int(r["year"]) <= end_yr]
    mo_years_with_obs = []
    for mo in range(1, 13):
        mo_recs_m = [r for r in mo_recs if int(r.get("month", 0)) == mo]
        mo_years_with_obs.append(sum(1 for r in mo_recs_m if (r.get("valid_sum") or 0) > 0))
    mean_obs_completeness = rnd(safe_mean(mo_years_with_obs) / year_count * 100) if year_count else None

    # ── Confidence ────────────────────────────────────────────────────────────
    confidence = compute_confidence_score(
        years_valid, year_count,
        (mean_obs_completeness or 0) / 100 * 25,  # scale to scenes/month
        cloud_flag, buffer_m, wdef["reliability"]
    )

    # ── Risk acceleration (only meaningful on full window, ref in others) ─────
    risk_accel, risk_accel_detail = risk_accel_tuple

    # ── Flood free months (calendar months with recurrence < 5%) ─────────────
    flood_free_months = sum(1 for m in monthly_pattern
                            if m.get("recurrence_pct") is not None and m["recurrence_pct"] < 5)

    return {
        "label":            wdef["label"],
        "years":            f"{start_yr}–{end_yr}",
        "year_count":       year_count,
        "reliability":      wdef["reliability"],
        "reliability_note": wdef["reliability_note"],

        # ── Core occurrence ───────────────────────────────────────────────────
        "occurrence_pct":             occurrence_pct,        # water obs / valid obs × 100 (water-masked)
        "occurrence_stddev_pct":      occurrence_std,        # D-fix: inter-annual std dev
        "recurrence_pct":             recurrence_pct,        # % years with water
        "seasonality_months_per_yr":  seasonality_avg,       # avg months/yr with water (computed)
        "area_ever_flooded_pct":      area_ever_flooded,     # % buffer ever water in this window

        # ── Water class breakdown ─────────────────────────────────────────────
        "seasonal_years":       seasonal_yrs,
        "permanent_years":      permanent_yrs,
        "water_permanence_pct": water_permanence,    # permanent / (seasonal + permanent)

        # ── Change detection ──────────────────────────────────────────────────
        # For full window: these match JRC's epoch1/epoch2 split closely
        # For sub-windows: first-half vs second-half of that window
        "first_half_occurrence_pct":   first_occ,
        "second_half_occurrence_pct":  second_occ,
        "change_pp":                   change_pp,    # second_half - first_half (pp = percentage points)
        "trend_direction":             trend_dir,    # "increasing" | "stable" | "declining" | null
        "trend_magnitude":             trend_mag,    # "negligible" | "moderate" | "strong" | null
        "trend_confidence":            ("high" if year_count >= 20
                                        else "moderate" if year_count >= 10
                                        else "low") if trend_dir else None,

        # ── Risk acceleration (latest 5yr vs prior 5yr) ───────────────────────
        "risk_acceleration":        risk_accel,
        "risk_acceleration_detail": risk_accel_detail,

        # ── Flood-free profile ────────────────────────────────────────────────
        "flood_free_years":            flood_free_yrs,
        "last_flood_free_year":        last_dry_yr,
        "flood_free_months_count":     flood_free_months,  # calendar months with <5% recurrence
        "consecutive_flood_years_max": max_flood_streak,
        "consecutive_dry_years_max":   max_dry_streak,

        # ── Observation quality ───────────────────────────────────────────────
        "years_with_valid_data":          years_valid,
        "mean_monthly_observation_completeness_pct": mean_obs_completeness,

        # ── Cloud bias ────────────────────────────────────────────────────────
        "cloud_bias_flag":   cloud_flag,
        "cloud_bias_detail": cloud_detail,

        # ── Confidence ────────────────────────────────────────────────────────
        "confidence_score": confidence,

        # ── Monthly breakdown ─────────────────────────────────────────────────
        "monthly_pattern":                 monthly_pattern,
        "monthly_deviation_from_baseline": deviations,
        "season_aggregates":               season_agg,
        "pmfby_windows":                   pmfby,
    }

# ── C-fix: Water regime transitions from YearlyHistory ───────────────────────

def compute_transitions(yearly_records):
    """
    Derives year-to-year water regime transition events from YearlyHistory
    by comparing consecutive year pairs (no YearlyTransitionMask needed).
    """
    records = sorted(
        [r for r in yearly_records if r.get("year") is not None],
        key=lambda x: int(x["year"])
    )

    events = []
    land_to_water = 0
    water_to_land = 0

    for i in range(len(records) - 1):
        r1, r2 = records[i], records[i + 1]
        yr1 = int(r1["year"])
        yr2 = int(r2["year"])

        if yr2 != yr1 + 1:
            continue  # non-consecutive years (shouldn't happen but guard anyway)

        c1 = r1.get("mode") or 0
        c2 = r2.get("mode") or 0

        if c1 == 0 or c2 == 0:
            continue  # skip no-data years

        if c1 == 1 and c2 >= 2:
            land_to_water += 1
            events.append({
                "year_from": yr1, "year_to": yr2,
                "event": "land_to_water",
                "from_class": WATER_CLASS_LABEL.get(c1, "unknown"),
                "to_class":   WATER_CLASS_LABEL.get(c2, "unknown"),
            })
        elif c1 >= 2 and c2 == 1:
            water_to_land += 1
            events.append({
                "year_from": yr1, "year_to": yr2,
                "event": "water_to_land",
                "from_class": WATER_CLASS_LABEL.get(c1, "unknown"),
                "to_class":   WATER_CLASS_LABEL.get(c2, "unknown"),
            })

    total_yrs = (int(records[-1]["year"]) - int(records[0]["year"])) if records else 37
    freq_per_decade = rnd((land_to_water + water_to_land) / max(total_yrs, 1) * 10)

    if freq_per_decade is not None:
        stability = "stable" if freq_per_decade < 1 else ("moderate" if freq_per_decade < 3 else "volatile")
    else:
        stability = None

    net_dir = ("gaining_water" if land_to_water > water_to_land
               else "losing_water" if water_to_land > land_to_water
               else "stable")

    l2w = [e for e in events if e["event"] == "land_to_water"]
    w2l = [e for e in events if e["event"] == "water_to_land"]

    return {
        "land_to_water_events":         land_to_water,
        "water_to_land_events":         water_to_land,
        "net_direction":                net_dir,
        "last_land_to_water_year":      l2w[-1]["year_to"] if l2w else None,
        "last_water_to_land_year":      w2l[-1]["year_to"] if w2l else None,
        "transition_frequency_per_decade": freq_per_decade,
        "water_regime_stability":       stability,
        "event_log":                    events,
    }

# ── E-fix: Spatial distribution within buffer ─────────────────────────────────

def compute_spatial_distribution(main_vals):
    total = main_vals.get("total_buffer_pixels") or 1
    perm  = main_vals.get("perm_water_pixels")   or 0
    flood = main_vals.get("flood_zone_pixels")   or 0
    never = main_vals.get("never_water_pixels")  or 0

    perm_pct  = rnd(perm  / total * 100)
    flood_pct = rnd(flood / total * 100)
    never_pct = rnd(never / total * 100)
    # area_any_water = ALL pixels where max_extent=1 (ever water in 38yr record).
    # = total - never_water. NOT just perm+flood, which misses low-prob water
    # pixels (max_extent=1 but occurrence <10%).
    ever_pct  = rnd((total - never) / total * 100) if total else 0

    if ever_pct and ever_pct >= 80:
        position = "in_water_body"
    elif perm_pct and perm_pct >= 30:
        position = "on_water_body_edge"
    elif ever_pct and ever_pct >= 20:
        position = "flood_prone"
    elif ever_pct and ever_pct >= 5:
        position = "near_water"
    else:
        position = "dry_land"

    return {
        "area_permanently_water_pct":  perm_pct,    # occurrence >90%
        "area_flood_prone_pct":        flood_pct,   # occurrence 10-90%
        "area_never_water_pct":        never_pct,   # max_extent = 0
        "area_any_water_pct":          ever_pct,    # ever water in 38yr record
        "location_position":           position,
        "note": (
            "area_permanently_water_pct: >90% occurrence; "
            "area_flood_prone_pct: 10-90% occurrence; "
            "area_never_water_pct: never observed as water 1984-2021"
        ),
    }

# ── G-fix: Flood season timing ────────────────────────────────────────────────

def compute_flood_season_timing(monthly_records):
    """Derives flood onset, peak, retreat from full 38yr MonthlyHistory."""
    FLOOD_THRESHOLD = 20.0  # % recurrence = flood month

    all_recs = monthly_records  # use all years for timing (full record)
    total_years = max((int(r["year"]) for r in all_recs if r.get("year")), default=2021) - \
                  min((int(r["year"]) for r in all_recs if r.get("year")), default=1984) + 1

    monthly_rec = {}
    for mo in range(1, 13):
        mo_recs = [r for r in all_recs if int(r.get("month", 0)) == mo]
        years_with_water = sum(1 for r in mo_recs if (r.get("water_sum") or 0) > 0)
        years_with_obs   = sum(1 for r in mo_recs if (r.get("valid_sum") or 0) > 0)
        monthly_rec[mo] = (years_with_water / years_with_obs * 100) if years_with_obs > 0 else 0

    peak_month = max(monthly_rec, key=monthly_rec.get) if monthly_rec else None
    flood_months = [m for m, r in monthly_rec.items() if r >= FLOOD_THRESHOLD]

    if not flood_months:
        return {
            "peak_flood_month":             None,
            "peak_flood_month_name":        None,
            "peak_flood_recurrence_pct":    None,
            "flood_onset_month":            None,
            "flood_onset_month_name":       None,
            "flood_retreat_month":          None,
            "flood_retreat_month_name":     None,
            "flood_season_duration_months": 0,
            "flood_free_months_count":      12,
            "longest_flood_free_window_months": 12,
            "crop_cycle_viable":            True,
            "crop_cycle_note":              "No significant flood season detected (< 20% recurrence in any month).",
        }

    onset_month   = min(flood_months)
    retreat_month = max(flood_months)
    duration      = len(flood_months)
    free_count    = 12 - duration

    # Longest consecutive flood-free window (circular, handles Dec→Jan wrap)
    is_flood = [monthly_rec.get(m, 0) >= FLOOD_THRESHOLD for m in range(1, 13)] * 2
    max_free = cur_free = 0
    for f in is_flood:
        if not f:
            cur_free += 1
            max_free  = max(max_free, cur_free)
        else:
            cur_free = 0
    longest_free = min(max_free, 12)
    crop_viable  = longest_free >= 4

    note = (
        f"Longest flood-free window: {longest_free} consecutive months. "
        + ("Sufficient for rabi / short-duration kharif crop cycle." if crop_viable
           else "Too short for most crop cycles — high PMFBY risk.")
    )

    return {
        "peak_flood_month":             peak_month,
        "peak_flood_month_name":        MONTH_LABELS[peak_month - 1] if peak_month else None,
        "peak_flood_recurrence_pct":    rnd(monthly_rec.get(peak_month)),
        "flood_onset_month":            onset_month,
        "flood_onset_month_name":       MONTH_LABELS[onset_month - 1],
        "flood_retreat_month":          retreat_month,
        "flood_retreat_month_name":     MONTH_LABELS[retreat_month - 1],
        "flood_season_duration_months": duration,
        "flood_free_months_count":      free_count,
        "longest_flood_free_window_months": longest_free,
        "crop_cycle_viable":            crop_viable,
        "crop_cycle_note":              note,
    }

# ── I-fix: Extreme events ─────────────────────────────────────────────────────

def compute_extreme_events(yearly_records, monthly_records):
    """Identify worst flood years and compute approximate return period."""
    by_year = {}
    for r in monthly_records:
        yr = r.get("year")
        if yr is None:
            continue
        yr = int(yr)
        if yr not in by_year:
            by_year[yr] = {"water": 0, "valid": 0}
        by_year[yr]["water"] += r.get("water_sum") or 0
        by_year[yr]["valid"] += r.get("valid_sum") or 0

    yearly_occ = {
        yr: vals["water"] / vals["valid"] * 100
        for yr, vals in by_year.items()
        if vals["valid"] > 0
    }

    if not yearly_occ:
        return {
            "worst_flood_year": None,
            "worst_flood_occurrence_pct": None,
            "severe_flood_years": [],
            "severe_flood_threshold_pct": None,
            "severe_flood_frequency": None,
            "severe_flood_return_period_yr": None,
        }

    worst_yr  = max(yearly_occ, key=yearly_occ.get)
    worst_occ = yearly_occ[worst_yr]

    sorted_occs = sorted(yearly_occ.values())
    p90_idx  = int(len(sorted_occs) * 0.9)
    p90      = sorted_occs[p90_idx] if sorted_occs else 0
    severe   = sorted([yr for yr, occ in yearly_occ.items() if occ >= p90])

    total_yrs = len(yearly_occ)
    severe_count = len(severe)
    return_period = rnd(total_yrs / severe_count, 1) if severe_count else None
    freq_label = (f"once_per_{int(return_period or 0)}yr"
                  if return_period and return_period >= 1 else "annual")

    return {
        "worst_flood_year":             worst_yr,
        "worst_flood_occurrence_pct":   rnd(worst_occ),
        "severe_flood_years":           severe,
        "severe_flood_threshold_pct":   rnd(p90),
        "severe_flood_frequency":       freq_label,
        "severe_flood_return_period_yr": return_period,
    }

# ── J-fix: New flood zone flag ────────────────────────────────────────────────

def compute_new_flood_zone_flag(transition_class, yearly_records):
    """
    True if the location has gained water post-2000 where it previously had none.
    Uses both the JRC transition class (epoch-level) and YearlyHistory (year-level).
    """
    new_from_transition = transition_class in (3, 5, 8)

    pre2000_water  = any(int(r.get("year", 0)) < 2000 and (r.get("mode") or 0) >= 2
                         for r in yearly_records)
    post2000_water = any(int(r.get("year", 0)) >= 2000 and (r.get("mode") or 0) >= 2
                         for r in yearly_records)
    new_from_history = post2000_water and not pre2000_water

    flag = new_from_transition or new_from_history

    if flag:
        if new_from_transition:
            label, _ = TRANSITION_META.get(transition_class, ("Unknown change", "increasing"))
            note = (
                f"JRC transition class {transition_class} ({label}): water presence "
                f"increased between epoch1 (1984-1999) and epoch2 (2000-2021). "
                "Properties built before this transition were not in a flood zone at time of construction."
            )
        else:
            note = (
                "No water detected pre-2000 but water observed post-2000 per YearlyHistory. "
                "Location may be a newly inundated area."
            )
    else:
        note = None

    return flag, note

# ── K: Underwriting summary with composite score ──────────────────────────────

def compute_underwriting_summary(periods, transitions, seasonal_timing, new_flood_zone, spatial_dist, cloud_flag):
    """
    Composite flood risk score 0-100 for underwriting. Higher = more risky.
    Breakdown into 7 components, each with max points and basis string.
    """
    full = periods.get("full", {})

    occ  = full.get("occurrence_pct")  or 0
    rec  = full.get("recurrence_pct")  or 0
    accel = full.get("risk_acceleration", "stable") or "stable"
    freq  = transitions.get("transition_frequency_per_decade") or 0
    perm_pct = spatial_dist.get("area_permanently_water_pct") or 0
    longest_free = (seasonal_timing or {}).get("longest_flood_free_window_months", 12)

    # Component scores
    s_occ    = round(min(occ / 100 * 35, 35), 1)
    s_rec    = round(min(rec / 100 * 20, 20), 1)
    s_trend  = {"accelerating": 15, "stable": 8, "decelerating": 3, "insufficient_data": 8}.get(accel, 8)
    s_vol    = round(min(freq / 5 * 10, 10), 1)
    s_new    = 10 if new_flood_zone else 0
    s_ext    = round(min(perm_pct / 100 * 5, 5), 1)
    s_free   = round(max(0, 5 - longest_free / 12 * 5), 1)

    total = round(s_occ + s_rec + s_trend + s_vol + s_new + s_ext + s_free, 1)

    risk_class = ("very_high"  if total >= 75 or occ >= 90
                  else "high"       if total >= 55
                  else "moderate"   if total >= 35
                  else "low"        if total >= 15
                  else "negligible")

    # Primary concern
    if occ >= 80:
        primary = "permanent_or_semi-permanent_water_body"
    elif rec >= 80 and occ >= 40:
        primary = "high_recurrence_flood_zone"
    elif new_flood_zone:
        primary = "newly_inundated_area"
    elif accel == "accelerating":
        primary = "increasing_flood_trend"
    elif freq >= 3:
        primary = "volatile_water_regime"
    else:
        primary = "low_to_moderate_flood_exposure"

    # Flags
    flags = []
    if cloud_flag:
        flags.append("cloud_bias_monsoon_months")
    if occ >= 90:
        flags.append("location_in_permanent_water_zone")
    if full.get("flood_free_years") == 0:
        flags.append("no_flood_free_years_in_38yr_record")
    if new_flood_zone:
        flags.append("new_flood_zone_post_2000")
    if full.get("consecutive_flood_years_max") == 38:
        flags.append("continuously_flooded_all_38_years")
    if accel == "accelerating":
        flags.append("flood_risk_accelerating")
    if transitions.get("water_regime_stability") == "volatile":
        flags.append("volatile_water_regime")

    # Pricing implication
    if risk_class == "very_high":
        pricing = "Standard flood cover not viable at market rates. Site verification required. Consider exclusion or specialist high-risk pricing."
    elif risk_class == "high":
        pricing = "Elevated flood loading required. Recommend site inspection. Consider flood sub-limit or extended waiting period."
    elif risk_class == "moderate":
        pricing = "Moderate flood loading. Standard policy with flood endorsement appropriate. Review JRC GloFAS return-period depth data."
    elif risk_class == "low":
        pricing = "Low flood risk. Standard policy applicable. Monitor for trend changes."
    else:
        pricing = "Negligible flood risk per 38yr satellite record. Standard policy."

    # Data limitations
    limits = [
        "30m resolution may miss narrow channels or sub-pixel water features.",
        "Historical record 1984-2021 — does not project future climate change impacts.",
    ]
    if cloud_flag:
        limits.insert(0, "Cloud bias in monsoon months (Jun-Sep) — actual flood exposure may be higher than measured.")

    return {
        "composite_flood_risk_score": total,
        "flood_risk_class":           risk_class,
        "primary_concern":            primary,
        "key_flags":                  flags,
        "pricing_implication":        pricing,
        "score_components": {
            "occurrence_38yr":       {"score": s_occ,   "max": 35, "basis": f"Occurrence {occ:.1f}% over 38yr"},
            "recurrence_38yr":       {"score": s_rec,   "max": 20, "basis": f"Recurrence {rec:.1f}% of years"},
            "risk_trend":            {"score": s_trend, "max": 15, "basis": f"Acceleration: {accel}"},
            "transition_volatility": {"score": s_vol,   "max": 10, "basis": f"{freq:.1f} regime changes/decade"},
            "new_flood_zone":        {"score": s_new,   "max": 10, "basis": "New water zone post-2000" if new_flood_zone else "Not a new flood zone"},
            "spatial_extent":        {"score": s_ext,   "max": 5,  "basis": f"{perm_pct:.1f}% buffer permanently water"},
            "flood_free_window":     {"score": s_free,  "max": 5,  "basis": f"Longest dry window: {longest_free} months"},
        },
        "data_limitations": limits,
    }

# ── Cross-window consistency ───────────────────────────────────────────────────

def compute_cross_window(periods):
    occs = {k: v.get("occurrence_pct") for k, v in periods.items() if v.get("occurrence_pct") is not None}
    recs = {k: v.get("recurrence_pct") for k, v in periods.items() if v.get("recurrence_pct") is not None}

    occ_vals = list(occs.values())
    rec_vals = list(recs.values())

    occ_std = safe_stdev(occ_vals)
    rec_std = safe_stdev(rec_vals)

    consistency = ("high" if occ_std < 5 else "moderate" if occ_std < 15 else "low")

    # Recent regime change flag: w2 or w5 occurrence deviates from full by > 10pp
    recent_occ = periods.get("w5", {}).get("occurrence_pct") or periods.get("w2", {}).get("occurrence_pct")
    full_occ   = periods.get("full", {}).get("occurrence_pct")
    regime_change_flag   = (recent_occ is not None and full_occ is not None and abs(recent_occ - full_occ) > 10)
    regime_change_detail = (
        f"Recent 5yr occurrence ({recent_occ:.1f}%) deviates >10pp from 38yr baseline ({full_occ:.1f}%)"
        if regime_change_flag else None
    )

    return {
        "occurrence_stddev_pp": rnd(occ_std),
        "recurrence_stddev_pp": rnd(rec_std),
        "consistency":          consistency,
        "occurrence_by_window": {k: rnd(v) for k, v in occs.items()},
        "recurrence_by_window": {k: rnd(v) for k, v in recs.items()},
        "recent_regime_change_flag":   regime_change_flag,
        "recent_regime_change_detail": regime_change_detail,
    }

# ── Overall classification ────────────────────────────────────────────────────

def compute_overall_classification(yearly_records, transition_class, new_flood_zone, new_flood_zone_note):
    total_perm = sum(1 for r in yearly_records if (r.get("mode") or 0) == 3)
    total_seas = sum(1 for r in yearly_records if (r.get("mode") or 0) == 2)
    total_land = sum(1 for r in yearly_records if (r.get("mode") or 0) == 1)
    total_valid = total_perm + total_seas + total_land

    if total_valid == 0:
        water_type = "no_data"
    elif total_perm + total_seas == 0:
        water_type = "no_water"
    elif total_perm >= total_seas:
        water_type = "permanent_water" if total_perm / total_valid >= 0.6 else "mixed"
    else:
        water_type = "seasonal_water"

    all_water_years = sorted([int(r["year"]) for r in yearly_records if (r.get("mode") or 0) >= 2])
    all_dry_years   = sorted([int(r["year"]) for r in yearly_records if (r.get("mode") or 0) == 1])

    _, _, max_flood_streak, max_dry_streak = compute_flood_free(yearly_records, 1984, 2021)

    # B-fix: transition class label and risk direction
    tc_label, tc_risk = TRANSITION_META.get(transition_class, (None, None)) if transition_class else (None, None)

    return {
        "water_type":           water_type,
        "water_type_note":      f"{total_perm} permanent, {total_seas} seasonal, {total_land} land-class years out of {total_valid} valid years",

        "seasonal_years":        total_seas,
        "permanent_years":       total_perm,
        "land_years":            total_land,

        "first_water_year":      min(all_water_years) if all_water_years else None,
        "last_flood_free_year":  max(all_dry_years)   if all_dry_years   else None,
        "total_flood_free_years": len(all_dry_years),

        "consecutive_flood_years_max": max_flood_streak,
        "consecutive_dry_years_max":   max_dry_streak,

        # B-fix: expose transition class with label and risk direction
        "jrc_transition_class":          transition_class,
        "jrc_transition_class_label":    tc_label,
        "jrc_transition_risk_direction": tc_risk,

        # J-fix
        "new_flood_zone_flag":  new_flood_zone,
        "new_flood_zone_detail": new_flood_zone_note,
    }

# ── Yearly profile ────────────────────────────────────────────────────────────

def build_yearly_profile(yearly_records, monthly_records):
    by_year_mo = {}
    for r in monthly_records:
        yr = r.get("year")
        if yr is None:
            continue
        yr = int(yr)
        if yr not in by_year_mo:
            by_year_mo[yr] = {"wet_months": 0, "valid_months": 0}
        if (r.get("valid_sum") or 0) > 0:
            by_year_mo[yr]["valid_months"] += 1
        if (r.get("water_sum") or 0) > 0:
            by_year_mo[yr]["wet_months"] += 1

    profile = []
    for r in sorted(yearly_records, key=lambda x: int(x.get("year", 0))):
        yr  = int(r["year"])
        mode = r.get("mode") or 0
        mo_data = by_year_mo.get(yr, {})
        profile.append({
            "year":                 yr,
            "water_class":          mode,
            "water_class_label":    WATER_CLASS_LABEL.get(mode, "unknown"),
            "has_valid_data":       mode > 0,
            "seasonality_months":   mo_data.get("wet_months"),
            "months_with_obs":      mo_data.get("valid_months"),
        })
    return profile

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat",       type=float, required=True)
    parser.add_argument("--lng",       type=float, required=True)
    parser.add_argument("--buffer_m",  type=int,   default=500)
    parser.add_argument("--windows",   type=str,   default="w2,w5,w10,w20,full")
    parser.add_argument("--pincode",   type=str,   default=None)
    parser.add_argument("--district",  type=str,   default=None)
    parser.add_argument("--state",     type=str,   default=None)
    args = parser.parse_args()

    requested_windows = [w.strip() for w in args.windows.split(",") if w.strip() in WINDOW_DEFS]
    if not requested_windows:
        requested_windows = list(WINDOW_DEFS.keys())

    # Always need "full" for baselines and classification even if not requested
    need_full = "full" in requested_windows
    compute_windows = list(set(requested_windows) | {"full"})

    print("Initialising GEE...", file=sys.stderr)
    init_gee()

    print("Fetching GEE data (3 server calls)...", file=sys.stderr)
    t0 = time.time()
    raw = fetch_all_gee_data(args.lat, args.lng, args.buffer_m)
    gee_ms = int((time.time() - t0) * 1000)
    print(f"  GEE fetch complete in {gee_ms}ms", file=sys.stderr)

    main_vals       = raw["main_vals"]
    yearly_records  = raw["yearly_records"]
    monthly_records = raw["monthly_records"]

    # ── Resolve raw GEE values ────────────────────────────────────────────────
    transition_class = to_int(main_vals.get("transition"))

    # Filter change_abs sentinel values (-128 / 127 = JRC fill values)
    raw_change_abs  = rnd(main_vals.get("change_abs"))
    jrc_change_abs  = None if raw_change_abs in (-128, 127, -128.0, 127.0) else raw_change_abs
    jrc_change_norm = rnd(main_vals.get("change_norm"))

    # ── Build full-window monthly pattern (baseline for deviations) ───────────
    full_pattern, _, full_cloud_flag, _ = compute_monthly_pattern(
        monthly_records, 1984, 2021, full_monthly_pattern=None
    )

    # ── Risk acceleration (computed once; referenced in each period) ──────────
    risk_accel_tuple = compute_risk_acceleration(monthly_records, end_yr=2021)

    # ── Build per-period metrics ───────────────────────────────────────────────
    periods = {}
    for wkey in compute_windows:
        print(f"  Computing period: {wkey}...", file=sys.stderr)
        periods[wkey] = build_period(
            wkey, monthly_records, yearly_records,
            full_pattern, args.buffer_m, risk_accel_tuple
        )
        # Add JRC epoch-level change bands on the full window only
        if wkey == "full":
            periods[wkey]["jrc_epoch_change_abs"]  = jrc_change_abs
            periods[wkey]["jrc_epoch_change_norm"]  = jrc_change_norm
            periods[wkey]["jrc_epoch_change_note"]  = (
                "JRC change_abs / change_norm compare epoch1 (1984-1999) vs epoch2 (2000-2021). "
                "change_pp above is first-half vs second-half of the same window (different metric)."
            )

    # Bug 4 fix: full window area_ever_flooded_pct should use authoritative JRC max_extent value
    if "full" in periods and main_vals.get("area_ever_water_frac") is not None:
        periods["full"]["area_ever_flooded_pct"] = rnd((main_vals["area_ever_water_frac"] or 0) * 100)

    # Only return requested windows in response
    output_periods = {k: v for k, v in periods.items() if k in requested_windows}

    # ── Derived analyses ───────────────────────────────────────────────────────
    transitions       = compute_transitions(yearly_records)
    spatial_dist      = compute_spatial_distribution(main_vals)
    seasonal_timing   = compute_flood_season_timing(monthly_records)
    extreme_events    = compute_extreme_events(yearly_records, monthly_records)
    new_zone, new_note = compute_new_flood_zone_flag(transition_class, yearly_records)
    overall_class      = compute_overall_classification(
        yearly_records, transition_class, new_zone, new_note
    )
    yearly_profile     = build_yearly_profile(yearly_records, monthly_records)
    cross_window       = compute_cross_window(output_periods)
    uw_summary         = compute_underwriting_summary(
        periods, transitions, seasonal_timing, new_zone, spatial_dist,
        full_cloud_flag
    )

    # ── Assemble response ─────────────────────────────────────────────────────
    response = {
        "success": True,

        "request": {
            "mode":               "pincode" if args.pincode else "latlong",
            "lat":                args.lat,
            "lng":                args.lng,
            "buffer_m":           args.buffer_m,
            "windows_requested":  requested_windows,
        },

        "location": {
            "lat":      args.lat,
            "lng":      args.lng,
            "buffer_m": args.buffer_m,
            "pincode":  args.pincode,
            "district": args.district,
            "state":    args.state,
        },

        "data_source": {
            "collections": {
                "main_bands":      "JRC/GSW1_4/GlobalSurfaceWater",
                "yearly_history":  "JRC/GSW1_4/YearlyHistory",
                "monthly_history": "JRC/GSW1_4/MonthlyHistory",
            },
            "record_start":   "1984-03-16",
            "record_end":     "2021-12-31",
            "total_years":    38,
            "satellites":     "Landsat 5 TM (1984-2012) + Landsat 7 ETM+ (1999-2021) + Landsat 8 OLI (2013-2021)",
            "native_resolution_m": SCALE,
            "sampling_methodology": (
                "Buffer mean over water-masked pixels only (max_extent=1 mask applied). "
                "Land pixels excluded from occurrence computation — matches JRC methodology."
            ),
            # A-fix: document what seasonality_2021 actually is
            "seasonality_band_note": (
                "The JRC 'seasonality' band = count of months with water specifically in 2021 (the final year). "
                "It is NOT a multi-year average. See seasonality_2021_months in overall_classification."
            ),
        },

        # A-fix: expose raw seasonality_2021 separately at top level
        "seasonality_2021_months": rnd(main_vals.get("seasonality_2021"), 1),
        "jrc_occurrence_pct":      rnd(main_vals.get("occurrence")),       # direct JRC band value
        "jrc_recurrence_pct":      rnd(main_vals.get("recurrence")),       # direct JRC band value

        "overall_classification":  overall_class,
        "buffer_distribution":     spatial_dist,      # E-fix
        "distance_to_water_m":     raw["distance_to_water_m"],  # F-fix

        "periods":                 output_periods,
        "cross_window":            cross_window,
        "yearly_profile":          yearly_profile,
        "flood_season_timing":     seasonal_timing,    # G-fix
        "extreme_events":          extreme_events,     # I-fix
        "water_regime_transitions": transitions,       # C-fix

        "underwriting_summary":    uw_summary,         # K

        "meta": {
            "computed_at":          datetime.now(timezone.utc).isoformat(),
            "gee_collection":       "JRC/GSW1_4",
            "data_vintage":         "1984-03-16 to 2021-12-31",
            "buffer_m":             args.buffer_m,
            "gee_fetch_ms":         gee_ms,
            "window_boundaries": {
                k: {"start": v["start"], "end": v["end"], "rationale": v["reliability_note"]}
                for k, v in WINDOW_DEFS.items()
                if k in requested_windows
            },
            "null_semantics":       "null = pixel never observed as water (not missing data). Correct JRC behavior.",
            "change_abs_sentinels": "JRC change_abs sentinel values (-128, 127) are filtered and returned as null.",
            "cloud_bias_warning":   (
                "In high-cloud regions (NE India, Western Ghats, Brahmaputra basin), "
                "monsoon-month recurrence is systematically understated. "
                "cloud_bias_flag marks affected windows and months."
            ),
        },
    }

    print(json.dumps(response, default=str), file=sys.stdout)


if __name__ == "__main__":
    main()
