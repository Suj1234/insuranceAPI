"""
FastAPI service for MERIT Hydro v1.0.1 point lookups via rasterio + HF CDN.

No local TIF files needed — reads from Hugging Face public dataset via
HTTP range requests (GDAL /vsicurl/). All 6 TIFs are 256×256 internally
tiled so only the relevant tile is fetched per request.

Latency: ~200–400 ms per lookup (6 HTTP range reads from HF CDN).

Deploy on SSH server:
  pip3 install fastapi uvicorn rasterio numpy
  HF_DATASET_REPO=Suj-1234/merit-hydro-india uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
from contextlib import asynccontextmanager

import numpy as np
import rasterio
from rasterio.windows import Window
from fastapi import FastAPI, HTTPException, Query

HF_REPO = os.environ.get("HF_DATASET_REPO", "Suj-1234/merit-hydro-india")
HF_BASE = f"https://huggingface.co/datasets/{HF_REPO}/resolve/main"

BANDS = {
    "hand": "india_hand.tif",
    "elv":  "india_elevation.tif",
    "upa":  "india_upstream_area.tif",
    "wth":  "india_river_width.tif",
    "wat":  "india_water_mask.tif",
    "dir":  "india_flow_direction.tif",
}

DIR_LABELS = {
    1: "east", 2: "southeast", 4: "south", 8: "southwest",
    16: "west", 32: "northwest", 64: "north", 128: "northeast",
    0: "river_mouth", -1: "inland_depression", -9: "undefined",
}

_datasets: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    for key, filename in BANDS.items():
        url = f"/vsicurl/{HF_BASE}/{filename}"
        _datasets[key] = rasterio.open(url)
        print(f"  opened {key}: {filename}")
    print("All 6 MERIT Hydro bands ready.")
    yield
    for ds in _datasets.values():
        ds.close()


app = FastAPI(title="MERIT Hydro raster service", lifespan=lifespan)


def _sample(key: str, lon: float, lat: float):
    ds = _datasets[key]
    try:
        row, col = ds.index(lon, lat)
        val = ds.read(1, window=Window(col, row, 1, 1))[0, 0]
        if ds.nodata is not None and val == ds.nodata:
            return None
        # float bands may carry NaN
        try:
            if np.isnan(val):
                return None
        except (TypeError, ValueError):
            pass
        return float(val)
    except Exception:
        return None


@app.get("/lookup")
def lookup(
    lat: float = Query(..., ge=6.0,  le=38.0),
    lon: float = Query(..., ge=67.0, le=98.0),
):
    hand_m            = _sample("hand", lon, lat)
    elevation_m       = _sample("elv",  lon, lat)
    upstream_area_km2 = _sample("upa",  lon, lat)
    river_width_raw   = _sample("wth",  lon, lat)
    water_raw         = _sample("wat",  lon, lat)
    dir_raw           = _sample("dir",  lon, lat)

    def _r(v, d): return round(v, d) if v is not None else None

    # 0 means no river in MERIT Hydro width band
    river_width_m        = _r(river_width_raw, 1) if river_width_raw else None
    on_permanent_water   = bool(int(water_raw) == 1) if water_raw is not None else None
    flow_direction_code  = int(dir_raw)              if dir_raw   is not None else None
    flow_direction_label = DIR_LABELS.get(flow_direction_code) if flow_direction_code is not None else None

    flood_risk_class   = _classify_hand(hand_m)
    coastal_surge_risk = bool(elevation_m < 5.0)   if elevation_m         is not None else None
    inland_depression  = flow_direction_code == -1  if flow_direction_code is not None else False
    adjacent_to_river  = bool(on_permanent_water) or bool(river_width_raw and river_width_raw > 0)

    return {
        "source": {
            "hand_m":               _r(hand_m, 2),
            "elevation_m":          _r(elevation_m, 2),
            "upstream_area_km2":    _r(upstream_area_km2, 3),
            "river_width_m":        river_width_m,
            "on_permanent_water":   on_permanent_water,
            "flow_direction_code":  flow_direction_code,
            "flow_direction_label": flow_direction_label,
        },
        "calculated": {
            "flood_risk_class":   flood_risk_class,
            "coastal_surge_risk": coastal_surge_risk,
            "inland_depression":  inland_depression,
            "adjacent_to_river":  adjacent_to_river,
        },
    }


def _classify_hand(hand_m):
    if hand_m is None: return None
    if hand_m <= 2:    return "extreme"
    if hand_m <= 5:    return "very_high"
    if hand_m <= 10:   return "high"
    if hand_m <= 20:   return "moderate"
    if hand_m <= 30:   return "low"
    return "very_low"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "source": f"HF:{HF_REPO}",
        "bands":  list(_datasets.keys()),
    }
