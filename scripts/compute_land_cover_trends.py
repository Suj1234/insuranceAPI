"""
Compute trend and calculated fields from ESRI land cover raw extraction.

Input:  data/output/esri_land_cover_raw.csv  (long format: one row per pincode+year)
Output: data/output/esri_land_cover_wide.csv (wide format: one row per pincode, all years + trends)

Run AFTER extract_esri_land_cover.py completes.
Run BEFORE load_esri_land_cover.py.
"""

import numpy as np
import pandas as pd

INPUT_CSV  = "data/output/esri_land_cover_raw.csv"
OUTPUT_CSV = "data/output/esri_land_cover_wide.csv"
YEARS      = list(range(2017, 2025))

BANDS = [
    "built_area_pct", "trees_pct", "crops_pct", "water_pct",
    "flooded_veg_pct", "grass_pct", "scrub_shrub_pct", "bare_ground_pct",
]

X      = np.array(YEARS, dtype=float)
X_norm = X - X.mean()


def regression_slope(values):
    """Linear regression slope over YEARS. Returns None if fewer than 4 valid points."""
    pairs = [(x, y) for x, y in zip(X_norm, values)
             if y is not None and not (isinstance(y, float) and np.isnan(y))]
    if len(pairs) < 4:
        return None
    xs, ys = zip(*pairs)
    return float(np.polyfit(xs, ys, 1)[0])


def trend_label(slope, threshold=0.1):
    if slope is None:
        return "unknown"
    if slope > threshold:
        return "increasing"
    if slope < -threshold:
        return "decreasing"
    return "stable"


def dominant_class(row, suffix):
    classes = {
        "built_area": row.get(f"built_area_pct_{suffix}", 0) or 0,
        "trees":      row.get(f"trees_pct_{suffix}",      0) or 0,
        "crops":      row.get(f"crops_pct_{suffix}",      0) or 0,
        "water":      row.get(f"water_pct_{suffix}",      0) or 0,
        "flooded_veg":row.get(f"flooded_veg_pct_{suffix}",0) or 0,
        "grass":      row.get(f"grass_pct_{suffix}",      0) or 0,
        "scrub_shrub":row.get(f"scrub_shrub_pct_{suffix}",0) or 0,
        "bare_ground":row.get(f"bare_ground_pct_{suffix}",0) or 0,
    }
    return max(classes, key=classes.get)


def main():
    print(f"Loading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    df["pincode"] = df["pincode"].astype(str)
    df["year"]    = df["year"].astype(int)

    before = len(df)
    df = df.drop_duplicates(subset=["pincode", "year"])
    if len(df) < before:
        print(f"  Dropped {before - len(df):,} duplicate (pincode, year) rows")

    expected = len(df["pincode"].unique()) * len(YEARS)
    print(f"  {len(df):,} rows ({len(df['pincode'].unique()):,} pincodes x {len(YEARS)} years)")
    if len(df) < expected:
        print(f"  Warning: expected {expected:,} rows — {expected - len(df):,} missing (extraction may be incomplete)")

    # ── Pivot to wide format ───────────────────────────────────────────────────
    print("Pivoting to wide format...")
    wide = df.pivot(index="pincode", columns="year", values=BANDS)
    wide.columns = [f"{band}_{yr}" for band, yr in wide.columns]
    wide = wide.reset_index()
    print(f"  {len(wide):,} pincode rows, {len(wide.columns)} columns")

    # ── Calculated fields ──────────────────────────────────────────────────────
    print("Computing calculated fields...")

    def col_vals(row, band):
        return [row.get(f"{band}_{yr}") for yr in YEARS]

    # Urban growth
    wide["urban_growth_rate_pct_per_yr"] = wide.apply(
        lambda r: round(regression_slope(col_vals(r, "built_area_pct")), 3)
        if regression_slope(col_vals(r, "built_area_pct")) is not None else None,
        axis=1
    )
    wide["urban_growth_class"] = wide["urban_growth_rate_pct_per_yr"].apply(
        lambda v: (
            "rapid"    if v is not None and v >  3.0 else
            "moderate" if v is not None and v >  1.0 else
            "declining"if v is not None and v < -1.0 else
            "stable"
        )
    )

    # Absolute deltas (2024 vs 2017)
    for band in BANDS:
        c17, c24 = f"{band}_2017", f"{band}_2024"
        if c17 in wide.columns and c24 in wide.columns:
            wide[f"{band.replace('_pct', '')}_change_pct"] = (
                wide[c24].fillna(0) - wide[c17].fillna(0)
            ).round(2)

    # Greenery loss (trees + grass combined)
    wide["greenery_loss_pct"] = (
        (wide.get("trees_pct_2017", 0).fillna(0) + wide.get("grass_pct_2017", 0).fillna(0)) -
        (wide.get("trees_pct_2024", 0).fillna(0) + wide.get("grass_pct_2024", 0).fillna(0))
    ).round(2)

    # Cropland-to-urban conversion
    # Min of (cropland lost, built-up gained) — the overlap where both moved same direction
    cropland_lost   = (wide.get("crops_pct_2017",      0).fillna(0) - wide.get("crops_pct_2024",      0).fillna(0))
    builtup_gained  = (wide.get("built_area_pct_2024", 0).fillna(0) - wide.get("built_area_pct_2017", 0).fillna(0))
    wide["cropland_to_urban_pct"] = (
        pd.concat([cropland_lost, builtup_gained], axis=1)
        .apply(lambda r: round(min(max(r.iloc[0], 0), max(r.iloc[1], 0)), 2), axis=1)
    )

    # Flooded veg: max and trend
    fv_cols = [f"flooded_veg_pct_{yr}" for yr in YEARS if f"flooded_veg_pct_{yr}" in wide.columns]
    wide["flooded_veg_max_pct"] = wide[fv_cols].max(axis=1).round(2)
    wide["flooded_vegetation_trend"] = wide.apply(
        lambda r: trend_label(regression_slope(col_vals(r, "flooded_veg_pct"))), axis=1
    )

    # Dominant land use
    wide["dominant_use_2017"] = wide.apply(lambda r: dominant_class(r, "2017"), axis=1)
    wide["dominant_use_2024"] = wide.apply(lambda r: dominant_class(r, "2024"), axis=1)
    wide["land_use_shifted"]  = wide["dominant_use_2017"] != wide["dominant_use_2024"]

    # ── Save ──────────────────────────────────────────────────────────────────
    wide.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved {len(wide):,} rows → {OUTPUT_CSV}")

    # Summary stats
    shifted = wide["land_use_shifted"].sum()
    rapid   = (wide["urban_growth_class"] == "rapid").sum()
    print(f"\nSummary:")
    print(f"  Land use shifted (dominant class changed 2017→2024): {shifted:,} ({shifted/len(wide)*100:.1f}%)")
    print(f"  Rapid urbanisation (>3%/yr):  {rapid:,} ({rapid/len(wide)*100:.1f}%)")
    print(f"  Avg built_area_pct 2017: {wide['built_area_pct_2017'].mean():.1f}%")
    print(f"  Avg built_area_pct 2024: {wide['built_area_pct_2024'].mean():.1f}%")
    print(f"\nNext step: python scripts/load_esri_land_cover.py")

if __name__ == "__main__":
    main()
