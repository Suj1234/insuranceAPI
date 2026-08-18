"""
Compute distance from each pincode centroid to the nearest HydroRIVERS river segment.

Uses the already-downloaded HydroRIVERS Asia shapefile.
Filters to India bounding box before spatial join for performance.

Output: data/flood/gee_outputs/river_distance.csv
Columns: pincode, distance_to_river_km

Runtime: ~20-30 min
"""

import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import numpy as np

PINCODE_CSV    = "data/output/pincode_coords.csv"
HYDRORIVERS_SHP = "data/flood/hydrorivers/HydroRIVERS_v10_as_shp/HydroRIVERS_v10_as.shp"
OUTPUT_CSV     = "data/flood/gee_outputs/river_distance.csv"

# India bounding box with buffer
INDIA_BBOX = (67.0, 6.0, 98.0, 38.0)

# Only keep rivers with reasonable size (ORDER <= 7 keeps major + medium rivers)
# ORD_FLOW 1=largest, 10=smallest streams
MIN_RIVER_ORDER = 7

def main():
    print(f"Loading HydroRIVERS shapefile...")
    rivers = gpd.read_file(HYDRORIVERS_SHP, bbox=INDIA_BBOX)
    print(f"  Total river segments in India bbox: {len(rivers):,}")

    # Filter to meaningful rivers only (exclude tiny streams)
    if "ORD_FLOW" in rivers.columns:
        rivers = rivers[rivers["ORD_FLOW"] <= MIN_RIVER_ORDER]
        print(f"  After filtering to order <= {MIN_RIVER_ORDER}: {len(rivers):,} segments")

    rivers = rivers.to_crs("EPSG:32644")  # UTM zone 44N — India, metres

    print(f"\nLoading pincodes...")
    pincodes = pd.read_csv(PINCODE_CSV)
    pincodes["lat"] = pd.to_numeric(pincodes["latitude"], errors="coerce")
    pincodes["lng"] = pd.to_numeric(pincodes["longitude"], errors="coerce")
    pincodes = pincodes[pincodes["lat"].between(6.0, 38.0) & pincodes["lng"].between(67.0, 99.0)]
    pincodes = pincodes.drop_duplicates(subset=["pincode"])
    print(f"  {len(pincodes):,} pincodes with valid India coords")

    # Convert pincodes to GeoDataFrame in same CRS
    gdf = gpd.GeoDataFrame(
        pincodes,
        geometry=[Point(row["lng"], row["lat"]) for _, row in pincodes.iterrows()],
        crs="EPSG:4326"
    ).to_crs("EPSG:32644")

    # Build union of all river geometries for distance computation
    print("\nBuilding river spatial index...")
    rivers_union = rivers.geometry.unary_union

    print("Computing distances (this may take 15-20 min)...")
    results = []
    total = len(gdf)
    for i, (_, row) in enumerate(gdf.iterrows()):
        if i % 5000 == 0:
            print(f"  {i:,}/{total:,}...")
        dist_m = row.geometry.distance(rivers_union)
        dist_km = round(dist_m / 1000, 3)
        results.append({
            "pincode": str(row["pincode"]),
            "distance_to_river_km": dist_km,
        })

    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone. {len(df):,} pincodes -> {OUTPUT_CSV}")
    print(f"Median distance to river: {df['distance_to_river_km'].median():.1f} km")
    print(f"Within 1km of river: {(df['distance_to_river_km'] < 1).sum():,} pincodes")

if __name__ == "__main__":
    main()
