# ESRI 10m Annual Land Cover — Full Research, Analysis & Implementation Plan

**Scope:** ESRI Land Cover (Impact Observatory / Sentinel-2) standalone API  
**Date of discussion:** 2026-07-23  
**Prepared by:** Sujeet Kumar (discussion with Claude Code)

---

## Table of Contents

1. [What Is This Data Source?](#1-what-is-this-data-source)
2. [Why ESRI Over ESA WorldCover — The Full Reasoning](#2-why-esri-over-esa-worldcover--the-full-reasoning)
3. [Sources Considered and Rejected](#3-sources-considered-and-rejected)
4. [All 9 Land Cover Classes — Full Detail](#4-all-9-land-cover-classes--full-detail)
5. [Native Resolution and Tile Structure](#5-native-resolution-and-tile-structure)
6. [Date Range, Update Frequency, and Staleness](#6-date-range-update-frequency-and-staleness)
7. [Accuracy — Per Source and Per Class](#7-accuracy--per-source-and-per-class)
8. [The Cloud / Monsoon Problem — Honest Assessment](#8-the-cloud--monsoon-problem--honest-assessment)
9. [What the Data Gives You — Raw vs Calculated](#9-what-the-data-gives-you--raw-vs-calculated)
10. [Insurance Usage — Is This Industry-Standard?](#10-insurance-usage--is-this-industry-standard)
11. [API Design — Endpoint, Inputs, Responses](#11-api-design--endpoint-inputs-responses)
12. [Pincode vs Lat/Long — Why They Return Different Things](#12-pincode-vs-latlong--why-they-return-different-things)
13. [Implementation Plan A — Pincode Path](#13-implementation-plan-a--pincode-path)
14. [Implementation Plan B — Lat/Long Path](#14-implementation-plan-b--latlong-path)
15. [Database Schema](#15-database-schema)
16. [Calculated Fields — Logic and Underwriting Rationale](#16-calculated-fields--logic-and-underwriting-rationale)

---

## 1. What Is This Data Source?

The starting point was a single field in the existing flood risk API:

```json
"land_cover": {
  "impervious_surface_pct": 48.2,
  "mangrove_cover_pct": 0,
  "note": "ESA WorldCover 2021 within 500m buffer"
}
```

The API showed only 2 of 11 available classes from ESA WorldCover 2021 — a 4-year-old static snapshot with no historical data and no planned annual updates. The goal: find a source that provides current, annual land cover data usable for insurance underwriting, and build a proper standalone API from it.

**ESRI 10m Annual Land Cover** is a global land use / land cover (LULC) time series produced by Impact Observatory and Microsoft, distributed by ESRI. It classifies every 10m pixel on Earth into one of 9 classes, once per year from 2017 through 2024 (updated annually).

- **Producer:** Impact Observatory + Microsoft + ESRI  
- **Sensor:** ESA Sentinel-2 (optical, multispectral)  
- **Resolution:** 10 metres per pixel — best available globally for a free annual product  
- **Coverage:** Global. India is fully covered.  
- **Years available:** 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024 (8 annual snapshots)  
- **License:** Free for commercial use via GEE and AWS Open Data  
- **GEE asset:** `projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS`  
- **AWS bucket:** `s3://io-lulc-annual-v02/`  

---

## 2. Why ESRI Over ESA WorldCover — The Full Reasoning

This was discussed at length. The decision was not obvious — ESA WorldCover is more accurate for some classes. Here is the full reasoning.

### ESA WorldCover — What it has

- 11 classes including an **explicit Mangrove class (code 95)** and **Herbaceous Wetland (code 90)**
- Uses **Sentinel-1 SAR + Sentinel-2 optical** fusion — SAR penetrates clouds, making it more accurate during monsoon
- **Built-up accuracy: 92.2% user accuracy** — highest among all free global products
- Validated independently by Wageningen University and IIASA
- Overall accuracy: **76.7% ± 0.5%**

### ESA WorldCover — The fatal problem

- Only **2 snapshots exist: 2020 (v1) and 2021 (v2)**
- ESA commissioned this as a science project under EOEP-5 (Earth Observation Envelope Programme 5), not as a commercial annual product. The mandate was to prove 10m global mapping was possible — deliver once, validate, publish.
- Annual updates were planned but have not been released as of mid-2025
- **The 2021 data is 4 years stale.** For rapidly urbanising India, a pincode that was 20% built-up in 2021 could be 50% built-up today. ESA cannot tell you that.
- **With 1–2 snapshots you cannot compute any trend.** For an underwriter, knowing that impervious surface is 48% today is far less valuable than knowing it grew from 5% to 48% in 7 years.

### ESRI — The key advantage

- **Annual data 2017–2024 = 8 snapshots per pincode/location**
- You can compute: urbanisation rate, cropland-to-concrete conversion, vegetation depletion trend, land use shifts
- These are **forward-looking signals** — what will flood risk look like in 3 years?
- Updated every year. The 2024 map was released in 2025.
- Overall accuracy: 75–85% (varies by study, self-assessed by Impact Observatory)

### The cloud / monsoon concern — and why it does not affect our use case

The cloud issue with ESRI (optical-only, no SAR) was raised. The key clarification: ESRI does NOT use a single image. It composites the **least cloudy scenes across all 12 months** using a class-weighted mode. India's monsoon is 4 months (June–September). The other 8 months are largely cloud-free. **Built-up areas — roads, buildings, concrete — are equally visible in December and July.** The monsoon cloud gap only affects seasonal features: crop classification during kharif season, temporary water bodies during floods. For our two primary use cases (impervious surface percentage, urbanisation trend), ESRI's annual composite is fully reliable.

### What we lose by dropping ESA WorldCover

- **Mangrove class** — ESRI has no mangrove class. Mangroves fall into "Trees" (code 2). We lose the coastal flood buffer signal. Decision: acceptable for this API since mangroves are slow-changing and ESA WorldCover 2021 data (already in DB) can continue to serve that one field in the flood risk composite API.
- **Wetland class** — ESRI merges wetlands into "Flooded vegetation". We lose the explicit wetland distinction.
- **SAR-backed monsoon accuracy** — we trade this for 8 years of trend data. Acceptable trade for built-up classification.

### Summary table

| Criterion | ESA WorldCover | ESRI Land Cover | Winner |
|---|---|---|---|
| Years of data | 2 (2020, 2021) | 8 (2017–2024) | **ESRI** |
| Latest data | 2021 (4yr stale) | 2024 (current) | **ESRI** |
| Trend analysis | Impossible | Core feature | **ESRI** |
| Built-up accuracy | 92.2% | ~80% | ESA |
| Mangrove class | Yes (explicit) | No | ESA |
| Wetland class | Yes (explicit) | Merged | ESA |
| Monsoon accuracy (built-up) | SAR — superior | Composited — sufficient | ESA |
| Annual updates | No | Yes | **ESRI** |
| Free license | Yes | Yes | Tie |
| **For insurance underwriting** | Static snapshot only | **Trend + current** | **ESRI** |

---

## 3. Sources Considered and Rejected

| Source | Resolution | Years | Why Rejected |
|---|---|---|---|
| **ESA WorldCover v200** | 10m | 2020, 2021 only | No trend data; 4-year stale; no annual update |
| **Dynamic World (Google)** | 10m | 2015–present (weekly) | Noisy; designed for change detection not area stats; 72% accuracy |
| **NLSMA / ISRO Bhuvan** | 30–50m | ~5yr cycle | India-specific but 3–5× coarser resolution; updated every 5 years |
| **MapBiomas India** | 30m | 2000–2023 | Good for long trends but 30m is 9× coarser than ESRI; India coverage incomplete |
| **GHSL Built-up Surface (EU JRC)** | 10m | 1975–2030 (5yr intervals) | Optical only (same cloud issue); 5-year intervals not annual; built-up only, not all classes |

**Decision:** ESRI Land Cover is the only free, global, 10m, annual product covering 2017–2024 with all relevant land cover classes for insurance underwriting.

---

## 4. All 9 Land Cover Classes — Full Detail

| Code | Class Name | What it Includes | Insurance Relevance |
|---|---|---|---|
| 1 | **Water** | Permanent rivers, lakes, reservoirs, coastal water. Excludes seasonal floods. | Proximity to permanent water = baseline flood exposure |
| 2 | **Trees** | Tall dense vegetation ≥15ft. Closed canopy forest, plantations, urban trees. Includes mangroves — they are NOT separated. | Natural runoff interception; fire risk for property |
| 3 | **Grass** | Open grassland, savannas, meadows. Not cropland. | Low impervious surface; moderate infiltration |
| 4 | **Flooded Vegetation** | Any vegetation with intermixed water for majority of year. Seasonal marshes, floodplains, rice paddies during monsoon. | Strong flood signal — land that floods regularly |
| 5 | **Crops** | Cereal crops, vegetables, orchards, plantations. Excludes fallow land (classified as bare/grass). | Agricultural insurance; cropland-to-urban conversion tracking |
| 6 | **Scrub / Shrub** | Low sparse vegetation, bushland, heathland. | Moderate absorption; fire risk in dry regions |
| 7 | **Built Area** | Buildings, roads, industrial surfaces, parking lots. Major homogeneous impervious surfaces. | Primary flood risk amplifier — reduces infiltration, increases runoff |
| 8 | **Bare Ground** | Exposed soil, rock, desert, dry riverbeds, construction sites. | High runoff; erosion risk |
| 9 | **Snow / Ice** | Permanent glaciers, snowfields. | Not relevant for India insurance |

**Note:** No Mangrove class. No explicit Wetland class (absorbed into Flooded Vegetation). These are the two losses versus ESA WorldCover.

---

## 5. Native Resolution and Tile Structure

- **Native pixel size:** 10m × 10m (0.00008983° at equator)
- **Tile grid:** Sentinel-2 MGRS (Military Grid Reference System). Each tile = **110km × 110km = 10,980 × 10,980 pixels**
- **Projection:** UTM per tile, mosaicked to WGS84 for distribution
- **File format:** Cloud-Optimised GeoTIFF (COG) — supports windowed reads without downloading the full tile
- **India coverage:** Approximately 50–60 Sentinel-2 tiles. Each tile = ~1.2 GB at 10m resolution. Total India = ~60–70 GB per year × 8 years = ~500 GB for the full time series (not needed — see implementation plan)

**Key implication for lat/lon lookups:** The native pixel is 10m × 10m. A lat/lon query reads exactly 1 pixel (the 10m square at that coordinate). No buffer needed. This is identical in approach to how MERIT Hydro TIF files are sampled — `rasterio.windows.Window(col, row, 1, 1)`. The pixel at the exact coordinate is the answer.

---

## 6. Date Range, Update Frequency, and Staleness

| Year | Status | Notes |
|---|---|---|
| 2017 | Available | Earliest in series |
| 2018 | Available | |
| 2019 | Available | |
| 2020 | Available | |
| 2021 | Available | Comparable to ESA WorldCover reference year |
| 2022 | Available | |
| 2023 | Available | |
| 2024 | Available | Most recent as of mid-2025 |
| 2025 | Expected ~early 2026 | Annual cadence |

**Update model:** Impact Observatory produces a new annual map each year. Access via GEE and AWS stays current. No manual intervention needed to get new years — re-running the extraction script picks up any new year added to the collection.

**Staleness risk:** Unlike ESA WorldCover which has an unknown update schedule, ESRI/Impact Observatory has delivered every year since 2017 without a gap. The commercial model (ESRI partnership, AWS hosting, annual subscription products) creates an economic incentive to maintain the annual cadence. Low staleness risk.

---

## 7. Accuracy — Per Source and Per Class

### Overall accuracy (global validation)

| Source | Overall Accuracy | Validation Body |
|---|---|---|
| ESRI Land Cover | 75–85% (85% self-reported; 75% independent study) | Impact Observatory (self); PNNL independent comparison |
| ESA WorldCover | 76.7% ± 0.5% | Wageningen University + IIASA (independent) |
| Dynamic World | 72% | Google/independent |

### Per-class notes (ESRI)

- **Built Area:** ~80%. ESRI over-counts built area — urban parks and lawns (vegetated but inside city) are sometimes classified as built area. Contrast: ESA WorldCover gets 92.2% for built-up because its SAR component distinguishes rough surfaces (rooftops) from smooth (grass).
- **Crops:** High accuracy (~85%) in most regions. India-specific issue: fallow fields are classified as bare ground rather than crops.
- **Flooded Vegetation:** Moderate accuracy. Seasonal variation makes this noisy. The max-across-years signal is more reliable than any single year.
- **Trees:** High globally. Mangroves are merged in — coastal "trees" in Sundarbans may be mangroves but we cannot distinguish.
- **Water:** High (~90%+). Permanent water bodies are well-detected optically.

### India-specific accuracy note

No published India-specific accuracy report exists for ESRI Land Cover as of mid-2025. The 75–85% figure is global. India's diversity (dense monsoon vegetation in Kerala vs Thar desert vs Himalayan mixed forests) means per-region accuracy varies. For built-up in Tier-1 city pincodes (Mumbai, Bangalore, Delhi), accuracy is likely 85%+. For mixed peri-urban areas, lower.

---

## 8. The Cloud / Monsoon Problem — Honest Assessment

### What ESRI does

ESRI does not use a single Sentinel-2 scene. The methodology:
1. Collect all Sentinel-2 scenes for a given tile across the full calendar year
2. Select the least-cloudy scenes across the 12 months
3. Run the deep learning model on each cloud-free scene → per-scene class predictions
4. Combine all predictions using a **class-weighted mode** (majority vote weighted by confidence)
5. Output: one classification per pixel per year

### Why this handles India's monsoon for built-up

India's monsoon (June–September) = 4 months. Clear-sky period (October–May) = 8 months. A building in Mumbai visible in December looks identical in December as it does in July. ESRI's composite will use October–May imagery to classify built-up pixels. A concrete building does not become a tree during monsoon.

**The monsoon issue is real for:**
- Seasonal water bodies (rivers swell during monsoon — may be classified as water in monsoon scenes, bare ground in dry season)
- Kharif crops (rice, cotton, soybean — grown during monsoon; ESRI's composite may under-represent them as the crop-growth period is exactly when cloud cover is highest)
- Temporary flooding — ESRI's annual composite cannot capture an event that lasts 2 weeks

**The monsoon issue is NOT relevant for:**
- Built area (permanent structures, year-round)
- Trees (perennial canopy, year-round)
- Bare ground (mostly visible in dry months anyway)
- Permanent water bodies

**Conclusion for our API:** The two primary signals we need — current built-up percentage and urbanisation trend — are unaffected by the monsoon cloud gap. We accept the limitation for flooded vegetation and seasonal crop accuracy, and document it clearly.

---

## 9. What the Data Gives You — Raw vs Calculated

### Raw (per year, per location)

For each year 2017–2024, at each pincode centroid or lat/lon point, we have:

**Pincode path (500m buffer zonal stats — area percentages):**
```
built_area_pct, trees_pct, crops_pct, water_pct,
flooded_vegetation_pct, grass_pct, scrub_shrub_pct, bare_ground_pct
```
All values sum to ~100%. Computed once via GEE, stored in DB.

**Lat/lon path (single 10m pixel — class code):**
```
class_code  (integer 1–9)
class_name  (string label)
```
One dominant class per year per point. Computed in real-time from local TIF files.

### Calculated (derived, computed at load time for pincode; at query time for lat/lon)

See Section 16 for full logic. Summary:

| Field | Type | Computed from |
|---|---|---|
| `urban_growth_rate_pct_per_yr` | Float | Linear regression on built_area_pct 2017–2024 |
| `urban_growth_class` | String | Rapid / Moderate / Stable / Declining |
| `built_area_change_pct` | Float | built_area 2024 minus built_area 2017 |
| `tree_cover_change_pct` | Float | trees 2024 minus trees 2017 |
| `greenery_loss_pct` | Float | (trees+grass) 2017 minus (trees+grass) 2024 |
| `cropland_change_pct` | Float | crops 2024 minus crops 2017 |
| `cropland_to_urban_pct` | Float | cropland lost where built-up gained simultaneously |
| `flooded_vegetation_max_pct` | Float | Max flooded_vegetation_pct across all years |
| `flooded_vegetation_trend` | String | Increasing / Stable / Decreasing |
| `dominant_use_2017` | String | Class with highest % in 2017 |
| `dominant_use_2024` | String | Class with highest % in 2024 |
| `land_use_shifted` | Boolean | Did dominant class change between 2017 and 2024? |
| `transition` | String | lat/lon only: e.g. "crops → built_area" |
| `transition_year` | Integer | lat/lon only: first year dominant class changed |

---

## 10. Insurance Usage — Is This Industry-Standard?

Yes. Land cover data at this class of resolution is actively used in insurance across three categories:

### Urban flood underwriting

Built-up percentage (impervious surface) is the primary input to runoff models. More concrete = less soil absorption = faster and higher flooding for the same rainfall event. The **urbanisation rate** (how fast built-up is growing) is a forward-looking risk signal: a pincode growing at 5% per year will have significantly higher flood risk in 5 years than its current built-up percentage suggests.

Catastrophe model vendors (RMS, Verisk AIR, Karen Clark & Company) use land cover as an exposure layer in their India flood models. They use proprietary 5m imagery internally; ESRI 10m is the best publicly available equivalent.

### Agricultural / crop insurance

Crops class identifies agricultural land. Cropland-to-built-up conversion rate identifies pincodes where farmland is being urbanised — relevant for portfolio monitoring (declining agri exposure in a region the insurer has written crop policies for).

### Property and infrastructure insurance

Flooded vegetation class identifies land that experiences regular seasonal inundation — a direct indicator of flood-prone areas not captured by static elevation models. A property built on land that was flooded vegetation 3 years ago has systematically higher flood risk than elevation alone suggests.

### Industry context for India

ESRI India explicitly markets ArcGIS (which uses this same LULC dataset) to Indian insurance companies for underwriting territory design, exposure mapping, and claims investigation. The IRDAI (Insurance Regulatory and Development Authority of India) has encouraged the use of geospatial data for catastrophe risk pricing since 2022.

---

## 11. API Design — Endpoint, Inputs, Responses

### Endpoint

```
GET /api/environmental/land-cover
```

### Request parameters

| Parameter | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `pincode` | string | Either pincode OR lat+lon | 6-digit, format `[1-9][0-9]{5}` | Returns area-level percentages from DB |
| `lat` | number | Either pincode OR lat+lon | 6.0 – 38.0 | India bounding box |
| `lon` | number | Either pincode OR lat+lon | 67.0 – 98.0 | India bounding box |

Authentication: `x-api-key` header (same as all other APIs).

### Response — Pincode path

```json
GET /api/environmental/land-cover?pincode=400001

{
  "success": true,
  "input": {
    "type": "pincode",
    "pincode": "400001",
    "lat": 18.9322,
    "lon": 72.8347
  },

  "land_cover": {

    "source": {
      "history": [
        {
          "year": 2017,
          "built_area_pct": 12.3,
          "trees_pct": 22.1,
          "crops_pct": 41.5,
          "water_pct": 0.5,
          "flooded_vegetation_pct": 0.2,
          "grass_pct": 14.2,
          "scrub_shrub_pct": 8.1,
          "bare_ground_pct": 1.1
        },
        { "year": 2018, "built_area_pct": 17.8, "trees_pct": 19.4, "crops_pct": 37.0, "water_pct": 0.5, "flooded_vegetation_pct": 0.4, "grass_pct": 14.9, "scrub_shrub_pct": 7.6, "bare_ground_pct": 2.4 },
        { "year": 2019, "built_area_pct": 24.4, "trees_pct": 17.2, "crops_pct": 31.0, "water_pct": 0.5, "flooded_vegetation_pct": 0.8, "grass_pct": 16.5, "scrub_shrub_pct": 7.8, "bare_ground_pct": 1.8 },
        { "year": 2020, "built_area_pct": 31.0, "trees_pct": 14.8, "crops_pct": 25.0, "water_pct": 0.5, "flooded_vegetation_pct": 1.2, "grass_pct": 17.0, "scrub_shrub_pct": 8.5, "bare_ground_pct": 2.0 },
        { "year": 2021, "built_area_pct": 37.5, "trees_pct": 12.1, "crops_pct": 19.8, "water_pct": 0.5, "flooded_vegetation_pct": 2.0, "grass_pct": 18.0, "scrub_shrub_pct": 7.5, "bare_ground_pct": 2.6 },
        { "year": 2022, "built_area_pct": 41.2, "trees_pct": 10.4, "crops_pct": 16.5, "water_pct": 0.5, "flooded_vegetation_pct": 2.8, "grass_pct": 18.5, "scrub_shrub_pct": 7.5, "bare_ground_pct": 2.6 },
        { "year": 2023, "built_area_pct": 45.7, "trees_pct": 9.1,  "crops_pct": 14.8, "water_pct": 0.5, "flooded_vegetation_pct": 3.1, "grass_pct": 17.5, "scrub_shrub_pct": 6.8, "bare_ground_pct": 2.5 },
        { "year": 2024, "built_area_pct": 48.2, "trees_pct": 8.3,  "crops_pct": 14.0, "water_pct": 0.5, "flooded_vegetation_pct": 3.1, "grass_pct": 16.2, "scrub_shrub_pct": 6.1, "bare_ground_pct": 3.6 }
      ]
    },

    "calculated": {
      "urban_growth_rate_pct_per_yr":  5.1,
      "urban_growth_class":            "rapid",
      "built_area_change_pct":         35.9,
      "tree_cover_change_pct":        -13.8,
      "greenery_loss_pct":            -17.0,
      "cropland_change_pct":          -27.5,
      "cropland_to_urban_pct":         27.5,
      "flooded_vegetation_max_pct":    3.1,
      "flooded_vegetation_trend":      "increasing",
      "dominant_use_2017":             "crops",
      "dominant_use_2024":             "built_area",
      "land_use_shifted":              true
    }

  },

  "meta": {
    "data_source":    "ESRI 10m Annual Land Cover — Impact Observatory / Sentinel-2",
    "resolution_m":   10,
    "buffer_m":       500,
    "years_covered":  "2017–2024",
    "accuracy_pct":   75,
    "license":        "CC-BY-4.0 (commercial use permitted)",
    "latency_ms":     12
  }
}
```

### Response — Lat/Long path

```json
GET /api/environmental/land-cover?lat=18.9322&lon=72.8347

{
  "success": true,
  "input": {
    "type": "latlon",
    "lat": 18.9322,
    "lon": 72.8347
  },

  "land_cover": {

    "source": {
      "note": "Single 10m pixel at exact coordinate. No buffer averaging.",
      "history": [
        { "year": 2017, "class_code": 5, "class_name": "crops" },
        { "year": 2018, "class_code": 5, "class_name": "crops" },
        { "year": 2019, "class_code": 5, "class_name": "crops" },
        { "year": 2020, "class_code": 7, "class_name": "built_area" },
        { "year": 2021, "class_code": 7, "class_name": "built_area" },
        { "year": 2022, "class_code": 7, "class_name": "built_area" },
        { "year": 2023, "class_code": 7, "class_name": "built_area" },
        { "year": 2024, "class_code": 7, "class_name": "built_area" }
      ]
    },

    "calculated": {
      "current_class":      "built_area",
      "transition":         "crops → built_area",
      "transition_year":    2020,
      "years_as_built":     5,
      "years_unchanged":    3
    }

  },

  "meta": {
    "data_source":    "ESRI 10m Annual Land Cover — Impact Observatory / Sentinel-2",
    "resolution_m":   10,
    "note":           "Point lookup — single pixel. For area-level composition use pincode input.",
    "years_covered":  "2017–2024",
    "accuracy_pct":   75,
    "license":        "CC-BY-4.0 (commercial use permitted)",
    "latency_ms":     95
  }
}
```

---

## 12. Pincode vs Lat/Long — Why They Return Different Things

This is a deliberate design decision, not a limitation.

### Pincode → percentages (area composition)

A pincode is an area, not a point. Querying by pincode means: "tell me about this geographic zone." The right answer is a statistical summary: what fraction of the 500m neighbourhood around the centroid is built-up, forested, farmed, etc. This requires **zonal statistics** (counting pixels of each class within a buffer).

- Buffer: 500m radius around pincode centroid
- Why 500m: consistent with other data sources in the platform (WorldCover, HAND terrain buffer)
- Pre-computed via GEE, stored in DB
- Returns percentage composition across all 9 classes × 8 years

**Limitation acknowledged:** A large rural pincode (covering 50–100km) has a centroid that may not represent the actual queried location. This is a pincode data problem, not a land cover problem. Users should use lat/lon for precise location queries.

### Lat/Long → single pixel (point classification)

A lat/lon coordinate is an exact point. At 10m resolution, that point falls within a single 10m × 10m pixel. The right answer is: what is the land cover at that precise location?

- Reads the single pixel at the coordinate from local TIF files (identical to MERIT Hydro approach)
- Returns one class per year — not percentages
- More precise for exact location queries
- Cannot return percentages without choosing an arbitrary buffer — which the user should not need for a point query

**Why not nearest-pincode for lat/lon:** A pincode can span 100km. Serving centroid data for an arbitrary lat/lon within a large pincode would be wrong — the actual land cover at the coordinate could be completely different from the centroid's neighbourhood. Direct pixel read from TIF is correct.

---

## 13. Implementation Plan A — Pincode Path

### Overview

Extract ESRI land cover class percentages for all ~19,000 Indian pincodes via Google Earth Engine, store in a new DB table, serve from DB at query time.

### Step 1 — GEE extraction script

**File:** `scripts/extract_esri_land_cover.py`

**Approach:** For each year 2017–2024, load the ESRI ImageCollection, filter to that year, take the mosaic for India. For each pincode batch, compute zonal statistics: what fraction of pixels within a 500m buffer around the centroid belong to each class. Results: one row per (pincode, year), 8 columns of percentages.

```python
"""
Extract ESRI 10m Annual Land Cover class percentages for all Indian pincodes via GEE.

For each pincode, for each year 2017–2024:
  - Buffer 500m around centroid
  - Count pixels per class (1–9) using reduceRegions
  - Store as percentage of total pixels in buffer

Output: data/output/esri_land_cover.csv
Columns: pincode, year, built_area_pct, trees_pct, crops_pct, water_pct,
         flooded_veg_pct, grass_pct, scrub_shrub_pct, bare_ground_pct
"""

import ee
import json
import os
import pandas as pd
import time

KEY_FILE    = os.environ.get("GEE_KEY_FILE", "gee-key.json")
PROJECT     = os.environ.get("GEE_PROJECT", "insuretech-data-platform")
PINCODE_CSV = "data/output/pincode_coords.csv"
OUTPUT_CSV  = "data/output/esri_land_cover.csv"
BATCH_SIZE  = 200
SCALE       = 10        # ESRI native 10m
BUFFER_M    = 500
YEARS       = list(range(2017, 2025))

GEE_ASSET   = "projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS"

CLASS_MAP = {
    1: "water",
    2: "trees",
    3: "grass",
    4: "flooded_veg",
    5: "crops",
    6: "scrub_shrub",
    7: "built_area",
    8: "bare_ground",
    9: "snow_ice",
}

def init_gee():
    with open(KEY_FILE) as f:
        key = json.load(f)
    creds = ee.ServiceAccountCredentials(email=key["client_email"], key_file=KEY_FILE)
    ee.Initialize(credentials=creds, project=PROJECT)

def get_year_image(collection, year):
    return (
        collection
        .filter(ee.Filter.calendarRange(year, year, "year"))
        .mosaic()
        .select("b1")  # single classification band
    )

def extract_batch(image, rows, year):
    features = [
        ee.Feature(
            ee.Geometry.Point([float(r["lng"]), float(r["lat"])]).buffer(BUFFER_M),
            {"pincode": str(int(r["pincode"]))}
        )
        for _, r in rows.iterrows()
    ]
    fc = ee.FeatureCollection(features)

    # For each class, compute fraction of pixels in buffer
    results_by_class = {}
    for code, name in CLASS_MAP.items():
        masked = image.eq(code).rename([name])
        reduced = masked.reduceRegions(
            collection=fc, reducer=ee.Reducer.mean(), scale=SCALE
        )
        for feat in reduced.getInfo()["features"]:
            pc = feat["properties"]["pincode"]
            results_by_class.setdefault(pc, {})[name] = round(
                float(feat["properties"].get(name) or 0) * 100, 2
            )

    rows_out = []
    for pc, classes in results_by_class.items():
        rows_out.append({
            "pincode": pc,
            "year": year,
            **{f"{name}_pct": classes.get(name, 0.0) for name in CLASS_MAP.values()},
        })
    return rows_out
```

**Runtime estimate:** 8 years × 19,000 pincodes / 200 per batch = 760 batches. ~5 min per batch (GEE zonal stats are slower than point sampling). **Total: ~60 hours.** Must run unattended with resume support (checkpoint after each year).

**Optimisation:** Process one year at a time. Save each year's CSV before moving to next. Batch size 200 is conservative — can try 300 if GEE quota permits.

### Step 2 — Compute calculated fields

**File:** `scripts/compute_land_cover_trends.py`

After extraction, run a post-processing script that:
1. Pivots the CSV from long format (row per pincode+year) to wide format (row per pincode, year as column prefix)
2. Computes all calculated fields using numpy (linear regression for growth rate, delta for changes)
3. Outputs: `data/output/esri_land_cover_with_trends.csv`

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data/output/esri_land_cover.csv")

# Pivot: one row per pincode, columns like built_area_2017_pct, built_area_2018_pct ...
wide = df.pivot(index="pincode", columns="year",
                values=[c for c in df.columns if c.endswith("_pct")])
wide.columns = [f"{band}_{yr}" for band, yr in wide.columns]
wide = wide.reset_index()

YEARS = list(range(2017, 2025))
X = np.array(YEARS, dtype=float)
X_norm = X - X.mean()

def slope(values):
    valid = [(x, y) for x, y in zip(X_norm, values) if y is not None and not np.isnan(y)]
    if len(valid) < 4:
        return None
    xs, ys = zip(*valid)
    return float(np.polyfit(xs, ys, 1)[0])

# Urban growth rate
wide["urban_growth_rate_pct_per_yr"] = wide.apply(
    lambda r: slope([r.get(f"built_area_pct_{y}") for y in YEARS]), axis=1
)
wide["urban_growth_class"] = wide["urban_growth_rate_pct_per_yr"].apply(
    lambda v: "rapid" if v and v > 3 else ("moderate" if v and v > 1 else
              ("declining" if v and v < -1 else "stable"))
)
wide["built_area_change_pct"] = wide["built_area_pct_2024"] - wide["built_area_pct_2017"]
wide["tree_cover_change_pct"] = wide["trees_pct_2024"] - wide["trees_pct_2017"]
wide["greenery_loss_pct"] = (
    (wide["trees_pct_2017"] + wide["grass_pct_2017"]) -
    (wide["trees_pct_2024"] + wide["grass_pct_2024"])
)
wide["cropland_change_pct"] = wide["crops_pct_2024"] - wide["crops_pct_2017"]
wide["flooded_veg_max_pct"] = wide[[f"flooded_veg_pct_{y}" for y in YEARS]].max(axis=1)

# Flooded veg trend
fv_slopes = wide.apply(
    lambda r: slope([r.get(f"flooded_veg_pct_{y}") for y in YEARS]), axis=1
)
wide["flooded_vegetation_trend"] = fv_slopes.apply(
    lambda v: "increasing" if v and v > 0.1 else ("decreasing" if v and v < -0.1 else "stable")
)

# Dominant use
def dominant(r, suffix):
    classes = ["built_area", "trees", "crops", "water", "flooded_veg",
               "grass", "scrub_shrub", "bare_ground"]
    vals = {c: r.get(f"{c}_pct_{suffix}", 0) for c in classes}
    return max(vals, key=vals.get)

wide["dominant_use_2017"] = wide.apply(lambda r: dominant(r, "2017"), axis=1)
wide["dominant_use_2024"] = wide.apply(lambda r: dominant(r, "2024"), axis=1)
wide["land_use_shifted"] = wide["dominant_use_2017"] != wide["dominant_use_2024"]

wide.to_csv("data/output/esri_land_cover_with_trends.csv", index=False)
```

### Step 3 — DB load script

**File:** `scripts/load_esri_land_cover.py`

Standard Neon/Drizzle insert. Reads `esri_land_cover_with_trends.csv`, upserts into `pincode_land_cover` table. Identical pattern to `load_merit_hydro_pincodes.py`.

### Step 4 — API route

**File:** `src/app/api/environmental/land-cover/route.ts`

Follows exact pattern of `src/app/api/environmental/terrain/route.ts`:
- Auth check (`x-api-key` header)
- Parse `pincode` or `lat+lon` from query params
- Pincode path → `db.select().from(pincodeLandCover).where(eq(pincodeLandCover.pincode, pincode))`
- Lat/lon path → call raster service (see Plan B)
- Format and return JSON

---

## 14. Implementation Plan B — Lat/Long Path

### Overview

For lat/lon input, read the single 10m pixel from local TIF files in real-time using `rasterio`. Identical architecture to MERIT Hydro's TIF-based lookup. The raster service is an existing pattern (`RASTER_SERVICE_URL` env var) — we add a new `/land-cover` endpoint to it.

### Why TIF files, not live GEE

GEE adds 2–5 seconds of latency per query and has daily quota limits. For a production API serving many requests, GEE is not viable for real-time per-request calls. MERIT Hydro already solved this by downloading TIF files to the server and reading them locally. Same approach here.

### TIF files needed

One TIF per year for the India region. Options:

**Option A — Download from AWS S3 (preferred):**
ESRI/Impact Observatory publishes the full dataset on AWS Open Data at `s3://io-lulc-annual-v02/`. Download India-covering Sentinel-2 tiles and merge into a single India mosaic per year.

```bash
# Download India tiles for all years (example for 2024)
aws s3 sync s3://io-lulc-annual-v02/v02/2024/ ./data/esri_tiles/2024/ \
  --no-sign-request \
  --exclude "*" \
  --include "44P*" --include "44Q*" --include "44R*"  # India MGRS tile codes
# Merge tiles into single India GeoTIFF
gdal_merge.py -o data/esri_tifs/india_lulc_2024.tif data/esri_tiles/2024/*.tif
```

**Option B — Export from GEE:**
Use GEE to export India-clipped mosaics to Google Drive, download from there. One export job per year. Slower to set up but no AWS CLI needed.

**Storage:** 8 TIF files (2017–2024), one per year. Each India mosaic at 10m ≈ 3–4 GB (India is ~3.3M km² ÷ (0.01km²/pixel) = 330M pixels, 1 byte per pixel = ~330 MB compressed). Total: ~3 GB for all 8 years.

### The pixel read — identical to MERIT Hydro

```python
# scripts/land_cover_raster_service.py  (add endpoint to existing raster service)
import rasterio
import numpy as np
from pathlib import Path

TIF_DIR = Path("data/esri_tifs")
YEARS   = list(range(2017, 2025))

CLASS_NAMES = {
    1: "water", 2: "trees", 3: "grass", 4: "flooded_vegetation",
    5: "crops", 6: "scrub_shrub", 7: "built_area", 8: "bare_ground", 9: "snow_ice"
}

def lookup_latlon(lat: float, lon: float) -> dict:
    history = []
    for year in YEARS:
        tif_path = TIF_DIR / f"india_lulc_{year}.tif"
        if not tif_path.exists():
            continue
        with rasterio.open(tif_path) as ds:
            row, col = ds.index(lon, lat)
            window = rasterio.windows.Window(col, row, 1, 1)  # 1 pixel — identical to MERIT
            val = int(ds.read(1, window=window)[0, 0])
            nodata = ds.nodata
            if nodata is not None and val == nodata:
                val = None
        history.append({
            "year": year,
            "class_code": val,
            "class_name": CLASS_NAMES.get(val) if val else None,
        })

    # Compute transition
    first_class = next((h["class_name"] for h in history if h["class_name"]), None)
    last_class  = next((h["class_name"] for h in reversed(history) if h["class_name"]), None)
    transition_year = None
    if first_class != last_class:
        for h in history:
            if h["class_name"] and h["class_name"] != first_class:
                transition_year = h["year"]
                break

    built_years = sum(1 for h in history if h["class_name"] == "built_area")

    return {
        "source": {
            "note": "Single 10m pixel at exact coordinate.",
            "history": history,
        },
        "calculated": {
            "current_class":    last_class,
            "transition":       f"{first_class} → {last_class}" if first_class != last_class else None,
            "transition_year":  transition_year,
            "years_as_built":   built_years,
            "years_unchanged":  len(history) - (1 if transition_year else 0),
        },
    }
```

### Latency

Each TIF read: `rasterio` windowed read of 1 pixel ≈ 1–3ms per year. 8 years = 8 reads = **8–24ms total**. If files are memory-mapped (keep dataset handles open across requests), drops to sub-millisecond. Total response latency including network: **<100ms**.

### Route integration

In `src/app/api/environmental/land-cover/route.ts`, the lat/lon path calls:

```typescript
const res = await fetch(
  `${process.env.RASTER_SERVICE_URL}/land-cover?lat=${lat}&lon=${lon}`,
  { signal: AbortSignal.timeout(15_000) }
)
```

Exact same pattern as the terrain route's lat/lon path. No changes needed to the Next.js API layer beyond adding the route file.

---

## 15. Database Schema

```typescript
// In src/lib/db/schema.ts

export const pincodeLandCover = pgTable(
  'pincode_land_cover',
  {
    pincode: varchar('pincode', { length: 6 }).primaryKey(),
    lat:     decimal('lat', { precision: 9, scale: 6 }),
    lon:     decimal('lon', { precision: 9, scale: 6 }),

    // ── Raw: 8 years × 8 classes = 64 columns ──────────────────────────────
    // 2017
    builtArea2017Pct:     decimal('built_area_2017_pct',     { precision: 5, scale: 2 }),
    trees2017Pct:         decimal('trees_2017_pct',          { precision: 5, scale: 2 }),
    crops2017Pct:         decimal('crops_2017_pct',          { precision: 5, scale: 2 }),
    water2017Pct:         decimal('water_2017_pct',          { precision: 5, scale: 2 }),
    floodedVeg2017Pct:    decimal('flooded_veg_2017_pct',    { precision: 5, scale: 2 }),
    grass2017Pct:         decimal('grass_2017_pct',          { precision: 5, scale: 2 }),
    scrubShrub2017Pct:    decimal('scrub_shrub_2017_pct',    { precision: 5, scale: 2 }),
    bareGround2017Pct:    decimal('bare_ground_2017_pct',    { precision: 5, scale: 2 }),
    // 2018 ... 2023 (same 8 columns per year — 48 more columns)
    // 2024
    builtArea2024Pct:     decimal('built_area_2024_pct',     { precision: 5, scale: 2 }),
    trees2024Pct:         decimal('trees_2024_pct',          { precision: 5, scale: 2 }),
    crops2024Pct:         decimal('crops_2024_pct',          { precision: 5, scale: 2 }),
    water2024Pct:         decimal('water_2024_pct',          { precision: 5, scale: 2 }),
    floodedVeg2024Pct:    decimal('flooded_veg_2024_pct',    { precision: 5, scale: 2 }),
    grass2024Pct:         decimal('grass_2024_pct',          { precision: 5, scale: 2 }),
    scrubShrub2024Pct:    decimal('scrub_shrub_2024_pct',    { precision: 5, scale: 2 }),
    bareGround2024Pct:    decimal('bare_ground_2024_pct',    { precision: 5, scale: 2 }),

    // ── Calculated: precomputed at load time ───────────────────────────────
    urbanGrowthRatePctPerYr:  decimal('urban_growth_rate_pct_per_yr', { precision: 5, scale: 2 }),
    urbanGrowthClass:          text('urban_growth_class'),      // rapid/moderate/stable/declining
    builtAreaChangePct:        decimal('built_area_change_pct', { precision: 5, scale: 2 }),
    treeCoverChangePct:        decimal('tree_cover_change_pct', { precision: 5, scale: 2 }),
    greeneryLossPct:           decimal('greenery_loss_pct',     { precision: 5, scale: 2 }),
    croplandChangePct:         decimal('cropland_change_pct',   { precision: 5, scale: 2 }),
    croplandToUrbanPct:        decimal('cropland_to_urban_pct', { precision: 5, scale: 2 }),
    floodedVegMaxPct:          decimal('flooded_veg_max_pct',   { precision: 5, scale: 2 }),
    floodedVegetationTrend:    text('flooded_vegetation_trend'), // increasing/stable/decreasing
    dominantUse2017:           text('dominant_use_2017'),
    dominantUse2024:           text('dominant_use_2024'),
    landUseShifted:            boolean('land_use_shifted'),

    dataAsOfDate: text('data_as_of_date'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    latLonIdx: index('idx_plc_lat_lon').on(t.lat, t.lon),
  })
)
```

**Row count:** ~19,000 rows (one per Indian pincode)  
**Column count:** 80 (64 raw + 14 calculated + 2 coords + metadata)  
**Storage:** ~19,000 rows × 80 columns × ~8 bytes avg = ~12 MB. Negligible.

---

## 16. Calculated Fields — Logic and Underwriting Rationale

### `urban_growth_rate_pct_per_yr`

**Logic:** Fit a linear regression through the 8 annual `built_area_pct` values (2017–2024). The slope (percentage points per year) is the urban growth rate.

**Underwriting rationale:** A pincode at 50% built-up that got there in 2 years (slope = 10%/yr) has severely underdeveloped drainage infrastructure relative to its current imperviousness. Roads were not designed for this runoff volume. A pincode stable at 50% for 20 years has infrastructure that has adapted. Same snapshot value, different forward-looking risk.

### `urban_growth_class`

- `rapid` → slope > 3%/yr — underwriting flag: escalating risk, may need annual policy re-rating
- `moderate` → 1–3%/yr — monitor; standard pricing
- `stable` → −1 to 1%/yr — no trend signal; use current built-up as given
- `declining` → slope < −1%/yr — area depopulating or being de-densified

### `built_area_change_pct`

**Logic:** `built_area_pct_2024 − built_area_pct_2017` (absolute delta, percentage points).

**Underwriting rationale:** Simple explainable metric. "This pincode added 35 percentage points of impervious surface in 7 years" is a clear risk communication to an underwriter or reinsurer.

### `tree_cover_change_pct`

**Logic:** `trees_pct_2024 − trees_pct_2017`. Negative means deforestation.

**Underwriting rationale:** Trees intercept rainfall and slow runoff. Loss of tree cover increases both flood peak flow and soil erosion risk. A hillside pincode that lost 20% tree cover is significantly more prone to landslides and flash floods than 7 years ago.

### `greenery_loss_pct`

**Logic:** `(trees + grass)_2017 − (trees + grass)_2024`. Total natural infiltration capacity lost.

**Underwriting rationale:** Both trees and grass provide soil absorption. Greenery loss is a composite indicator of natural flood buffer degradation. More specific than tree cover alone.

### `cropland_change_pct`

**Logic:** `crops_pct_2024 − crops_pct_2017`.

**Underwriting rationale:** Direct indicator for agricultural portfolio monitoring. If a region has seen 30% cropland loss, agri insurance exposure in that region is declining — relevant for portfolio rebalancing. Also: cropland converted to built-up is the primary source of urbanisation in peri-urban India.

### `cropland_to_urban_pct`

**Logic:** Min of (cropland decrease, built-up increase) — the overlap where both trends moved in the same direction. Positive = farmland converted to concrete.

**Underwriting rationale:** Farmland conversion to urban use is the single largest driver of flood risk increase in Indian tier-2/tier-3 cities. Agricultural soil has high infiltration capacity; concrete has zero. This metric directly measures that conversion.

### `flooded_vegetation_max_pct`

**Logic:** Maximum `flooded_veg_pct` across all 8 years.

**Underwriting rationale:** Flooded vegetation in ESRI's classification means land that has standing water mixed with vegetation for a majority of the observation year. If any year showed this at 10%+, the location has experienced significant seasonal inundation. It is a proxy for historical flood events not captured by elevation models. A property built on what was 15% flooded vegetation in 2019 carries latent flood risk.

### `flooded_vegetation_trend`

**Logic:** Linear regression slope on `flooded_veg_pct` across 8 years. `increasing` if slope > 0.1%/yr.

**Underwriting rationale:** Increasing flooded vegetation over time means the land is becoming chronically wetter — possibly due to rising groundwater, upstream changes, or subsidence. This is a risk that will not reverse without intervention.

### `dominant_use_2017` / `dominant_use_2024` / `land_use_shifted`

**Logic:** The class with the highest percentage in that year. `land_use_shifted = true` if they differ.

**Underwriting rationale:** A fundamental land use shift (crops → built_area, trees → crops) represents a change in the risk character of the location. A property insured when the area was agricultural and re-underwritten without recognising the shift to industrial has been systematically mispriced. `land_use_shifted = true` is a flag for manual review.

---

*Document ends. Implementation follows the MERIT Hydro pattern throughout — same auth, same DB pattern, same TIF-service architecture, same response envelope.*
