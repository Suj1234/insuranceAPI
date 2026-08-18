"""
Build pincode_gsw_cache table from the 4 extracted CSVs.
Pure Python — no GEE, no network. Reads CSVs, computes all metrics,
upserts one JSON row per pincode into Neon DB.

Runtime: ~60-90 seconds for 19,098 pincodes.
"""

import json
import os
import time
import numpy as np
import pandas as pd
import psycopg2

CSV_MAIN   = "data/flood/gee_outputs/gsw_main.csv"
CSV_YEARLY = "data/flood/gee_outputs/gsw_yearly.csv"
CSV_CALMON = "data/flood/gee_outputs/gsw_calmonth.csv"
CSV_ANNUAL = "data/flood/gee_outputs/gsw_annual.csv"

BATCH_SIZE = 500

WINDOWS = {
    "full": (1984, 2021),
    "w20":  (2002, 2021),
    "w10":  (2012, 2021),
    "w5":   (2017, 2021),
    "w2":   (2020, 2021),
}

TRANSITION_LABELS = {
    1: "no_change", 2: "permanent", 3: "new_permanent",
    4: "lost_permanent", 5: "seasonal_to_permanent", 6: "permanent_to_seasonal",
    7: "seasonal", 8: "new_seasonal", 9: "lost_seasonal",
    10: "ephemeral_permanent", 11: "ephemeral_seasonal",
}

DATA_SOURCE_META = {
    "name":         "JRC Global Surface Water v1.4",
    "satellite":    "Landsat 5/7/8",
    "resolution_m": 30,
    "coverage":     "1984-2021",
    "years":        38,
    "buffer_m":     500,
}


# ── Shared helpers ─────────────────────────────────────────────────────────────

def f(v, n=4):
    """Round float; return None for NaN/None."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return round(float(v), n)


def slope(x, y):
    """OLS slope — no scipy."""
    n = len(x)
    if n < 2:
        return 0.0
    xm = sum(x) / n
    ym = sum(y) / n
    num = sum((xi - xm) * (yi - ym) for xi, yi in zip(x, y))
    den = sum((xi - xm) ** 2 for xi in x)
    return num / den if den else 0.0


def _water_class(pp_frac, sp_frac):
    """Classify a year's water regime. Returns (int 0-3, str label)."""
    if pp_frac > 0.5:
        return 3, "permanent"
    if pp_frac + sp_frac > 0.2:
        return 2, "seasonal"
    if pp_frac + sp_frac > 0:
        return 1, "intermittent"
    return 0, "none"


def _max_consecutive(flags):
    """Max consecutive True in a bool list."""
    max_c = cur_c = 0
    for b in flags:
        if b:
            cur_c += 1
            max_c = max(max_c, cur_c)
        else:
            cur_c = 0
    return max_c


def _jrc_float(m_row, key):
    """Extract a JRC raw-band float; return None if missing/NaN."""
    v = m_row.get(key)
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return float(v)


# ── Sub-builders ───────────────────────────────────────────────────────────────

def _build_yearly_profile(an_df, yr_df):
    an_idx = an_df.set_index("year")
    yr_idx = yr_df.set_index("year")

    profile = []
    for y in range(1984, 2022):
        an_row = an_idx.loc[y] if y in an_idx.index else None
        yr_row = yr_idx.loc[y] if y in yr_idx.index else None

        has_valid = an_row is not None and bool(an_row["valid_sum"] > 0)
        occ_y = f(an_row["water_sum"] / an_row["valid_sum"] * 100, 3) if has_valid else 0.0

        tp_y   = int(yr_row["total_pixels"]) if yr_row is not None else 0
        pp_frac = float(yr_row["perm_pixels"]) / tp_y if tp_y else 0.0
        sp_frac = float(yr_row["seas_pixels"]) / tp_y if tp_y else 0.0
        wc, wc_label = _water_class(pp_frac, sp_frac)

        profile.append({
            "year":              y,
            "occurrence_pct":    occ_y,
            "perm_pct":          f(pp_frac * 100, 2),
            "seas_pct":          f(sp_frac * 100, 2),
            "months_with_obs":   int(an_row["month_count"]) if an_row is not None else 0,
            "water_class":       wc,
            "water_class_label": wc_label,
            "has_valid_data":    has_valid,
        })
    return profile


def _build_monthly(cm_df):
    # Ensure all 12 months present
    cm_full = (
        cm_df.set_index("month")
             .reindex(range(1, 13), fill_value=0)
             .reset_index()
    )
    monthly_occ  = []
    monthly_comp = []
    for _, r in cm_full.iterrows():
        vs = r["valid_sum"]
        ws = r["water_sum"]
        yc = r.get("year_count", 0)
        monthly_occ.append(f(ws / vs * 100, 3) if vs > 0 else 0.0)
        monthly_comp.append(f(yc / 38 * 100, 1) if yc > 0 else 0.0)

    valid_sums = cm_full["valid_sum"].values
    med = float(np.median(valid_sums)) if len(valid_sums) else 0
    cloud_bias = bool((valid_sums < med * 0.5).any()) if med > 0 else False

    return monthly_occ, monthly_comp, cloud_bias


def _season_occ(cm_df, months):
    w = cm_df[cm_df["month"].isin(months)]
    ws, vs = int(w["water_sum"].sum()), int(w["valid_sum"].sum())
    return f(ws / vs * 100, 3) if vs > 0 else 0.0


def _build_flood_season(monthly_occ, monthly_comp, cm_df, cloud_bias):
    peak_idx  = int(np.argmax(monthly_occ))
    peak_occ  = monthly_occ[peak_idx]
    peak_month = peak_idx + 1

    if peak_occ and peak_occ > 0:
        threshold = max(0.5, peak_occ * 0.1)
        above     = [i + 1 for i, v in enumerate(monthly_occ) if (v or 0) >= threshold]
        if above:
            onset    = min(above)
            retreat  = max(above)
            duration = len(above)
        else:
            onset = retreat = None
            duration = 0
    else:
        onset = retreat = None
        duration = 0

    return {
        "peak_flood_month":          peak_month,
        "onset_month":               onset,
        "retreat_month":             retreat,
        "duration_months":           duration,
        "monthly_occ_pct":           monthly_occ,
        "monthly_completeness_pct":  monthly_comp,
        "cloud_bias_flag":           cloud_bias,
        "season_aggregates": {
            "kharif": _season_occ(cm_df, [6, 7, 8, 9]),
            "rabi":   _season_occ(cm_df, [10, 11, 12, 1, 2]),
            "zaid":   _season_occ(cm_df, [3, 4, 5]),
        },
        "pmfby_windows": {
            "kharif": _season_occ(cm_df, [4, 5, 6, 7, 8, 9]),
            "rabi":   _season_occ(cm_df, [10, 11, 12, 1, 2, 3]),
        },
    }


def _build_window(name, sy, ey, an_df, yr_df):
    an = an_df[(an_df["year"] >= sy) & (an_df["year"] <= ey)].copy()
    yr = yr_df[(yr_df["year"] >= sy) & (yr_df["year"] <= ey)].copy()

    # Aggregate occurrence
    ws = int(an["water_sum"].sum())
    vs = int(an["valid_sum"].sum())
    occ_pct = f(ws / vs * 100, 4) if vs > 0 else 0.0

    # Annual occurrence series
    an["occ"] = an.apply(
        lambda r: r["water_sum"] / r["valid_sum"] * 100 if r["valid_sum"] > 0 else np.nan, axis=1
    )
    valid_an      = an.dropna(subset=["occ"])
    years_analyzed = len(valid_an)

    # Recurrence: fraction of years where water appeared
    years_with_water = int((valid_an["occ"] > 0).sum())
    recurrence_pct = f(years_with_water / years_analyzed * 100, 2) if years_analyzed > 0 else 0.0

    # Std dev
    occ_std = f(valid_an["occ"].std(), 4) if years_analyzed >= 2 else 0.0

    # Trend
    if years_analyzed >= 5:
        sl = slope(valid_an["year"].tolist(), valid_an["occ"].tolist())
        trend_dir = "increasing" if sl > 0.005 else ("decreasing" if sl < -0.005 else "stable")
        trend_mag = f(sl, 6)
    else:
        trend_dir, trend_mag = "stable", 0.0

    # Change pp: first vs second half of this window
    mid = (sy + ey) // 2
    fh_vals = an[an["year"] <= mid]["occ"].dropna()
    sh_vals = an[an["year"] > mid]["occ"].dropna()
    fh = fh_vals.mean() if len(fh_vals) > 0 else np.nan
    sh = sh_vals.mean() if len(sh_vals) > 0 else np.nan
    change_pp = f(sh - fh, 4) if not (np.isnan(fh) or np.isnan(sh)) else 0.0

    # Yearly classification counts
    yr_has_water = {}
    permanent_years = seasonal_years = intermittent_years = land_years = 0

    yr_valid = yr[yr["total_pixels"] > 0]
    for _, row in yr_valid.iterrows():
        tp  = int(row["total_pixels"])
        pp  = float(row["perm_pixels"]) / tp
        sp  = float(row["seas_pixels"]) / tp
        yr_int = int(row["year"])
        wc, _ = _water_class(pp, sp)
        yr_has_water[yr_int] = wc > 0
        if wc == 3:   permanent_years   += 1
        elif wc == 2: seasonal_years    += 1
        elif wc == 1: intermittent_years += 1
        else:         land_years        += 1

    for y in range(sy, ey + 1):
        if y not in yr_has_water:
            yr_has_water[y] = False
            land_years += 1

    consec_flags = [yr_has_water.get(y, False) for y in range(sy, ey + 1)]
    max_consec   = _max_consecutive(consec_flags)

    # Flood-free window: years since last flood to end of window
    last_flood = None
    for y in range(ey, sy - 1, -1):
        if yr_has_water.get(y, False):
            last_flood = y
            break
    flood_free = (ey - last_flood) if last_flood is not None else (ey - sy + 1)

    return {
        "window":                      f"{sy}-{ey}",
        "years_analyzed":              years_analyzed,
        "occurrence_pct":              occ_pct,
        "recurrence_pct":              recurrence_pct,
        "occurrence_stddev_pct":       occ_std,
        "trend_direction":             trend_dir,
        "trend_magnitude":             trend_mag,
        "change_pp":                   change_pp,
        "permanent_years":             permanent_years,
        "seasonal_years":              seasonal_years,
        "intermittent_years":          intermittent_years,
        "land_years":                  land_years,
        "consecutive_flood_years_max": max_consec,
        "flood_free_window_years":     flood_free,
    }


def _build_overall_cls(yearly_profile, m_row):
    valid_yrs = [r for r in yearly_profile if r["has_valid_data"]]
    if valid_yrs:
        counts = {0: 0, 1: 0, 2: 0, 3: 0}
        for r in valid_yrs:
            counts[r["water_class"]] += 1
        dom_cls   = max(counts, key=counts.get)
        labels    = {0: "none", 1: "intermittent", 2: "seasonal", 3: "permanent"}
        cls_label = labels[dom_cls]
        total     = len(valid_yrs)
        perm_frac = f(counts[3] / total, 4)
        water_frac = f((counts[3] + counts[2] + counts[1]) / total, 4)
    else:
        cls_label  = "none"
        perm_frac  = 0.0
        water_frac = 0.0

    tv = m_row.get("transition")
    ti = int(tv) if tv is not None and not (isinstance(tv, float) and np.isnan(tv)) else None

    return {
        "label":                cls_label,
        "perm_years_frac":      perm_frac,
        "water_years_frac":     water_frac,
        "jrc_transition":       ti,
        "jrc_transition_label": TRANSITION_LABELS.get(ti),
        "center_is_water":      bool(m_row.get("center_is_water") or False),
    }


def _build_transitions(yearly_profile):
    event_log = []
    prev = None
    for r in yearly_profile:
        if not r["has_valid_data"]:
            continue
        cls = r["water_class_label"]
        if prev is not None and cls != prev:
            event_log.append({"year": r["year"], "from": prev, "to": cls})
        prev = cls

    def decade_dominant(rows):
        if not rows:
            return "none"
        counts = {}
        for r in rows:
            lbl = r["water_class_label"]
            counts[lbl] = counts.get(lbl, 0) + 1
        return max(counts, key=counts.get)

    early  = [r for r in yearly_profile if 1984 <= r["year"] <= 1993 and r["has_valid_data"]]
    recent = [r for r in yearly_profile if 2012 <= r["year"] <= 2021 and r["has_valid_data"]]

    early_lbl  = decade_dominant(early)
    recent_lbl = decade_dominant(recent)
    label = f"stable_{early_lbl}" if early_lbl == recent_lbl else f"{early_lbl}_to_{recent_lbl}"

    return {
        "early_decade_label":  early_lbl,
        "recent_decade_label": recent_lbl,
        "transition_label":    label,
        "is_stable":           early_lbl == recent_lbl,
        "event_log":           event_log,
    }


def _build_extreme_events(an_df):
    an = an_df.copy()
    an["occ"] = an.apply(
        lambda r: r["water_sum"] / r["valid_sum"] * 100 if r["valid_sum"] > 0 else np.nan, axis=1
    )
    valid_an = an.dropna(subset=["occ"])

    if len(valid_an) < 3:
        return {
            "worst_flood_year":       None,
            "severe_flood_years":     [],
            "return_period_years":    None,
            "severity_threshold_pct": None,
        }

    threshold  = float(np.percentile(valid_an["occ"], 90))
    severe     = valid_an[valid_an["occ"] >= threshold]
    worst_yr   = int(valid_an.loc[valid_an["occ"].idxmax(), "year"])
    severe_yrs = sorted(int(y) for y in severe["year"].tolist())
    ret_period = f(len(valid_an) / len(severe_yrs), 1) if severe_yrs else None

    return {
        "worst_flood_year":       worst_yr,
        "severe_flood_years":     severe_yrs,
        "return_period_years":    ret_period,
        "severity_threshold_pct": f(threshold, 3),
    }


def _build_buffer_dist(m_row):
    tp = m_row.get("total_buffer_pixels") or 0
    if tp:
        perm_pct  = f(float(m_row.get("perm_water_pixels")  or 0) / tp * 100, 2)
        flood_pct = f(float(m_row.get("flood_zone_pixels")  or 0) / tp * 100, 2)
        never_pct = f(float(m_row.get("never_water_pixels") or 0) / tp * 100, 2)
    else:
        perm_pct = flood_pct = never_pct = 0.0

    if (perm_pct or 0) > 10:
        position = "permanent_water"
    elif (flood_pct or 0) > 10:
        position = "flood_zone"
    else:
        position = "land"

    return {
        "perm_water_pct":    perm_pct,
        "flood_zone_pct":    flood_pct,
        "never_water_pct":   never_pct,
        "location_position": position,
    }


def _build_cross_window(periods):
    w5_o  = periods["w5"]["occurrence_pct"]  or 0
    w20_o = periods["w20"]["occurrence_pct"] or 0
    full_o = periods["full"]["occurrence_pct"] or 0
    diff  = w5_o - w20_o  # recent deviation

    if diff > 1.0:   trend = "accelerating"
    elif diff < -1.0: trend = "decelerating"
    else:             trend = "stable"

    return {
        "occurrence_trend":       trend,
        "is_emerging_flood_zone": full_o < 2.0 and w5_o > 5.0,
        "is_improving":           full_o > 5.0 and w5_o < 2.0,
        "recent_deviation_pct":   f(diff, 4),
    }


def _build_underwriting(periods, buf_dist):
    full = periods["full"]
    w10  = periods["w10"]

    occ_score  = min(100.0, (full.get("occurrence_pct") or 0) / 30 * 100)
    rec_score  = min(100.0, (full.get("recurrence_pct") or 0))

    td  = full.get("trend_direction", "stable")
    tm  = abs(full.get("trend_magnitude") or 0)
    trend_score = min(100.0, tm / 0.5 * 100) if td == "increasing" else (0.0 if td == "decreasing" else 10.0)

    vol_score      = min(100.0, (full.get("occurrence_stddev_pct") or 0) / 10 * 100)
    change_pp      = w10.get("change_pp") or 0
    new_flood_score = min(100.0, max(0.0, change_pp / 5 * 100))
    spatial        = (buf_dist.get("perm_water_pct") or 0) + (buf_dist.get("flood_zone_pct") or 0)
    spatial_score  = min(100.0, spatial / 50 * 100)
    ffw            = full.get("flood_free_window_years") or 0
    ffw_score      = max(0.0, 100.0 - ffw * 10)

    components = {
        "occurrence":        round(occ_score, 1),
        "recurrence":        round(rec_score, 1),
        "trend":             round(trend_score, 1),
        "volatility":        round(vol_score, 1),
        "new_flood_zone":    round(new_flood_score, 1),
        "spatial_extent":    round(spatial_score, 1),
        "flood_free_window": round(ffw_score, 1),
    }
    weights = {
        "occurrence": 0.30, "recurrence": 0.20, "trend": 0.15,
        "volatility": 0.10, "new_flood_zone": 0.10,
        "spatial_extent": 0.10, "flood_free_window": 0.05,
    }
    composite = round(sum(components[k] * weights[k] for k in weights), 1)

    if composite < 20:    risk_band = "low"
    elif composite < 40:  risk_band = "moderate"
    elif composite < 60:  risk_band = "elevated"
    elif composite < 80:  risk_band = "high"
    else:                 risk_band = "critical"

    return {"composite_score": composite, "risk_band": risk_band, "components": components}


# ── Main compute ───────────────────────────────────────────────────────────────

def compute(pc_str, m_row, an, cm, yr):
    yearly_profile = _build_yearly_profile(an, yr)

    monthly_occ, monthly_comp, cloud_bias = _build_monthly(cm)

    periods = {
        name: _build_window(name, sy, ey, an, yr)
        for name, (sy, ey) in WINDOWS.items()
    }

    buf_dist    = _build_buffer_dist(m_row)
    overall_cls = _build_overall_cls(yearly_profile, m_row)
    transitions = _build_transitions(yearly_profile)
    flood_season = _build_flood_season(monthly_occ, monthly_comp, cm, cloud_bias)
    extreme_ev  = _build_extreme_events(an)
    cross_window = _build_cross_window(periods)
    underwriting = _build_underwriting(periods, buf_dist)

    first_occ_yr = next(
        (r["year"] for r in yearly_profile if (r["occurrence_pct"] or 0) > 0),
        None
    )

    return {
        "data_source":               DATA_SOURCE_META,
        "year_of_first_occurrence":  first_occ_yr,
        "jrc_occurrence_pct":        f(_jrc_float(m_row, "occurrence"), 2),
        "jrc_recurrence_pct":        f(_jrc_float(m_row, "recurrence"), 2),
        "seasonality_2021_months":   f(_jrc_float(m_row, "seasonality_2021"), 1),
        "change_abs_pct":            f(_jrc_float(m_row, "change_abs"), 2),
        "change_norm_pct":           f(_jrc_float(m_row, "change_norm"), 2),
        "overall_classification":    overall_cls,
        "buffer_distribution":       buf_dist,
        "distance_to_water_m":       f(m_row.get("distance_to_water_m"), 1),
        "area_ever_water_frac":      f(m_row.get("area_ever_water_frac"), 4),
        "periods":                   periods,
        "cross_window":              cross_window,
        "yearly_profile":            yearly_profile,
        "flood_season_timing":       flood_season,
        "extreme_events":            extreme_ev,
        "water_regime_transitions":  transitions,
        "underwriting_summary":      underwriting,
        "meta": {"data_version": "v1.4"},
    }


# ── DB upsert ──────────────────────────────────────────────────────────────────

UPSERT_SQL = """
INSERT INTO pincode_gsw_cache (pincode, data, computed_at)
VALUES (%s, %s, now())
ON CONFLICT (pincode) DO UPDATE
  SET data = EXCLUDED.data, computed_at = now()
"""


def main():
    t0 = time.time()
    print("Loading CSVs...")
    main_df   = pd.read_csv(CSV_MAIN)
    yearly_df = pd.read_csv(CSV_YEARLY)
    calmon_df = pd.read_csv(CSV_CALMON)
    annual_df = pd.read_csv(CSV_ANNUAL)
    print(f"  Loaded in {time.time()-t0:.1f}s")

    print("Indexing...")
    main_idx   = main_df.set_index("pincode")
    annual_grp = {str(pc): g for pc, g in annual_df.groupby("pincode")}
    calmon_grp = {str(pc): g for pc, g in calmon_df.groupby("pincode")}
    yearly_grp = {str(pc): g for pc, g in yearly_df.groupby("pincode")}

    pincodes = [str(p) for p in main_df["pincode"].tolist()]
    print(f"  {len(pincodes):,} pincodes to process")

    def make_conn():
        return psycopg2.connect(
            os.environ["DATABASE_URL"],
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5,
        )

    def flush(cur, conn, rows_buf):
        """Commit a batch; reconnect once on OperationalError."""
        try:
            cur.executemany(UPSERT_SQL, rows_buf)
            conn.commit()
            return cur, conn
        except psycopg2.OperationalError as e:
            print(f"  Connection dropped ({e}), reconnecting...")
            try:
                conn.close()
            except Exception:
                pass
            conn = make_conn()
            cur  = conn.cursor()
            cur.executemany(UPSERT_SQL, rows_buf)
            conn.commit()
            return cur, conn

    print("Connecting to DB...")
    conn = make_conn()
    cur  = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS pincode_gsw_cache (
            pincode     text PRIMARY KEY,
            data        jsonb NOT NULL,
            computed_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    conn.commit()

    print("Computing and upserting...")
    rows_buf = []
    errors   = 0

    for i, pc in enumerate(pincodes):
        try:
            m_row = main_idx.loc[int(pc)].to_dict() if int(pc) in main_idx.index else {}
            an    = annual_grp.get(pc, pd.DataFrame(columns=["year", "water_sum", "valid_sum", "month_count"]))
            cm    = calmon_grp.get(pc, pd.DataFrame(columns=["month", "water_sum", "valid_sum", "year_count"]))
            yr    = yearly_grp.get(pc, pd.DataFrame(columns=["year", "perm_pixels", "seas_pixels", "land_pixels", "total_pixels"]))

            data = compute(pc, m_row, an, cm, yr)
            rows_buf.append((pc, json.dumps(data, allow_nan=False)))
        except Exception as e:
            errors += 1
            print(f"  ERROR pincode {pc}: {e}")
            continue

        if len(rows_buf) >= BATCH_SIZE:
            cur, conn = flush(cur, conn, rows_buf)
            rows_buf = []
            print(f"  {i+1:,}/{len(pincodes):,} done ({errors} errors)...")

    if rows_buf:
        cur, conn = flush(cur, conn, rows_buf)

    cur.close()
    conn.close()

    elapsed = time.time() - t0
    print(f"\nDone. {len(pincodes)-errors:,} pincodes cached in {elapsed:.0f}s ({errors} errors)")
    print("Table: pincode_gsw_cache")


if __name__ == "__main__":
    main()
