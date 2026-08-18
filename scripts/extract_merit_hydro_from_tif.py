"""
Extract MERIT Hydro values for all PIN codes from local TIF files.

Run AFTER downloading TIF files from GCS to data/output/merit_hydro_tifs/

No GEE quota used — reads local files with rasterio.
Runtime: ~5 minutes for 19,550 PIN codes.

Output: data/output/merit_hydro_pincodes.csv
"""

import os
import numpy as np
import pandas as pd
import rasterio

TIF_DIR     = "data/output/merit_hydro_tifs"
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/output/merit_hydro_pincodes.csv"

TIFS = {
    "hand_m":             "india_hand.tif",
    "elevation_m":        "india_elevation.tif",
    "upstream_area_km2":  "india_upstream_area.tif",
    "river_width_m":      "india_river_width.tif",
    "on_permanent_water": "india_water_mask.tif",
    "flow_direction_code":"india_flow_direction.tif",
}

ROUND = {
    "hand_m": 2,
    "elevation_m": 2,
    "upstream_area_km2": 3,
    "river_width_m": 1,
}

def load_pincodes():
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"],  errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    df["pincode"] = df["pincode"].astype(str)
    return df[["pincode", "lat", "lng"]].reset_index(drop=True)

def sample_point(ds, lon, lat):
    try:
        row, col = ds.index(lon, lat)
        window = rasterio.windows.Window(col, row, 1, 1)
        val = float(ds.read(1, window=window)[0, 0])
        nodata = ds.nodata
        if (nodata is not None and val == nodata) or np.isnan(val):
            return None
        return val
    except Exception:
        return None

def main():
    # Verify TIF files exist
    missing = [f for f in TIFS.values() if not os.path.exists(os.path.join(TIF_DIR, f))]
    if missing:
        print(f"ERROR — missing TIF files in {TIF_DIR}/:")
        for f in missing:
            print(f"  {f}")
        print("Run download_merit_hydro_gcs.py first.")
        return

    print(f"Opening {len(TIFS)} TIF files...")
    datasets = {col: rasterio.open(os.path.join(TIF_DIR, fname)) for col, fname in TIFS.items()}

    pincodes = load_pincodes()
    print(f"Sampling {len(pincodes):,} PIN codes...\n")

    results = []
    for i, (_, row) in enumerate(pincodes.iterrows()):
        record = {"pincode": row["pincode"]}
        for col, ds in datasets.items():
            val = sample_point(ds, float(row["lng"]), float(row["lat"]))
            if val is not None and col in ROUND:
                val = round(val, ROUND[col])
            elif col == "on_permanent_water":
                val = int(val) if val is not None else None
            elif col == "flow_direction_code":
                val = int(val) if val is not None else None
            record[col] = val
        results.append(record)

        if (i + 1) % 1000 == 0:
            print(f"  {i+1:,}/{len(pincodes):,} done...")

    for ds in datasets.values():
        ds.close()

    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_CSV, index=False)

    print(f"\nDone. {len(df):,} PIN codes → {OUTPUT_CSV}")
    print(f"Median HAND: {df['hand_m'].median():.1f} m")
    print(f"HAND <= 2m (extreme risk): {(df['hand_m'] <= 2).sum():,}")
    print(f"On permanent water: {(df['on_permanent_water'] == 1).sum():,}")
    print(f"Inland depressions (dir=-1): {(df['flow_direction_code'] == -1).sum():,}")
    print(f"\nNext step: python scripts/load_merit_hydro_pincodes.py")

if __name__ == "__main__":
    main()
