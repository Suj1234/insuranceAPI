"""
Merge GEE-exported tile files into single TIF per band.

GEE splits large exports into tiles named like:
  india_hand0000000000-0000000000.tif
  india_hand0000000000-0000032768.tif
  ...

This script merges them into:
  india_hand.tif
  india_elevation.tif
  india_upstream_area.tif
  india_river_width.tif

Bands already single files (flow_direction, water_mask) are skipped.
"""

import os
import glob
import rasterio
from rasterio.merge import merge

TIF_DIR = "data/output/merit_hydro_tifs"

BANDS = [
    "india_hand",
    "india_elevation",
    "india_upstream_area",
    "india_river_width",
    "india_flow_direction",
    "india_water_mask",
]

def merge_band(band):
    out_path = os.path.join(TIF_DIR, f"{band}.tif")
    if os.path.exists(out_path):
        print(f"  {band}.tif already exists — skipping")
        return True

    # Find tiles for this band
    tiles = sorted(glob.glob(os.path.join(TIF_DIR, f"{band}[0-9]*.tif")))

    if not tiles:
        single = os.path.join(TIF_DIR, f"{band}.tif")
        if os.path.exists(single):
            print(f"  {band}.tif already a single file — OK")
            return True
        print(f"  ERROR: no files found for {band}")
        return False

    if len(tiles) == 1:
        os.rename(tiles[0], out_path)
        print(f"  {band}: single tile → renamed to {band}.tif")
        return True

    print(f"  {band}: merging {len(tiles)} tiles...", end=" ", flush=True)
    datasets = [rasterio.open(t) for t in tiles]
    mosaic, transform = merge(datasets)

    profile = datasets[0].profile.copy()
    profile.update({
        "height": mosaic.shape[1],
        "width":  mosaic.shape[2],
        "transform": transform,
    })

    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(mosaic)

    for ds in datasets:
        ds.close()

    # Delete tiles after successful merge
    for t in tiles:
        os.remove(t)

    size_mb = os.path.getsize(out_path) / 1_048_576
    print(f"done ({size_mb:.0f} MB)")
    return True

def main():
    print(f"Merging tiles in {TIF_DIR}/\n")
    ok = 0
    for band in BANDS:
        if merge_band(band):
            ok += 1

    print(f"\n{ok}/{len(BANDS)} bands ready.")
    if ok == len(BANDS):
        print("All merged. Next step: python scripts/extract_merit_hydro_from_tif.py")

if __name__ == "__main__":
    main()
