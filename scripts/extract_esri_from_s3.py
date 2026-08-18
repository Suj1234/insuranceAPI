"""
Extract ESRI 10m Annual Land Cover from AWS S3 COGs — no GEE, no credentials.

Source: s3://io-10m-annual-lulc (us-west-2, public bucket, CC BY 4.0)
URL pattern: https://io-10m-annual-lulc.s3.us-west-2.amazonaws.com/{zone:02d}{band}_{year}.tif

How it works:
  - Groups 19K pincodes by their UTM tile (zone+band formula, no library needed)
  - Opens each tile once via VSICURL HTTP range requests (COG — only downloads
    the exact pixels needed, not the full file)
  - Reads 500m buffer (50px radius) at each pincode centroid
  - Counts pixels per class → percentages

Output: data/output/esri_land_cover_raw.csv
        (same format as extract_esri_land_cover.py — plug into compute_land_cover_trends.py)

Resume-safe: skips already-done (pincode, year) pairs on restart.
Run with --test to validate 5 pincodes x 1 year before full run.
"""

import sys
import os
import time
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import rowcol
from pyproj import Transformer

# Fail fast when no internet — 10s timeout, 2 retries (vs GDAL default 30s, many retries)
os.environ["GDAL_HTTP_TIMEOUT"]   = "10"
os.environ["GDAL_HTTP_MAX_RETRY"] = "2"
os.environ["GDAL_HTTP_RETRY_DELAY"] = "2"

S3_BASE    = "https://io-10m-annual-lulc.s3.us-west-2.amazonaws.com"
YEARS      = list(range(2017, 2025))
BUFFER_M   = 500
RADIUS_PX  = 50          # 500m / 10m native resolution
OUTPUT_CSV = "data/output/esri_land_cover_raw.csv"
PINCODE_CSV = "data/output/pincode_coords.csv"

CLASS_MAP = {
    1: "water_pct",
    2: "trees_pct",
    3: "grass_pct",
    4: "flooded_veg_pct",
    5: "crops_pct",
    6: "scrub_shrub_pct",
    7: "built_area_pct",
    8: "bare_ground_pct",
    9: "snow_ice_pct",
}

# ── India tile catalogue ──────────────────────────────────────────────────────
# UTM zones 42-47 cover India (66-102°E)
# Latitude bands: N(0-8N) P(8-16N) Q(16-24N) R(24-32N) S(32-40N) T(40-48N)
INDIA_ZONES = list(range(42, 48))   # 42-47
INDIA_BANDS = list("NPQRST")

def get_tile_id(lat: float, lon: float) -> str:
    """Map a WGS84 coordinate to its UTM zone+band tile ID (e.g. '44Q')."""
    zone = int((lon + 180) / 6) + 1
    if   lat <  8: band = "N"
    elif lat < 16: band = "P"
    elif lat < 24: band = "Q"
    elif lat < 32: band = "R"
    elif lat < 40: band = "S"
    else:          band = "T"
    return f"{zone:02d}{band}"

def tile_url(tile_id: str, year: int) -> str:
    return f"/vsicurl/{S3_BASE}/{tile_id}_{year}.tif"

# ── Pre-flight check ──────────────────────────────────────────────────────────

def preflight_check():
    """Verify every India tile exists for every year before starting."""
    import requests
    print("Pre-flight: checking all India tiles exist on S3...")
    missing = []
    for zone in INDIA_ZONES:
        for band in INDIA_BANDS:
            tid = f"{zone:02d}{band}"
            for year in YEARS:
                url = f"{S3_BASE}/{tid}_{year}.tif"
                r = requests.head(url, timeout=10)
                if r.status_code == 404:
                    missing.append(f"{tid}_{year}.tif")
    if missing:
        print(f"  WARNING — {len(missing)} tiles not found on S3:")
        for m in missing[:10]:
            print(f"    {m}")
        print("  These pincodes will have null values for those years.")
    else:
        total = len(INDIA_ZONES) * len(INDIA_BANDS) * len(YEARS)
        print(f"  All {total} India tile-year combinations confirmed present.")
    return missing

# ── Core extraction ───────────────────────────────────────────────────────────

def extract_tile_year(tile_id: str, year: int, pincodes: pd.DataFrame) -> list:
    """
    Open one tile for one year, extract all pincodes in pincodes_df.
    Returns list of dicts with pincode, year, and class percentages.
    """
    url = tile_url(tile_id, year)
    results = []

    try:
        with rasterio.open(url) as ds:
            transformer = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)

            for _, row in pincodes.iterrows():
                lat, lon = float(row["lat"]), float(row["lng"])
                try:
                    x, y   = transformer.transform(lon, lat)
                    r, c   = rowcol(ds.transform, x, y)

                    r0 = max(0, r - RADIUS_PX)
                    c0 = max(0, c - RADIUS_PX)
                    r1 = min(ds.height, r + RADIUS_PX + 1)
                    c1 = min(ds.width,  c + RADIUS_PX + 1)

                    if r1 <= r0 or c1 <= c0:
                        continue

                    window = rasterio.windows.Window(c0, r0, c1 - c0, r1 - r0)
                    data   = ds.read(1, window=window)
                    total  = data.size

                    rec = {"pincode": str(row["pincode"]), "year": year}
                    for code, col in CLASS_MAP.items():
                        rec[col] = round(float(np.sum(data == code)) / total * 100, 2) if total > 0 else 0.0
                    results.append(rec)

                except Exception as e:
                    # Coordinate outside tile bounds — expected for edge pincodes
                    pass

    except Exception as e:
        print(f"    ERROR opening {tile_id}_{year}: {e}")

    return results

# ── IO helpers ────────────────────────────────────────────────────────────────

def load_pincodes() -> pd.DataFrame:
    df = pd.read_csv(PINCODE_CSV)
    df["lat"] = pd.to_numeric(df["latitude"],  errors="coerce")
    df["lng"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df[df["lat"].between(6.0, 38.0) & df["lng"].between(67.0, 99.0)]
    df = df.drop_duplicates(subset=["pincode"])
    df["pincode"]  = df["pincode"].astype(str)
    df["tile_id"]  = df.apply(lambda r: get_tile_id(r["lat"], r["lng"]), axis=1)
    return df[["pincode", "lat", "lng", "tile_id"]].reset_index(drop=True)

def load_done() -> set:
    if not os.path.exists(OUTPUT_CSV):
        return set()
    df = pd.read_csv(OUTPUT_CSV, usecols=["pincode", "year"])
    return set(zip(df["pincode"].astype(str), df["year"].astype(int)))

def save_rows(rows: list):
    if not rows:
        return
    df_new = pd.DataFrame(rows)
    if os.path.exists(OUTPUT_CSV):
        df_new = pd.concat([pd.read_csv(OUTPUT_CSV), df_new], ignore_index=True)
    df_new.to_csv(OUTPUT_CSV, index=False)

# ── Main ──────────────────────────────────────────────────────────────────────

def main(test_mode: bool = False):
    pincodes = load_pincodes()
    print(f"Loaded {len(pincodes):,} pincodes")

    # Tile distribution summary
    tile_counts = pincodes["tile_id"].value_counts().sort_index()
    print(f"Tile coverage: {len(tile_counts)} tiles")
    for tid, n in tile_counts.items():
        print(f"  {tid}: {n:,} pincodes")

    if test_mode:
        print("\nTEST MODE — 5 pincodes x year 2024 only")
        sample = pincodes.groupby("tile_id").first().reset_index()
        sample = pincodes[pincodes["pincode"].isin(sample["pincode"])].head(5)
        years_to_run = [2024]
        pincodes = sample
    else:
        years_to_run = YEARS

    done = load_done()
    print(f"Already done: {len(done):,} (pincode, year) pairs\n")

    total_rows   = 0
    errors       = 0
    buffer       = []

    for year in years_to_run:
        year_done = {pc for pc, yr in done if yr == year}
        remaining = pincodes[~pincodes["pincode"].isin(year_done)]

        if len(remaining) == 0:
            print(f"Year {year}: already complete, skipping.")
            continue

        print(f"Year {year}: {len(remaining):,} pincodes remaining across "
              f"{remaining['tile_id'].nunique()} tiles")

        for tile_id in sorted(remaining["tile_id"].unique()):
            tile_pincodes = remaining[remaining["tile_id"] == tile_id]
            n = len(tile_pincodes)
            print(f"  {tile_id}_{year}  ({n} pincodes)...", end=" ", flush=True)
            t0 = time.time()

            rows = extract_tile_year(tile_id, year, tile_pincodes)

            elapsed = time.time() - t0
            if rows:
                buffer.extend(rows)
                total_rows += len(rows)
                print(f"{len(rows)} extracted  ({elapsed:.1f}s)")
            else:
                errors += 1
                print(f"0 extracted — tile may not exist  ({elapsed:.1f}s)")

            # Checkpoint every 10 tiles
            if len(buffer) >= 2000:
                save_rows(buffer)
                buffer = []
                print(f"    -> checkpoint saved ({total_rows:,} total rows)")

        # Save at end of each year
        if buffer:
            save_rows(buffer)
            buffer = []
        print(f"  Year {year} done.\n")

    if buffer:
        save_rows(buffer)

    if os.path.exists(OUTPUT_CSV):
        final = pd.read_csv(OUTPUT_CSV)
        print(f"Complete. {len(final):,} rows in {OUTPUT_CSV}")
        print(f"Errors (empty tiles): {errors}")
        if not test_mode:
            print("\nNext steps:")
            print("  python scripts/compute_land_cover_trends.py")
            print("  python scripts/load_esri_land_cover.py")
    else:
        print("No output produced.")

if __name__ == "__main__":
    test_mode = "--test" in sys.argv
    main(test_mode=test_mode)
