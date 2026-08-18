"""
Identify upstream dams for each Indian pincode using Global Dam Watch v1.0.

Data: data/flood/dam_watch/GDW_v1_0_shp/GDW_barriers_v1_0.shp
      7,097 India dams (COUNTRY='India'). 95% have DAM_HGT_M=-99 (missing height).

Logic: for each pincode, find the nearest dam within 100km that is roughly
upstream (higher latitude, approximate for most Indian rivers flowing south).

Output: data/flood/gee_outputs/dam_watch.csv
Columns: pincode, upstream_dam_present, upstream_dam_name, upstream_dam_type,
         upstream_dam_height_m, upstream_dam_river, upstream_dam_main_use,
         upstream_dam_year

All raw GDW fields saved — upstream_dam_height_m=-99 means data missing.

Runtime: ~10-20 min
"""

import os
import glob
import pandas as pd
import numpy as np

try:
    import geopandas as gpd
    from shapely.geometry import Point
    HAS_GPD = True
except ImportError:
    HAS_GPD = False
    print("WARNING: geopandas not installed. Run: pip install geopandas")

PINCODE_CSV  = "data/output/pincode_coords.csv"
DAM_SHAPEFILE = "data/flood/dam_watch/GDW_v1_0_shp/GDW_barriers_v1_0.shp"
OUTPUT_CSV   = "data/flood/gee_outputs/dam_watch.csv"

SEARCH_RADIUS_M = 100_000  # 100km

def load_pincodes():
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    return df[["pincode", "lat", "lng"]].reset_index(drop=True)

def classify_dam_type(main_use, use_fcon):
    """
    GDW v1.0: MAIN_USE has full words (Irrigation, Hydroelectricity, etc.)
    USE_FCON has 'Main' or 'Sec' if flood control is a purpose.
    """
    if use_fcon and not pd.isna(use_fcon):
        return "flood_control"
    if not main_use or pd.isna(main_use):
        return "multipurpose"
    mu = str(main_use).lower()
    if "flood" in mu or "control" in mu:
        return "flood_control"
    if "irrigation" in mu:
        return "irrigation"
    if "hydro" in mu or "electric" in mu or "power" in mu:
        return "hydropower"
    if "supply" in mu or "water" in mu:
        return "water_supply"
    return "multipurpose"

def main():
    if not HAS_GPD:
        return

    pincodes = load_pincodes()
    print(f"Pincodes: {len(pincodes):,}")

    if not os.path.exists(DAM_SHAPEFILE):
        print(f"ERROR: GDW shapefile not found at {DAM_SHAPEFILE}")
        print("Expected: data/flood/dam_watch/GDW_v1_0_shp/GDW_barriers_v1_0.shp")
        return

    print(f"Loading GDW v1.0 shapefile...")
    # Load all dams and filter to India by COUNTRY field
    india_bbox = (67.0, 6.0, 98.0, 38.0)
    dams = gpd.read_file(DAM_SHAPEFILE, bbox=india_bbox)
    dams = dams[dams["COUNTRY"] == "India"].copy()
    print(f"  {len(dams):,} India dams loaded")
    print(f"  Named dams: {dams['DAM_NAME'].notna().sum():,}")
    print(f"  Flood control (USE_FCON): {dams['USE_FCON'].notna().sum():,}")
    print(f"  With height (DAM_HGT_M != -99): {(dams['DAM_HGT_M'] != -99).sum():,}")

    # Reproject both to metric CRS for distance calculation
    dams = dams.to_crs("EPSG:32644")
    pincode_gdf = gpd.GeoDataFrame(
        pincodes,
        geometry=[Point(r["lng"], r["lat"]) for _, r in pincodes.iterrows()],
        crs="EPSG:4326"
    ).to_crs("EPSG:32644")

    results = []
    total = len(pincode_gdf)

    for i, (_, row) in enumerate(pincode_gdf.iterrows()):
        if i % 5000 == 0:
            print(f"  {i:,}/{total:,}...")

        pt = row.geometry
        nearby = dams[dams.geometry.distance(pt) < SEARCH_RADIUS_M].copy()
        # Upstream approximation: dam is north of pincode (Indian rivers flow southward mostly)
        upstream = nearby[nearby.geometry.y > pt.y]

        if len(upstream) == 0:
            results.append({
                "pincode":               str(row["pincode"]),
                "upstream_dam_present":  False,
                "upstream_dam_name":     None,
                "upstream_dam_type":     None,
                "upstream_dam_height_m": None,
                "upstream_dam_river":    None,
                "upstream_dam_main_use": None,
                "upstream_dam_year":     None,
            })
        else:
            distances = upstream.geometry.distance(pt)
            closest = upstream.iloc[distances.argmin()]

            height = float(closest["DAM_HGT_M"]) if closest["DAM_HGT_M"] not in (None, -99) else None
            year   = int(closest["YEAR_DAM"]) if closest["YEAR_DAM"] and closest["YEAR_DAM"] > 0 else None
            name   = str(closest["DAM_NAME"]) if closest["DAM_NAME"] and not pd.isna(closest["DAM_NAME"]) else None

            results.append({
                "pincode":               str(row["pincode"]),
                "upstream_dam_present":  True,
                "upstream_dam_name":     name,
                "upstream_dam_type":     classify_dam_type(closest["MAIN_USE"], closest["USE_FCON"]),
                "upstream_dam_height_m": height,
                "upstream_dam_river":    str(closest["RIVER"]) if closest["RIVER"] and not pd.isna(closest["RIVER"]) else None,
                "upstream_dam_main_use": str(closest["MAIN_USE"]) if closest["MAIN_USE"] and not pd.isna(closest["MAIN_USE"]) else None,
                "upstream_dam_year":     year,
            })

    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone. {len(df):,} pincodes -> {OUTPUT_CSV}")
    print(f"With upstream dam: {df['upstream_dam_present'].sum():,}")
    print(f"  flood_control:   {(df['upstream_dam_type'] == 'flood_control').sum():,}")
    print(f"  irrigation:      {(df['upstream_dam_type'] == 'irrigation').sum():,}")
    print(f"  hydropower:      {(df['upstream_dam_type'] == 'hydropower').sum():,}")
    print(f"  multipurpose:    {(df['upstream_dam_type'] == 'multipurpose').sum():,}")

if __name__ == "__main__":
    main()
