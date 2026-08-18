"""
Extract ISRO Bhuvan NRSC flood hazard classification for Indian pincodes via WMS.

Uses OGC WMS GetFeatureInfo against the Bhuvan flood hazard layer.
Only returns values for states that have completed flood hazard atlases.

Output: data/flood/gee_outputs/bhuvan_hazard.csv
Columns: pincode, nrsc_hazard_class, nrsc_inundation_count,
         nrsc_observation_years, nrsc_data_period, nrsc_state_covered

Covered states (as of 2025):
  Bihar (1998-2019), Assam (1998-2023), Andhra Pradesh (2000-2020),
  Uttar Pradesh (partial), West Bengal (partial), Odisha (partial), Punjab (partial)

Runtime: 2-4 hours (rate-limited WMS requests)
"""

import os
import time
import requests
import pandas as pd
from urllib.parse import urlencode

PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/flood/gee_outputs/bhuvan_hazard.csv"

WMS_BASE = "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms"

# Layer names to try (Bhuvan layer names vary; try each)
FLOOD_LAYERS = [
    "bhuvan:flood_hazard_zonation",
    "bhuvan:FHZ_India",
    "bhuvan:flood_hazard",
    "nrsc:flood_hazard_zonation",
]

# States with completed Bhuvan flood hazard atlases
COVERED_STATES = {
    "Bihar":           {"period": "1998-2019", "years": 21},
    "Assam":           {"period": "1998-2023", "years": 25},
    "Andhra Pradesh":  {"period": "2000-2020", "years": 20},
    "Uttar Pradesh":   {"period": "2000-2019", "years": 19},
    "West Bengal":     {"period": "1998-2020", "years": 22},
    "Odisha":          {"period": "2000-2022", "years": 22},
    "Punjab":          {"period": "2000-2018", "years": 18},
}

HAZARD_CLASS_MAP = {
    "1": "Very Low",
    "2": "Low",
    "3": "Moderate",
    "4": "High",
    "Very Low": "Very Low",
    "Low": "Low",
    "Moderate": "Moderate",
    "High": "High",
}

REQUEST_DELAY = 0.3  # seconds between WMS requests

def build_wms_url(layer, lat, lon, bbox_delta=0.001):
    """Build WMS GetFeatureInfo URL for a point location."""
    bbox = f"{lon-bbox_delta},{lat-bbox_delta},{lon+bbox_delta},{lat+bbox_delta}"
    params = {
        "SERVICE": "WMS",
        "VERSION": "1.1.1",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": layer,
        "QUERY_LAYERS": layer,
        "BBOX": bbox,
        "WIDTH": "3",
        "HEIGHT": "3",
        "X": "1",
        "Y": "1",
        "INFO_FORMAT": "application/json",
        "SRS": "EPSG:4326",
    }
    return f"{WMS_BASE}?{urlencode(params)}"

def query_wms(layer, lat, lon, session):
    url = build_wms_url(layer, lat, lon)
    try:
        resp = session.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                props = features[0].get("properties", {})
                return props
    except Exception:
        pass
    return None

def parse_hazard_class(props):
    """Extract hazard class from WMS response properties."""
    for key in ["hazard_class", "FHZ", "HAZARD", "class", "GRIDCODE", "VALUE"]:
        val = props.get(key)
        if val is not None:
            return HAZARD_CLASS_MAP.get(str(val), str(val))
    return None

def main():
    print(f"Loading pincodes...")
    pincodes = pd.read_csv(PINCODE_CSV).dropna(subset=["lat", "lng"])

    # Filter to covered states only
    if "state_name" in pincodes.columns:
        covered = pincodes[pincodes["state_name"].isin(COVERED_STATES.keys())]
        uncovered = pincodes[~pincodes["pincode"].isin(covered["pincode"])]
    else:
        print("WARNING: No state_name column — processing all pincodes")
        covered = pincodes
        uncovered = pd.DataFrame()

    print(f"  Covered-state pincodes: {len(covered):,}")
    print(f"  Uncovered (will be Not Mapped): {len(uncovered):,}")

    done = set()
    if os.path.exists(OUTPUT_CSV):
        done = set(pd.read_csv(OUTPUT_CSV)["pincode"].astype(str))
        print(f"  Resuming — {len(done):,} done")
    covered = covered[~covered["pincode"].astype(str).isin(done)]

    # Detect working layer
    active_layer = None
    session = requests.Session()
    session.headers.update({"User-Agent": "InsureTech-DataPlatform/1.0"})

    for layer in FLOOD_LAYERS:
        test_url = build_wms_url(layer, 25.61, 85.14)  # Patna, Bihar
        try:
            resp = session.get(test_url, timeout=10)
            if resp.status_code == 200 and "features" in resp.text:
                active_layer = layer
                print(f"  Active WMS layer: {layer}")
                break
        except Exception:
            continue

    if not active_layer:
        print("\nWARNING: No Bhuvan WMS layer responding. Writing Not Mapped for all.")
        print("Try again later or check: https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms")

    all_rows = []
    total = len(covered)

    for i, (_, row) in enumerate(covered.iterrows()):
        if i % 500 == 0:
            print(f"  {i:,}/{total:,}...")

        pincode = str(row["pincode"])
        state = row.get("state_name", "")
        state_info = COVERED_STATES.get(state, {})

        if active_layer:
            props = query_wms(active_layer, float(row["lat"]), float(row["lng"]), session)
            hazard_class = parse_hazard_class(props) if props else None
            inundation_count = props.get("inundation_count") if props else None
        else:
            hazard_class = None
            inundation_count = None

        all_rows.append({
            "pincode": pincode,
            "nrsc_hazard_class": hazard_class or "Not Mapped",
            "nrsc_inundation_count": inundation_count,
            "nrsc_observation_years": state_info.get("years"),
            "nrsc_data_period": state_info.get("period"),
            "nrsc_state_covered": True,
        })
        time.sleep(REQUEST_DELAY)

        if (i + 1) % 200 == 0:
            df_save = pd.DataFrame(all_rows)
            if os.path.exists(OUTPUT_CSV):
                df_save = pd.concat([pd.read_csv(OUTPUT_CSV), df_save], ignore_index=True)
            df_save.to_csv(OUTPUT_CSV, index=False)
            all_rows = []

    # Add Not Mapped rows for uncovered states
    for _, row in uncovered.iterrows():
        all_rows.append({
            "pincode": str(row["pincode"]),
            "nrsc_hazard_class": "Not Mapped",
            "nrsc_inundation_count": None,
            "nrsc_observation_years": None,
            "nrsc_data_period": None,
            "nrsc_state_covered": False,
        })

    if all_rows:
        df_save = pd.DataFrame(all_rows)
        if os.path.exists(OUTPUT_CSV):
            df_save = pd.concat([pd.read_csv(OUTPUT_CSV), df_save], ignore_index=True)
        df_save.to_csv(OUTPUT_CSV, index=False)

    final = pd.read_csv(OUTPUT_CSV)
    print(f"\nDone. {len(final):,} pincodes -> {OUTPUT_CSV}")
    print(final["nrsc_hazard_class"].value_counts().to_string())

if __name__ == "__main__":
    main()
