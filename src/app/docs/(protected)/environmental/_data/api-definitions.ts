import { BASE_URL } from './introduction'

export type ParamIn = 'query' | 'header' | 'path'
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'

export interface Param {
  name: string
  in: ParamIn
  required: boolean
  type: SchemaType
  description: string
  example?: string | number | boolean
  enum?: string[]
  inputType?: 'state-select' | 'district-select' | 'month' | 'pollutant-select'
  metaKey?: 'aqiStates' | 'waterStates' | 'hotspotStates'
  cascadesFrom?: string
}

export interface ResponseField {
  field: string
  type: string
  nullable?: boolean
  description: string
}

export interface ApiDefinition {
  id: string
  label: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  shortDescription: string
  description: string
  authNote: string
  params: Param[]
  responseFields: ResponseField[]
  exampleRequest: {
    queryString?: string
    body?: string
  }
  exampleResponse: string
}

export const API_DEFINITIONS: ApiDefinition[] = [
  // ── 1. District Risk ──────────────────────────────────────────────────────
  {
    id: 'district-risk',
    label: 'District Risk',
    method: 'GET',
    path: '/api/environmental/district',
    shortDescription: 'Air quality, disasters, heat stress & composite risk for a district',
    description:
      'Returns a comprehensive environmental risk profile for a district identified by pincode. ' +
      'Includes PM2.5/PM10/NO₂/SO₂/CO/O₃ pollutant profiles, AQI, disaster frequency, heat wave days, ' +
      'NFHS-5 health burden indicators, and a composite risk score (0–100) with national percentile rank. ' +
      'Used as Endpoint 1 in the underwriting pipeline to determine geographic risk loading.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    params: [
      {
        name: 'x-api-key',
        in: 'header',
        required: true,
        type: 'string',
        description: 'Your platform API key',
        example: 'env_abc123...',
      },
      {
        name: 'pincode',
        in: 'query',
        required: true,
        type: 'string',
        description: '6-digit Indian PIN code. Must start with a non-zero digit.',
        example: '110001',
      },
    ],
    responseFields: [
      { field: 'data.lookup.pincode',            type: 'string',       description: 'Queried pincode' },
      { field: 'data.lookup.district_name',      type: 'string',       description: 'District resolved from pincode' },
      { field: 'data.lookup.state_name',         type: 'string',       description: 'State name' },
      { field: 'data.lookup.lat',                type: 'number',       description: 'District centroid latitude' },
      { field: 'data.lookup.lng',                type: 'number',       description: 'District centroid longitude' },
      { field: 'data.lookup.city_tier',          type: 'integer|null', description: '1 = metro, 2 = tier-2, 3 = tier-3, null = rural' },
      { field: 'data.air_quality.pm25.mean_5yr', type: 'number|null',  description: '5-year mean PM2.5 (µg/m³)' },
      { field: 'data.air_quality.pm25.trend_direction', type: 'string|null', description: '"improving" | "stable" | "worsening"' },
      { field: 'data.air_quality.pm25.data_quality', type: 'string',   description: '"measured" | "modelled" | "gap_filled" | "missing"' },
      { field: 'data.air_quality.aqi.annual_mean', type: 'number|null', description: 'Annual mean AQI' },
      { field: 'data.air_quality.aqi.category',  type: 'string|null',  description: '"Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe"' },
      { field: 'data.disasters.flood_events_per_decade', type: 'number|null', description: 'Average flood events per decade (EM-DAT)' },
      { field: 'data.disasters.disaster_frequency_score', type: 'number|null', description: 'Composite disaster frequency score (0–100)' },
      { field: 'data.heat.heat_wave_days_per_year', type: 'number|null', description: 'Mean annual heat wave days (ERA5, 1981–2023)' },
      { field: 'data.heat.heat_stress_zone',     type: 'string|null',  description: '"Low" | "Moderate" | "High" | "Extreme"' },
      { field: 'data.health_burden.hypertension_pct', type: 'number|null', description: '% adults with hypertension (NFHS-5)' },
      { field: 'data.health_burden.diabetes_pct', type: 'number|null', description: '% adults with diabetes (NFHS-5)' },
      { field: 'data.composite.composite_risk_score', type: 'number',  description: 'Weighted composite risk score 0–100' },
      { field: 'data.composite.risk_tier',       type: 'string',       description: '"Low" | "Medium" | "High" | "Very High"' },
      { field: 'data.composite.composite_national_percentile', type: 'number|null', description: 'Percentile rank vs all districts (0 = cleanest)' },
      { field: 'data.uw_narrative',              type: 'string',       description: 'Plain-language underwriting narrative for this district' },
      { field: 'data.data_coverage.overall_coverage', type: 'string',  description: '"full" | "partial" | "minimal"' },
      { field: 'data.meta.response_time_ms',     type: 'integer',      description: 'Server-side processing time in ms' },
    ],
    exampleRequest: {
      queryString: 'pincode=110001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        uw_narrative: 'New Delhi ranks in the 97th national percentile for air quality (PM2.5 3yr mean: 95.2 µg/m³, Severe zone). Risk tier: Very High. Composite score: 82.0/100 (98th national percentile).',
        lookup: { pincode: '110001', district_name: 'New Delhi', state_name: 'Delhi', lat: 28.6448, lng: 77.2167, city_tier: 1 },
        air_quality: {
          pm25: { mean_3yr: 95.2, mean_5yr: 98.4, worst_month_avg: null, trend_5yr_pct: -4.2, trend_direction: 'improving', vintage: { mean_3yr_from: 2021, mean_3yr_to: 2023, mean_5yr_from: 2019, mean_5yr_to: 2023 }, zone: 'Severe', unit: 'µg/m³', data_quality: 'modelled', data_source: 'sedac_cams_blended' },
          pm10: { mean_3yr: null, mean_5yr: 188.1, worst_month_avg: null, trend_5yr_pct: null, trend_direction: null, vintage: { mean_3yr_from: null, mean_3yr_to: null, mean_5yr_from: null, mean_5yr_to: null }, zone: null, unit: 'µg/m³', data_quality: 'modelled', data_source: 'cams_eac4' },
          no2: { mean_5yr: 48.6, zone: null, unit: 'ppb', data_quality: 'modelled', data_source: 'cams_eac4' },
          so2: { mean_5yr: 12.4, zone: null, unit: 'ppb', data_quality: 'modelled', data_source: 'cams_eac4' },
          co:  { mean_5yr: 0.8, zone: null, unit: 'ppm', data_quality: 'modelled', data_source: 'cams_eac4' },
          o3:  { mean_5yr: 38.2, zone: null, unit: 'ppb', data_quality: 'modelled', data_source: 'cams_eac4' },
          aqi: { annual_mean: null, worst_month_value: null, worst_month_name: null, worst_year: null, category: 'Severe', limiting_pollutant: 'PM2.5' },
        },
        disasters: { flood_events_per_decade: 0.4, cyclone_events_per_decade: 0, earthquake_events_per_decade: 0.1, disaster_insurance_loss_cr: null, disaster_frequency_score: 1.2, data_quality: 'measured', data_source: 'emdat' },
        heat: { heat_wave_days_per_year: 14, heat_stress_zone: 'Moderate', data_quality: 'modelled', data_source: 'era5' },
        health_burden: { hypertension_pct: 28.4, diabetes_pct: 9.1, obesity_pct: 22.6, tobacco_use_pct: 31.2, anaemia_pct: 44.8, data_quality: 'surveyed', data_source: 'nfhs5', data_as_of_year: 2021 },
        composite: { composite_risk_score: 82, risk_tier: 'Very High', pm25_national_percentile: 97, composite_national_percentile: 98 },
        data_coverage: { overall_coverage: 'full', missing_fields: [] },
        meta: { db_last_refreshed: '2025-01-15T00:00:00Z', response_time_ms: 42, stored_on_application: false },
      },
    }, null, 2),
  },

  // ── 2. AQI History ────────────────────────────────────────────────────────
  {
    id: 'aqi-history',
    label: 'AQI History',
    method: 'GET',
    path: '/api/environmental/district/aqi-history',
    shortDescription: 'Monthly AQI & pollutant time-series for a district (up to 5 years)',
    description:
      'Returns a monthly time-series of AQI and individual pollutant concentrations (PM2.5, PM10, NO₂, SO₂, CO, O₃). ' +
      'Data is a blend of CPCB station measurements (where available) and CAMS/SEDAC satellite-modelled values ' +
      'for months without ground station coverage. Useful for trend charts on underwriting dashboards.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    params: [
      {
        name: 'x-api-key',
        in: 'header',
        required: true,
        type: 'string',
        description: 'Your platform API key',
        example: 'env_abc123...',
      },
      {
        name: 'state',
        in: 'query',
        required: true,
        type: 'string',
        description: 'State name.',
        example: 'Maharashtra',
        inputType: 'state-select',
        metaKey: 'aqiStates',
      },
      {
        name: 'district',
        in: 'query',
        required: true,
        type: 'string',
        description: 'District name (case-insensitive, spaces optional).',
        example: 'Mumbai City',
        inputType: 'district-select',
        cascadesFrom: 'state',
      },
      {
        name: 'from',
        in: 'query',
        required: true,
        type: 'string',
        description: 'Start month in YYYY-MM format.',
        example: '2022-01',
        inputType: 'month',
      },
      {
        name: 'to',
        in: 'query',
        required: true,
        type: 'string',
        description: 'End month in YYYY-MM format. Maximum range: 60 months.',
        example: '2023-12',
        inputType: 'month',
      },
      {
        name: 'pollutants',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Pollutants to include. Defaults to pm25 and aqi.',
        example: 'pm25,aqi',
        inputType: 'pollutant-select',
      },
    ],
    responseFields: [
      { field: 'data.district_name',           type: 'string',       description: 'District name' },
      { field: 'data.state_name',              type: 'string',       description: 'State name' },
      { field: 'data.series',                  type: 'array',        description: 'Chronological monthly data points' },
      { field: 'data.series[].year',           type: 'integer',      description: 'Year' },
      { field: 'data.series[].month',          type: 'integer',      description: 'Month number (1–12)' },
      { field: 'data.series[].month_name',     type: 'string',       description: 'Full month name' },
      { field: 'data.series[].pm25.value',     type: 'number|null',  description: 'PM2.5 concentration (µg/m³)' },
      { field: 'data.series[].pm25.data_quality', type: 'string',   description: '"measured" | "modelled" | "gap_filled"' },
      { field: 'data.series[].aqi.value',      type: 'number|null',  description: 'Computed AQI value' },
      { field: 'data.series[].aqi.category',   type: 'string|null',  description: 'AQI category string' },
      { field: 'data.summary.annual_means',    type: 'array',        description: 'Per-year mean PM2.5 and AQI' },
      { field: 'data.summary.worst_month_ever', type: 'object|null', description: 'Month with the highest AQI in the series' },
      { field: 'data.summary.trend',           type: 'string',       description: '"improving" | "worsening" | "stable"' },
      { field: 'data.meta.total_months',       type: 'integer',      description: 'Total months in series' },
      { field: 'data.meta.months_with_measured_data', type: 'integer', description: 'Months sourced from CPCB ground stations' },
      { field: 'data.meta.months_gap_filled',  type: 'integer',      description: 'Months filled by satellite/modelled data' },
    ],
    exampleRequest: {
      queryString: 'district=Mumbai City&state=Maharashtra&from=2022-01&to=2023-12',
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        district_name: 'Mumbai City',
        state_name: 'Maharashtra',
        series: [
          { year: 2022, month: 1, month_name: 'January', pm25: { value: 58.4, data_quality: 'measured' }, aqi: { value: 162, category: 'Moderate' } },
          { year: 2022, month: 2, month_name: 'February', pm25: { value: 52.1, data_quality: 'measured' }, aqi: { value: 148, category: 'Moderate' } },
        ],
        summary: {
          annual_means: [{ year: 2022, pm25_mean: 44.2, aqi_mean: 138 }, { year: 2023, pm25_mean: 41.8, aqi_mean: 132 }],
          worst_month_ever: { year: 2022, month: 11, month_name: 'November', pm25: 88.4, aqi: 232, category: 'Poor' },
          best_month_ever: { year: 2023, month: 7, month_name: 'July', pm25: 14.2, aqi: 62, category: 'Satisfactory' },
          trend: 'improving',
        },
        meta: { total_months: 24, months_with_measured_data: 18, months_gap_filled: 6, gap_filled_months: ['2022-06', '2022-07'] },
      },
    }, null, 2),
  },

  // ── 3. Water Quality State ─────────────────────────────────────────────────
  {
    id: 'water-quality-state',
    label: 'Water Quality — State',
    method: 'GET',
    path: '/api/environmental/water-quality/state',
    shortDescription: 'Fluoride, arsenic & nitrate exceedance data at state level',
    description:
      'Returns state-level ground water quality data sourced from the CGWB Annual Ground Water Quality Report 2025 ' +
      '(Pre-Monsoon 2024 monitoring). Reports percentage of samples exceeding BIS permissible limits for fluoride (1.5 mg/L), ' +
      'arsenic (0.01 mg/L), and nitrate (45 mg/L). Includes known high-risk districts and clinical health risk signals ' +
      'for underwriting. Accept either a state name or a pincode — pincode is internally mapped to a state.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    params: [
      {
        name: 'x-api-key',
        in: 'header',
        required: true,
        type: 'string',
        description: 'Your platform API key',
        example: 'env_abc123...',
      },
      {
        name: 'state',
        in: 'query',
        required: false,
        type: 'string',
        description: 'State name. Common abbreviations accepted (UP, MP, TN, WB, AP, HP…). Either state or pincode is required.',
        example: 'Rajasthan',
        inputType: 'state-select',
        metaKey: 'waterStates',
      },
      {
        name: 'pincode',
        in: 'query',
        required: false,
        type: 'string',
        description: '6-digit PIN code. Mapped internally to a state. Either state or pincode is required.',
        example: '302001',
      },
    ],
    responseFields: [
      { field: 'data.lookup.state_name',            type: 'string',       description: 'Resolved state name' },
      { field: 'data.lookup.pincode_provided',      type: 'string|null',  description: 'Pincode supplied by caller (if any)' },
      { field: 'data.lookup.resolution',            type: 'string',       description: 'Always "state" — data is at state level' },
      { field: 'data.lookup.note',                  type: 'string',       description: 'Human-readable note about data resolution' },
      { field: 'data.contaminants.fluoride.pct_exceeding', type: 'number|null', description: '% samples exceeding BIS limit (1.5 mg/L)' },
      { field: 'data.contaminants.fluoride.samples_analyzed', type: 'integer|null', description: 'Total samples analyzed for fluoride' },
      { field: 'data.contaminants.fluoride.risk_level', type: 'string|null', description: '"low" | "moderate" | "high" | "very_high"' },
      { field: 'data.contaminants.fluoride.bis_limit', type: 'number',    description: 'BIS permissible limit: 1.5' },
      { field: 'data.contaminants.arsenic.pct_exceeding', type: 'number|null', description: '% samples exceeding BIS limit (0.01 mg/L)' },
      { field: 'data.contaminants.arsenic.risk_level', type: 'string|null', description: '"low" | "moderate" | "high" | "very_high"' },
      { field: 'data.contaminants.nitrate.pct_exceeding', type: 'number|null', description: '% samples exceeding BIS limit (45 mg/L)' },
      { field: 'data.contaminants.nitrate.risk_level', type: 'string|null', description: '"low" | "moderate" | "high" | "very_high"' },
      { field: 'data.overall_water_risk',           type: 'string|null',  description: '"low" | "moderate" | "high" | "very_high"' },
      { field: 'data.known_high_risk_districts',    type: 'string[]',     description: 'District names with documented contamination hotspots' },
      { field: 'data.health_risks.fluoride',        type: 'array',        description: 'Clinical health risks from fluoride exposure' },
      { field: 'data.health_risks.arsenic',         type: 'array',        description: 'Clinical health risks from arsenic exposure' },
      { field: 'data.health_risks.nitrate',         type: 'array',        description: 'Clinical health risks from nitrate exposure' },
      { field: 'data.uw_summary',                   type: 'string',       description: 'Plain-language underwriting summary' },
      { field: 'data.data_coverage.overall_coverage', type: 'string',     description: '"full" | "partial" | "minimal"' },
      { field: 'data.meta.monitoring_season',       type: 'string|null',  description: 'Monitoring season (e.g. "Pre-Monsoon 2024")' },
      { field: 'data.meta.data_as_of_year',         type: 'integer|null', description: 'Year of monitoring data' },
    ],
    exampleRequest: {
      queryString: 'pincode=302001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        lookup: { state_name: 'Rajasthan', pincode_provided: '302001', resolution: 'state', note: 'Result is at state level. Pincode 302001 was mapped to state "Rajasthan". Ground water quality data is only available at state level from CGWB.' },
        contaminants: {
          fluoride: { pct_exceeding: 41.06, samples_analyzed: 8241, samples_exceeding: 3387, risk_level: 'very_high', bis_limit: 1.5, unit: 'mg/L' },
          arsenic:  { pct_exceeding: 3.21, samples_analyzed: 4102, samples_exceeding: 132, risk_level: 'low', bis_limit: 0.01, unit: 'mg/L' },
          nitrate:  { pct_exceeding: 18.74, samples_analyzed: 8241, samples_exceeding: 1545, risk_level: 'moderate', bis_limit: 45, unit: 'mg/L' },
        },
        overall_water_risk: 'very_high',
        known_high_risk_districts: ['Barmer', 'Jaisalmer', 'Jodhpur', 'Nagaur', 'Bikaner', 'Sikar', 'Jhunjhunu'],
        health_risks: {
          fluoride: [
            { risk_code: 'dental_fluorosis', display_label: 'Dental Fluorosis', severity: 'moderate', clinical_basis: 'Mottling and structural damage to tooth enamel' },
            { risk_code: 'skeletal_fluorosis', display_label: 'Skeletal Fluorosis', severity: 'high', clinical_basis: 'Bone density loss, joint pain, spinal rigidity with chronic exposure >4 mg/L' },
          ],
          arsenic: [
            { risk_code: 'arsenicosis', display_label: 'Arsenicosis / Skin Lesions', severity: 'high', clinical_basis: 'Keratosis, hyperpigmentation with chronic exposure' },
          ],
          nitrate: [
            { risk_code: 'methaemoglobinaemia', display_label: 'Methaemoglobinaemia', severity: 'high', clinical_basis: 'Blue baby syndrome in infants — nitrate reduces oxygen-carrying capacity' },
          ],
        },
        uw_summary: 'Rajasthan has very high ground water contamination risk. Elevated: fluoride (41.1% samples above BIS limit of 1.5 mg/L). Known high-risk districts: Barmer, Jaisalmer, Jodhpur, Nagaur, Bikaner and 2 others.',
        data_coverage: { overall_coverage: 'full', missing_contaminants: [] },
        meta: { monitoring_season: 'Pre-Monsoon 2024', data_source: 'cgwb_annual_report', data_as_of_year: 2024, response_time_ms: 28 },
      },
    }, null, 2),
  },

  // ── 4. Water Quality Hotspots ─────────────────────────────────────────────
  {
    id: 'water-quality-hotspots',
    label: 'Water Quality — Hotspots',
    method: 'GET',
    path: '/api/environmental/water-quality/hotspots',
    shortDescription: 'Point-measured CGWB contamination hotspot stations for a state',
    description:
      'Returns individual monitoring station records (CGWB, 2024) where ground water exceeded BIS permissible limits. ' +
      'Each hotspot has GPS coordinates, village/block/district, contaminant type, measured concentration, and ' +
      'exceedance factor (measured ÷ BIS limit). Useful for district-level drilldown and generating contamination maps. ' +
      'Data resolution is state-level — a pincode is accepted but results cover the entire state.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    params: [
      {
        name: 'x-api-key',
        in: 'header',
        required: true,
        type: 'string',
        description: 'Your platform API key',
        example: 'env_abc123...',
      },
      {
        name: 'state',
        in: 'query',
        required: false,
        type: 'string',
        description: 'State name. Common abbreviations accepted. Either state or pincode is required.',
        example: 'West Bengal',
        inputType: 'state-select',
        metaKey: 'hotspotStates',
      },
      {
        name: 'pincode',
        in: 'query',
        required: false,
        type: 'string',
        description: '6-digit PIN code. Mapped internally to a state. Either state or pincode is required.',
        example: '700001',
      },
      {
        name: 'contaminant',
        in: 'query',
        required: false,
        type: 'string',
        description: 'Filter hotspots by contaminant. If omitted, all contaminants are returned.',
        example: 'arsenic',
        enum: ['fluoride', 'arsenic', 'nitrate'],
      },
    ],
    responseFields: [
      { field: 'data.lookup.state_name',         type: 'string',      description: 'Resolved state name' },
      { field: 'data.lookup.pincode_provided',   type: 'string|null', description: 'Pincode supplied (if any)' },
      { field: 'data.hotspots',                  type: 'array',       description: 'Array of monitoring station records' },
      { field: 'data.hotspots[].hotspot_no',     type: 'integer|null', description: 'CGWB internal hotspot number' },
      { field: 'data.hotspots[].state_name',     type: 'string',      description: 'State' },
      { field: 'data.hotspots[].district',       type: 'string',      description: 'District name' },
      { field: 'data.hotspots[].block_taluka',   type: 'string|null', description: 'Block or taluka name' },
      { field: 'data.hotspots[].village',        type: 'string|null', description: 'Village name' },
      { field: 'data.hotspots[].lat',            type: 'number|null', description: 'Station latitude' },
      { field: 'data.hotspots[].lng',            type: 'number|null', description: 'Station longitude' },
      { field: 'data.hotspots[].source_type',    type: 'string|null', description: 'Water source type (e.g. "Dug Well", "Hand Pump")' },
      { field: 'data.hotspots[].contaminant',    type: 'string',      description: '"fluoride" | "arsenic" | "nitrate"' },
      { field: 'data.hotspots[].concentration',  type: 'number',      description: 'Measured concentration in the listed unit' },
      { field: 'data.hotspots[].unit',           type: 'string',      description: 'Concentration unit (mg/L)' },
      { field: 'data.hotspots[].bis_limit',      type: 'number',      description: 'BIS permissible limit for this contaminant' },
      { field: 'data.hotspots[].exceedance_factor', type: 'number|null', description: 'concentration ÷ bis_limit (e.g. 3.2 = 3.2× the limit)' },
      { field: 'data.hotspots[].severity',       type: 'string|null', description: '"low" | "moderate" | "high" | "very_high"' },
      { field: 'data.summary.total_hotspots',    type: 'integer',     description: 'Total hotspot count for this state' },
      { field: 'data.summary.fluoride_hotspots', type: 'integer',     description: 'Count of fluoride hotspots' },
      { field: 'data.summary.arsenic_hotspots',  type: 'integer',     description: 'Count of arsenic hotspots' },
      { field: 'data.summary.nitrate_hotspots',  type: 'integer',     description: 'Count of nitrate hotspots' },
      { field: 'data.summary.worst_contaminant', type: 'string|null', description: 'Contaminant with the most hotspots' },
      { field: 'data.summary.max_exceedance_factor', type: 'number|null', description: 'Highest exceedance factor across all hotspots' },
    ],
    exampleRequest: {
      queryString: 'state=West Bengal&contaminant=arsenic',
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        lookup: { state_name: 'West Bengal', pincode_provided: null, resolution: 'state', note: 'Hotspots shown for state "West Bengal". Point-measured CGWB monitoring stations — not all districts in the state will have hotspots listed.' },
        hotspots: [
          { hotspot_no: 1, state_name: 'West Bengal', district: 'Murshidabad', block_taluka: 'Raninagar-I', village: 'Domkal', lat: 24.1672, lng: 88.5281, source_type: 'Dug Well', contaminant: 'arsenic', concentration: 0.412, unit: 'mg/L', bis_limit: 0.01, exceedance_factor: 41.2, severity: 'very_high' },
          { hotspot_no: 2, state_name: 'West Bengal', district: 'Malda', block_taluka: 'Kaliachak-III', village: 'Sujapur', lat: 24.9821, lng: 87.9124, source_type: 'Hand Pump', contaminant: 'arsenic', concentration: 0.187, unit: 'mg/L', bis_limit: 0.01, exceedance_factor: 18.7, severity: 'very_high' },
        ],
        summary: { total_hotspots: 43, fluoride_hotspots: 0, arsenic_hotspots: 43, nitrate_hotspots: 0, worst_contaminant: 'arsenic', max_exceedance_factor: 41.2 },
        meta: { data_source: 'cgwb_annual_report', data_as_of_year: 2024, response_time_ms: 18 },
      },
    }, null, 2),
  },
]
