# MERIT Hydro — Full Research, Analysis & Implementation Plan

**Scope:** MERIT Hydro v1.0.1 only. Other data sources (GloFAS, GSW, Aqueduct, WorldCover, etc.) deferred.
**Date of discussion:** 2026-07-22
**Prepared by:** Sujeet Kumar (discussion with Claude Code)

---

## Table of Contents

1. [What Is This Data Source?](#1-what-is-this-data-source)
2. [API Input — What Can a User Provide?](#2-api-input--what-can-a-user-provide)
3. [Complete Parameter List — All 7 Bands](#3-complete-parameter-list--all-7-bands)
4. [Derived Parameters](#4-derived-parameters-calculable-not-stored)
5. [Deep Analysis — Insurance & Underwriting Inference](#5-deep-analysis--insurance--underwriting-inference)
6. [What MERIT Hydro Cannot Tell You](#6-what-merit-hydro-cannot-tell-you-gaps)
7. [Standalone API — Example Response Shape](#7-standalone-api--example-response-shape)
8. [Is This the Latest Data?](#8-is-this-the-latest-data)
9. [Date Range of Underlying Data](#9-date-range-of-underlying-data)
10. [Free or Paid? License Analysis](#10-free-or-paid-license-analysis)
11. [Dataset Comparison — MERIT Hydro vs Alternatives](#11-dataset-comparison--merit-hydro-vs-alternatives)
12. [Accuracy — MERIT Hydro vs FABDEM](#12-accuracy--merit-hydro-vs-fabdem)
13. [HAND Derivation — The Calculation Explained](#13-hand-derivation--the-calculation-explained)
14. [Current Architecture — How the PIN Code Pipeline Works](#14-current-architecture--how-the-pin-code-pipeline-works)
15. [Lat/Long Input — How It Works Differently](#15-latlong-input--how-it-works-differently)
16. [Infrastructure — SSH Server Setup](#16-infrastructure--ssh-server-setup)
17. [Implementation Plan A — PIN Code (MERIT Hydro Expansion)](#17-implementation-plan-a--pin-code-merit-hydro-expansion)
18. [Implementation Plan B — Lat/Long (COG-Based Pixel Lookup)](#18-implementation-plan-b--latlong-cog-based-pixel-lookup)

---

## 1. What Is This Data Source?

The starting point for this entire discussion was a single field already in the flood risk API response:

```json
"terrain": {
  "hand_elevation_m": 16.9,
  "note": "MERIT Hydro v1.0.1: height above nearest drainage"
}
```

The API was showing only one parameter from this data source. The goal was to understand the full scope of what MERIT Hydro provides, and to build a proper standalone terrain-hydrology API block from it.

**MERIT Hydro** is a global hydrography dataset at 3 arc-second (~90 metres) resolution, published by the University of Tokyo (Yamazaki et al., 2019). It is derived from MERIT DEM — the world's most accurate global elevation model at 90m, which removes systematic errors from SRTM (NASA) and AW3D (JAXA) including stripe noise, speckle noise, tree-height bias, and absolute offset bias.

In plain terms: it is a cleaned, hydrologically-consistent terrain model of the entire planet's drainage system — where water flows, how fast, how much, how wide the rivers are, and critically: how high any point on Earth sits above its nearest waterway.

**Coverage:** 90°N to 60°S. India is fully covered.
**Temporal baseline:** Derived from DEM + water body datasets spanning 1987–2017.
**Resolution:** 92.77 metres per pixel (3 arc-seconds at the equator).

---

## 2. API Input — What Can a User Provide?

| Input Type | Feasibility | Precision | Notes |
|---|---|---|---|
| **Lat/Long** | Native | ~90m pixel exact | Best. The raster is sampled directly. |
| **PIN code** | Feasible | ~1–5km centroid | PIN code → geocode to centroid lat/long → raster lookup. |
| **Polygon (GeoJSON)** | Feasible | Area statistics | Returns min/mean/max/percentile across the polygon. Best for property parcels. |
| **H3/S2 tile index** | Feasible | Depends on zoom | Useful for batch analysis. Not user-facing. |
| **Address string** | Feasible | Geocode-dependent | Address → lat/long via geocoding → raster lookup. |

**Decision for this API:**
- Primary input: `lat` + `lon` (float)
- Secondary input: `pincode` (derive centroid internally)
- Tiles are internal infrastructure, not a user concern.

---

## 3. Complete Parameter List — All 7 Bands

### Band 1: `hnd` — Height Above Nearest Drainage
- **Unit:** metres (float32, 10cm precision)
- **What it is:** Vertical distance between the point and the nearest downstream river/drainage channel. If HAND = 5m, you are 5 metres above the nearest river's water surface.
- **Range:** 0 to several hundred metres.
- **Status in current API:** In use (showing `hand_elevation_m`). Only parameter currently exposed. Needs to be expanded.

### Band 2: `elv` — Hydrologically Adjusted Elevation
- **Unit:** metres above EGM96 geoid (float32, 10cm precision)
- **What it is:** Absolute elevation of the terrain, adjusted so that no downstream point is higher than upstream. This is NOT the same as raw SRTM elevation. Tree canopy, building heights, and sensor noise are removed. True bare-earth elevation.
- **Range:** ~-50m (below sea level depressions) to 8000m+.

### Band 3: `upa` — Upstream Drainage Area
- **Unit:** km²
- **What it is:** Total watershed area draining into the river at that point. A point on the Ganges might show 500,000 km² of upstream area. A point near a small stream headwater might show 2 km².
- **Range:** Near 0 for ridgelines/headwaters to millions of km² for major river outlets.
- **Interpretation:** The larger the upstream area, the more water can potentially arrive during a flood event.

### Band 4: `upg` — Upstream Drainage Pixel Count
- **Unit:** pixel count (float32)
- **What it is:** Number of pixels upstream. Functionally equivalent to `upa` but in pixel units. Used for flow accumulation calculations.
- **Relationship to upa:** `upa ≈ upg × (90m)² / 1,000,000` approximately.

### Band 5: `dir` — Flow Direction (Local Drainage Direction)
- **Unit:** categorical integer (int8)
- **What it is:** The direction water flows out of each pixel. D8 encoding:
  - 1 = East
  - 2 = Southeast
  - 4 = South
  - 8 = Southwest
  - 16 = West
  - 32 = Northwest
  - 64 = North
  - 128 = Northeast
  - 0 = River mouth
  - -1 = Inland depression (endorheic basin) — water has no outlet, pools here
  - -9 = Ocean/undefined

### Band 6: `wth` — River Channel Width
- **Unit:** metres
- **What it is:** Width of the river channel at the channel centreline. Measured using satellite imagery analysis methodology (Yamazaki et al. 2012).
- **Range:** ~30m (small streams, near detection limit) to 10,000m+ (Amazon, Brahmaputra delta).

### Band 7: `wat` — Permanent Water Body Mask
- **Unit:** binary (0 or 1)
- **What it is:** Whether the pixel is classified as permanent water (lake, reservoir, river channel, wetland). 0 = land, 1 = permanent water.
- **Source:** Derived from G1WBM + GSWO (Global Surface Water Occurrence from Landsat) + OpenStreetMap water bodies.

---

## 4. Derived Parameters (Calculable, Not Stored)

These are not direct bands but are standard products routinely derived from MERIT Hydro:

| Derived Parameter | How | What It Tells You |
|---|---|---|
| **Stream Order** (Strahler) | From `dir` + `upa` thresholding | Order 1 = headwater stream. Order 7+ = major river. Higher = more water, more flood magnitude. |
| **Distance to Nearest River** (horizontal) | Euclidean distance to nearest `wth > 0` pixel | Combined with HAND (vertical distance), gives 2D proximity context. |
| **Slope / Terrain Gradient** | Derive from `elv` neighbouring pixels | Steeper = faster runoff, less ponding. Flat = slow drainage, ponding risk. |
| **Basin/Watershed ID** | From `dir` network tracing | Which catchment does this point belong to. |

---

## 5. Deep Analysis — Insurance & Underwriting Inference

### Overall Verdict

MERIT Hydro is a Tier 1 data source for flood underwriting. It is the most widely used global terrain-hydrology dataset in catastrophe models (RMS, AIR, Fathom all build on or validate against it). For India specifically, it fills a major gap because India has no equivalent open national DEM product at this accuracy level.

The key reason it matters: it is not just elevation — it is hydrologically corrected elevation, which matters enormously for flood modelling because raw SRTM has systematic errors (overstates elevation near rivers due to vegetation and buildings) that MERIT removes.

---

### Per-Parameter Underwriting Breakdown

#### `hnd` — Height Above Nearest Drainage
**Primary flood risk indicator. Most important parameter.**

| HAND Value | Flood Risk Class | Underwriting Implication |
|---|---|---|
| 0 – 2m | Extreme | In active floodplain. Inundated in nearly every major flood event. Do not underwrite without flood excess or exclusion. |
| 2 – 5m | Very High | First-order floodplain. Inundated in 1-in-10 to 1-in-50 year events. Load premium heavily. |
| 5 – 10m | High | Second-order floodplain. 1-in-50 to 1-in-100 year events. Moderate loading. |
| 10 – 20m | Moderate | 1-in-100 to 1-in-200 year. Standard underwriting with flood endorsement. |
| 20 – 30m | Low | Episodic flash flood risk only. Minimal loading. |
| > 30m | Very Low / Negligible | Riverine flood not a concern. May still have pluvial (rain) risk. |

HAND is used exactly this way by the National Water Model (NOAA, US), Fathom Global, and Munich Re's flood models.

---

#### `elv` — Hydrologically Adjusted Elevation
**Absolute elevation for sea-level flood risk (coastal) and flash flood context.**

- Coastal properties at `elv` < 5m ASL face storm surge and sea-level-rise risk, independently of `hnd`.
- Combined with `hnd`: a property can have high HAND (safe from riverine flood) but low absolute elevation (vulnerable to coastal surge or prolonged inundation from blocked drainage).
- For actuarial use: elevation bands are standard rating factors in flood insurance. NFIP, FEMA all use BFE (Base Flood Elevation) which is equivalent.
- India-specific: properties in coastal districts (Mumbai, Chennai, Kolkata) at `elv` < 3m need this flag regardless of HAND.

---

#### `upa` — Upstream Drainage Area
**Measures how much of the country's water can eventually reach this point.**

- This is the single best proxy for flood magnitude (volume of water in an event).
- A property next to a stream with `upa` = 50 km² is exposed to local runoff only.
- A property near a river with `upa` = 200,000 km² (e.g., near the Ganga in Bihar) is exposed to the combined runoff of an entire river basin — even from rainfall 1,000km upstream.
- Underwriting use: large upstream area + low HAND = catastrophic loss scenario. This combination identifies properties where a single upstream cloudburst creates a major claim.
- Actuary use: `upa` is a direct input to flood frequency analysis (larger basin = slower response but larger peak discharge in major events).

---

#### `wth` — River Channel Width
**Channel capacity — how much flood can be contained before overflowing.**

- A narrow channel (50m) fills and overtops quickly in heavy rainfall.
- A wide channel (2km) has more buffer before overtopping.
- But width alone is misleading: a wide river in a flat delta (Brahmaputra in Assam) still overtops frequently because the basin is enormous.
- Best used as a ratio: combine `wth` with `upa`. Small `wth` relative to large `upa` = under-capacity channel = very high overflow risk.
- Also: properties directly adjacent to wide rivers have lateral erosion risk (bank erosion claims) in addition to inundation risk.

---

#### `wat` — Permanent Water Body
**Direct exposure flag — property is on or adjacent to water.**

- `wat = 1` at the property centroid means it is ON water — not underwritable for standard flood cover.
- A property within 1-2 pixels (90–180m) of `wat = 1` pixels is immediately adjacent to a river/lake — flag for survey or enhanced loading.
- Used to define the floodplain boundary at fine resolution.

---

#### `dir` — Flow Direction
**Determines if a property is in a drainage convergence zone.**

- If multiple upstream `dir` vectors converge on a single point, that point accumulates runoff from multiple directions — flash flood funnel.
- Inland depression (`dir = -1`) flag is critical: these are endorheic basins — water has no outlet. In a heavy rain event, the entire basin water pools here with no escape. These are among the worst flood risk locations possible, and they do NOT appear on standard flood zone maps because they're not connected to rivers.
- Underwriting use: `dir = -1` at or near a property = mandatory flood survey, highest loading, consider decline.

---

#### `upg` — Upstream Pixel Count
- Used to compute compound flood risk scores internally.
- Not directly user-facing but feeds the model.

---

## 6. What MERIT Hydro Cannot Tell You (Gaps)

| Gap | What's Missing | Source to Fill It |
|---|---|---|
| **Pluvial (urban) flood risk** | Rainfall that ponds in urban areas due to drainage failure | IMD rainfall data + urban drainage maps |
| **Flood return periods** | HAND tells you exposure, not probability | GloFAS, CWC data |
| **Historical flood events** | Whether this location has actually flooded before | EM-DAT, NDMA, ISRO |
| **Constructed defences** | Embankments, bunds, flood walls reduce risk but are not in MERIT Hydro | State irrigation dept data |
| **Drainage infrastructure** | Urban stormwater drains change flood dynamics | Local municipal data |
| **Temporal dynamics** | MERIT is static — does not show seasonal river behaviour | JRC Global Surface Water |

---

## 7. Standalone API — Example Response Shape

```json
"terrain": {
  "hand_m": 16.9,
  "elevation_m": 42.3,
  "upstream_area_km2": 12400.5,
  "river_width_m": 380.0,
  "on_permanent_water": false,
  "flow_direction": "southeast",
  "inland_depression": false,
  "flood_risk_class": "moderate",
  "data_source": "MERIT Hydro v1.0.1 (Yamazaki et al. 2019, ~90m resolution)"
}
```

Derived underwriting flags:

```json
"underwriting_flags": {
  "riverine_flood_exposure": "moderate",
  "basin_magnitude": "large",
  "channel_overflow_risk": "high",
  "coastal_surge_risk": false,
  "endorheic_trap_risk": false,
  "adjacent_to_river": true
}
```

---

## 8. Is This the Latest Data?

**Yes and No.**

MERIT Hydro v1.0.1 (released June 2019) is the latest and only stable version. There has been no v2, no update, no new release since June 2019. The dataset is essentially static — it is a one-time global product, not a time-series.

However, newer competing datasets now exist:
- **Hydrography90m** (2022) — higher network topology detail, more stream metrics
- **GRIT** (Global River Topology, 2024) — bifurcating river network, better deltas
- **HydroSHEDS v2** (2022) — alternative from WWF, updated DEM inputs
- **FABDEM** (2022) — better underlying DEM at 30m, used by Fathom Global 3.0

For flood underwriting at property level, MERIT Hydro v1.0.1 is still the widely used academic and industry reference. It has not been superseded for open/free use cases.

---

## 9. Date Range of Underlying Data

MERIT Hydro is not a time-series — it is a static snapshot. The dates refer to the source data it was built from:

| Source Layer | Time Period |
|---|---|
| MERIT DEM (elevation base) | SRTM (Feb 2000) + AW3D (2006–2011) |
| G1WBM water body mask | ~2000 era |
| GSWO (Global Surface Water Occurrence) | 1984–2015 (Landsat archive) |
| OpenStreetMap water bodies | Up to 2018 |
| **Published / frozen as** | **May 2019 (v1.0), June 2019 (v1.0.1)** |

**Plain English:** The terrain model reflects Earth's surface as it was around year 2000 (elevation) and 1984–2018 (water bodies). It will not reflect new construction, land reclamation, reservoir creation, or river channel changes after ~2019.

**Is the 2000-era data a problem?** Mostly no. Rivers, valleys, mountains — terrain does not move. Major river channels are the same. What changed since 2000 that MERIT doesn't know: new reservoirs, new embankments, urban expansion, land reclamation. For riverine flood risk scoring, terrain from 2000 is ~95% accurate for the parameters that matter (HAND, upstream area, flow direction).

The industry continues to use MERIT Hydro-derived products because terrain is largely stable, the errors are systematic and well-understood, and alternative free datasets are only marginally better for riverine flood risk.

---

## 10. Free or Paid? License Analysis

MERIT Hydro is dual-licensed — you pick one:

| License | Cost | Commercial Use | Catch |
|---|---|---|---|
| **CC-BY-NC 4.0** | Free | NOT allowed | Non-commercial and academic only |
| **ODbL 1.0** | Free | Allowed | Any "derived data" (e.g. your flood risk scores, processed outputs) must be made publicly available under the same ODbL license |

**Implication for a commercial API:**

If you expose a commercial API that returns processed MERIT Hydro values (HAND score, flood risk class, underwriting flags), you are building a derived work under ODbL. ODbL requires you to open-source your derived dataset. The API responses themselves (the computed scores) would technically need to be publicly available.

**How the industry handles this:** Most commercial catastrophe model vendors use MERIT Hydro as one input among many — the final output is a multi-source model, not a direct re-serve of MERIT Hydro data. That blends the lineage enough that pure ODbL attribution gets diluted.

**Action required:** Legal team should review before treating raw HAND values as freely re-distributable in a paid API.

---

## 11. Dataset Comparison — MERIT Hydro vs Alternatives

### The Four Actual Contenders

During research, four datasets were identified. They are not interchangeable — they serve fundamentally different purposes.

---

#### Dataset 1: MERIT Hydro v1.0.1
- **Type:** Raster terrain + hydrology product
- **Resolution:** 90m per pixel
- **Data year:** ~2000 (SRTM) / 1984–2018 (water bodies)
- **Parameters:** 7 bands (hnd, elv, upa, upg, dir, wth, wat)
- **HAND parameter:** Yes — direct band, pre-computed
- **Purpose:** Large-scale hydrodynamic and flood simulation
- **Cost:** Free (ODbL or CC-BY-NC)
- **Industry status:** Was global standard until ~2022. Still most widely cited academic reference. Fathom 1.0 and 2.0 used it. NOAA's National Water Model uses HAND from it.
- **India coverage:** Full
- **Point-query API ready:** Yes

---

#### Dataset 2: Hydrography90m (2022)
- **Type:** Freshwater ecology / biodiversity network dataset. NOT a terrain model.
- **Resolution:** 90m (same as MERIT Hydro — built on same DEM)
- **Data year:** Same underlying 2000-era SRTM
- **Parameters:** ~20+ layers — 5 stream order systems (Strahler, Horton, Shreve, Hack, topological), stream slope, curvature, distance to stream, compound topographic index, stream power index, sediment transport index, 1.6 million drainage basins, 726 million stream segments
- **HAND parameter:** No
- **Purpose:** Freshwater biodiversity, species distribution modelling, ecology
- **Cost:** Free
- **For flood/insurance:** Not used. Not designed for it. Wrong tool for property-level underwriting.
- **Verdict:** Adds ecological metrics you don't need. Removes flood parameters you do need.

---

#### Dataset 3: GRIT — Global River Topology (v0.6, 2024/2025)
- **Type:** Vector network dataset of the global river system. Lines and nodes, not pixels.
- **Resolution:** Based on FABDEM 30m DEM, but output is vector
- **Parameters:** River reach lines, bifurcation nodes, confluence nodes, canal networks, catchment polygons. 19.6 million km of waterways, 67,495 bifurcations, 818,000 confluences.
- **HAND parameter:** No
- **Purpose:** River topology — specifically capturing bifurcating rivers (deltas, braided channels, canal networks). First global dataset to correctly represent bifurcating rivers.
- **Cost:** Free (Zenodo)
- **India relevance:** Relevant for Ganges-Brahmaputra delta, Krishna-Godavari delta — but for basin-scale routing, not property-level risk scoring.
- **Verdict:** Wrong tool for a point-query API. No raster, no HAND, no elevation at a coordinate.

---

#### Dataset 4: FABDEM / FABDEM+ (2022, updated 2024)
- **Type:** Bare-earth digital elevation model at 30m global resolution
- **Resolution:** 30m per pixel (3× better than MERIT)
- **Data year:** 2011–2015 (TanDEM-X satellite, newer than SRTM 2000)
- **Parameters:** Elevation only — you derive HAND, flow direction, upstream area from it (same 5-step algorithm, better input)
- **HAND parameter:** Must derive — but derived values are more accurate (1.24m RMSE vs 3-5m for MERIT in flat terrain)
- **Purpose:** Best available global bare-earth DEM. Used as input to derive all hydrological parameters.
- **Cost:** Non-commercial: Free (CC-BY-NC, v1.2 on HuggingFace). Commercial: Requires licence from Fathom.
- **Industry status:** Fathom Global 3.0 (current industry-leading flood model) is built entirely on FABDEM.
- **India coverage:** Full

---

### Head-to-Head Comparison Table

| | MERIT Hydro v1.0.1 | Hydrography90m | GRIT | FABDEM |
|---|---|---|---|---|
| Type | Raster terrain + hydrology | Raster stream network (ecology) | Vector river network | Raster bare-earth DEM |
| Resolution | 90m | 90m | Vector (30m DEM source) | 30m |
| Data year | ~2000 | ~2000 (same DEM) | ~2011–2015 | 2011–2015 |
| HAND parameter | Yes (direct band) | No | No | Must derive (better accuracy) |
| Elevation | Yes (adjusted) | No | No | Yes (bare earth, better) |
| Upstream area | Yes | Yes | Yes (catchment polygon) | Must derive |
| River width | Yes | No | Yes (partial) | Must derive |
| Flow direction | Yes | Yes | Implicit in network | Must derive |
| Stream order | No | Yes (5 systems) | No | Must derive |
| Bifurcations/deltas | Poor | Poor | Excellent | Partial |
| Urban flood accuracy | Poor (90m too coarse) | Poor | N/A | Good (30m) |
| Free for commercial | ODbL (open-data obligation) | Yes | Yes | No (licence required) |
| India coverage | Full | Full | Full | Full |
| Used by Fathom | v1.0 and v2.0 | No | Co-authored | v3.0 (current) |
| Used for insurance | Yes (standard until 2022) | No | No | Yes (current standard) |
| Point-query API ready | Yes | Partial | No | Yes (after deriving bands) |

---

### Decision for This Project

**Phase 1 (now, free):** MERIT Hydro. Expand from 1 parameter to all 7 bands. Highest ROI, zero cost.

**Phase 2 (when scaling commercially):** License FABDEM and re-derive HAND at 30m. Non-commercial FABDEM (v1.2) is free on HuggingFace/Zenodo for early-stage non-commercial use.

**Never needed:** GRIT for a point-query API. Hydrography90m for flood underwriting.

---

## 12. Accuracy — MERIT Hydro vs FABDEM

### The Numbers

| Metric | MERIT Hydro (SRTM-based) | FABDEM |
|---|---|---|
| Resolution | 90m per pixel | 30m per pixel |
| Vertical accuracy (RMSE) in flat terrain | ~3–5m | 1.24m |
| Buildings removed | Partially (heuristic) | Yes (machine learning) |
| Forests removed | Partially | Yes (machine learning) |
| Source data year | 2000 (SRTM) | 2011–2015 (TanDEM-X) |
| HAND pre-computed | Yes, direct band | No — must derive |
| Fathom uses it | v1.0, v2.0 (retired) | v3.0 (current) |

**Winner for accuracy: FABDEM. Not close.**

In flat, flood-prone terrain (coastal India — Mumbai, Chennai, Kolkata, Bhubaneswar, Odisha coast, Krishna-Godavari delta), a 90m pixel literally covers a city block. A 3–5m vertical error means you cannot tell the difference between a safe property and an inundated one. FABDEM at 30m with 1.24m RMSE resolves individual streets and elevation bands that matter for flood risk.

---

### For a Stakeholder Presentation — Which to Use?

**Today: MERIT Hydro.**

MERIT Hydro HAND is battle-tested, cited in 500+ peer-reviewed papers, used operationally by NOAA, validated in South Asia, and immediately defensible. If someone challenges you — there is a decade of independent validation to point to.

**6–12 months out: Derive HAND from FABDEM.**

Run the 5-step pipeline on India's geographic extent. Validate derived HAND values against 3–5 known historical flood events in India (2005 Mumbai, 2015 Chennai, 2023 Sikkim, Assam 2022). Once validated, FABDEM-derived HAND becomes more accurate AND independently verified.

---

## 13. HAND Derivation — The Calculation Explained

This section explains how HAND (Height Above Nearest Drainage) is computed from a raw DEM. This applies when deriving from FABDEM later. For MERIT Hydro, HAND is pre-computed — this is for understanding and future reference.

The calculation is not custom or proprietary. It was published in Nobre et al. (2011) and has been independently implemented in GRASS GIS, TauDEM, WhiteboxTools, and Google Earth Engine.

### Step 1 — Sink Filling (Depression Filling)

Raw DEMs have artificial pits — pixels lower than all 8 neighbours — caused by sensor noise or data gaps. Water cannot flow out of a pit. Fill these first so flow routing is physically consistent.

Algorithm: Priority-Flood (Wang & Liu 2006) or Planchon-Darboux (2001).
Tools: GRASS GIS (`r.fill.dir`), WhiteboxTools (`FillDepressions`), TauDEM.

### Step 2 — Flow Direction (D8)

For every pixel, find which of 8 neighbours is the lowest. Water flows that direction.
Output: 1=East, 2=SE, 4=South, 8=SW, 16=West, 32=NW, 64=North, 128=NE.
This is the `dir` band already in MERIT Hydro.

### Step 3 — Flow Accumulation

Count how many upstream pixels drain through each pixel.
Multiply by pixel area → upstream drainage area in km².
This is the `upa` band in MERIT Hydro.

### Step 4 — River Network Delineation

Apply a threshold: if upstream area > X km², this pixel is a river channel.
MERIT Hydro uses 0.5 km² as the threshold.
This is the only judgment call in the pipeline — it matters. Too low = every ditch is a "river". Too high = you miss local waterways that actually flood.

### Step 5 — HAND Calculation

For each pixel, follow flow direction downstream until you reach a river pixel.

```
HAND = elevation(current pixel) − elevation(nearest river pixel)
```

That is the entire formula. Simple subtraction along the flow path.

### Will FABDEM-Derived HAND Be Accurate?

The calculation: yes, 100% established and correct.

The output values: better than MERIT Hydro for two provable reasons:
1. 30m pixels means "nearest drainage" is found with 3× more spatial precision.
2. 1.24m vertical accuracy means the elevation difference calculated is 2–4× more precise than MERIT in flat terrain.

The honest caveat: MERIT Hydro's HAND has been independently validated against real flood events globally. FABDEM-derived HAND — if computed yourself — is a new product that needs your own validation before presenting with full confidence. Validate against known flood events (NDMA data, ISRO satellite flood maps, CWC gauge readings) before using in production.

---

## 14. Current Architecture — How the PIN Code Pipeline Works

```
OFFLINE (run once, takes hours)
─────────────────────────────────────────────────────
19,000 PIN codes
    → pincode_coords.csv  (each PIN = one lat/long centroid)
    → GEE extraction scripts sample each raster at those 19,000 points
    → CSVs per source  (jrc_glofas.csv, hand_terrain.csv, aqueduct.csv …)
    → build_flood_risk_index.py merges all CSVs, computes score
    → loads into  pincode_flood_index  table in Neon DB

REAL-TIME (every API call, milliseconds)
─────────────────────────────────────────────────────
User → GET /api/environmental/flood/pincode?pincode=400001
    → DB: SELECT * FROM pincode_flood_index WHERE pincode = '400001'
    → return pre-computed row instantly
    → No GEE, no raster, no math at query time
```

Everything is pre-baked. The API is just a DB lookup. That is why it is fast.

**Current state of MERIT Hydro in the pipeline:**
- Only `hand_elevation_m` (the `hnd` band) is extracted and stored.
- The other 6 bands (elv, upa, upg, dir, wth, wat) are not extracted.
- The `terrain` block in the API response shows only one field.

---

## 15. Lat/Long Input — How It Works Differently

### What the Raster Lookup Does

The source data is all raster data — global GeoTIFF files. Every pixel has a geographic coordinate. When you send a lat/long, you find which pixel that coordinate falls in and read that pixel's value.

```
pixel_col = (lon - raster_west_edge)  / pixel_width
pixel_row = (raster_north_edge - lat) / pixel_height
value = raster[pixel_row][pixel_col]
```

No interpolation, no approximation. Direct array lookup. The source data is in lat/long (WGS84). Your lat/long input IS the native coordinate system.

### The Two Worlds

| | PIN code API (current) | Lat/Long API (new) |
|---|---|---|
| Pre-computation | 19,000 points, done offline | Not pre-computed |
| Query time | DB lookup, <10ms | Depends on approach |
| Accuracy | Centroid of PIN area (~1–5km off) | Exact pixel at that coordinate |
| Coverage | Only Indian PIN codes | Any lat/long in India |

### Three Approaches Considered

**Option 1: Nearest PIN code centroid** — User sends lat/long, you find nearest pre-computed PIN centroid in DB. Fast but inaccurate. A 2–8km centroid offset on flat terrain = entirely different flood zone. Not defensible for property-level underwriting.

**Option 2: Real-time GEE pixel sampling** — API calls GEE in real-time, GEE samples each raster at that exact coordinate. Most accurate but GEE calls take 2–5 seconds each. 10 sources = 20–50 seconds per query. Not production-ready.

**Option 3: Cloud-Optimized GeoTIFF (COG) pixel lookup** — Pre-download India-extent rasters, convert to COG, serve from local disk via Python/FastAPI. Fast (<100ms), accurate to exact pixel, production-ready. This is what Fathom, RMS, and Swiss Re use. **This is the chosen approach.**

---

## 16. Infrastructure — SSH Server Setup

### Server Details

- Host: `sujeetk@172.17.4.105 -p 1729`
- Accessible via VPN
- Public HTTPS domain: team is setting this up separately
- nginx will proxy the public HTTPS domain to FastAPI on port 8000

### Architecture

```
Your laptop  ──VPN──►  172.17.4.105:1729  (SSH server, internal)
                              │
                        /opt/raster-india/  (COG files on local disk)
                              │
                        FastAPI :8000  (rasterio pixel reads)
                              │
                        nginx (HTTPS public domain)  ← team setting up
                              │
                        https://yourdomain.com/lookup?lat=19.07&lon=72.87
```

### What Sits on the Server (MERIT Hydro only, for now)

```
/opt/raster-india/
├── india_hand.tif          ~250 MB  (hnd band)
├── india_elevation.tif     ~300 MB  (elv band)
├── india_upstream_area.tif ~250 MB  (upa band)
├── india_flow_dir.tif      ~100 MB  (dir band)
├── india_river_width.tif   ~150 MB  (wth band)
└── india_water_mask.tif    ~50 MB   (wat band)

Total: ~1.1 GB for all 6 MERIT Hydro bands (upg skipped — derived from upa)
```

**These are NOT raw global tiles. They are India-clipped, processed, compressed files. Raw tiles from MERIT Hydro stay on your laptop and are deleted after processing.**

### Google Drive

Confirmed: Google Drive does NOT support HTTP range requests. COG pixel lookups require range requests. Google Drive cannot serve COG files for pixel reads. Drive can be used as a backup/archive of the files, not as the serving layer.

### File Transfer to Server

SCP command (run from your laptop, note capital -P for port):

```bash
scp -P 1729 india_hand.tif sujeetk@172.17.4.105:/opt/raster-india/
```

### What IT Team Needs to Do

Send this request to IT:

> "On server 172.17.4.105, I need:
> 1. `sudo apt install gdal-bin libgdal-dev python3-pip` installed
> 2. Port 8000 open internally (or nginx to proxy from the public HTTPS domain to localhost:8000)
> 3. A folder `/opt/raster-india/` created with write access for user `sujeetk`
> 4. A systemd service to keep a Python/uvicorn process running on port 8000"

Check if you have sudo first:
```bash
ssh sujeetk@172.17.4.105 -p 1729
sudo whoami
```
- Prints `root` → you can do everything yourself
- Says `permission denied` → you need IT for system-level items

---

## 17. Implementation Plan A — PIN Code (MERIT Hydro Expansion)

**Goal:** Expand the existing flood risk API's terrain block from 1 MERIT Hydro parameter (`hand_elevation_m`) to all 7 bands. Everything uses the existing DB-backed architecture.

**Effort estimate:** 2–3 days

---

### Phase A1: Update GEE Extraction Script
**File:** `scripts/extract_hand_terrain.py`
**Time:** 2–4 hours

Currently this script extracts only the `hnd` band. Update it to extract all bands in a single GEE sample call:

```python
# Current (only hnd):
image = ee.Image("MERIT/Hydro/v1_0_1").select(['hnd'])

# Updated (all bands):
image = ee.Image("MERIT/Hydro/v1_0_1").select(['hnd', 'elv', 'upa', 'upg', 'dir', 'wth', 'wat'])
```

Output CSV columns to add:
- `hand_elevation_m` (existing, keep)
- `merit_elevation_m` (elv band)
- `upstream_area_km2` (upa band)
- `upstream_pixel_count` (upg band)
- `flow_direction` (dir band — store as integer, decode to label in API)
- `river_width_m` (wth band)
- `on_permanent_water` (wat band — binary 0/1)

Re-run the extraction:
```bash
python scripts/extract_hand_terrain.py
# This resamples all 19,000 PIN code centroids against GEE
# Output: data/flood/gee_outputs/hand_terrain.csv (now with 7 columns)
```

---

### Phase A2: Update DB Schema
**File:** `src/lib/db/schema.ts`
**Time:** 30 minutes

Add new columns to `pincode_flood_index` table:

```typescript
meritElevationM:       real('merit_elevation_m'),
upstreamAreaKm2:       real('upstream_area_km2'),
upstreamPixelCount:    real('upstream_pixel_count'),
flowDirection:         integer('flow_direction'),
riverWidthM:           real('river_width_m'),
onPermanentWater:      boolean('on_permanent_water').default(false),
// derived flags
inlandDepression:      boolean('inland_depression').default(false),
adjacentToRiver:       boolean('adjacent_to_river').default(false),
```

Run migration:
```bash
npx drizzle-kit push
```

---

### Phase A3: Update Build Script
**File:** `scripts/build_flood_risk_index.py`
**Time:** 1 hour

Add new columns to `DB_COLS` list:
```python
DB_COLS = [
    # ... existing columns ...
    "merit_elevation_m",
    "upstream_area_km2",
    "upstream_pixel_count",
    "flow_direction",
    "river_width_m",
    "on_permanent_water",
    "inland_depression",
    "adjacent_to_river",
]
```

Add derived flag computation:
```python
# Inland depression flag (flow_direction == -1)
df["inland_depression"] = (df["flow_direction"] == -1)

# Adjacent to river (river_width_m > 0 at this pixel or within 2 pixels)
# If river_width_m > 0, the centroid is ON a river channel
df["adjacent_to_river"] = (
    df["river_width_m"].fillna(0) > 0
) | (
    df["on_permanent_water"].fillna(False)
)
```

Add flow direction decoder:
```python
DIR_LABELS = {
    1: "east", 2: "southeast", 4: "south", 8: "southwest",
    16: "west", 32: "northwest", 64: "north", 128: "northeast",
    0: "river_mouth", -1: "inland_depression", -9: "undefined"
}
df["flow_direction_label"] = df["flow_direction"].map(DIR_LABELS)
```

Re-run:
```bash
python scripts/build_flood_risk_index.py
```

---

### Phase A4: Update API Response
**File:** `src/app/api/environmental/flood/pincode/route.ts`
**Time:** 1 hour

Expand the `terrain` block:

```typescript
terrain: {
  // MERIT Hydro v1.0.1 — all 7 bands
  hand_m:               toNum(r.handElevationM),
  elevation_m:          toNum(r.meritElevationM),
  upstream_area_km2:    toNum(r.upstreamAreaKm2),
  river_width_m:        toNum(r.riverWidthM),
  on_permanent_water:   r.onPermanentWater ?? false,
  flow_direction:       r.flowDirection ?? null,
  inland_depression:    r.inlandDepression ?? false,

  // Derived underwriting flags
  flood_risk_class_terrain: (() => {
    const h = toNum(r.handElevationM) ?? 99
    if (h <= 2)  return 'extreme'
    if (h <= 5)  return 'very_high'
    if (h <= 10) return 'high'
    if (h <= 20) return 'moderate'
    if (h <= 30) return 'low'
    return 'very_low'
  })(),
  coastal_surge_risk:   (toNum(r.meritElevationM) ?? 99) < 5,
  adjacent_to_river:    r.adjacentToRiver ?? false,

  note: 'MERIT Hydro v1.0.1 (Yamazaki et al. 2019) — ~90m resolution',
},
```

---

### Phase A5: Update API Docs
**File:** `src/app/docs/(protected)/environmental/_data/api-definitions.ts`
**Time:** 30 minutes

Add new terrain fields to the API documentation schema so they appear in the docs portal tryout panel.

---

### Phase A — Full Checklist

- [ ] Update `extract_hand_terrain.py` to extract all 7 bands
- [ ] Re-run extraction script against GEE (19,000 PIN codes)
- [ ] Verify output CSV has all 7 columns
- [ ] Add new columns to DB schema (`schema.ts`)
- [ ] Run `npx drizzle-kit push` to apply migration
- [ ] Update `build_flood_risk_index.py` — DB_COLS, derived flags, direction decoder
- [ ] Re-run `build_flood_risk_index.py` to reload DB
- [ ] Update `route.ts` to expose all new fields in API response
- [ ] Update API docs definitions
- [ ] Test: query a known coastal PIN code (Mumbai), verify `coastal_surge_risk = true`
- [ ] Test: query a hilly PIN code (Shimla), verify `hand_m` is high and `flood_risk_class_terrain = very_low`
- [ ] Test: query Bihar riverbank PIN code, verify `upstream_area_km2` is large

---

## 18. Implementation Plan B — Lat/Long (COG-Based Pixel Lookup)

**Goal:** Accept exact lat/long coordinates and return MERIT Hydro values at that precise location — not the nearest PIN code centroid, but the actual pixel at those coordinates.

**Effort estimate:** 3–5 days (including server setup and coordination with IT)

---

### Phase B1: Export India-Extent Rasters from GEE
**Where:** Your laptop (GEE Python API)
**Time:** 2–4 hours (GEE export runs in background)

For each MERIT Hydro band, export a clipped India-extent GeoTIFF from GEE.

India bounding box: `[67.0, 6.0, 98.0, 38.0]` (lon_min, lat_min, lon_max, lat_max)

```python
import ee
ee.Initialize()

image = ee.Image("MERIT/Hydro/v1_0_1")
india = ee.Geometry.Rectangle([67.0, 6.0, 98.0, 38.0])

bands = {
    'hnd': 'india_hand',
    'elv': 'india_elevation',
    'upa': 'india_upstream_area',
    'dir': 'india_flow_direction',
    'wth': 'india_river_width',
    'wat': 'india_water_mask',
}

for band, filename in bands.items():
    task = ee.batch.Export.image.toDrive(
        image=image.select([band]),
        description=filename,
        folder='merit_hydro_india',
        fileNamePrefix=filename,
        region=india,
        scale=92.77,          # native resolution
        crs='EPSG:4326',
        maxPixels=1e13,
        fileFormat='GeoTIFF',
    )
    task.start()
    print(f"Started export: {filename}")
```

Files land in Google Drive folder `merit_hydro_india`. Download them to your laptop.

**Note:** GEE exports large files in multiple parts (e.g., `india_hand-0000000000-0000000000.tif`, `india_hand-0000000000-0000065536.tif`). This is normal — handled in the next step.

---

### Phase B2: Process to COG (One-Time, on Laptop)
**Time:** 30–60 minutes per band, runs unattended

Install GDAL on your laptop if not already present.

For each band, merge the tile parts and convert to Cloud-Optimized GeoTIFF:

```bash
# Step 1: Create virtual mosaic (merges all parts, no data copy, instant)
gdalbuildvrt india_hand.vrt india_hand-*.tif

# Step 2: Convert to COG (compressed, internally tiled for fast point reads)
gdal_translate india_hand.vrt india_hand_cog.tif \
  -co TILED=YES \
  -co BLOCKXSIZE=512 \
  -co BLOCKYSIZE=512 \
  -co COMPRESS=LZW \
  -co COPY_SRC_OVERVIEWS=YES

# Repeat for each band:
gdalbuildvrt india_elevation.vrt india_elevation-*.tif
gdal_translate india_elevation.vrt india_elevation_cog.tif -co TILED=YES -co COMPRESS=LZW ...

# etc. for all 6 bands
```

Verify output:
```bash
gdalinfo india_hand_cog.tif | grep -E "Size|Pixel|Compression|TILED"
```

Expected output:
```
Size is 37200, 38400
Pixel Size = (0.000833, -0.000833)
COMPRESSION=LZW
TILED=YES
```

Final files on your laptop:
```
india_hand_cog.tif          ~250 MB
india_elevation_cog.tif     ~300 MB
india_upstream_area_cog.tif ~250 MB
india_flow_direction_cog.tif ~100 MB
india_river_width_cog.tif   ~150 MB
india_water_mask_cog.tif    ~50 MB
```

---

### Phase B3: Transfer Files to SSH Server
**Time:** 20–60 minutes depending on VPN speed

First, confirm the folder exists on the server (coordinate with IT if needed):

```bash
ssh sujeetk@172.17.4.105 -p 1729 "ls /opt/raster-india/ && echo OK || echo FOLDER_MISSING"
```

Then copy files (run from your laptop):

```bash
scp -P 1729 india_hand_cog.tif         sujeetk@172.17.4.105:/opt/raster-india/india_hand.tif
scp -P 1729 india_elevation_cog.tif    sujeetk@172.17.4.105:/opt/raster-india/india_elevation.tif
scp -P 1729 india_upstream_area_cog.tif sujeetk@172.17.4.105:/opt/raster-india/india_upstream_area.tif
scp -P 1729 india_flow_direction_cog.tif sujeetk@172.17.4.105:/opt/raster-india/india_flow_dir.tif
scp -P 1729 india_river_width_cog.tif  sujeetk@172.17.4.105:/opt/raster-india/india_river_width.tif
scp -P 1729 india_water_mask_cog.tif   sujeetk@172.17.4.105:/opt/raster-india/india_water_mask.tif
```

Verify arrival:
```bash
ssh sujeetk@172.17.4.105 -p 1729 "ls -lh /opt/raster-india/"
```

---

### Phase B4: Deploy FastAPI Service on Server
**Time:** 1–2 hours

SSH into server:
```bash
ssh sujeetk@172.17.4.105 -p 1729
```

Install Python dependencies:
```bash
pip3 install fastapi uvicorn rasterio numpy
```

Create service file:
```bash
mkdir -p /opt/raster-service
nano /opt/raster-service/main.py
```

```python
from fastapi import FastAPI, HTTPException
import rasterio
import numpy as np

app = FastAPI(title="MERIT Hydro Raster Service")

FOLDER = "/opt/raster-india"

# Open all files once at startup — stay open for all requests
_files = {}

@app.on_event("startup")
def open_files():
    sources = {
        "hand":           f"{FOLDER}/india_hand.tif",
        "elevation":      f"{FOLDER}/india_elevation.tif",
        "upstream_area":  f"{FOLDER}/india_upstream_area.tif",
        "flow_direction": f"{FOLDER}/india_flow_dir.tif",
        "river_width":    f"{FOLDER}/india_river_width.tif",
        "water_mask":     f"{FOLDER}/india_water_mask.tif",
    }
    for key, path in sources.items():
        _files[key] = rasterio.open(path)
    print(f"Opened {len(_files)} raster files")

def read_pixel(src, lat: float, lon: float):
    try:
        row, col = src.index(lon, lat)
        val = src.read(1, window=((row, row+1), (col, col+1)))[0][0]
        if np.isnan(val) or val == src.nodata:
            return None
        return float(round(val, 4))
    except Exception:
        return None

DIR_LABELS = {
    1: "east", 2: "southeast", 4: "south", 8: "southwest",
    16: "west", 32: "northwest", 64: "north", 128: "northeast",
    0: "river_mouth", -1: "inland_depression", -9: "undefined"
}

@app.get("/lookup")
def lookup(lat: float, lon: float):
    if not (6.0 <= lat <= 38.0 and 67.0 <= lon <= 98.0):
        raise HTTPException(status_code=400, detail="Coordinates outside India coverage area")

    hand_m          = read_pixel(_files["hand"],          lat, lon)
    elevation_m     = read_pixel(_files["elevation"],     lat, lon)
    upstream_area   = read_pixel(_files["upstream_area"], lat, lon)
    flow_dir_raw    = read_pixel(_files["flow_direction"], lat, lon)
    river_width     = read_pixel(_files["river_width"],   lat, lon)
    water_mask_raw  = read_pixel(_files["water_mask"],    lat, lon)

    flow_dir_int = int(flow_dir_raw) if flow_dir_raw is not None else None
    on_water     = bool(water_mask_raw == 1.0) if water_mask_raw is not None else False

    # Compute terrain flood risk class from HAND
    if hand_m is None:
        risk_class = None
    elif hand_m <= 2:   risk_class = "extreme"
    elif hand_m <= 5:   risk_class = "very_high"
    elif hand_m <= 10:  risk_class = "high"
    elif hand_m <= 20:  risk_class = "moderate"
    elif hand_m <= 30:  risk_class = "low"
    else:               risk_class = "very_low"

    return {
        "input": {"lat": lat, "lon": lon},
        "terrain": {
            "hand_m":                    hand_m,
            "elevation_m":               elevation_m,
            "upstream_area_km2":         upstream_area,
            "river_width_m":             river_width,
            "on_permanent_water":        on_water,
            "flow_direction_code":       flow_dir_int,
            "flow_direction_label":      DIR_LABELS.get(flow_dir_int) if flow_dir_int is not None else None,
            "inland_depression":         flow_dir_int == -1,
            "flood_risk_class_terrain":  risk_class,
            "coastal_surge_risk":        elevation_m is not None and elevation_m < 5.0,
            "adjacent_to_river":         on_water or (river_width is not None and river_width > 0),
        },
        "meta": {
            "data_source":  "MERIT Hydro v1.0.1 (Yamazaki et al. 2019)",
            "resolution_m": 92.77,
            "note":         "Terrain values at exact pixel containing the coordinate",
        }
    }

@app.get("/health")
def health():
    return {"status": "ok", "files_loaded": list(_files.keys())}
```

Start the service:
```bash
cd /opt/raster-service
nohup uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2 &
```

Set up systemd so it restarts on reboot:
```bash
sudo nano /etc/systemd/system/raster.service
```
```ini
[Unit]
Description=MERIT Hydro Raster Lookup Service
After=network.target

[Service]
User=sujeetk
WorkingDirectory=/opt/raster-service
ExecStart=/usr/local/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable raster
sudo systemctl start raster
sudo systemctl status raster
```

Test locally on server:
```bash
curl "http://localhost:8000/lookup?lat=19.07&lon=72.87"
curl "http://localhost:8000/health"
```

---

### Phase B5: Coordinate with IT for Public HTTPS
**Time:** Depends on IT team

The team setting up the HTTPS domain needs to add an nginx proxy rule:

```nginx
location /raster/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Once done, the endpoint is live at:
```
https://yourdomain.com/raster/lookup?lat=19.07&lon=72.87
https://yourdomain.com/raster/health
```

---

### Phase B6: Create Next.js API Route for Lat/Long
**File:** `src/app/api/environmental/flood/latlong/route.ts`
**Time:** 1–2 hours

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  lat: z.coerce.number().min(6.0).max(38.0),
  lon: z.coerce.number().min(67.0).max(98.0),
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

export async function GET(req: NextRequest) {
  const start = Date.now()

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || !isValidApiKey(apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    lat: searchParams.get('lat'),
    lon: searchParams.get('lon'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid coordinates', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { lat, lon } = parsed.data

  try {
    const rasterRes = await fetch(
      `${process.env.RASTER_SERVICE_URL}/lookup?lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!rasterRes.ok) {
      throw new Error(`Raster service returned ${rasterRes.status}`)
    }

    const raster = await rasterRes.json()

    return NextResponse.json({
      success:     true,
      coordinates: { lat, lon },
      ...raster,
      meta: {
        ...raster.meta,
        latency_ms: Date.now() - start,
      }
    })
  } catch (err) {
    console.error('[flood/latlong] error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

Add to `.env.local`:
```
RASTER_SERVICE_URL=https://yourdomain.com/raster
```

---

### Phase B7: Update API Docs
**File:** `src/app/docs/(protected)/environmental/_data/api-definitions.ts`
**Time:** 30 minutes

Add the new lat/long endpoint to the docs portal with its request/response schema.

---

### Phase B — Full Checklist

**Data preparation (laptop):**
- [ ] Run GEE export script for all 6 MERIT Hydro bands (hnd, elv, upa, dir, wth, wat)
- [ ] Wait for GEE exports to complete (check GEE Tasks panel)
- [ ] Download exported files from Google Drive to laptop
- [ ] Run `gdalbuildvrt` to merge tile parts for each band
- [ ] Run `gdal_translate` to convert each to COG
- [ ] Verify each COG file with `gdalinfo` — check TILED=YES, COMPRESS=LZW
- [ ] Note final file sizes

**Server setup:**
- [ ] Check sudo access: `ssh sujeetk@172.17.4.105 -p 1729` then `sudo whoami`
- [ ] Request IT team to: install GDAL/Python libs, create `/opt/raster-india/`, open port 8000
- [ ] Copy 6 COG files to server via SCP
- [ ] Verify files arrived: `ls -lh /opt/raster-india/`
- [ ] Install Python packages: `pip3 install fastapi uvicorn rasterio numpy`
- [ ] Create `/opt/raster-service/main.py`
- [ ] Start service: `uvicorn main:app --host 127.0.0.1 --port 8000`
- [ ] Test locally: `curl http://localhost:8000/health`
- [ ] Test lookup: `curl "http://localhost:8000/lookup?lat=19.07&lon=72.87"`
- [ ] Set up systemd service for auto-restart

**Integration:**
- [ ] Coordinate with IT team for nginx proxy config
- [ ] Verify public HTTPS URL works: `https://yourdomain.com/raster/health`
- [ ] Create `src/app/api/environmental/flood/latlong/route.ts`
- [ ] Add `RASTER_SERVICE_URL` to `.env.local` and production environment
- [ ] Test end-to-end: call Next.js route → raster service → response
- [ ] Update API docs definitions

---

## Summary — What We Are Building (MERIT Hydro Only)

| | Plan A (PIN Code) | Plan B (Lat/Long) |
|---|---|---|
| Input | `?pincode=400001` | `?lat=19.07&lon=72.87` |
| Data path | Pre-computed DB lookup | Real-time COG pixel read |
| Latency | <15ms | ~100ms |
| Accuracy | PIN centroid (~1–5km off) | Exact pixel (90m precision) |
| Infrastructure | Neon DB (already exists) | SSH server + FastAPI |
| MERIT Hydro bands exposed | All 7 | All 6 (upg omitted — redundant with upa) |
| Effort | 2–3 days | 3–5 days |
| Start with | Yes — existing architecture | After Plan A is complete |

**Sequence:** Complete Plan A first (all 7 bands in DB, API updated). Then Plan B (COG service on SSH server). Plan B depends on nothing in Plan A — they are independent pipelines for the same data.

---

## References

- [MERIT Hydro — GEE Data Catalog](https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1)
- [MERIT Hydro — Official Site (Yamazaki Lab)](https://global-hydrodynamics.github.io/MERIT_Hydro/)
- [MERIT Hydro — Original Paper (Yamazaki et al. 2019)](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019wr024873)
- [HAND — Original Paper (Nobre et al. 2011)](https://www.sciencedirect.com/science/article/abs/pii/S0022169411002599)
- [FABDEM vs MERIT DEM — Fathom](https://www.fathom.global/insight/fabdem-versus-merit-dem-a-visual-comparison/)
- [Hydrography90m — ESSD 2022](https://essd.copernicus.org/articles/14/4525/2022/)
- [GRIT — Water Resources Research 2025](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2024WR038308)
- [FABDEM on GEE Community Catalog](https://gee-community-catalog.org/projects/fabdem/)
- [Fathom Global 3.0 — Wing et al. 2024](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023WR036460)
- [India Flood Atlas](https://flood.neer.io/)
