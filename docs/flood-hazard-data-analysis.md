# Flood Hazard Data: Source Analysis & Competitive Intelligence

> **Document Purpose:** Product decision document for integrating flood hazard spatial data into the Insuretech Data Platform.
> **Date:** July 2026 | **Status:** Draft for review

---

## 1. Executive Summary

India's flood risk is among the world's most severe — approximately 40 million hectares are flood-prone, and annual economic losses routinely exceed $10 billion USD. For an insurtech underwriting health and property risks at pincode resolution, the current EM-DAT baseline is fundamentally inadequate for pricing, portfolio accumulation control, or regulatory compliance. This document audits every material flood hazard data source — government free, global open, and commercial — evaluating their fitness for integration into a Next.js/PostgreSQL data platform that needs pincode or lat/lng point lookups.

The landscape has matured substantially in 2024–2025. Free global datasets (JRC GloFAS v2.1, WRI Aqueduct, Fathom 3.0 non-commercial) now reach 30–90 m resolution with return-period depth maps. However, India-specific calibration, pluvial flood coverage (urban surface-water flooding — the dominant peril for property insurers in Indian cities), and insurance-grade actuarial outputs (AAL, OEP/AEP loss curves, vulnerability functions) remain the exclusive domain of commercial vendors.

**Recommended path:** A two-layer architecture — free government + JRC data for immediate phase-1 scoring, with RMSI India FloodRisk 2.0 or Fathom Commercial as the actuary-grade phase-2 upgrade.

---

## 2. Current Platform Gap: What EM-DAT Misses

**What the platform currently has:**
- `flood_events_per_decade` — a count of CRED EM-DAT disaster events aggregated at state level and distributed across districts proportionally
- EM-DAT records only disasters that cross reporting thresholds (≥10 deaths OR ≥100 affected OR state of emergency declared)
- No spatial extent, inundation depth, return period, or distinction between riverine vs surface-water vs coastal flooding

**What is missing for insurance underwriting:**

| Gap | Why It Matters |
|---|---|
| Return-period hazard (2yr, 10yr, 100yr) | Pricing at portfolio level requires AAL — which is the integral over return-period loss curves |
| Inundation depth (meters) | Depth-damage functions need depth to estimate claim size, not just event count |
| Flood type (fluvial / pluvial / coastal) | Urban property losses in India are dominated by pluvial (drainage overload); EM-DAT has no such split |
| Spatial granularity below district | Properties within one district can have wildly different risk — pincode or lat/lng lookup is needed |
| Near-real-time monitoring | Portfolio accumulation risk management during active monsoon events |
| Climate projection | Regulatory Solvency II / IRDAI stress-test requirements now demand 2050 scenario exposure |

EM-DAT's `flood_events_per_decade` is useful only as a crude frequency signal. It cannot support underwriting, pricing, or CAT model output, and it systematically undercounts smaller recurring flood events that still cause property damage.

---

## 3. ISRO Bhuvan — Free Indian Government Data

### 3.1 Available Layers

ISRO's Bhuvan geoportal and the linked National Database for Emergency Management (NDEM) provide the most India-specific free flood spatial data in existence. The key layers are:

**Flood Hazard Zonation Atlas (State-Level Atlases)**
- Produced by NRSC/ISRO Disaster Management Support Group (DMSG)
- Coverage: Bihar (1998–2019), Assam (1998–2023), Andhra Pradesh (2000–2020), Uttar Pradesh, West Bengal. Additional flood-prone states (Maharashtra, Odisha, Punjab, Kerala) are partially covered or in progress.
- Methodology: Multi-temporal satellite data — Landsat, IRS, EOS-04 SAR — stacked to compute flood inundation frequency per pixel
- Hazard classes: Very Low (inundated 1–2 times over the observation period), Low (3–5 times), Moderate (6–9 times), High (10+ times). These are frequency-based, not return-period-based.
- Spatial resolution: ~30–56 m depending on the satellite sensor used for that state's period of record
- Temporal coverage: 13–25 years of historical monsoon imagery per state atlas

**Near Real-Time (NRT) Flood Inundation Maps**
- NRSC DMSG operationally maps active flood events within 24–48 hours of peak inundation
- Sensors: EOS-04 SAR (18 m resolution, 160 km swath, all-weather), Sentinel-1 SAR, optical fallback
- ~300 flood maps generated per monsoon season (2023, 2024)
- Processing time: 85–90 seconds per EOS-04 MRS scene (machine-learning pipeline)
- Output: Binary inundated / non-inundated raster, district-level impact statistics
- Historical archive: 25+ years of temporal inundation maps accessible via NDEM

**All-India Cumulative Flood Layer (NDEM)**
- 10-year cumulative flood footprint available for visualization
- Current year + 2 previous years shown in near-real-time on NDEM portal

**Spatial Flood Early Warning System (NHP/Bhuvan)**
- Accessible at bhuvan.nrsc.gov.in/nhp/webgis-flood/map
- Integrates CWC (Central Water Commission) gauge data with NRT flood maps
- Upstream river discharge forecasts linked to spatial inundation extents

**MOSDAC (Space Applications Centre / ISRO)**
- Satellite-derived precipitation: INSAT-3DR rainfall, GPM IMERG near-real-time
- Heavy rainfall alerts, cloudburst warnings — primarily a meteorological input layer, not a flood hazard layer
- Fully free and open access at mosdac.gov.in

### 3.2 API and Access

| Endpoint | Type | Status |
|---|---|---|
| `https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms` | OGC WMS v1.1.1 | Publicly accessible, no auth required |
| `https://bhuvan.nrsc.gov.in/gis/thematic/index.php` | Thematic WMS | Layer-specific endpoints |
| NDEM Portal (ndem.nrsc.gov.in) | Web GIS / download | Interactive, bulk download via documentation request |
| Bhuvan WFS | OGC WFS | Available for select vector layers |
| REST API (flood layers) | REST | "Under development" as of 2024 documentation |

QGIS, ArcGIS, and OpenLayers all connect to Bhuvan WMS natively. For programmatic/API-based access to flood hazard zone polygons (as opposed to map tiles), a formal data request to NRSC is the current path; bulk GeoTIFF/Shapefile downloads are available by application.

### 3.3 Data Parameters

| Parameter | Available? | Notes |
|---|---|---|
| Flood hazard zone class | Yes | Frequency-based (Very Low / Low / Moderate / High) |
| Return period (2yr, 10yr, 100yr etc.) | **No** | Not return-period mapped — this is the single biggest gap |
| Inundation depth (meters) | NRT only | Not in static hazard atlases |
| Flood extent / area | Yes | Both NRT and historical |
| Flood type (fluvial vs pluvial) | Partially | SAR maps capture both, but not labeled by type |
| District/state statistics | Yes | Automated post-event statistics |
| Velocity | No | Not available |
| Climate projections | No | Not available |

### 3.4 Limitations

- **No return-period mapping**: The hazard class is entirely frequency-based over a historical window — you cannot answer "what is the 1-in-100-year flood depth at this pincode?" This is the critical gap for insurance pricing.
- **Incomplete state coverage**: Only ~8–10 of India's 28 flood-prone states have completed hazard atlases as of mid-2025. Southern states (Karnataka, Tamil Nadu, Goa, Maharashtra) are sparse.
- **PDF-first delivery**: Most atlases are published as PDFs with embedded cartographic maps, not machine-readable rasters. Extracting polygon data requires manual georeferencing.
- **No commercial SLA**: Being a government research product, there is no uptime guarantee, no API versioning, and no support contract available.
- **Pincode lookup**: Not natively supported — spatial join against pincode boundary file must be performed by the integrator.

---

## 4. Global Open Source Sources

### 4.1 JRC Global River Flood Hazard Maps v2.1 (European Commission / Copernicus)

**Overview:** Produced by the EC Joint Research Centre using the LISFLOOD hydrological model (river routing) and LISFLOOD-FP hydrodynamic model (inundation simulation). Published March 2024 (v2.1). Available on EU Open Data Portal and Google Earth Engine.

**Data Parameters:**
- 14 bands: flood depth in meters for 7 return periods (RP10, RP20, RP50, RP75, RP100, RP200, RP500), plus 7 corresponding hazard category bands
- Additional bands: `permanent_water_class`, `spurious_depth_category`
- Depth range: 0.1 m to 401.3 m (physically, ~0.1–15 m across most of India)

**Resolution:** 90 meters (3 arc-seconds). Approximately one data point per 2–3 city blocks — insufficient for property-level underwriting but adequate for pincode-level scoring via spatial average or point lookup.

**Temporal Coverage:** Static snapshot (published 2024-03-16). Based on historical hydrological modeling.

**Refresh Cadence:** Irregular major updates (v1 → v2 → v2.1 over ~5 years). Not operational / real-time.

**API / Access:**
- Google Earth Engine: `ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1")` — free with GEE registration
- EU Open Data Portal: direct GeoTIFF download, no API key required
- Microsoft Planetary Computer: available as STAC item

**Pricing:** Free. CC-BY-4.0 with attribution to EC JRC / Copernicus.

**Licensing:** "Available without restriction on use or distribution" — **commercial use is permitted.**

**Accuracy:**
- Captures 67–75% of benchmark flood extent without excessive false positives
- Mean absolute error in flooded fraction: ~5% at 1 km aggregation
- Validated against MODIS NRT flood events globally; India-specific validation limited in published literature
- Primary weakness: the 90 m MERIT DEM used for India has vertical accuracy limitations in low-relief alluvial plains (Bihar, Gangetic plain) where 1–2 m elevation errors translate to large errors in flood extent

**India-Specific Quality:** Global model applied to India without India-specific calibration. Significantly underperforms in braided river systems (Brahmaputra, Ganga delta) and does not model urban drainage or pluvial flooding. Adequate for district/pincode-level screening; not adequate for property-level pricing.

**Platform value:** Provides `RP10_depth`, `RP100_depth`, `RP500_depth` — 7 return-period depth layers at 90 m that can be spatially joined to pincode centroids via Python/GEE.

---

### 4.2 JRC Global Surface Water v1.4

**Overview:** 38 years (1984–2021) of Landsat-based surface water mapping. 4.7 million scenes analyzed.

**Data Parameters (7 bands at 30 m):**
- `occurrence`: % of time water was present (0–100%)
- `seasonality`: months per year with water presence (0–12)
- `recurrence`: % of years with water occurrence (0–100%)
- `transition`: 11-class categorical change map
- `max_extent`: binary maximum-ever water footprint
- `change_abs` / `change_norm`: change detection bands

**Resolution:** 30 meters. The finest-resolution free global water layer available.

**Pricing:** Free. Copernicus Programme open data, attribution required. **Commercial use permitted.**

**API / Access:** Google Earth Engine: `JRC/GSW1_4/GlobalSurfaceWater`. Also via Global Surface Water Explorer (global-surface-water.appspot.com).

**India-Specific Quality:** 38-year Landsat archive provides genuinely good India coverage. The `recurrence` and `max_extent` bands are immediately useful for flagging pincode-level flood risk. Key limitation: cloud-free coverage during active monsoon flooding is sparse — biased toward non-flooded dry-season imagery in heavily cloud-affected regions.

**Platform value:** `max_extent` and `recurrence > 50%` bands can be extracted per pincode at no charge to identify pincodes with chronic, repeated flooding — a strong underwriting exclusion trigger.

---

### 4.3 WRI Aqueduct Floods v2

**Overview:** World Resources Institute's flood hazard and risk platform. Combines JRC hydrological model outputs with socioeconomic exposure data.

**Data Parameters:**
- Single band: `inundation_depth` in meters (0–32.05 m range)
- 10 return periods: 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000-year
- Flood types: **Riverine AND Coastal** — both available, separately
- Coastal: with and without land subsidence adjustment

**Temporal/Scenario Coverage:**
- Current: 2010 baseline
- Future: 2030, 2050, 2080 projections
- Climate scenarios: RCP 4.5 (moderate) and RCP 8.5 (worst-case)
- Sea level rise: 5th, 50th, 95th percentile ranges

**Resolution:** 1,000 meters (1 km). Single pixel covers ~4–5 pincodes in dense urban areas — not suitable for pincode-level differentiation in cities, but usable for district-level aggregation.

**Pricing:** Completely free. **Commercial use permitted.** Attribution to WRI requested.

**API / Access:** Google Earth Engine: `WRI/Aqueduct_Flood_Hazard_Maps/V2`. Direct download from WRI data portal. Interactive tool at wri.org/applications/aqueduct/floods.

**India-Specific Quality:** Same global model as JRC (GloFAS discharge routing). The coastal flood component adds genuine value for India's 7,500 km coastline: cyclone-surge-prone states (Odisha, AP, Tamil Nadu, Gujarat) benefit from coastal inundation depth at multiple return periods. The 2050/2080 climate scenarios are unique among free sources and directly relevant to regulatory stress-test requirements.

**Key differentiator vs JRC:** Future climate projections and coastal flood — JRC GloFAS v2.1 is riverine only. Aqueduct provides the **only free coastal flood layer** for India at return-period resolution.

---

### 4.4 Google Flood Hub / Flood Forecasting API

**Overview:** Google's AI-powered riverine flood forecasting system, operational since 2018, covering India via partnership with the Central Water Commission (CWC).

**Data Provided:**
- Hydrologic forecast: river discharge forecast at daily steps, up to 7-day horizon
- Flood status: current severity classification + inundation extent maps
- Updated multiple times per day
- Coverage: 1,800+ forecast sites globally; India priority partner since 2021 monsoon (245 million people covered)

**Operational Coverage India:** Yes. Covers major river systems including Ganga, Brahmaputra, Narmada, Mahanadi, Godavari, Krishna, Cauvery basins. Partnership with CWC provides gauge assimilation.

**API Access:**
- REST API available via Google Cloud, requires API key + waitlist approval
- License: CC BY 4.0 — **commercial use permitted**
- **Pricing: Free** — explicitly "offered at no charge"

**What It Provides vs What It Lacks:**
- ✅ Provides: real-time flood onset warning (days ahead), current inundation extent during active events
- ❌ Does NOT provide: return-period hazard maps, depth at a specific location for actuarial purposes, historical static hazard zones

**Platform value:** Not suitable as a primary underwriting data source. Extremely valuable as a **real-time portfolio risk monitoring** layer — flag pincodes currently under active flood warning during monsoon season.

---

### 4.5 Copernicus Emergency Management Service (CEMS) / GloFAS

**CEMS On-Demand Mapping:**
- Activates within hours of a declared disaster
- Produces before/during/after satellite-derived flood extent maps
- **Free of charge** globally, including India
- Access: mapping.emergency.copernicus.eu — activation by authorized entities (national disaster management agencies, UN bodies). Private insurers cannot directly request activation.
- Licensing: Free, no commercial restrictions on derived products

**GloFAS v4 (Global Flood Awareness System):**
- Operational version (v4, released July 2023): 0.05° resolution (~5 km)
- 15-day probabilistic flood forecast via ECMWF-ENS
- Access: Copernicus EWDS (launched September 2024) via OGC-compliant API
- **Free for all users including commercial**
- Historical reanalysis: 1984–present

**For the Platform:** GloFAS provides a free near-real-time flood monitoring signal. At 5 km resolution it cannot differentiate risk within a district, let alone a pincode.

---

### 4.6 NASA MODIS/VIIRS NRT Global Flood Product

**Overview:** LANCE produces daily global flood mapping from MODIS and VIIRS optical sensors. Operational since 2021 (MCDWD product), with historical archive from 2003.

**Data Parameters:**
- Binary flood detection: flooded / non-flooded / no observation (cloud/night)
- Compositing periods: 1-day, 2-day, 3-day (to reduce cloud false positives)
- Depth: Not provided — extent only

**Resolution:** ~250 meters (MODIS)

**Pricing:** Free. NASA Earthdata — open access. **Commercial use unrestricted (US Government works).**

**India-Specific Quality:** Cloud cover during Indian monsoon season (June–September) is the primary limitation — optical sensors cannot see through monsoon cloud decks. SAR-based alternatives (NRSC EOS-04, Sentinel-1) are more reliable for India during active floods.

**Platform value:** The 23-year historical archive is useful for building flood frequency maps. NRT product supplements real-time monitoring but should be used alongside SAR-based products for India.

---

### 4.7 NEER India Flood Atlas (flood.neer.io) — Emerging Open Source

**Overview:** A new public-good project providing India's first statewide publicly accessible 1%-annual-chance (100-year) flood hazard maps at ~30 m resolution. Built on GEDTM30 terrain data, ICESat-2 vertical calibration, and HydroRIVERS.

**Coverage (as of mid-2025):** Tamil Nadu & Puducherry, Andhra Pradesh, Telangana, Karnataka, Kerala, Goa. Maharashtra planned.

**Data Parameters:**
- Modeled flood depth (meters) at 100-year return period — free and open
- Building footprint exposure counts
- Road/railway network exposure
- DEM accuracy: Tamil Nadu 1.04 m MAE, Kerala 1.65 m MAE vs ICESat-2

**Additional Return Periods (on request):** 2, 5, 10, 25, 50, 500, 1000-year; future climate scenarios (2100, SSP2-4.5 and SSP5-8.5).

**Pricing:** Free for 100-year layer. Contact for other return periods.

**Licensing:** Open access, CC-BY 4.0.

**Limitations:** Not an official government product. Coverage currently limited to 6 southern/western states.

---

## 5. Commercial Global Competitors

### 5.1 JBA Risk Management ("The Flood People")

**Overview:** UK-headquartered specialist flood risk data company. Recently opened India office (Bangalore). Widest geographic commercial flood data coverage globally.

**India Flood Product:**
- **Resolution:** 30 m for India
- **Return Periods:** 1-in-5 to 1-in-1,000 year (7+ return period map layers)
- **Flood Types:** Fluvial (riverine) + Surface water (pluvial) + Coastal. All three types modeled separately with defended and undefended variants.
- **Parameters:** Flood depth (meters), flood scores (categorical risk ratings), "Pricing Data" — JBA's own derived risk scores optimized for insurance pricing
- **Climate:** Future climate scenarios available (released 2024)

**API / Access:**
- REST API for point or polygon queries — returns depth, score, and pricing data fields
- WMTS for map tile streaming
- Direct data delivery (bulk GeoTIFF/Shapefile)
- Transactional (pay-per-lookup) or annual/multi-year license
- Resellers: integrated into Nasdaq Simplitium

**Pricing:** Enterprise pricing, not publicly disclosed. Estimated $30K–$100K USD/year for full India license with API.

**Licensing:** Commercial use permitted under license; cannot resell raw JBA data but can embed scores in your own product.

**Accuracy:**
- JBA publishes validation methodology comparing modeled flood maps against Sentinel-2 NDWI
- India-specific calibration: JBA has invested in India-specific terrain and hydrological model improvements following the Bangalore office; calibrated against Delhi (2023), Chennai, Bengaluru flood events

**India-Specific Quality:** At 30 m with all three flood types (including pluvial), JBA is one of the best-calibrated commercial options for Indian property insurers. Suitable for pincode-level scoring via spatial join.

---

### 5.2 Fathom Global / Fathom-Swiss Re

**Overview:** Bristol University spin-out acquired by Swiss Re in December 2023. Peer-reviewed academic pedigree with operational commercial products. Fathom 3.0 (2023) is the current global product.

**India Product:**
- **Resolution:** 30 m globally (FABDEM+ DEM which corrects for vegetation and building bias in SRTM)
- **Return Periods:** 5, 10, 20, 50, 75, 100, 200, 250, 500, 1000-year
- **Flood Types:** Fluvial + Pluvial + Coastal — first global product to cover all three types simultaneously
- **Parameters:** Inundation depth (meters), defended and undefended variants separately
- **Climate:** 2030, 2050, 2080 future scenarios (SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5)

**Non-Commercial Free Tier:**
- Fathom 3.0 available free for non-commercial use via World Bank data catalog
- India is NOT in the list of 16 countries receiving free access under the World Bank agreement

**Commercial Pricing:** Not publicly disclosed. Estimated $50K–$200K USD/year for India. Historical one-off city datasets on OasisHub: e.g., Chennai at ~£1,800 (Fathom v1-era data).

**API / Access:** RESTful HTTP API + gRPC SDK (Python preferred). Portal access for non-API users. Integration with Swiss Re CatNet.

**Accuracy:**
- Published peer-reviewed validation: CSI ~0.75 for flood extent globally (Wing et al., Water Resources Research, 2024)
- Average water level deviation from observations: ~0.6 m

**India-Specific Quality:** Strong — FABDEM+ gives materially better terrain accuracy in India's alluvial plains than SRTM-based products. The pluvial flood layer is particularly important for Indian urban insurers.

---

### 5.3 Verisk (AIR Worldwide) India Flood CAT Model

**Overview:** Verisk Extreme Event Solutions provides the industry-standard catastrophe models used by primary insurers and reinsurers for capital allocation, treaty pricing, and regulatory solvency capital. Delivered via Touchstone/Touchstone Re platform.

**India Flood Product:**
- **Resolution:** 5 m for LiDAR-available areas; 30–90 m estimated for rural areas
- **Return Periods:** Stochastic event catalog covering 10,000-year loss distribution; reporting at 10, 25, 50, 100, 250, 500-year
- **Flood Types:** Fluvial (inland flood) + Pluvial (monsoon surface water)
- **Parameters:** Event mean damage ratios, vulnerability curves (100+ structure types), insured loss estimates, AAL, OEP, AEP

**Pricing:** Enterprise-only. Typically $200K–$500K+ USD/year for full India peril access.

**API / Access:** No public API. Delivered through Verisk's Touchstone platform (on-premise or cloud). Not suitable for real-time point-of-sale API integration — designed for portfolio-level batch analysis.

**Accuracy:** Industry-reference standard. Calibrated against CWC gauge data and historical Indian insurer loss data (GIC Re data). No independent published accuracy metrics (proprietary model).

**Licensing:** Proprietary. Scores and derived metrics cannot be resold without explicit sub-licensing.

**India-Specific Quality:** Highest quality available. Calibrated against actual Indian insurance loss data. Primary weakness: inaccessible to small/mid-market insurtechs due to cost and platform complexity.

---

### 5.4 Moody's RMS FloodModel India

**Overview:** RMS (now Moody's Catastrophe Risk) has a dedicated India Inland Flood Model that has been the reinsurance market standard for Indian flood treaty pricing.

**India Flood Product:**
- **Resolution:** 10 meters for flood depth output across all of India — **finest resolution among CAT model vendors for India**
- **Return Periods:** 8 standard: 10, 25, 50, 100, 200, 250, 500, 1000-year
- **Event Set:** 125,000 stochastic events across 9,033 catchments throughout India
- **Flood Types:** Fluvial + Pluvial — explicitly separated
- **Model Inputs:** 125 years of historical rainfall + 50 years of river flow records
- **Vulnerability:** 1,000+ India-specific vulnerability curves for residential, commercial, and industrial occupancies

**Pricing:** Enterprise-only. Platform license: $150K–$400K USD/year range. India-specific model license additional.

**API / Access:**
- Intelligent Risk Platform (IRP): cloud-based, REST API via developer.rms.com
- Location Intelligence API: lat/lng → flood risk score for individual locations
- Moody's Global Flood Maps on ESRI Marketplace (ArcGIS integration) — potentially lower-cost access point for the flood map layer

**Accuracy:** Calibrated against GIC Re claims data — the only model with acknowledged actual Indian insurance loss calibration.

**India-Specific Quality:** Best-in-class for reinsurance-grade India flood analysis. The 10 m resolution and 1,000+ Indian vulnerability curves provide more actuarially defensible outputs than any other solution.

---

## 6. Commercial Domestic India Competitors

### 6.1 RMSI India FloodRisk 2.0 — Domestic Market Leader

**Overview:** RMSI (Risk Management Solutions India, Noida) is India's leading domestic GIS and risk modeling firm. India FloodRisk 2.0 is the first countrywide stochastic flood model built specifically for the Indian insurance market by an Indian company.

**Technical Specifications:**
- **Coverage:** All 19,000+ pincodes across India — native pincode resolution
- **River basins:** 28 main basins, 3,400 sub-basins modeled
- **Event set:** 80,000 stochastic flood events
- **Historical data:** 50 years of river flow records + 125 years of historical rainfall
- **Terrain:** 5-meter resolution LULC exposure data (2020–21)
- **Vulnerability:** India-specific vulnerability functions calibrated against multiple Indian flood events
- **Calibration events:** Delhi (2003, 2023), Bengaluru (2022, 2024), Mumbai (2024), Tamil Nadu/AP (2024), Gujarat, Uttarakhand, J&K, Chennai, Kerala
- **Oasis integration:** Produces EP curves (OEP + AEP), AAL, and return period losses via the Oasis Loss Modeling Framework

**PIER Platform (Profiler for Insurance Exposure & Risk):**
- Cloud-based SaaS layer on top of FloodRisk model
- Location risk profile reports (lat/lng or pincode input)
- Return period hazard intensity maps for flood, earthquake, cyclone
- Portfolio accumulation monitoring across pincodes
- Available at pieronline.rmsi.com

**Pricing:**
- PIER: "Low entry ticket" — estimated Rs. 5–25 lakh/year for basic access (unconfirmed)
- India FloodRisk 2.0 full CAT model: estimated Rs. 50–200 lakh/year for full Oasis integration with API

**API / Access:** PIER web + enterprise API (lat/lng or pincode input). Full model runs in Oasis framework.

**Licensing:** Commercial product. Derived scores can be embedded in insurance pricing tools under license. Open to white-label and data-as-a-service arrangements.

**India-Specific Quality:** The best India-specific calibration available in the non-Verisk/Moody's tier. Built by Indian engineers with Indian data, calibrated against Indian events, priced for the Indian market. Primary limitation: no real-time / NRT capability — this is a static stochastic model for actuarial analysis.

---

### 6.2 GeoIQ — Location Intelligence API

**Overview:** GeoIQ (geoiq.ai) provides 3,000+ location attributes via API at 200 m, 500 m, and 1,000 m radius granularity around any lat/lng in India.

**Flood-Relevant Capabilities:**
- Proximity to water bodies, flood zone indicators, terrain slope
- The platform aggregates multiple public and proprietary datasets
- District and pincode level aggregation supported

**Pricing:** Custom / subscription plans. Estimated range: Rs. 2–15 lakh/year for API access depending on call volume.

**API:** REST API — 3,000+ attributes per point query, sub-second latency. JSON output.

**Flood Data Quality:** GeoIQ is a **data aggregator, not a flood modeler.** Flood-related signals are derived from third-party datasets (likely JRC, Bhuvan, OSM). Does not provide return-period flood depths or actuarial-grade risk metrics. Useful as a pincode enrichment layer for first-pass screening only.

---

### 6.3 Skymet Weather Services — Flood Forecast API

**Overview:** India's first and largest private weather forecasting company (founded 2003, Noida). Provides weather, agri, and risk services.

**Flood-Relevant APIs:**
- Rainfall forecasts (7–15 day) at district and tehsil level
- Historical rainfall data since 1971
- Heavy rainfall alerts and weather advisories
- Monsoon tracking and rainfall anomaly data
- No standalone "flood forecast" API — flood risk is inferred from rainfall data

**Pricing:** Estimated Rs. 5–25 lakh/year for data API access depending on volume and parameters.

**India-Specific Quality:** Strong for meteorological inputs (rainfall, temperature, soil moisture). Weak for flood hazard data specifically — Skymet provides the **precipitation trigger, not the hydrological flood response.** Valuable as a complement to a flood hazard model, not a substitute.

---

### 6.4 IIT Bombay / IIT Roorkee / IIT Delhi Flood Models

**IIT Bombay:**
- AI flood prediction system: 93% accuracy in flood-prone area identification
- 30 m resolution flood inundation maps for Western Ghats coastal belt
- Not commercially licensed as a standard data product

**IIT Delhi (HydroSense Lab):**
- INDOFLOODS database (published January 2025 on Zenodo): comprehensive India flood event database with catchment attributes, peak discharge, flood volume, event duration
- India Flood Inventory — Impacts (IFI-Impacts): 1967–2023 geospatial database
- Free access on Zenodo and GitHub (hydrosenselab/India-Flood-Inventory)
- Excellent research resource for historical validation; not suitable for real-time or return-period scoring layer

**Verdict:** Academic products with high research quality but no commercial support, no SLA, and no API infrastructure for production integration. Useful for validation and calibration benchmarking only.

---

### 6.5 ICEYE — SAR Satellite Real-Time Flood Monitoring

**Overview:** Finnish SAR satellite operator with 50+ constellation satellites. Provides near-real-time flood extent maps for insurance claims and portfolio management.

**Capabilities:**
- 4x+ daily revisit with SAR — works through clouds and night
- Flood depth and extent within hours of flood peak
- Primarily for claims triage (which properties are currently flooded?) and portfolio rapid impact assessment
- Partnerships with reinsurers (Munich Re, Swiss Re) and primary insurers

**Pricing:** Enterprise only. Estimated $50K–$200K USD/year for operational subscription.

**For the Platform:** ICEYE is a **claims-time tool, not an underwriting-time hazard scoring tool.** Relevant for a future loss estimation / parametric trigger layer, not for the initial platform integration.

---

## 7. Comparison Tables

### 7.1 Data Parameters Matrix

| Source | Flood Type | Return Period Depth | Depth (m) | Velocity | Extent/Area | NRT Status | Climate Future | India Pluvial |
|---|---|---|---|---|---|---|---|---|
| Bhuvan NRSC Hazard Atlas | R | No (frequency class) | NRT only | No | Yes | Yes | No | Partial |
| JRC GloFAS v2.1 | R | **Yes** (10–500yr, 7 levels) | Yes | No | Yes | No | No | No |
| JRC Global Surface Water | R+C | Historical recurrence | No | No | Yes | No | No | No |
| WRI Aqueduct Floods v2 | R+C | **Yes** (1–1000yr, 10 levels) | Yes | No | Yes | No | **Yes** (2030/50/80) | No |
| Google Flood Hub API | R | Forecast only (7-day) | Extent only | No | Yes | Yes | No | No |
| GloFAS v4 | R | Reanalysis | Discharge | No | Yes | Yes | No | No |
| NASA MODIS NRT | R+C | No (historical frequency) | No (extent only) | No | Yes | Yes | No | No |
| NEER India Flood Atlas | R | **Yes** (2–1000yr on request) | Yes | No | Yes | No | **Yes** (2100) | No |
| Fathom 3.0 | R+P+C | **Yes** (5–1000yr, 10 levels) | Yes | No | Yes | No | **Yes** (2030/50/80) | **Yes** |
| JBA Global Flood Maps | R+P+C | **Yes** (5–1000yr) | Yes | Yes (partial) | Yes | No | **Yes** | **Yes** |
| RMSI India FloodRisk 2.0 | R+P | **Yes** (stochastic AAL/OEP) | Yes | No | Yes | No | No | **Yes** |
| Moody's RMS India Flood | R+P | **Yes** (10–1000yr, 8 levels) | Yes | Yes | Yes | No | **Yes** | **Yes** |
| Verisk AIR India Flood | R+P | **Yes** (full stochastic) | Yes | Yes | Yes | No | **Yes** | **Yes** |
| ICEYE Flood Insights | R+C | No (NRT only) | Yes | No | Yes | Yes | No | Partial |
| GeoIQ | Indicator only | No | No | No | No | No | No | No |
| Skymet | Precip trigger | No | No | No | No | Yes | Partial | Partial |

**Key: R=Riverine/Fluvial, P=Pluvial/Surface Water, C=Coastal**

---

### 7.2 Resolution & Coverage Matrix

| Source | Spatial Resolution | India Coverage | Pincode Lookup? | Urban Pluvial | Admin Unit |
|---|---|---|---|---|---|
| Bhuvan NRSC Atlas | ~30–56 m (raster) | 8–10 flood-prone states | Spatial join only | No | State/District |
| JRC GloFAS v2.1 | **90 m** | All India (riverine) | Spatial join | No | Global grid |
| JRC Global Surface Water | **30 m** | All India | Spatial join | No | Global grid |
| WRI Aqueduct Floods | 1,000 m | All India | Poor (too coarse) | No | Global grid |
| Google Flood Hub | ~500 m–1 km | Major rivers | No — real-time only | No | Gauge/reach |
| GloFAS v4 | 5,000 m | Major rivers India | No | No | Gauge/reach |
| NASA MODIS NRT | 250 m | All India | Spatial join | No | Global grid |
| NEER Flood Atlas | ~30 m | 6 southern states | Spatial join | No | State/District |
| Fathom 3.0 Commercial | **30 m** | All India | API point query | Yes | Any polygon |
| JBA Global Flood Maps | **30 m** | All India | API point query | Yes | Any polygon |
| RMSI FloodRisk 2.0 | ~5 m exposure; 30 m hazard | **All 19,000+ pincodes** | **Native pincode** | Yes | Pincode native |
| Moody's RMS India | **10 m** | All India | API point query | Yes | Any polygon |
| Verisk AIR India | ~30–90 m estimated | All India | Platform query | Yes | Any polygon |
| ICEYE | SAR ~0.5–5 m | On-demand | NRT only | Partial | Asset-level |
| GeoIQ | 200 m radius | All India | Yes (native) | Indicator | Pincode/lat-lng |
| Skymet | District/tehsil | All India | District level | No | District |

---

### 7.3 Pricing Matrix

| Source | Cost Model | Approx. Price (India) | API Available | Commercial License |
|---|---|---|---|---|
| Bhuvan NRSC | Free (government) | Free | WMS (limited); REST in dev | Open — attribution |
| JRC GloFAS v2.1 | Free | Free | GEE / direct download | CC BY 4.0 — **commercial OK** |
| JRC Global Surface Water | Free | Free | GEE / WMS | CC BY 4.0 — **commercial OK** |
| WRI Aqueduct Floods | Free | Free | GEE / direct | Open — **commercial OK** |
| Google Flood Hub | Free | Free | REST (waitlist) | CC BY 4.0 — **commercial OK** |
| GloFAS / CEMS | Free | Free | OGC API via EWDS | Open |
| NASA MODIS NRT | Free | Free | GIBS/WMTS + download | US Gov public domain |
| NEER India Flood Atlas | Free (100yr) / request | Free | Request-based | Open CC-BY 4.0 |
| Fathom 3.0 Non-commercial | Free (not India in list) | Contact info@fathom.global | No | Non-commercial only |
| Fathom 3.0 Commercial | Enterprise subscription | ~$50K–$200K/yr USD est. | REST + gRPC SDK | Commercial license required |
| JBA Global Flood Maps | Enterprise | ~$30K–$100K/yr USD est. | REST API + WMTS | Commercial license |
| RMSI PIER (SaaS) | Subscription "low entry" | ~Rs. 5–25 lakh/yr est. | Web + API enterprise | Commercial license |
| RMSI FloodRisk 2.0 (full) | Enterprise | ~Rs. 50–200 lakh/yr est. | Oasis + API | Commercial license |
| Moody's RMS India | Enterprise platform | ~$150K–$400K/yr USD est. | IRP REST API | Proprietary |
| Verisk AIR India | Enterprise platform | ~$200K–$500K+/yr USD est. | Touchstone platform | Proprietary |
| ICEYE Flood Insights | Enterprise subscription | ~$50K–$200K/yr USD est. | REST API | Commercial license |
| GeoIQ | Subscription | ~Rs. 2–15 lakh/yr est. | REST API | Commercial license |
| Skymet Weather | Enterprise subscription | ~Rs. 5–25 lakh/yr est. | REST API | Commercial license |

*All commercial prices are estimates based on industry benchmarks — actual pricing requires direct vendor engagement.*

---

### 7.4 Open Source vs Commercial: The Delta

This section quantifies what you pay for when choosing commercial over open source.

**Gap 1: Pluvial (Surface Water) Flood — The Biggest Miss**
- Every free global dataset (JRC, Aqueduct, MODIS, GloFAS) covers only riverine flooding.
- India's largest urban property loss events are pluvial: Mumbai 2005, Chennai 2015, Bengaluru 2022, Delhi 2023 — all primarily surface drainage overload events.
- Only commercial products (Fathom, JBA, RMSI, Moody's RMS) model urban surface-water flooding.
- **This single gap justifies commercial investment for any property insurer writing urban risks.**

**Gap 2: Return-Period Depth vs Frequency Count**
- Free government data (Bhuvan) provides frequency class (very low / low / moderate / high) based on observed inundation count.
- This is not usable for pricing. Pricing requires: "What is the expected depth at this property in a 1-in-100-year event?"
- JRC GloFAS v2.1 provides return-period depth at 90 m — a major improvement over Bhuvan, free, and commercially usable.
- Commercial products provide return-period depth at 10–30 m with India-specific calibration.

**Gap 3: India DEM Accuracy**
- The SRTM DEM (used in older global products) has systematic errors of 3–12 m in India's flat alluvial plains (Gangetic plain, Brahmaputra valley) — the precise areas most flood-prone.
- Commercial products (Fathom with FABDEM+, Moody's RMS with proprietary terrain, RMSI with 5 m LULC) use better-corrected terrain, which directly improves flood extent accuracy.
- NEER Flood Atlas uses ICESat-2 corrected terrain — a free improvement for southern India specifically.

**Gap 4: Insurance Financial Outputs (AAL, OEP, AEP)**
- Free and semi-commercial data provide hazard (depth, extent). They do not provide financial loss estimates.
- Only RMSI FloodRisk 2.0 (with Oasis), Moody's RMS, and Verisk AIR produce actuarial loss metrics (Average Annual Loss, Occurrence Exceedance Probability curves) that IRDAI expects for solvency capital modeling.
- The delta between "flood depth at return period" (available free) and "AAL in rupees per policy" (requires commercial CAT model + vulnerability functions) is unbridgeable with open source alone.

**Gap 5: Real-Time Operational Monitoring**
- NASA MODIS (250 m, optical, cloud-impacted) and Google Flood Hub (riverine only, no depth) are free.
- ICEYE SAR (5 m, cloud-penetrating, depth-capable) provides claims-time property-level flood monitoring that is categorically different from free alternatives.

**Gap 6: Validation and Regulatory Defensibility**
- Using JRC or Aqueduct data in a regulatory filing requires documenting validation against Indian observed events — significant internal engineering effort.
- RMSI, Moody's RMS, and Verisk products come with validation documentation that satisfies IRDAI and reinsurer due diligence requirements out of the box.

---

## 8. Recommendation for Platform Integration

### 8.1 Recommended Integration Path (Phased)

**Phase 1: Immediate (Free, ship in 4–6 weeks)**

Integrate the following free sources to replace EM-DAT's crude `flood_events_per_decade` and immediately provide return-period flood depth at pincode level:

1. **JRC GloFAS v2.1** via Google Earth Engine: Extract `RP10_depth`, `RP50_depth`, `RP100_depth`, `RP500_depth` for each pincode centroid. 90 m resolution, free, CC BY 4.0 commercial use OK.

2. **JRC Global Surface Water v1.4** via GEE: Extract `max_extent` (binary), `recurrence` (% of years flooded), and `seasonality` fields per pincode. 30 m, free.

3. **WRI Aqueduct Floods v2** via GEE: Extract coastal flood `inundation_depth` at RP100 for coastal pincodes. Only free return-period coastal layer. 1 km, free.

4. **Bhuvan NRSC WMS** for flood hazard zone class (where available — 8–10 states): Add as `nrsc_hazard_class` (Very Low / Low / Moderate / High / Not Mapped) via WMS spatial query against pincode polygon.

5. **NEER India Flood Atlas** API (request access for insurers): 100-year flood depth at 30 m for 6 southern states — highest free-tier resolution available for these states.

Estimated engineering effort: 3–5 weeks for a Python pipeline pulling from GEE + Bhuvan WMS + NEER API.

---

**Phase 2: Mid-term (6–18 months) — Commercial Upgrade for Underwriting**

Primary recommendation: **RMSI PIER + India FloodRisk 2.0**

- Best India-market fit: built by Indian engineers, priced in INR, calibrated against Indian events, native pincode coverage
- PIER's "low entry ticket" SaaS enables initial deployment without full Oasis CAT model infrastructure
- Provides the critical gap-fillers: pluvial flood, AAL, OEP/AEP curves, India-specific vulnerability functions
- Compatible with Oasis for future reinsurance treaty optimization

Alternative if budget permits global-standard accuracy: **Fathom Commercial API**
- 30 m global coverage with pluvial + coastal + climate scenarios
- REST/gRPC SDK cleanly integrates with Next.js backend
- Backed by Swiss Re — resellers and reinsurance treaty counterparts will recognize it

---

**Phase 3: Advanced (18+ months) — Real-Time Portfolio Monitoring**
- **Google Flood Hub API** (free, CC BY 4.0): Add real-time flood status dashboard for active monsoon season monitoring of portfolio concentration
- **ICEYE or NASA NRT** (as budget allows): Claims triage layer for detecting which properties are currently inundated during active events

---

### 8.2 New Schema Fields to Add

Based on the data sources surveyed, the following fields should be added to the existing `district_risk_index` and `pincode_risk_index` tables:

```sql
-- PHASE 1: Free sources (JRC + Aqueduct + Bhuvan)
-- Add to pincode_risk_index
jrc_flood_depth_rp10_m        NUMERIC(6,2),   -- JRC GloFAS v2.1, 1-in-10-year depth (m)
jrc_flood_depth_rp50_m        NUMERIC(6,2),   -- JRC GloFAS v2.1, 1-in-50-year depth (m)
jrc_flood_depth_rp100_m       NUMERIC(6,2),   -- JRC GloFAS v2.1, 1-in-100-year depth (m)
jrc_flood_depth_rp500_m       NUMERIC(6,2),   -- JRC GloFAS v2.1, 1-in-500-year depth (m)
jrc_gsw_max_extent            BOOLEAN,        -- JRC GSW v1.4: ever observed as water body
jrc_gsw_recurrence_pct        NUMERIC(5,2),   -- JRC GSW v1.4: % of years water present
jrc_gsw_seasonality_months    SMALLINT,       -- JRC GSW v1.4: months/year with water
aqueduct_coastal_rp100_m      NUMERIC(6,2),   -- WRI Aqueduct: coastal flood depth 1-in-100yr
aqueduct_riverine_rp100_m     NUMERIC(6,2),   -- WRI Aqueduct: riverine flood depth 1-in-100yr
nrsc_hazard_class             VARCHAR(20),    -- Bhuvan: Very Low/Low/Moderate/High/Not Mapped
neer_flood_depth_rp100_m      NUMERIC(6,2),   -- NEER Atlas: 100yr depth (southern states only)
flood_data_sources            TEXT[],         -- Array of sources used for this pincode
flood_data_updated_at         TIMESTAMPTZ     -- Last refresh timestamp

-- PHASE 2: Commercial source additions (RMSI or Fathom)
rmsi_flood_zone               VARCHAR(20),    -- RMSI: risk zone class
rmsi_aal_per_sqm              NUMERIC(10,2),  -- RMSI: Average Annual Loss (Rs. per sq m)
rmsi_rp100_depth_m            NUMERIC(6,2),   -- RMSI: 1-in-100yr riverine + pluvial depth
rmsi_pluvial_risk_class       VARCHAR(20),    -- RMSI: urban surface water risk class
fathom_rp100_fluvial_m        NUMERIC(6,2),   -- Fathom: 1-in-100yr fluvial depth
fathom_rp100_pluvial_m        NUMERIC(6,2),   -- Fathom: 1-in-100yr pluvial depth
fathom_rp100_coastal_m        NUMERIC(6,2),   -- Fathom: 1-in-100yr coastal depth
flood_composite_score         NUMERIC(5,2),   -- Platform-computed composite (0-100)
flood_composite_method        VARCHAR(50)     -- Scoring method version
```

---

### 8.3 Integration Approach

**Step 1: GEE Extraction Pipeline (Phase 1)**

```python
# JRC GloFAS v2.1 extraction per pincode
import ee
ee.Initialize()

flood_hazard = ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1").first()
rp100_depth = flood_hazard.select("RP100_depth")

# Load pincode centroids as FeatureCollection
pincodes = ee.FeatureCollection("projects/your-project/pincode_centroids")

# Sample raster at each pincode centroid (point extraction)
samples = rp100_depth.sampleRegions(
    collection=pincodes,
    scale=90,
    geometries=True
)
# Export to CSV → load into Neon DB
```

**Step 2: Bhuvan WMS Integration**

Use the WMS endpoint `https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms` with GetFeatureInfo requests against the flood hazard zone polygon layer for each pincode bounding box. Where polygon data is not machine-readable, apply spatial join against NDEM-provided Shapefile downloads (requested from NRSC).

**Step 3: RMSI PIER API Integration (Phase 2)**

RMSI PIER exposes a web + enterprise API that accepts lat/lng or pincode and returns risk scores. Integrates directly into the Next.js API layer as a middleware lookup — on policy issuance, query PIER for the property's flood risk score, store in database, use in pricing model.

**Step 4: Real-Time Monitoring (Phase 3)**

Google Flood Hub API (CC BY 4.0, free) via REST: query flood status by gauge location, map to pincodes in the portfolio that fall within active flood reach. Surface as a portfolio dashboard alert.

---

## 9. Bottom Line Summary

| Question | Answer |
|---|---|
| **Can we ship flood risk data for free?** | Yes — JRC GloFAS v2.1 + Aqueduct gives return-period depth at 90 m / 1 km resolution, commercially usable, ready in 4–6 weeks |
| **What does free miss?** | Urban pluvial flooding (the biggest India risk), sub-30m resolution, actuarial AAL outputs, regulatory-defensible validation |
| **Best free source for India?** | JRC GloFAS v2.1 (90 m, riverine, 7 return periods) + JRC GSW (30 m, historical recurrence) |
| **Best Bhuvan-specific data?** | NRSC Flood Hazard Zone Class (Very Low → High), available for 8–10 states via WMS |
| **Best commercial for Indian insurtech?** | RMSI PIER — India-native, pincode-first, "low entry ticket" SaaS, calibrated against actual Indian events |
| **Best commercial for reinsurance-grade?** | Moody's RMS FloodModel India (10 m, 1,000+ vulnerability curves) or Fathom (30 m, all three flood types, Swiss Re backed) |
| **What does Bhuvan give that nothing else does?** | Near-real-time SAR flood inundation maps (24–48 hr latency) for active events, free, India-specific, 18 m EOS-04 resolution |
| **What's the single biggest data gap?** | Pluvial (urban surface-water) flood — no free source covers this; it's the dominant peril for Indian urban property insurers |

---

## 10. Implementation Plan: Flood Data Pipeline & API

> **Status:** Approved for Phase 1 implementation (free sources only, Pan-India)
> **Architecture:** Standalone `/api/environmental/flood/pincode` endpoint — separate from the existing `/api/environmental/district` endpoint. All existing disaster fields (`flood_events_per_decade`, `cyclone_events_per_decade`, `disaster_frequency_score`) remain unchanged in the current endpoint. The new flood endpoint is additive only.

---

### 10.1 Complete Database Schema — New Fields

All fields below are **added** to both `pincode_risk_index` and `district_risk_index` tables. No existing columns are removed.

**Naming convention:** Technical source-prefixed names in DB (e.g., `jrc_rp100_depth_m`). The API exposes these with plain-English names (e.g., `flood_depth_100yr_event_m`).

#### JRC GloFAS v2.1 — Return Period Depths (7 return periods)

| DB Column | Type | Source Band | Notes |
|---|---|---|---|
| `jrc_rp10_depth_m` | `NUMERIC(6,2)` | `RP10_depth` | Depth (m) in a 1-in-10-year flood event |
| `jrc_rp20_depth_m` | `NUMERIC(6,2)` | `RP20_depth` | Depth in a 1-in-20-year event |
| `jrc_rp50_depth_m` | `NUMERIC(6,2)` | `RP50_depth` | Depth in a 1-in-50-year event |
| `jrc_rp75_depth_m` | `NUMERIC(6,2)` | `RP75_depth` | Depth in a 1-in-75-year event |
| `jrc_rp100_depth_m` | `NUMERIC(6,2)` | `RP100_depth` | Depth in a 1-in-100-year event (insurance standard) |
| `jrc_rp200_depth_m` | `NUMERIC(6,2)` | `RP200_depth` | Depth in a 1-in-200-year event |
| `jrc_rp500_depth_m` | `NUMERIC(6,2)` | `RP500_depth` | Depth in a 1-in-500-year event |
| `jrc_rp100_class` | `SMALLINT` | `RP100_class` | Categorical hazard: 1=Low 2=Medium 3=High 4=Very High |
| `jrc_spurious_depth_flag` | `SMALLINT` | `spurious_depth_category` | Data quality: 0=OK 1=questionable depth value |

#### JRC Global Surface Water v1.4 — 38-Year Historical Water (1984–2021)

| DB Column | Type | Source Band | Notes |
|---|---|---|---|
| `gsw_occurrence_pct` | `NUMERIC(5,2)` | `occurrence` | % of time pixel was water across 38 years |
| `gsw_seasonality_months` | `SMALLINT` | `seasonality` | Months per year with water present (0–12) |
| `gsw_recurrence_pct` | `NUMERIC(5,2)` | `recurrence` | % of years that had any water occurrence |
| `gsw_transition_class` | `SMALLINT` | `transition` | 11-class change map (1=permanent water…11=new permanent) |
| `gsw_max_extent` | `BOOLEAN` | `max_extent` | TRUE if pixel was ever observed as water 1984–2021 |
| `gsw_change_abs` | `SMALLINT` | `change_abs` | Net change signal: positive = more water, negative = less water over 38 years |

#### WRI Aqueduct Floods v2 — Riverine, Coastal, Climate Projections

| DB Column | Type | Notes |
|---|---|---|
| `aqd_riverine_rp100_m` | `NUMERIC(6,2)` | Riverine flood depth at 100yr return period, 2010 baseline |
| `aqd_riverine_rp500_m` | `NUMERIC(6,2)` | Riverine flood depth at 500yr return period, 2010 baseline |
| `aqd_coastal_rp100_m` | `NUMERIC(6,2)` | Coastal storm surge depth at 100yr return period (no subsidence adjustment) |
| `aqd_coastal_rp100_subsidence_m` | `NUMERIC(6,2)` | Coastal 100yr depth **with land subsidence** — higher value indicates sinking coastline; critical for Mumbai, Kolkata, Chennai |
| `aqd_coastal_rp500_m` | `NUMERIC(6,2)` | Coastal storm surge depth at 500yr return period |
| `aqd_2030_rcp85_rp100_m` | `NUMERIC(6,2)` | Projected riverine 100yr depth by 2030 under worst-case climate (RCP 8.5) |
| `aqd_2050_rcp45_rp100_m` | `NUMERIC(6,2)` | Projected 100yr depth by 2050 under moderate climate (RCP 4.5) |
| `aqd_2050_rcp85_rp100_m` | `NUMERIC(6,2)` | Projected 100yr depth by 2050 under worst-case climate (RCP 8.5) |
| `aqd_2080_rcp85_rp100_m` | `NUMERIC(6,2)` | Projected 100yr depth by 2080 under worst-case climate (RCP 8.5) |

#### Bhuvan NRSC Flood Hazard Atlas — Indian Government (8–10 states)

| DB Column | Type | Notes |
|---|---|---|
| `nrsc_hazard_class` | `VARCHAR(20)` | `Very Low` / `Low` / `Moderate` / `High` / `Not Mapped` |
| `nrsc_inundation_count` | `SMALLINT` | Raw count: how many times this area was mapped as flooded over the observation period |
| `nrsc_observation_years` | `SMALLINT` | Total number of monsoon seasons observed (e.g., 21 for 1998–2019) |
| `nrsc_data_period` | `VARCHAR(20)` | e.g., `"1998-2023"` — the observation window |
| `nrsc_state_covered` | `BOOLEAN` | TRUE if this state has a completed Bhuvan flood hazard atlas |

#### NEER India Flood Atlas — Southern States (6 states, 30 m)

| DB Column | Type | Notes |
|---|---|---|
| `neer_rp100_depth_m` | `NUMERIC(6,2)` | 100yr flood depth at 30 m (free tier, highest-resolution free layer for south India) |
| `neer_rp10_depth_m` | `NUMERIC(6,2)` | 10yr depth (available on insurer request) |
| `neer_rp50_depth_m` | `NUMERIC(6,2)` | 50yr depth (available on insurer request) |
| `neer_rp500_depth_m` | `NUMERIC(6,2)` | 500yr depth (available on insurer request) |
| `neer_building_exposure_count` | `INTEGER` | Number of building footprints within flood zone at this pincode |
| `neer_state_covered` | `BOOLEAN` | TRUE if this state has NEER flood atlas coverage |

#### EM-DAT Flood-Specific Events

| DB Column | Type | Notes |
|---|---|---|
| `flood_insured_loss_cr` | `NUMERIC(12,2)` | EM-DAT flood-only insured losses (Crore INR) — extracted separately from `disaster_insurance_loss_cr` which includes all disaster types |

#### Computed / Derived Fields

| DB Column | Type | Notes |
|---|---|---|
| `flood_hazard_score` | `NUMERIC(4,2)` | Composite 0–10 score computed by platform (see scoring formula) |
| `flood_risk_level` | `VARCHAR(20)` | `Negligible` / `Low` / `Moderate` / `High` / `Very High` |
| `flood_dominant_type` | `VARCHAR(20)` | `Riverine` / `Coastal` / `Mixed` / `Unknown` |
| `flood_data_confidence` | `VARCHAR(20)` | `High` / `Medium` / `Low` / `Insufficient` |
| `flood_data_sources` | `TEXT[]` | Array of data sources used for this pincode's flood data |
| `flood_data_updated_at` | `TIMESTAMPTZ` | When flood data was last extracted/refreshed |

#### Terrain & Exposure — HydroSHEDS, ESA WorldCover, HydroRIVERS, NDMA

| DB Column | Type | Source | Notes |
|---|---|---|---|
| `hand_elevation_m` | `NUMERIC(6,2)` | HydroSHEDS HAND 90 m | Height Above Nearest Drainage — metres above the nearest stream channel; low values = high flood exposure regardless of flat terrain |
| `distance_to_river_km` | `NUMERIC(6,2)` | HydroRIVERS v1.0 | Straight-line distance from pincode centroid to nearest mapped river channel |
| `impervious_surface_pct` | `NUMERIC(5,2)` | ESA WorldCover 2021 10 m | % of pincode area that is built-up / paved — proxy for pluvial (urban surface water) flood risk where no free pluvial model exists |
| `ndma_flood_prone_district` | `BOOLEAN` | NDMA published list (static) | TRUE if NDMA officially designates this district as flood-prone under National Flood Risk Mitigation Project — carries regulatory / compliance weight |

#### Rainfall Intensity — IMD Gridded Rainfall (1981–2020)

| DB Column | Type | Notes |
|---|---|---|
| `imd_extreme_rain_days_per_yr` | `NUMERIC(5,2)` | Average days per year with rainfall >100 mm; measures flood trigger frequency, not just hazard depth |
| `imd_annual_rainfall_mm` | `NUMERIC(7,1)` | Average annual total rainfall in mm over 40-year climatology period |

#### Upstream Infrastructure — Global Dam Watch

| DB Column | Type | Notes |
|---|---|---|
| `upstream_major_dam` | `BOOLEAN` | TRUE if a major dam exists within the upstream river catchment of this pincode |
| `upstream_dam_name` | `VARCHAR(100)` | Name of primary upstream dam (e.g., "Hirakud Dam", "Tansa Dam") |
| `upstream_dam_type` | `VARCHAR(30)` | `flood_control` (reduces risk), `run_of_river` (no storage), `multipurpose` (context-dependent) |

#### Coastal Natural Barrier — JAXA Global Mangrove Watch 2020 (coastal pincodes only)

| DB Column | Type | Notes |
|---|---|---|
| `mangrove_cover_pct_5km` | `NUMERIC(5,2)` | % of 5 km coastal buffer covered by mangroves; NULL for inland pincodes; higher % = natural storm surge attenuation |

**Total new fields: 47 columns**

---

### 10.2 API Response Design — `/api/environmental/flood/pincode`

**Request:**
```
GET /api/environmental/flood/pincode?pincode=400001
Headers: x-api-key: <key>
```

**Complete response — all sections, all fields:**

```json
{
  "success": true,
  "data": {

    // ── Where is this? ──────────────────────────────────────────────────────────
    "lookup": {
      "pincode": "400001",
      "district_name": "Mumbai City",
      "state_name": "Maharashtra",
      "lat": 18.9333,
      "lng": 72.8347
    },

    // ── A. How deep does it flood at different rarity levels? ───────────────────
    // Source priority: NEER (30m, south states) → JRC GloFAS (90m, all India) → Aqueduct (1km, fallback)
    "return_period_depths": {
      "flood_depth_10yr_event_m": 0.45,        // 10% annual chance — once-a-decade flood
      "flood_depth_20yr_event_m": 0.78,        // 5% annual chance
      "flood_depth_50yr_event_m": 1.12,        // 2% annual chance
      "flood_depth_100yr_event_m": 1.58,       // 1% annual chance — insurance pricing standard
      "flood_depth_200yr_event_m": 2.01,       // 0.5% annual chance — stress test level
      "flood_depth_500yr_event_m": 2.89,       // 0.2% annual chance — near maximum credible flood
      "flood_hazard_class_100yr": "High",      // Low / Medium / High / Very High at 100yr scenario
      "depth_source": "jrc_glofas_v2_1",       // which source provided flood_depth_100yr_event_m
      "depth_resolution_m": 90,               // spatial resolution of the source used
      "unit": "metres"
    },

    // ── B. What has satellite imagery actually observed here since 1984? ────────
    // 38 years of Landsat observations — historical truth, not modeled
    "historical_water_presence": {
      "water_presence_pct": 12.4,              // % of all observations where water was detected
      "water_months_per_year": 2,              // average months/year with water (0=never, 12=permanent water body)
      "flooded_years_pct": 38.5,              // % of 38 years that had at least one flood occurrence
      "ever_flooded_1984_2021": true,          // did water ever appear here in 38 years?
      "flood_trend_change": -3,               // positive = flooding expanding, negative = reducing over 38yr
      "observation_period": "1984-2021",
      "data_source": "jrc_global_surface_water_v1_4"
    },

    // ── C. How exposed is the terrain itself? ───────────────────────────────────
    "terrain_exposure": {
      "height_above_nearest_drainage_m": 2.4,  // metres above nearest stream channel — low = flood-exposed
      "distance_to_nearest_river_km": 0.8,    // km to nearest mapped river
      "impervious_surface_pct": 74.2,         // % built-up/paved — proxy for pluvial (urban drainage) flood risk
      "ndma_flood_prone_district": true,       // officially designated flood-prone by NDMA
      "data_sources": {
        "hand": "hydrosheds_hand_90m",
        "river_distance": "hydrorivers_v1_0",
        "impervious": "esa_worldcover_2021_10m",
        "ndma": "ndma_flood_prone_districts_2024"
      }
    },

    // ── D. How intense is the rainfall trigger? ─────────────────────────────────
    "rainfall_intensity": {
      "extreme_rain_days_per_year": 12,        // avg days/year with >100mm rainfall (IMD threshold)
      "annual_rainfall_mm": 2150,             // avg annual total rainfall
      "observation_period": "1981-2020",
      "data_source": "imd_gridded_0_25deg"
    },

    // ── E. What does the Indian government say about this area? ─────────────────
    // Available for Bihar, Assam, AP, UP, WB, Odisha, Punjab; null elsewhere
    "govt_flood_classification": {
      "govt_flood_zone": "Not Mapped",         // Very Low / Low / Moderate / High / Not Mapped
      "govt_times_flooded": null,             // raw count of satellite-observed floods
      "govt_observation_years": null,         // years of monsoon imagery analyzed
      "govt_data_period": null,              // e.g., "1998-2023"
      "govt_state_covered": false,           // TRUE if state has completed Bhuvan atlas
      "data_source": "bhuvan_nrsc_flood_hazard_atlas"
    },

    // ── F. Is there coastal storm surge risk? ───────────────────────────────────
    // All depth fields null + is_coastal_risk=false for inland pincodes
    "coastal_flood": {
      "is_coastal_risk": true,
      "coastal_surge_depth_100yr_m": 1.2,    // surge depth at 100yr — without land subsidence
      "coastal_surge_depth_100yr_subsidence_m": 1.45, // surge + sinking land (Mumbai ~2-4mm/yr)
      "coastal_surge_depth_500yr_m": 2.1,    // surge at 500yr — CAT bond / extreme stress level
      "mangrove_cover_pct_5km": 8.4,         // % mangrove in 5km coastal buffer — natural surge barrier
      "data_source": "wri_aqueduct_v2",
      "mangrove_source": "jaxa_global_mangrove_watch_2020"
    },

    // ── G. How much worse does climate change make this? ────────────────────────
    "climate_projections": {
      "projected_flood_depth_2030_worst_case_m": 1.72,  // 100yr depth by 2030, RCP 8.5
      "projected_flood_depth_2050_moderate_m": 1.91,    // 100yr depth by 2050, RCP 4.5 (moderate scenario)
      "projected_flood_depth_2050_worst_case_m": 2.24,  // 100yr depth by 2050, RCP 8.5 (worst-case)
      "projected_flood_depth_2080_worst_case_m": 2.98,  // 100yr depth by 2080, RCP 8.5
      "climate_change_increase_pct_by_2050": 41.8,      // % increase vs 2010 baseline (worst-case)
      "baseline_year": 2010,
      "data_source": "wri_aqueduct_v2",
      "climate_scenarios": "RCP 4.5 (moderate emissions reduction) and RCP 8.5 (business as usual)"
    },

    // ── H. Is there a dam upstream that changes the risk picture? ───────────────
    "upstream_infrastructure": {
      "upstream_major_dam": true,
      "upstream_dam_name": "Tansa Dam",        // null if no upstream dam
      "upstream_dam_type": "multipurpose",    // flood_control / run_of_river / multipurpose
      "data_source": "global_dam_watch"
    },

    // ── I. What do actual recorded flood disasters show? ────────────────────────
    // District-level. All pincodes in same district share these values.
    "historical_flood_disasters": {
      "flood_events_per_decade": 4.2,          // recorded EM-DAT flood events (flood-only, not all disasters)
      "flood_insured_loss_cr": 1240.5,        // verified insured losses from floods only, Crore INR
      "observation_period": "1990-2024",
      "data_source": "emdat",
      "granularity": "district"
    },

    // ── J. Overall risk rating ──────────────────────────────────────────────────
    "composite_risk": {
      "flood_risk_score": 7.8,                // 0–10 composite (higher = more dangerous)
      "flood_risk_level": "High",             // Negligible / Low / Moderate / High / Very High
      "dominant_flood_type": "Coastal",       // Riverine / Coastal / Mixed / Unknown
      "data_confidence": "Medium"             // High / Medium / Low / Insufficient
    },

    // ── K. Flags for underwriting automation ────────────────────────────────────
    "underwriting_signals": {
      "is_high_flood_risk": true,             // true if flood_risk_level is High or Very High
      "flood_risk_flag": "HIGH_FLOOD_RISK",   // HIGH_FLOOD_RISK / MODERATE / LOW / COASTAL / NO_DATA
      "coastal_surge_flag": true,            // true if coastal_surge_depth_100yr_m > 0.5m
      "chronic_inundation_flag": false,      // true if flooded_years_pct > 50% OR govt_flood_zone = High
      "climate_worsening_flag": true,        // true if 2050 worst-case depth > 25% above today
      "flood_trend_worsening": false,        // true if flood_trend_change > 0 (expanding over 38 years)
      "high_impervious_surface_flag": true,  // true if impervious_surface_pct > 60% (pluvial risk proxy)
      "upstream_dam_risk_flag": false,       // true if upstream dam is run_of_river or multipurpose (not flood_control)
      "recommended_action": "Apply coastal loading; require flood survey; stress-test against 2050 projections"
    },

    // ── L. Which sources contributed data for this pincode? ─────────────────────
    "data_coverage": {
      "sources_used": [
        "jrc_glofas_v2_1",
        "jrc_gsw_v1_4",
        "wri_aqueduct_v2",
        "hydrosheds_hand",
        "esa_worldcover_2021",
        "hydrorivers_v1_0",
        "imd_gridded",
        "global_dam_watch",
        "jaxa_mangrove_watch_2020",
        "emdat"
      ],
      "sources_missing": ["bhuvan_nrsc", "neer_flood_atlas"],
      "missing_reason": {
        "bhuvan_nrsc": "Maharashtra atlas not yet published by NRSC",
        "neer_flood_atlas": "Coverage limited to TN, AP, TS, KA, KL, GA"
      }
    },

    "meta": {
      "flood_data_updated_at": "2025-09-01T00:00:00Z",
      "response_time_ms": 42
    }

  }
}
```

---

### 10.3 Parameter Reference — Every Field Explained

#### A. Return Period Depths

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `flood_depth_10yr_event_m` | How deep the water gets in a "once-per-decade" flood (10% chance each year). In flood-prone areas of Bihar this is already 1–2 m. | `jrc_rp10_depth_m` or `neer_rp10_depth_m` |
| `flood_depth_20yr_event_m` | Depth in a 1-in-20-year flood (5% annual chance). Intermediate data point between 10yr and 50yr. | `jrc_rp20_depth_m` |
| `flood_depth_50yr_event_m` | Depth in a moderately rare flood (2% annual chance). Relevant for long-term property mortgages. | `jrc_rp50_depth_m` or `neer_rp50_depth_m` |
| `flood_depth_100yr_event_m` | **The insurance standard.** Depth in a 1-in-100-year flood (1% annual chance). This is the benchmark used in flood insurance pricing globally. A value of 1.5 m means floodwater reaches roughly the window ledge of a ground-floor room. | Best available: NEER (30 m, south states) → JRC (90 m, all India) → Aqueduct (1 km, fallback) |
| `flood_depth_200yr_event_m` | Depth in a very rare flood (0.5% annual chance). Used for stress-testing in reinsurance and CAT bond pricing. | `jrc_rp200_depth_m` |
| `flood_depth_500yr_event_m` | Depth in an extremely rare flood (0.2% annual chance). Approximately the "probable maximum flood" level. | `jrc_rp500_depth_m` or `neer_rp500_depth_m` |
| `flood_hazard_class_100yr` | A categorical rating at the 100-year scenario: **Low** (shallow, limited duration), **Medium** (moderate depth, some structure damage), **High** (significant depth, major damage), **Very High** (dangerous depths, likely total loss for ground-floor assets). | `jrc_rp100_class` |
| `depth_data_source` | Which source provided the canonical 100yr depth value — important for understanding accuracy and resolution. | derived |

#### B. Historical Water Presence (JRC GSW 1984–2021)

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `water_presence_pct` | Out of all 38 years of satellite observations, what percentage of the time was this location covered by water? 0% = never seen as water; 100% = permanent water body (river/lake). A pincode showing 15–40% is a seasonal flood zone. | `gsw_occurrence_pct` |
| `water_months_per_year` | On average, how many months per year is water present at this location? 0–1 = ephemeral or rain-fed; 2–5 = monsoon floodplain; 6–12 = semi-permanent to permanent water body. | `gsw_seasonality_months` |
| `flooded_years_pct` | Out of 38 years, what percentage of years had at least one instance of water appearing at this location? High values indicate recurring annual flooding. Even 30% means this location floods roughly every 3 years — a significant insurer concern. | `gsw_recurrence_pct` |
| `ever_flooded_1984_2021` | Simple yes/no: did satellite imagery ever detect water at this exact location during 1984–2021? TRUE for any historically flooded pincode. | `gsw_max_extent` |
| `flood_trend_change` | Is flooding increasing or decreasing over time? Positive values = flooding has expanded over 38 years (more inundation now than in the 1980s). Negative values = flooding has reduced (upstream dam, channel improvement). Zero = no change. Critical for climate-aware underwriting. | `gsw_change_abs` |

#### C. Government Flood Classification (Bhuvan NRSC)

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `govt_flood_zone` | India's official ISRO/NRSC flood hazard classification: **Very Low** (1–2 floods in 20+ years), **Low** (3–5 floods), **Moderate** (6–9 floods), **High** (10+ floods), **Not Mapped** (state not yet covered). | `nrsc_hazard_class` |
| `govt_times_flooded` | The raw number of times this area was observed as flooded by satellite imagery during the government's observation window. E.g., 15 floods over 26 years = a High hazard zone. Combined with `govt_observation_years`, lets you compute recurrence rate. | `nrsc_inundation_count` |
| `govt_observation_years` | How many monsoon seasons were analyzed to produce the government hazard classification. A "High" zone based on 25 years of observation is more reliable than one based on 8 years. | `nrsc_observation_years` |
| `govt_data_period` | The specific years covered by the government's atlas (e.g., "1998–2023"). A shorter or older period means the classification may not reflect recent flood patterns. | `nrsc_data_period` |
| `govt_state_covered` | TRUE if this state has a completed ISRO/NRSC Flood Hazard Atlas. Currently only Bihar, Assam, Andhra Pradesh, Uttar Pradesh, West Bengal, Odisha, Punjab have full atlases. Maharashtra, Karnataka, Tamil Nadu = Not Mapped. | `nrsc_state_covered` |

#### D. Coastal Flood (WRI Aqueduct + JAXA)

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `is_coastal_risk` | TRUE if this pincode has non-zero coastal storm surge exposure according to Aqueduct. Applies to pincodes within ~50 km of the coastline in cyclone-prone states (Odisha, AP, Tamil Nadu, Gujarat, Maharashtra, Kerala). | derived |
| `coastal_surge_depth_100yr_m` | How deep the seawater surge would be at this location in a 100-year coastal storm event (cyclone + sea-level confluence). Pure hazard depth without adjusting for land sinking. | `aqd_coastal_rp100_m` |
| `coastal_surge_depth_100yr_subsidence_m` | Same 100-year surge, but adjusted for how much the land is sinking. Mumbai sinks ~2–4 mm/year, Kolkata ~3–5 mm/year. Over 30 years, this adds 6–15 cm to effective flood depth. This is the more accurate value for properties whose risk horizon is decades. | `aqd_coastal_rp100_subsidence_m` |
| `coastal_surge_depth_500yr_m` | The 500-year coastal surge depth — used for CAT bond trigger design and extreme-scenario stress testing. | `aqd_coastal_rp500_m` |
| `mangrove_cover_pct_5km` | What percentage of the 5 km coastal buffer around this pincode is covered by mangrove forest? Mangroves absorb wave energy — a 100 m wide mangrove belt reduces storm surge height by 50–70%. A pincode with 40% mangrove cover is materially more protected than a cleared coastal strip. NULL for inland pincodes. | `mangrove_cover_pct_5km` |

#### E. Climate Projections (WRI Aqueduct)

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `projected_flood_depth_2030_worst_case_m` | What the 100-year riverine flood depth would be by 2030, assuming the worst-case greenhouse gas emissions path (RCP 8.5 = "business as usual"). Compare to `flood_depth_100yr_event_m` (2010 baseline) to see how much the risk grows in just 5 years. | `aqd_2030_rcp85_rp100_m` |
| `projected_flood_depth_2050_moderate_m` | Projected 100-year depth by 2050 under a moderate emissions scenario (RCP 4.5 = significant emissions reductions underway). Appropriate for mid-term insurance products and 25-year mortgage underwriting. | `aqd_2050_rcp45_rp100_m` |
| `projected_flood_depth_2050_worst_case_m` | Projected 100-year depth by 2050 under the worst-case scenario (RCP 8.5). This is the regulatory stress-test value for IRDAI climate risk disclosure requirements. | `aqd_2050_rcp85_rp100_m` |
| `projected_flood_depth_2080_worst_case_m` | Long-horizon projection (2080, RCP 8.5). Relevant for infrastructure insurers and very long-duration property bonds. Most meaningful for coastal zones where sea-level rise accumulates substantially. | `aqd_2080_rcp85_rp100_m` |
| `climate_change_increase_pct_by_2050` | How much worse will a 100-year flood be by 2050 vs today (% increase in depth, worst case)? E.g., 41.8% means a currently 1.5 m flood will be 2.1 m in the same return-period event by 2050. Computed as: `(aqd_2050_rcp85_rp100_m − jrc_rp100_depth_m) / jrc_rp100_depth_m × 100`. | derived |

#### F. Historical Flood Disasters (EM-DAT, flood-only)

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `flood_events_per_decade` | How many significant flood disasters (meeting EM-DAT reporting thresholds: ≥10 deaths OR ≥100 affected) have been recorded for this district on average per decade, based on records from 1990–2024. This is the only field that measures *actual events* rather than modeled hazard. | `flood_events_per_decade` (existing) |
| `flood_insured_loss_cr` | Total verified insured losses from flood events specifically (floods only — not cyclones or earthquakes) recorded for this district, in Crore INR, from EM-DAT. This is the only field with actual insurance-relevant financial loss quantum. Useful for calibrating claim size distributions. | `flood_insured_loss_cr` (new) |

#### G. Composite Risk Scores

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `flood_risk_score` | Platform-computed composite flood risk rating on a scale of **0 to 10** (higher = more dangerous). Combines: `jrc_rp100_depth_m` (50% weight), `gsw_recurrence_pct` (20%), `flood_events_per_decade` (15%), `aqd_coastal_rp100_m` if applicable (15%). Score and level are always shown together. | `flood_hazard_score` |
| `flood_risk_level` | Plain-language translation of `flood_risk_score`: **Negligible** (0–2), **Low** (2–4), **Moderate** (4–6), **High** (6–8), **Very High** (8–10). Shown alongside the score so underwriters see both the number and its meaning without translation. | `flood_risk_level` |
| `dominant_flood_type` | The primary flood mechanism driving risk at this location: **Riverine** (river overflow — most of India), **Coastal** (storm surge — coastal pincodes), **Mixed** (both equally relevant). Pluvial (urban drainage) is not yet covered by free data. | `flood_dominant_type` |
| `data_confidence` | How much to trust the flood scores for this pincode: **High** (multiple sources agree, 30 m NEER data available), **Medium** (JRC 90 m available, some sources missing), **Low** (only 1 km Aqueduct data, no state atlas), **Insufficient** (pincode exists but no flood data from any source). | `flood_data_confidence` |

#### H. Terrain & Exposure

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `height_above_nearest_drainage_m` | How many metres above the nearest stream channel is this pincode located? This is HAND — Height Above Nearest Drainage. Think of it as "how high would the river need to rise before it reaches you?" A value of 1 m means the river only needs to rise 1 m to inundate. A value of 15 m means the river would need to rise 15 m — much safer. Works even in flat alluvial plains (Bihar, Bengal) where raw elevation tells you almost nothing. | `hand_elevation_m` |
| `distance_to_nearest_river_km` | Straight-line distance from the pincode centroid to the nearest mapped river channel. A property 300 m from a river is categorically more exposed than one 8 km away, even if both have the same JRC depth in a 100yr event (90 m resolution may average out). | `distance_to_river_km` |
| `impervious_surface_pct` | What percentage of this pincode's land is covered by concrete, asphalt, rooftops, or other impervious surfaces? High values (>60%) mean rainfall cannot soak into the ground — it becomes surface runoff immediately, causing urban flooding even without a river nearby. This is the only proxy for pluvial (drainage) flood risk available from free data. A dense Mumbai or Bengaluru pincode at 80% impervious will flood from heavy rain regardless of river proximity. | `impervious_surface_pct` |
| `ndma_flood_prone_district` | TRUE if the National Disaster Management Authority officially designates this district as flood-prone under the National Flood Risk Mitigation Project. This is India's regulatory classification — carries weight in IRDAI filings and reinsurance treaty documentation. ~200 districts across India carry this designation. | `ndma_flood_prone_district` |

#### I. Rainfall Intensity

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `extreme_rain_days_per_year` | On average, how many days per year does this location receive more than 100 mm of rainfall in a single day? The IMD defines 100 mm/day as "heavy rainfall" — the threshold at which urban drainage systems typically start failing and rivers begin to rise rapidly. A coastal pincode in Kerala may have 25–30 such days per year; a Rajasthan pincode may have 1–2. This is the flood trigger frequency, separate from flood depth. | `imd_extreme_rain_days_per_yr` |
| `annual_rainfall_mm` | Total average annual rainfall in millimetres over the 1981–2020 climatology period. Context for understanding flood risk magnitude — a district receiving 3,000 mm/year (Kerala, Assam) has fundamentally different flood risk baseline from one receiving 400 mm/year (Gujarat interior). | `imd_annual_rainfall_mm` |

#### J. Upstream Infrastructure

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `upstream_major_dam` | TRUE if there is a major dam within the river catchment upstream of this pincode. Dams change the flood equation — they can either protect (flood control reservoir) or create additional risk (spillway releases during extreme monsoon, or dam breach scenarios). | `upstream_major_dam` |
| `upstream_dam_name` | Name of the primary upstream dam (e.g., "Hirakud Dam" for downstream Mahanadi pincodes in Odisha, "Tansa Dam" for parts of Mumbai). NULL if no upstream dam. | `upstream_dam_name` |
| `upstream_dam_type` | How the dam operates — determines whether it helps or complicates flood risk: **`flood_control`** = designed to retain flood water (reduces downstream peak, protective), **`run_of_river`** = no storage capacity (does not help with floods, water passes through), **`multipurpose`** = has storage but flood control is one of several competing priorities (context-dependent — may still release during heavy monsoon). | `upstream_dam_type` |

#### K. Underwriting Signals

| API Field | Plain English Meaning | DB Column |
|---|---|---|
| `is_high_flood_risk` | TRUE if `flood_risk_level` is High or Very High. Quick boolean for system automation — e.g., auto-flag policies in high-flood pincodes for human review. | derived |
| `flood_risk_flag` | Text code for downstream systems: `HIGH_FLOOD_RISK` / `MODERATE_FLOOD_RISK` / `LOW_FLOOD_RISK` / `COASTAL_FLOOD_RISK` / `NO_DATA`. | derived |
| `coastal_surge_flag` | TRUE if this pincode has significant coastal storm surge exposure (`aqd_coastal_rp100_m > 0.5 m`). Triggers coastal loading in marine and property pricing. | derived |
| `chronic_inundation_flag` | TRUE if the location floods in most years (`gsw_recurrence_pct > 50%` OR `nrsc_hazard_class = "High"`). Indicates a location that floods so regularly it may be practically uninsurable at standard rates. | derived |
| `climate_worsening_flag` | TRUE if the 2050 worst-case depth is more than 25% worse than today's 100-year depth. Indicates this pincode's flood risk trajectory is materially worsening — requires climate adjustment in long-duration products. | derived |
| `flood_trend_worsening` | TRUE if `gsw_change_abs` is positive, meaning satellite observations show flooding has expanded at this location over 38 years (more inundation in recent decades vs 1980s). Distinct from `climate_worsening_flag` — this is historically observed, not modeled. | derived |
| `high_impervious_surface_flag` | TRUE if `impervious_surface_pct > 60%`. Flags dense urban pincodes at elevated pluvial (drainage) flood risk even where no riverine hazard exists. Use to trigger urban drainage loading in property pricing. | derived |
| `upstream_dam_risk_flag` | TRUE if an upstream dam exists AND its type is `run_of_river` or `multipurpose` (i.e., it does NOT provide flood control storage). These dams may suddenly release large volumes during peak monsoon, amplifying downstream flood peaks. FALSE if the dam is a dedicated flood-control reservoir. | derived |
| `recommended_action` | Plain-English action text for underwriters: e.g., "Apply 20% flood loading", "Require survey before binding", "Exclude ground-floor contents", "Standard terms — no flood loading". | derived |

---

### 10.4 Scoring Formula — `flood_risk_score` (0–10)

```
flood_risk_score = (
    0.40 × depth_score(jrc_rp100_depth_m)              # 40% — primary return-period depth
  + 0.15 × recurrence_score(gsw_recurrence_pct)        # 15% — 38-year satellite recurrence
  + 0.15 × terrain_score(hand_elevation_m)             # 15% — terrain vulnerability (HAND)
  + 0.10 × frequency_score(flood_events_per_decade)    # 10% — EM-DAT actual event count
  + 0.10 × coastal_score(aqd_coastal_rp100_m)          # 10% — coastal surge (0 if not coastal)
  + 0.10 × rainfall_score(imd_extreme_rain_days_per_yr) # 10% — rainfall trigger frequency
)

depth_score(d):       # return-period flood depth at 100yr (metres)
  d=null → 0 | d<0.3 → 1 | d<0.6 → 3 | d<1.0 → 5 | d<1.5 → 7 | d<2.5 → 9 | d≥2.5 → 10

recurrence_score(r):  # % of 38 years that had water occurrence
  r=null → 0 | r<5 → 1 | r<20 → 3 | r<40 → 5 | r<60 → 7 | r<80 → 9 | r≥80 → 10

terrain_score(h):     # Height Above Nearest Drainage (metres) — inverse: lower HAND = higher score
  h=null → 5 | h<1 → 10 | h<3 → 8 | h<6 → 6 | h<10 → 4 | h<20 → 2 | h≥20 → 0

frequency_score(f):   # EM-DAT recorded flood events per decade
  f=null → 0 | f<1 → 1 | f<3 → 3 | f<6 → 6 | f<10 → 8 | f≥10 → 10

coastal_score(c):     # coastal storm surge depth at 100yr (metres) — 0 for inland pincodes
  c=null or 0 → 0 | c<0.5 → 2 | c<1.0 → 5 | c<2.0 → 7 | c≥2.0 → 10

rainfall_score(r):    # extreme rain days per year (>100mm/day)
  r=null → 0 | r<3 → 1 | r<7 → 3 | r<12 → 5 | r<20 → 7 | r<30 → 9 | r≥30 → 10
```

**Modifier — impervious surface:** `impervious_surface_pct > 60%` adds +0.5 to final score (capped at 10) to reflect elevated pluvial risk in dense urban pincodes where modeled riverine depths may understate actual flood exposure.

**Risk level mapping:**

| Score Range | Level |
|---|---|
| 0.0 – 2.0 | Negligible |
| 2.1 – 4.0 | Low |
| 4.1 – 6.0 | Moderate |
| 6.1 – 8.0 | High |
| 8.1 – 10.0 | Very High |

**Composite score weight in main risk index:**
The existing `composite_risk_score` in `district_risk_index` currently allocates **15% weight to `disaster_frequency_score`** (all disaster types blended). After flood data loads, this splits:
- `flood_hazard_score` → **7% weight** (new, spatial flood hazard)
- EM-DAT `disaster_frequency_score` → **8% weight** (retained, all-disaster frequency)
- Total disaster contribution unchanged: 15%

---

### 10.5 Python Scripts to Write

**GEE-based extractions (run via `earthengine-api` Python SDK):**

| Script | What It Does | GEE Dataset | Est. Runtime |
|---|---|---|---|
| `scripts/setup_gee_auth.py` | Authenticates GEE service account, validates project setup, runs sample extraction at 3 test pincodes | — | 1 min |
| `scripts/extract_jrc_glofas.py` | Extracts 7 return-period depths (`RP10`→`RP500`) + `RP100_class` + `spurious_depth_flag` for all ~50,000 pincode centroids | `JRC/CEMS_GLOFAS/FloodHazard/v2_1` | 30–60 min |
| `scripts/extract_jrc_gsw.py` | Extracts 6 bands: `occurrence`, `seasonality`, `recurrence`, `max_extent`, `transition`, `change_abs` | `JRC/GSW1_4/GlobalSurfaceWater` | 30–60 min |
| `scripts/extract_aqueduct.py` | Extracts riverine rp100/rp500 + coastal rp100/rp100-subsidence/rp500 + 4 climate scenarios (2030/2050 rcp45/rcp85/2080) | `WRI/Aqueduct_Flood_Hazard_Maps/V2` | 45–90 min |
| `scripts/extract_hand_terrain.py` | Extracts HAND elevation per pincode centroid | `WWF/HydroSHEDS/03HAND` | 20–30 min |
| `scripts/extract_worldcover.py` | Extracts % of each pincode polygon that is ESA WorldCover class 50 (built-up) using zonal statistics | `ESA/WorldCover/v200` | 30–45 min |
| `scripts/extract_mangrove_watch.py` | For coastal pincodes: extracts mangrove cover % within 5 km buffer (JAXA GMW 2020) | `JAXA/GPM_L3/GSMaP/v6/operational` *(or local GMW GeoTIFF)* | 15–20 min |

**Non-GEE scripts:**

| Script | What It Does | Source | Est. Runtime |
|---|---|---|---|
| `scripts/extract_hydrorivers.py` | Computes distance from each pincode centroid to nearest HydroRIVERS river segment using GeoPandas spatial join | HydroRIVERS v1.0 shapefile (download once) | 20–30 min |
| `scripts/extract_bhuvan_wms.py` | WMS GetFeatureInfo requests against Bhuvan flood hazard layer per pincode; extracts `hazard_class`, `inundation_count`, `observation_years` | `bhuvan-vec2.nrsc.gov.in/bhuvan/wms` | 2–4 hours |
| `scripts/extract_neer.py` | Point extraction from downloaded NEER GeoTIFF rasters; rp100 free; rp10/50/500 after insurer access | NEER GeoTIFF download | 20–30 min |
| `scripts/extract_imd_rainfall.py` | Reads IMD 0.25° gridded daily rainfall NetCDF (1981–2020); computes extreme rain days per year + annual total per pincode | IMD gridded rainfall (download from imdpune.gov.in) | 30–45 min |
| `scripts/load_ndma_districts.py` | One-time load of NDMA flood-prone district list (static CSV → DB boolean flag) | NDMA published list | 1 min |
| `scripts/extract_dam_watch.py` | For each pincode: identifies major dams in same HydroBASINS level-8 sub-catchment upstream; extracts dam name and type | Global Dam Watch shapefile (free download) | 15–20 min |
| `scripts/extract_neer.py` | Point extraction from downloaded NEER GeoTIFF rasters for 6 southern states; rp100 free tier; rp10/50/500 after insurer access approved | NEER GeoTIFF | 20–30 min |
| `scripts/build_flood_risk_index.py` | Merges all extracted CSVs; computes `flood_hazard_score`, `flood_risk_level`, `dominant_flood_type`, `data_confidence`, all underwriting signal flags | All above outputs | 5–10 min |
| `scripts/process_emdat.py` *(update existing)* | Add flood-only event filter (`disaster_type = "Flood"`); extract `flood_insured_loss_cr` separately from existing all-disaster `disaster_insurance_loss_cr` | `data/emdat/*.xlsx` | 2–5 min |

**Run order:**
```
1. setup_gee_auth.py
2. [parallel] extract_jrc_glofas.py, extract_jrc_gsw.py, extract_aqueduct.py,
             extract_hand_terrain.py, extract_worldcover.py, extract_mangrove_watch.py
3. [parallel] extract_hydrorivers.py, extract_imd_rainfall.py,
             extract_bhuvan_wms.py, extract_neer.py, extract_dam_watch.py
4. load_ndma_districts.py
5. process_emdat.py  (update)
6. build_flood_risk_index.py  (merge + compute scores + write to DB)
```

---

### 10.6 GEE Setup Instructions

Google Earth Engine is free for non-commercial AND commercial research/development use. All JRC and Aqueduct data needed for Phase 1 is accessed through GEE at no cost.

**Step 1: Create a Google Cloud Project**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project — suggested name: `insuretech-data-platform`
3. Enable billing (required for GEE API activation, but GEE itself is free — billing account is needed for the Cloud project, not GEE)

**Step 2: Register for Google Earth Engine**
1. Go to [earthengine.google.com/signup](https://earthengine.google.com/signup/)
2. Select "Commercial / Government / NGO" (not Student) — ensures commercial-use access
3. Select your Google Cloud project created in Step 1
4. Approval: 1–2 business days for commercial tier

**Step 3: Create a Service Account**
```bash
# Create service account for server-side pipeline access
gcloud iam service-accounts create gee-pipeline \
    --project=insuretech-data-platform \
    --display-name="GEE Data Pipeline"

# Grant Earth Engine roles
gcloud projects add-iam-policy-binding insuretech-data-platform \
    --member="serviceAccount:gee-pipeline@insuretech-data-platform.iam.gserviceaccount.com" \
    --role="roles/earthengine.admin"

# Download service account key
gcloud iam service-accounts keys create gee-key.json \
    --iam-account=gee-pipeline@insuretech-data-platform.iam.gserviceaccount.com
```

**Step 4: Install Python Dependencies**
```bash
pip install earthengine-api geopandas rasterio xarray pandas numpy psycopg2-binary python-dotenv
```

**Step 5: Authenticate and Test**
```python
import ee
ee.Authenticate(auth_mode="service_account", 
                credentials_file="gee-key.json")
ee.Initialize(project="insuretech-data-platform")

# Sanity check — extract JRC rp100 depth at a Mumbai pincode centroid
point = ee.Geometry.Point([72.8347, 18.9333])
jrc = ee.ImageCollection("JRC/CEMS_GLOFAS/FloodHazard/v2_1").first()
value = jrc.select("RP100_depth").reduceRegion(
    reducer=ee.Reducer.first(), geometry=point, scale=90
).getInfo()
print(value)  # Expected: {'RP100_depth': <float>}
```

**Step 6: Store Key Securely**
Add to `.env.local` (already gitignored):
```
GEE_SERVICE_ACCOUNT=gee-pipeline@insuretech-data-platform.iam.gserviceaccount.com
GEE_KEY_FILE=gee-key.json
GEE_PROJECT=insuretech-data-platform
```

---

### 10.7 NEER API Access Request

NEER provides rp10/rp50/rp500 layers on request to insurers and researchers. The rp100 layer is free on flood.neer.io.

**Draft email to send to NEER team (flood.neer.io/contact):**

> Subject: Insurer Data Access Request — NEER India Flood Atlas (rp10/50/500 layers)
>
> We are an insurtech building a flood risk data platform for Indian health and property insurance underwriting. We would like to request access to the multi-return-period flood depth layers (rp10, rp50, rp500) for the states currently covered by the NEER Flood Atlas (Tamil Nadu, Andhra Pradesh, Telangana, Karnataka, Kerala, Goa).
>
> Use case: underwriting enrichment data stored in a private PostgreSQL database, used to compute flood risk scores at pincode level for individual policy applications. Data will not be resold or redistributed.
>
> Please let us know the access mechanism (API key, bulk download, or GeoTIFF delivery) and any attribution or licensing requirements.

---

### 10.8 Source Coverage Summary — By Pincode

**All 14 sources and which states they cover:**

| Source | Coverage | Resolution | API Section |
|---|---|---|---|
| JRC GloFAS v2.1 | **All India** | 90 m | `return_period_depths` (primary for most states) |
| JRC Global Surface Water | **All India** | 30 m | `historical_water_presence` |
| WRI Aqueduct (riverine) | **All India** | 1 km | `climate_projections` |
| WRI Aqueduct (coastal) | Coastal states† | 1 km | `coastal_flood` depths |
| HydroSHEDS HAND | **All India** | 90 m | `terrain_exposure.height_above_nearest_drainage_m` |
| HydroRIVERS v1.0 | **All India** | Vector | `terrain_exposure.distance_to_nearest_river_km` |
| ESA WorldCover 2021 | **All India** | 10 m | `terrain_exposure.impervious_surface_pct` |
| IMD Gridded Rainfall | **All India** | ~28 km (0.25°) | `rainfall_intensity` |
| Global Dam Watch | **All India** | Point/polygon | `upstream_infrastructure` |
| JAXA Mangrove Watch 2020 | Coastal pincodes† | 25 m | `coastal_flood.mangrove_cover_pct_5km` |
| NDMA Flood-Prone List | ~200 districts (static) | District | `terrain_exposure.ndma_flood_prone_district` |
| Bhuvan NRSC Atlas | 8–10 states‡ | 30–56 m | `govt_flood_classification` |
| NEER Flood Atlas | 6 south states§ | 30 m | `return_period_depths` (replaces JRC for those states) |
| EM-DAT (flood-only) | All districts | District | `historical_flood_disasters` |

† Coastal states: Maharashtra, Gujarat, Goa, Karnataka, Kerala, Tamil Nadu, AP, Odisha, West Bengal, Puducherry

‡ Bhuvan complete: Bihar, Assam, Andhra Pradesh, Uttar Pradesh, West Bengal, Odisha, Punjab. Partial: Maharashtra

§ NEER: Tamil Nadu + Puducherry, Andhra Pradesh, Telangana, Karnataka, Kerala, Goa

---

**Coverage by state — which sources contribute:**

| State | Riverine Depth | Historical | Terrain | Rainfall | Govt Class | Coastal | Climate |
|---|---|---|---|---|---|---|---|
| Bihar, Assam, UP | JRC 90m | ✓ | ✓ | ✓ | **Bhuvan** | – | ✓ |
| West Bengal, Odisha | JRC 90m | ✓ | ✓ | ✓ | **Bhuvan** | Coastal ✓ | ✓ |
| Andhra Pradesh | **NEER 30m** | ✓ | ✓ | ✓ | **Bhuvan** | Coastal ✓ | ✓ |
| TN, TS, KA, KL, Goa | **NEER 30m** | ✓ | ✓ | ✓ | – | Coastal ✓ (KL, TN, Goa) | ✓ |
| Maharashtra, Gujarat | JRC 90m | ✓ | ✓ | ✓ | – | Coastal ✓ | ✓ |
| All other states | JRC 90m | ✓ | ✓ | ✓ | – | – | ✓ |

**Data confidence by state:**
- **High** (4+ sources incl. Bhuvan or NEER): Bihar, Assam, AP, West Bengal, Odisha, Tamil Nadu, Telangana, Karnataka, Kerala
- **Medium** (JRC + terrain + rainfall, no state atlas): Maharashtra, Gujarat, Rajasthan, MP, Chhattisgarh, Jharkhand, Punjab (no Bhuvan), most NE states
- **Low** (limited river network, sparse flood history): Remote hill states (Arunachal, Sikkim, Himachal interior)

---

## Sources

- [Bhuvan ISRO Disaster Services](https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php)
- [NDEM Flood Hazard Zonation Maps](https://ndem.nrsc.gov.in/hydrological_fhz.php)
- [NDMA Flood Hazard Atlases](https://ndma.gov.in/flood-hazard-atlases)
- [JRC Global River Flood Hazard Maps v2.1 — GEE](https://developers.google.com/earth-engine/datasets/catalog/JRC_CEMS_GLOFAS_FloodHazard_v2_1)
- [JRC Global Surface Water v1.4 — GEE](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater)
- [WRI Aqueduct Floods Hazard Maps v2 — GEE](https://developers.google.com/earth-engine/datasets/catalog/WRI_Aqueduct_Flood_Hazard_Maps_V2)
- [Google Flood Forecasting API](https://developers.google.com/flood-forecasting)
- [Copernicus EMS On-Demand Mapping](https://mapping.emergency.copernicus.eu/)
- [GloFAS Flood Forecast Products](https://global-flood.emergency.copernicus.eu/)
- [NASA Earthdata NRT Global Flood Products](https://www.earthdata.nasa.gov/data/instruments/viirs/near-real-time-data/nrt-global-flood-products)
- [NEER India Flood Atlas](https://flood.neer.io/)
- [Fathom Global Flood Map Product](https://www.fathom.global/product/global-flood-map/)
- [Fathom 3.0 World Bank Non-Commercial](https://datacatalog.worldbank.org/search/dataset/0065654/)
- [JBA Risk Management — Global Flood Maps](https://www.jbarisk.com/products/global-flood-maps/)
- [Verisk Inland Flood Models](https://www.verisk.com/products/inland-flood-models/)
- [Moody's RMS Global Flood Risk Models](https://www.moodys.com/web/en/us/capabilities/catastrophe-modeling/flood-models.html)
- [RMSI India FloodRisk Model](https://www.rmsi.com/products/india-floodrisk/)
- [RMSI PIER Platform](https://rmsicropalytics.com/pier/)
- [GeoIQ Location Intelligence APIs](https://geoiq.ai/in/products/data-apis)
- [Skymet Weather APIs](https://www.skymetweather.com/corporate/skymet-APIs.html)
- [ICEYE Flood Insights for Insurance](https://www.iceye.com/solutions/insurance/flood-insights)
- [INDOFLOODS Database — Zenodo](https://zenodo.org/records/14584655)
- [IIT Delhi HydroSense Lab](https://hydrosense.iitd.ac.in/resources/)
- [InRisk Labs India](https://inrisklabs.com/)
- [IIT Bombay AI Flood Prediction](https://www.freepressjournal.in/education/iit-bombay-develops-ai-flood-prediction-system-with-93-accuracy)
- [Fathom 3.0 Academic Paper](https://www.fathom.global/academic-papers/global-flood-inundation-model-for-any-climate/)
- [Swiss Re Urban Flood India](https://www.swissre.com/risk-knowledge/mitigating-climate-risk/billion-dollar-rain-india.html)
- [HydroSHEDS HAND Dataset — GEE](https://developers.google.com/earth-engine/datasets/catalog/WWF_HydroSHEDS_03HAND)
- [HydroRIVERS v1.0 — HydroSHEDS](https://www.hydrosheds.org/products/hydrorivers)
- [ESA WorldCover 2021 — GEE](https://developers.google.com/earth-engine/datasets/catalog/ESA_WorldCover_v200)
- [IMD Gridded Rainfall Data](https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html)
- [Global Dam Watch](https://www.globaldamwatch.org/)
- [JAXA Global Mangrove Watch](https://www.eorc.jaxa.jp/ALOS/en/dataset/gmw_e.htm)
- [NDMA Flood Prone Districts](https://ndma.gov.in/Resources/reports)
