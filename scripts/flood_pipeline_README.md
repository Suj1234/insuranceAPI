# Flood Data Pipeline — Setup & Run Guide

_Last verified: 2026-07-14_

---

## Data Sources — Verified Status

### ✅ READY — GEE (account live, key in place, scripts fixed and run)

| Source | GEE Dataset ID | What it provides | Period | Resolution | India coverage | Verified |
|---|---|---|---|---|---|---|
| **JRC GloFAS v2.1** | `JRC/CEMS_GLOFAS/FloodHazard/v2_1` | Flood depth at RP10/20/50/75/100/200/500 | Static model | 90m | 100% pincodes | ✅ 2,396 pincodes with RP100 data |
| **JRC Global Surface Water** | `JRC/GSW1_4/GlobalSurfaceWater` | Historical flooding 1984–2021: occurrence%, recurrence%, seasonality, trend | 1984–2021 (38 yrs) | 30m | 100% pincodes | ✅ 462 ever-flooded pincodes (null=never flooded, correct) |
| **WRI Aqueduct v2** | `WRI/Aqueduct_Flood_Hazard_Maps/V2` | Riverine + coastal depth + 2030/2050/2080 climate projections | **1980 baseline** + projections | 1km | 100% pincodes | ✅ 2,301 in RP100 riverine zone; 3,539 by RCP8.5 2080 |
| **MERIT HAND** | `MERIT/Hydro/v1_0_1` band `hnd` | Height above nearest drainage (terrain flood exposure proxy) | Static (SRTM) | 90m | 100% pincodes | ✅ 19,406 non-null; median 4.2m |
| **ESA WorldCover** | `ESA/WorldCover/v200` | Impervious surface % (class 50) + Mangrove cover % (class 95) | 2021 | 10m | 100% pincodes | ✅ 3,099 high impervious; 117 with mangrove |

**Script bugs fixed before running:**
- `extract_jrc_glofas.py` — fixed: `.mosaic()` not `.first()` (tiled collection); correct band names; `str(int(r["pincode"]))` fix
- `extract_aqueduct.py` — fixed: `props.get("first")` for single-band reduceRegions; 1980 baseline; `str(int(r["pincode"]))` fix
- `extract_hand_terrain.py` — fixed: `MERIT/Hydro/v1_0_1` path; `props.get("first")`; `str(int(r["pincode"]))` fix
- `extract_worldcover.py` — fixed: added class 95 (mangrove); `str(int(r["pincode"]))` fix
- All scripts — `str(int(r["pincode"]))` fix (iterrows() int64→float64 coercion)

**Important — Aqueduct baseline year:** Dataset uses **1980** as historical baseline (not 2010 as previously stated). Available years: 1980, 2030, 2050, 2080. Return periods: 2, 5, 10, 25, 50, 100, 250, 500, 1000.

---

### ✅ DONE — Local files (downloaded, extracted, loaded)

| Source | File location | What it provides | Period | India coverage | Quality notes |
|---|---|---|---|---|---|
| **HydroRIVERS v1.0** | `data/flood/hydrorivers/GDW_v1_0_shp/` | Distance to nearest river | Static (2012) | 594,858 river segments in India bbox | ✅ 19,550 pincodes, 0% null |
| **Global Dam Watch v1.0** | `data/flood/dam_watch/GDW_v1_0_shp/` | Upstream dam location, name, type, height, year | Static (2024 release) | **7,097 India dams** | ⚠️ 6,769/7,097 have height=-99 (missing); only 361 named; purpose data for ~350; location data complete for all 7,097 |
| **IMD Rainfall** | `data/flood/imd/` | Annual rainfall mm + extreme rain days/yr (>100mm threshold) | **1981–2020** (40 yrs) | All India 0.25° grid | ✅ Full 40-year climatology; 19,550 pincodes, 0% null |

---

### ✅ DONE — Database / compiled

| Source | Location | What it provides | Period | Coverage | Notes |
|---|---|---|---|---|---|
| **NDMA Districts** | `data/flood/gee_outputs/ndma_districts.csv` | Official flood-prone district flag | Static (2021 NDMA pub.) | 245 districts, 36 states | ✅ 7,860 flood-prone pincodes |
| **EM-DAT** | `data/output/emdat_disaster_summary.csv` | Flood events per decade + disaster loss (₹Cr) | 1988–present | 676 districts, 36 states | ✅ 15,107 pincodes matched (77.3%). ⚠️ Loss column is blended (flood+cyclone+earthquake). See Known Issues. |

---

### ⏸ SKIPPED / BACKLOG

| Source | What it would add | Why skipped | How to get | Priority |
|---|---|---|---|---|
| **NEER India Flood Atlas** | 30m flood depth RP10/50/100/500 for TN, AP, TS, KA, KL, GA | Email to support@neer.ai needed; JRC covers same states at 90m | Email support@neer.ai — CC BY 4.0, expected to share | Low — revisit after JRC pipeline running |
| **Bhuvan NRSC Flood Hazard** | Govt hazard class (7 states): Bihar, Assam, AP, UP, WB, Odisha, Punjab | WMS server (`bhuvan-vec2.nrsc.gov.in`) blocked on corporate network; data is fragmented/event-based not systematic | Run `extract_bhuvan_wms.py` from home network or cloud VM | Low — JRC+NDMA already covers same states better |
| **JAXA Global Mangrove Watch** | Higher-accuracy mangrove cover | REPLACED by ESA WorldCover class 95 (already in pipeline) | Not needed | ❌ Replaced — `mangrove_cover_pct` already in DB via WorldCover |

---

## GEE Setup — Completed Steps

- [x] Google Cloud project `insuretech-data-platform` created
- [x] Earth Engine API enabled (`earthengine.googleapis.com`)
- [x] Service account `gee-pipeline@insuretech-data-platform.iam.gserviceaccount.com` created
- [x] IAM roles added: `roles/earthengine.admin` + `roles/serviceusage.serviceUsageConsumer`
- [x] `gee-key.json` in project root
- [x] Auth verified: `python scripts/setup_gee_auth.py` → OK
- [x] All 5 GEE datasets confirmed returning data

---

## Run Order (for a clean re-run from scratch)

```bash
# Step 1 — GEE extractions (run in parallel terminals, ~30-90 min each)
python scripts/extract_jrc_glofas.py
python scripts/extract_jrc_gsw.py
python scripts/extract_aqueduct.py
python scripts/extract_hand_terrain.py
python scripts/extract_worldcover.py           # also extracts mangrove (class 95)

# Step 2 — Local extractions (can run in parallel with GEE)
python scripts/extract_hydrorivers.py          # ~20-30 min
python scripts/extract_dam_watch.py            # ~10-20 min (GDW shapefile ready)

# Step 3 — IMD rainfall (downloads 1981-2020, ~1 GB, ~45-60 min)
python scripts/extract_imd_rainfall.py

# Step 4 — NDMA districts (1 sec)
python scripts/load_ndma_districts.py

# Step 5 — EM-DAT summary
python scripts/process_emdat.py

# Step 6 — Final merge + scoring + DB load
python scripts/build_flood_risk_index.py
```

---

## Output files

| File | Content | Source |
|---|---|---|
| `data/flood/gee_outputs/jrc_glofas.csv` | RP10/20/50/75/100/200/500 depth per pincode | JRC GloFAS |
| `data/flood/gee_outputs/jrc_gsw.csv` | occurrence, recurrence, seasonality, trend | JRC GSW |
| `data/flood/gee_outputs/aqueduct.csv` | Riverine + coastal + 2030/2050/2080 projections | WRI Aqueduct |
| `data/flood/gee_outputs/hand_terrain.csv` | HAND elevation per pincode | MERIT Hydro |
| `data/flood/gee_outputs/worldcover.csv` | Impervious surface % + mangrove % | ESA WorldCover |
| `data/flood/gee_outputs/river_distance.csv` | Distance to nearest river km | HydroRIVERS |
| `data/flood/gee_outputs/ndma_districts.csv` | NDMA flood-prone flag | NDMA compiled |
| `data/flood/gee_outputs/dam_watch.csv` | Upstream dam info | GDW v1.0 |
| `data/flood/gee_outputs/imd_rainfall.csv` | Annual rainfall + extreme rain days | IMD imdlib |
| `data/output/emdat_disaster_summary.csv` | Flood events per decade + loss by district | EM-DAT |
| `data/output/flood_risk_index.csv` | Final merged output (all sources, 19,550 rows) | All above |

---

## Status Tracker

| Source | Data acquired | Script status | Extraction done |
|---|---|---|---|
| HydroRIVERS | ✅ Downloaded | ✅ Fixed | ✅ 19,550 rows, 0% null |
| GEE account | ✅ Live + key verified | ✅ `setup_gee_auth.py` | ✅ Auth confirmed |
| JRC GloFAS | ✅ Via GEE | ✅ Fixed | ✅ 2,396 pincodes with RP100 data |
| JRC GSW | ✅ Via GEE | ✅ Fixed | ✅ 462 ever-flooded pincodes |
| WRI Aqueduct | ✅ Via GEE | ✅ Fixed | ✅ 2,301 in RP100 riverine zone |
| MERIT HAND | ✅ Via GEE | ✅ Fixed | ✅ 19,406 non-null; median 4.2m |
| ESA WorldCover | ✅ Via GEE | ✅ Fixed | ✅ 3,099 high impervious; 117 with mangrove |
| Global Dam Watch | ✅ 7,097 India dams downloaded | ✅ Fixed | ✅ 19,550 rows |
| NDMA districts | ✅ Compiled (245 districts) | ✅ `load_ndma_districts.py` | ✅ 7,860 flood-prone pincodes |
| IMD Rainfall | ✅ 1981–2020 (40 years) | ✅ `extract_imd_rainfall.py` | ✅ 19,550 rows, 0% null |
| EM-DAT | ✅ 676 districts | ✅ `process_emdat.py` | ✅ 15,107 pincodes matched (77.3%) |
| Build + DB load | ✅ | ✅ `build_flood_risk_index.py` | ✅ 19,550 rows in `pincode_flood_index` |
| API endpoint | ✅ | ✅ `GET /api/environmental/flood/pincode` | ✅ Live, tested |
| Bhuvan NRSC | ⏸ Skipped | ✅ `extract_bhuvan_wms.py` written | ⏸ Blocked (corporate network) |
| JAXA Mangrove | ❌ Replaced by WorldCover | N/A | ✅ via WorldCover class 95 |
| NEER Flood Atlas | ⏸ Skipped | ⬜ `extract_neer.py` to write | ⏸ Email access needed |

---

## Known Data Quality Issues

| Source | Issue | Impact | Fix |
|---|---|---|---|
| GDW India dams | 6,769/7,097 (95%) have height=-99 (missing) | Can't filter by dam size | Use location for proximity; classify by type where available |
| GDW India dams | Only 361/7,097 have dam names | `upstream_dam_name` null for most | Acceptable — name is bonus, not core signal |
| EM-DAT loss | `emdat_flood_loss_cr` is blended flood+cyclone+earthquake per district | Loss not flood-specific | Update `process_emdat.py` to filter `disaster_type == "Flood"` only before summing |
| Aqueduct | Returns 0 (not null) for non-flood-zone pixels | Must treat 0 and null differently | Handled in `build_flood_risk_index.py` (0 = not in zone, not missing) |
| JRC GSW | Returns null for pixels never flooded (correct behavior) | null ≠ missing data | Handled in API response: `"ever_flooded": false` |

---

## Future / Backlog

### 1. NEER India Flood Atlas — 30m south India depth
- **What:** 30m riverine flood depth RP10/50/100/500 for TN, AP, TS, KA, KL, GA
- **Why skipped:** Email access needed; JRC covers same area at 90m
- **Contact:** support@neer.ai — "API Access Request — NEER India Flood Atlas (CC BY 4.0)"
- **Fields:** `neer_rp10_depth_m`, `neer_rp50_depth_m`, `neer_rp100_depth_m`, `neer_rp500_depth_m`
- **Script:** `scripts/extract_neer.py` (to write)

### 2. Bhuvan NRSC Flood Hazard — Govt classification 7 states
- **What:** Official hazard class (Very Low/Low/Moderate/High) for Bihar, Assam, AP, UP, WB, Odisha, Punjab
- **Why skipped:** WMS server blocked on corporate network; data is event-based not systematic
- **How:** Run `extract_bhuvan_wms.py` from home network or cloud VM
- **Fields:** `nrsc_hazard_class`, `nrsc_inundation_count`, `nrsc_observation_years`

### 3. EM-DAT flood-only loss
- **What:** Split blended disaster loss into flood-specific loss per district
- **How:** Filter `process_emdat.py` to `disaster_type == "Flood"` before aggregating loss
- **Impact:** `emdat_flood_loss_cr` becomes flood-accurate instead of blended
