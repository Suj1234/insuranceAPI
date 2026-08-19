import { BASE_URL } from './introduction'
import { PAN_PROFILE_VARIANTS } from './pan-profile-variants'
import { PAN_STATUS_VARIANTS } from './pan-status-variants'
import { PAN_DOB_STATUS_VARIANTS } from './pan-dob-status-variants'
import { PAN_LINK_UNIQUE_CONSENT_VARIANTS } from './pan-link-unique-consent-variants'
import { PAN_LINK_UNIQUE_CHECK_VARIANTS } from './pan-link-unique-check-variants'
import { PAN_LINK_ANY_VARIANTS } from './pan-link-any-variants'
import { BANK_AC_ADVANCED_VARIANTS } from './bank-ac-advanced-variants'
import { BANK_AC_SILENT_VARIANTS } from './bank-ac-silent-variants'
import { DL_VARIANTS } from './dl-variants'
import { PASSPORT_VARIANTS } from './passport-variants'
import { RC_ADVANCED_VARIANTS } from './rc-advanced-variants'
import { GST_VARIANTS } from './gst-variants'

export type ParamIn = 'query' | 'header' | 'path' | 'body'
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'

// Structured validation rules — the single source of truth for BOTH the
// Documentation "Validations" column and the Tryout form's inline checks.
export interface ParamValidation {
  minLength?: number
  maxLength?: number
  pattern?: string   // regex source, e.g. ^[A-Za-z]{5}\d{4}[A-Za-z]{1}$
  hint?: string      // human label for the format, e.g. "YYYY-MM-DD"
}

export interface Param {
  name: string          // wire name (sent to the API) — never change casually
  label?: string        // friendly form label; falls back to a humanized name
  placeholder?: string  // tryout input placeholder (e.g. a format hint)
  uppercase?: boolean   // force the tryout input value to upper-case as typed
  in: ParamIn
  required: boolean
  type: SchemaType
  description: string
  example?: string | number | boolean
  enum?: string[]
  validation?: ParamValidation
  inputType?: 'state-select' | 'district-select' | 'month' | 'pollutant-select'
  metaKey?: 'aqiStates' | 'waterStates' | 'hotspotStates'
  cascadesFrom?: string
}

export interface ResponseField {
  field: string
  type: string
  nullable?: boolean
  description: string
  required?: boolean   // explicit Required column value (from source docs)
}

// A request/response variant (e.g. "Default", "PAN Lite", "Father Name").
// Each carries its own exact Schema/Body/Headers for both request and response,
// copied from the vendor documentation.
export interface ApiVariant {
  label: string
  request: {
    params: Param[]
    body: string       // JSON example (Body tab)
    headers: string    // Headers tab text
  }
  response: {
    fields: ResponseField[]
    body: string
    headers: string
  }
}

export type AboutBlock =
  | { type: 'heading';    text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph';  text: string }
  | { type: 'code';       text: string }
  | { type: 'table';      headers: string[]; rows: string[][] }
  | { type: 'bullets';    items: string[] }
  | { type: 'callout';    label: string; text: string }
  | { type: 'divider' }

export type ApiGroupName = 'Environmental' | 'Flood & Hydrology' | 'Verification (KYC)'

export interface ApiDefinition {
  id: string
  label: string
  group?: ApiGroupName
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
  about?: { blocks: AboutBlock[]; source: string }
  modeGroup?: 'pincode-or-latlon'
  // When present, DocTab renders a variant switcher and uses these exact
  // request/response definitions instead of the flat params/responseFields.
  variants?: ApiVariant[]
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

  // ── 5. Aqueduct Flood Hazard (Pincode) ────────────────────────────────────
  {
    id: 'aqueduct-pincode',
    label: 'Aqueduct Flood Hazard',
    method: 'GET',
    path: '/api/environmental/aqueduct/pincode',
    shortDescription: 'WRI Aqueduct Floods v2 — 231-column riverine & coastal flood hazard profile for a pincode',
    description:
      'Returns the full WRI Aqueduct Floods v2 flood hazard profile for a 6-digit Indian pincode — 231 depth columns sampled at 1km resolution. ' +
      'Four sections: ' +
      '(1) Riverine baseline — 7 return periods (RP10–RP1000) from the 1980 WATCH reanalysis. ' +
      '(2) Riverine projections — 6 climate scenarios (RCP4.5/8.5 × 2030/2050/2080) × 7 RPs = 42 columns, each the ensemble mean of 5 CMIP5 GCMs (NorESM1-M, GFDL-ESM2M, HadGEM2-ES, IPSL-CM5A-LR, MIROC-ESM-CHEM). ' +
      '(3) Coastal no-subsidence — historical baseline (7 RPs, p95 only) + 6 scenarios × 7 RPs × 2 SLR percentiles (p95/p50) = 91 columns. ' +
      '(4) Coastal with-subsidence — baseline_2030 (7 RPs, p95 only) + 6 scenarios × 7 RPs × 2 percentiles = 91 columns. ' +
      'All values in metres. 0 = pincode centroid is outside the flood zone at that return period. null = no raster coverage at this location.',
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
        example: '781001',
      },
    ],
    responseFields: [
      { field: 'pincode',                                                              type: 'string',      description: 'Queried pincode' },

      // Riverine baseline
      { field: 'aqueduct.riverine.baseline_1980.rp10_m',                             type: 'number|null', description: 'Riverine flood depth (m) at 10-yr return period — 1980 WATCH reanalysis baseline. 0 = outside flood zone.' },
      { field: 'aqueduct.riverine.baseline_1980.rp25_m',                             type: 'number|null', description: 'Riverine depth at 25-yr RP (1980 baseline)' },
      { field: 'aqueduct.riverine.baseline_1980.rp50_m',                             type: 'number|null', description: 'Riverine depth at 50-yr RP (1980 baseline)' },
      { field: 'aqueduct.riverine.baseline_1980.rp100_m',                            type: 'number|null', description: 'Riverine depth at 100-yr RP (1980 baseline)' },
      { field: 'aqueduct.riverine.baseline_1980.rp250_m',                            type: 'number|null', description: 'Riverine depth at 250-yr RP (1980 baseline)' },
      { field: 'aqueduct.riverine.baseline_1980.rp500_m',                            type: 'number|null', description: 'Riverine depth at 500-yr RP (1980 baseline)' },
      { field: 'aqueduct.riverine.baseline_1980.rp1000_m',                           type: 'number|null', description: 'Riverine depth at 1000-yr RP (1980 baseline)' },

      // Riverine projections — one scenario shown; all 6 follow the same 7-key pattern
      { field: 'aqueduct.riverine.projections.rcp45_2030',                           type: 'object',      description: 'RCP4.5 2030 projection — keys rp10_m … rp1000_m (7 return periods). Ensemble mean of 5 CMIP5 GCMs.' },
      { field: 'aqueduct.riverine.projections.rcp85_2030',                           type: 'object',      description: 'RCP8.5 2030 — same 7-key structure' },
      { field: 'aqueduct.riverine.projections.rcp45_2050',                           type: 'object',      description: 'RCP4.5 2050 — same 7-key structure' },
      { field: 'aqueduct.riverine.projections.rcp85_2050',                           type: 'object',      description: 'RCP8.5 2050 — same 7-key structure' },
      { field: 'aqueduct.riverine.projections.rcp45_2080',                           type: 'object',      description: 'RCP4.5 2080 — same 7-key structure' },
      { field: 'aqueduct.riverine.projections.rcp85_2080',                           type: 'object',      description: 'RCP8.5 2080 — same 7-key structure. Worst-case scenario.' },
      { field: 'aqueduct.riverine.projections.{scenario}.rp10_m',                   type: 'number|null', description: '10-yr RP projected depth for this scenario' },
      { field: 'aqueduct.riverine.projections.{scenario}.rp100_m',                  type: 'number|null', description: '100-yr RP projected depth (key actuarial return period)' },
      { field: 'aqueduct.riverine.projections.{scenario}.rp1000_m',                 type: 'number|null', description: '1000-yr RP projected depth' },

      // Coastal nosub historical
      { field: 'aqueduct.coastal.nosub.historical',                                  type: 'object',      description: 'Coastal no-subsidence historical baseline (~1986–2005). Keys: rp10_p95_m … rp1000_p95_m (7 RPs, p95 SLR only).' },
      { field: 'aqueduct.coastal.nosub.historical.rp100_p95_m',                     type: 'number|null', description: 'Coastal historical depth at RP100, p95 SLR percentile, no land subsidence' },

      // Coastal nosub projected
      { field: 'aqueduct.coastal.nosub.rcp45_2030',                                 type: 'object',      description: 'Coastal no-subsidence RCP4.5 2030. Keys: rp10_p95_m, rp10_p50_m … rp1000_p95_m, rp1000_p50_m (14 keys: 7 RPs × 2 SLR percentiles).' },
      { field: 'aqueduct.coastal.nosub.{scenario}.rp100_p95_m',                    type: 'number|null', description: 'Coastal projected depth at RP100, high SLR (p95), no subsidence' },
      { field: 'aqueduct.coastal.nosub.{scenario}.rp100_p50_m',                    type: 'number|null', description: 'Coastal projected depth at RP100, median SLR (p50), no subsidence' },
      { field: 'aqueduct.coastal.nosub.rcp85_2080',                                 type: 'object',      description: 'Coastal no-subsidence RCP8.5 2080 — worst-case scenario, same 14-key structure' },

      // Coastal wtsub baseline
      { field: 'aqueduct.coastal.with_subsidence.baseline_2030',                    type: 'object',      description: 'Coastal with-subsidence baseline_2030 (land subsidence included, ~2030 horizon). Keys: rp10_p95_m … rp1000_p95_m (7 RPs, p95 only). Higher than nosub.historical at same RP.' },
      { field: 'aqueduct.coastal.with_subsidence.baseline_2030.rp100_p95_m',       type: 'number|null', description: 'Coastal depth at RP100 with subsidence, 2030 baseline, p95 SLR' },

      // Coastal wtsub projected
      { field: 'aqueduct.coastal.with_subsidence.rcp45_2030',                       type: 'object',      description: 'Coastal with-subsidence RCP4.5 2030. Same 14-key structure as nosub projected.' },
      { field: 'aqueduct.coastal.with_subsidence.{scenario}.rp100_p95_m',          type: 'number|null', description: 'Coastal projected depth at RP100 with subsidence, high SLR (p95)' },
      { field: 'aqueduct.coastal.with_subsidence.{scenario}.rp100_p50_m',          type: 'number|null', description: 'Coastal projected depth at RP100 with subsidence, median SLR (p50)' },
      { field: 'aqueduct.coastal.with_subsidence.rcp85_2080',                       type: 'object',      description: 'Coastal with-subsidence RCP8.5 2080 — highest flood depths in the dataset' },

      // Meta
      { field: 'aqueduct.meta.source',            type: 'string',  description: 'Always "WRI Aqueduct Floods v2"' },
      { field: 'aqueduct.meta.published',         type: 'string',  description: 'Dataset publication date: "2020-04"' },
      { field: 'aqueduct.meta.baseline_year',     type: 'integer', description: '1980 — year of the WATCH reanalysis baseline' },
      { field: 'aqueduct.meta.baseline_model',    type: 'string',  description: '"WATCH reanalysis 1960-1999"' },
      { field: 'aqueduct.meta.projection_models', type: 'string',  description: 'Ensemble members: NorESM1-M, GFDL-ESM2M, HadGEM2-ES, IPSL-CM5A-LR, MIROC-ESM-CHEM' },
      { field: 'aqueduct.meta.resolution_m',      type: 'integer', description: 'Native raster resolution: 1000 m' },
      { field: 'aqueduct.meta.zero_means',        type: 'string',  description: '"outside flood zone at this return period"' },
      { field: 'aqueduct.meta.null_means',        type: 'string',  description: '"no raster coverage at this location"' },
      { field: 'aqueduct.meta.sampling',          type: 'string',  description: '"point-sampled at pincode centroid"' },
      { field: 'aqueduct.meta.latency_ms',        type: 'integer', description: 'Server-side processing time in ms' },
    ],
    exampleRequest: {
      queryString: 'pincode=781001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      pincode: '781001',
      aqueduct: {
        riverine: {
          baseline_1980: {
            rp10_m: 0.214, rp25_m: 0.381, rp50_m: 0.489,
            rp100_m: 0.550, rp250_m: 0.741, rp500_m: 1.120, rp1000_m: 1.480,
          },
          projections: {
            rcp45_2030: { rp10_m: 0.220, rp25_m: 0.392, rp50_m: 0.503, rp100_m: 0.565, rp250_m: 0.762, rp500_m: 1.152, rp1000_m: 1.524 },
            rcp85_2030: { rp10_m: 0.225, rp25_m: 0.401, rp50_m: 0.514, rp100_m: 0.578, rp250_m: 0.779, rp500_m: 1.178, rp1000_m: 1.558 },
            rcp45_2050: { rp10_m: 0.231, rp25_m: 0.412, rp50_m: 0.528, rp100_m: 0.595, rp250_m: 0.802, rp500_m: 1.213, rp1000_m: 1.604 },
            rcp85_2050: { rp10_m: 0.243, rp25_m: 0.434, rp50_m: 0.557, rp100_m: 0.627, rp250_m: 0.845, rp500_m: 1.278, rp1000_m: 1.690 },
            rcp45_2080: { rp10_m: 0.246, rp25_m: 0.440, rp50_m: 0.565, rp100_m: 0.636, rp250_m: 0.856, rp500_m: 1.295, rp1000_m: 1.712 },
            rcp85_2080: { rp10_m: 0.284, rp25_m: 0.508, rp50_m: 0.652, rp100_m: 0.734, rp250_m: 0.989, rp500_m: 1.495, rp1000_m: 1.977 },
          },
        },
        coastal: {
          nosub: {
            historical: {
              rp10_p95_m: 0, rp25_p95_m: 0, rp50_p95_m: 0,
              rp100_p95_m: 0, rp250_p95_m: 0, rp500_p95_m: 0, rp1000_p95_m: 0,
            },
            rcp45_2030: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2030: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp45_2050: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2050: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp45_2080: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2080: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
          },
          with_subsidence: {
            baseline_2030: {
              rp10_p95_m: 0, rp25_p95_m: 0, rp50_p95_m: 0,
              rp100_p95_m: 0, rp250_p95_m: 0, rp500_p95_m: 0, rp1000_p95_m: 0,
            },
            rcp45_2030: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2030: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp45_2050: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2050: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp45_2080: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
            rcp85_2080: { rp10_p95_m: 0, rp10_p50_m: 0, rp25_p95_m: 0, rp25_p50_m: 0, rp50_p95_m: 0, rp50_p50_m: 0, rp100_p95_m: 0, rp100_p50_m: 0, rp250_p95_m: 0, rp250_p50_m: 0, rp500_p95_m: 0, rp500_p50_m: 0, rp1000_p95_m: 0, rp1000_p50_m: 0 },
          },
        },
        meta: {
          source: 'WRI Aqueduct Floods v2',
          published: '2020-04',
          baseline_year: 1980,
          baseline_model: 'WATCH reanalysis 1960-1999',
          projection_models: 'ensemble mean - NorESM1-M, GFDL-ESM2M, HadGEM2-ES, IPSL-CM5A-LR, MIROC-ESM-CHEM',
          resolution_m: 1000,
          zero_means: 'outside flood zone at this return period',
          null_means: 'no raster coverage at this location',
          sampling: 'point-sampled at pincode centroid',
          latency_ms: 42,
        },
      },
    }, null, 2),

    about: {
      source: 'Data source: WRI Aqueduct Floods v2, World Resources Institute (2020).',
      blocks: [
        { type: 'heading', text: 'What this API tells you' },
        { type: 'paragraph', text: 'For any Indian pincode, this API tells you: if a flood of a given severity occurs here, how deep will the water be — and how likely is that severity in any given year.' },
        { type: 'paragraph', text: 'It covers two types of flood — river flooding and coastal flooding — and shows how both change under climate change from today through to 2080. The depth and the likelihood always come together. One without the other tells you nothing.' },
        { type: 'paragraph', text: 'What this is not: a flood forecast, a flood alert, or a count of past floods. It is a hazard model — a probability-weighted depth estimate at each severity level.' },

        { type: 'divider' },
        { type: 'heading', text: 'Two types of flood risk' },
        { type: 'subheading', text: 'River flooding (riverine)' },
        { type: 'paragraph', text: 'Flooding caused by rivers overflowing — the Brahmaputra, Ganga, Godavari, Krishna, and their tributaries. This is the dominant flood type across inland India. It affects any property near a river system, not just coastal areas. Driven by heavy monsoon rainfall and upstream discharge.' },
        { type: 'subheading', text: 'Coastal flooding' },
        { type: 'paragraph', text: 'Sea-driven flooding from rising sea levels combined with storm surge and tidal action. Affects coastal strips across Gujarat, Maharashtra, Goa, Karnataka, Kerala, Tamil Nadu, Andhra Pradesh, Odisha, and West Bengal.' },
        { type: 'paragraph', text: 'The two hazards are returned separately. A pincode can have high riverine risk and zero coastal risk, or vice versa.' },

        { type: 'divider' },
        { type: 'heading', text: 'Riverine flood — return period and depth' },
        { type: 'paragraph', text: 'This API gives river flood depth at 7 severity levels, from frequent minor floods to rare catastrophic events.' },
        {
          type: 'table',
          headers: ['Return period', 'How often', 'Annual probability', 'What it is used for'],
          rows: [
            ['rp10_m',   'Once every ~10 years',    '10% per year',   'Annual crop insurance'],
            ['rp25_m',   'Once every ~25 years',    '4% per year',    'Agricultural land assessment'],
            ['rp50_m',   'Once every ~50 years',    '2% per year',    'Commercial property'],
            ['rp100_m',  'Once every ~100 years',   '1% per year',    'Standard property underwriting'],
            ['rp250_m',  'Once every ~250 years',   '0.4% per year',  'Portfolio stress testing'],
            ['rp500_m',  'Once every ~500 years',   '0.2% per year',  'Reinsurance and CAT modelling'],
            ['rp1000_m', 'Once every ~1,000 years', '0.1% per year',  'Extreme capital stress testing'],
          ],
        },
        { type: 'paragraph', text: 'The rarer the flood, the deeper the water. All seven values describe the same pincode — just seven different severity levels.' },

        { type: 'subheading', text: 'Example 1 — what a pincode response looks like (riverine)' },
        { type: 'paragraph', text: 'For a pincode in Assam near the Brahmaputra:' },
        { type: 'code', text: 'rp10_m   = 0.3m  → once every ~10 years   — ankle to knee deep, happens regularly\nrp25_m   = 0.5m  → once every ~25 years   — knee deep, moderate damage\nrp50_m   = 0.7m  → once every ~50 years   — significant property damage\nrp100_m  = 1.0m  → once every ~100 years  — waist deep, major damage\nrp250_m  = 1.4m  → once every ~250 years  — severe, vehicles and ground floor lost\nrp500_m  = 1.8m  → once every ~500 years  — very severe, structural risk\nrp1000_m = 2.3m  → once every ~1,000 years — extreme, potential total loss' },

        { type: 'subheading', text: 'Example 2 — why loan tenure changes the risk' },
        { type: 'paragraph', text: 'A 1% annual chance (rp100) sounds small. But it comes back every year for as long as the property exists. Formula: P = 1 − (1 − annual probability)^N' },
        {
          type: 'table',
          headers: ['Loan tenure', 'Probability of at least one RP100 flood'],
          rows: [
            ['5 years',  '~5%'],
            ['10 years', '~10%'],
            ['20 years', '~18%'],
            ['30 years', '~26%'],
          ],
        },
        { type: 'paragraph', text: 'A 20-year home loan on a pincode where rp100_m = 1.0m carries an 18% chance of seeing that level of flooding before the loan is repaid. For standard property underwriting, use rp100_m — it is the global benchmark for pricing flood risk.' },

        { type: 'divider' },
        { type: 'heading', text: 'Riverine climate projections — how risk changes over time' },
        { type: 'paragraph', text: 'The current riverine values are based on 1980 historical data. The API also provides projections across three time horizons and two emissions scenarios.' },
        { type: 'bullets', items: [
          'RCP 4.5 (moderate) — assumes significant global action on emissions. Optimistic path.',
          'RCP 8.5 (high) — business as usual, limited action. Pessimistic path. Used for stress testing.',
        ]},
        { type: 'paragraph', text: 'Three time horizons: 2030, 2050, 2080. At 2050, both RCP 4.5 and RCP 8.5 are available — so you can directly see the difference emissions policy makes.' },
        { type: 'code', text: 'Today (1980 baseline):\n  rp100_m = 1.0m   rp500_m = 1.8m\n\n2030 — high emissions (RCP 8.5):\n  rp100_m = 1.2m   rp500_m = 2.2m\n\n2050 — moderate emissions (RCP 4.5):\n  rp100_m = 1.2m   rp500_m = 2.2m\n\n2050 — high emissions (RCP 8.5):\n  rp100_m = 1.4m   rp500_m = 2.6m   ← always higher than RCP 4.5 at the same year\n\n2080 — high emissions (RCP 8.5):\n  rp100_m = 1.7m   rp500_m = 3.1m' },
        { type: 'paragraph', text: 'At 2050: high emissions gives 1.4m vs moderate emissions 1.2m at rp100 — a 17% difference. That gap widens further by 2080. A 30-year home loan issued today matures in 2055 — the 2050 projection is more relevant to that loan than the 1980 baseline.' },

        { type: 'divider' },
        { type: 'heading', text: 'Coastal flood — subsidence, sea level rise, and time' },
        { type: 'paragraph', text: 'Coastal flood risk is more complex than riverine because it has two additional layers: how much the sea rises and whether the land itself is sinking.' },
        { type: 'subheading', text: 'What is land subsidence?' },
        { type: 'paragraph', text: 'The ground beneath many Indian coastal cities is slowly sinking. Large amounts of groundwater are pumped out for drinking water and industry. When that water is removed, the soil above compresses and the land surface physically drops — sometimes 2 to 5 centimetres every year. Mumbai, Chennai, and Kolkata are all measurably sinking. Even if the sea level never rose at all, a sinking city would flood more each decade because the land is getting lower.' },
        { type: 'subheading', text: 'Without subsidence (nosub)' },
        { type: 'paragraph', text: 'What coastal flooding looks like if the ground stays exactly where it is today — sea level rise only. Provided for the historical baseline and all projected scenarios (2030, 2050, 2080 under both RCP 4.5 and RCP 8.5). Use as a reference: it shows how much risk comes purely from the sea rising, with zero contribution from land sinking.' },
        { type: 'subheading', text: 'With subsidence (wtsub)' },
        { type: 'paragraph', text: 'Accounts for sea level rise AND the land sinking over time. Also provided for the historical baseline and all projected scenarios. Will always show higher flood depth than the nosub equivalent at the same year, scenario, and return period. Use this for all actual underwriting decisions.' },
        { type: 'subheading', text: 'p50 and p95 — which sea level rise estimate to use' },
        { type: 'paragraph', text: 'p50 is the 50th percentile of sea level rise projections across climate models — the median estimate. p95 is the 95th percentile — the conservative estimate. Use p95 for underwriting.' },
        { type: 'code', text: 'Without subsidence (sea level rise only):\n  historical rp100 p50 = 0.4m    ← median SLR estimate\n  historical rp100 p95 = 0.7m    ← conservative — use this for underwriting\n  2050 RCP 8.5 rp100 p95 = 1.1m  ← sea level rise by 2050, no sinking factored\n\nWith subsidence (sea rise + land sinking):\n  historical rp100 p95 = 0.9m\n  2030 RCP 8.5 rp100 p95 = 1.1m  ← 5 years of combined sinking and sea rise\n  2050 RCP 8.5 rp100 p95 = 1.5m  ← 25 years of combined sinking and sea rise\n  2080 RCP 8.5 rp100 p95 = 2.2m  ← long-term: significant combined impact\n\nGap at 2050: nosub 1.1m vs wtsub 1.5m → 0.4m is land sinking\'s contribution.' },
        { type: 'paragraph', text: 'The gap between nosub and wtsub at the same scenario and year shows exactly how much of the risk increase comes from land sinking versus the sea rising. For cities like Mumbai and Kolkata, subsidence is a significant and growing contributor. For coastal underwriting, always use wtsub (with subsidence) and p95 (conservative).' },

        { type: 'divider' },
        { type: 'heading', text: 'What someone could wrongly read into this data' },
        { type: 'callout', label: '"This tells me whether a flood will come."', text: 'It does not. The API says nothing about whether a flood will occur. It only tells you the depth if a flood of that probability level occurs.' },
        { type: 'callout', label: '"This tells me how often floods happen here."', text: 'No. A pincode can flood every monsoon with 10cm of water AND have a high rp100 depth for rare severe events. Return period measures severity thresholds — not how routinely any flooding occurs.' },
        { type: 'callout', label: '"The rp100 depth is what the next flood will look like."', text: 'No. The next flood could be shallower or deeper depending on actual conditions. rp100 is a probability threshold, not a depth forecast.' },
        { type: 'callout', label: '"A value of 0.0 means this pincode is safe."', text: 'Not necessarily. The model samples a single coordinate per pincode. If that point sits on elevated ground, the model returns 0.0 even if flood-prone areas exist within the same pincode.' },
        { type: 'callout', label: '"The 2050 and 2080 projections are predictions."', text: 'They are scenarios, not forecasts. They represent what happens IF emissions follow a given pathway. Use them as stress-test inputs.' },
        { type: 'callout', label: '"Higher depth means more damage."', text: 'Depth alone does not determine damage. This data does not capture how fast water moves, how long it stays, or whether flood protection like embankments exists at that location.' },

        { type: 'divider' },
        { type: 'heading', text: 'Where to use this' },
        { type: 'bullets', items: [
          'New business intake — rp100_m above 0.5m warrants flood loading. Above 1.5m warrants referral. Any non-zero coastal column means the property sits in a modelled coastal flood zone.',
          'Portfolio accumulation — Aggregate rp500_m across your book to identify catastrophe concentration. Compare 2030 vs 2080 projections to see how expected annual flood loss grows.',
          'Long-term property and home loans — Use the 2050 RCP 8.5 column for any product with a horizon beyond 10 years.',
          'Reinsurance treaty pricing — rp500_m, rp1000_m, and climate projections are the inputs for long-range treaty pricing and capital adequacy modelling.',
        ]},

        { type: 'divider' },
        { type: 'heading', text: 'Parameters' },
        {
          type: 'table',
          headers: ['Parameter', 'What it represents'],
          rows: [
            ['riverine baseline rp10_m → rp1000_m', 'River flood depth at 7 return periods, 1980 baseline'],
            ['riverine rcp85_2030 rp100_m / rp500_m', '2030 high emissions riverine depth'],
            ['riverine rcp45_2050 rp100_m / rp500_m', '2050 moderate emissions riverine depth'],
            ['riverine rcp85_2050 rp100_m / rp500_m', '2050 high emissions riverine depth'],
            ['riverine rcp85_2080 rp100_m / rp500_m', '2080 worst case riverine depth'],
            ['coastal nosub historical rp100 p50 / p95', 'Coastal depth today, no subsidence, median and conservative SLR'],
            ['coastal nosub rcp85_2050 rp100 p95', 'Coastal depth 2050, no subsidence, conservative SLR'],
            ['coastal wtsub historical rp100 p95', 'Coastal + land sinking, current baseline'],
            ['coastal wtsub rcp85_2030 rp100 p95', 'Coastal + land sinking by 2030'],
            ['coastal wtsub rcp85_2050 rp100 p95', 'Coastal + land sinking by 2050'],
            ['coastal wtsub rcp85_2080 rp100 p95', 'Coastal + land sinking by 2080'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Known limitations' },
        { type: 'bullets', items: [
          'Point-sampled centroid. Single coordinate per pincode. If on elevated ground, flood-prone areas within the same pincode return 0.0. Do not treat 0.0 as a guarantee of no flood risk.',
          '1 km grid resolution. Urban drainage failure, flash floods, and localised pluvial flooding not captured. Understates flood exposure in dense metros.',
          'Depth only — not velocity or duration. Does not capture how fast water moves or how long it stays. Both significantly affect actual damage.',
          'Flood protection not modelled. Embankments and levees are not accounted for. A protected pincode may still show high flood depth values.',
          'Model version. WRI Aqueduct v2 (2020). V4 (2023) adds Annual Expected Damage as a damage ratio, urban pluvial flooding, compound flood events, and building-type damage curves. Upgrade planned.',
        ]},
      ],
    },
  },

  // ── 6. Flood Risk (Pincode) ───────────────────────────────────────────────
  {
    id: 'flood-pincode',
    label: 'Flood Risk',
    method: 'GET',
    path: '/api/environmental/flood/pincode',
    shortDescription: 'Multi-source flood risk score and raw hazard data for a pincode',
    description:
      'Returns a comprehensive flood risk profile for a 6-digit Indian pincode. ' +
      'Aggregates 8 data sources: JRC GloFAS v2.1 return-period flood depths, JRC Global Surface Water ' +
      '(1984–2021 historical inundation), WRI Aqueduct v2 riverine/coastal hazard with climate projections, ' +
      'MERIT Hydro HAND terrain elevation, ESA WorldCover impervious/mangrove cover, HydroRIVERS proximity, ' +
      'Global Dam Watch upstream dams, and IMD 40-year rainfall climatology. ' +
      'A weighted flood_risk_score (0–100) and flood_risk_class (Low/Medium/High/Very High) summarise the risk ' +
      'for underwriting use. All raw columns are returned so callers can build their own models.',
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
        example: '781001',
      },
    ],
    responseFields: [
      { field: 'pincode',                                       type: 'string',       description: 'Queried pincode' },
      { field: 'district',                                      type: 'string|null',  description: 'District name' },
      { field: 'state',                                         type: 'string|null',  description: 'State name' },
      { field: 'coordinates.lat',                               type: 'number|null',  description: 'Centroid latitude' },
      { field: 'coordinates.lng',                               type: 'number|null',  description: 'Centroid longitude' },
      { field: 'flood_risk.score',                              type: 'number|null',  description: 'Weighted flood risk score 0–100' },
      { field: 'flood_risk.class',                              type: 'string|null',  description: '"Low" | "Medium" | "High" | "Very High"' },
      { field: 'flood_risk.component_scores.glofas',            type: 'number|null',  description: 'JRC GloFAS sub-score 0–100 (RP100 depth, weight 30%)' },
      { field: 'flood_risk.component_scores.gsw',               type: 'number|null',  description: 'Historical surface water sub-score (weight 20%)' },
      { field: 'flood_risk.component_scores.aqueduct',          type: 'number|null',  description: 'WRI Aqueduct sub-score (weight 20%)' },
      { field: 'flood_risk.component_scores.hand',              type: 'number|null',  description: 'HAND terrain sub-score (weight 15%)' },
      { field: 'flood_risk.component_scores.rainfall',          type: 'number|null',  description: 'Extreme rainfall sub-score (weight 10%)' },
      { field: 'flood_risk.component_scores.dam',               type: 'number|null',  description: 'Upstream dam risk sub-score (weight 5%)' },
      { field: 'jrc_glofas.rp10_depth_m',                      type: 'number|null',  description: '10-year return period flood depth in metres. null = outside 90m flood zone' },
      { field: 'jrc_glofas.rp100_depth_m',                     type: 'number|null',  description: '100-year return period flood depth in metres' },
      { field: 'jrc_glofas.rp500_depth_m',                     type: 'number|null',  description: '500-year return period flood depth in metres' },
      { field: 'jrc_glofas.rp100_class',                       type: 'integer|null', description: 'Flood hazard class 0–4 at RP100 (0=none, 4=severe)' },
      { field: 'jrc_gsw.occurrence_pct',                        type: 'number|null',  description: '% of years 1984–2021 the pixel was classified as water' },
      { field: 'jrc_gsw.ever_flooded',                          type: 'boolean',      description: 'True if pixel was ever classified as water 1984–2021' },
      { field: 'aqueduct.baseline_1980.riverine_rp100_m',       type: 'number|null',  description: 'Riverine flood depth at 100-yr RP (1980 baseline). 0 = outside flood zone' },
      { field: 'aqueduct.projections.rcp85_2030_rp100_m',       type: 'number|null',  description: 'Projected riverine depth RCP8.5 2030 (ensemble mean of 5 GCMs)' },
      { field: 'aqueduct.projections.rcp85_2080_rp100_m',       type: 'number|null',  description: 'Projected riverine depth RCP8.5 2080 (ensemble mean of 5 GCMs)' },
      { field: 'terrain.hand_elevation_m',                      type: 'number|null',  description: 'Height Above Nearest Drainage in metres (MERIT Hydro). Low HAND = high flood risk' },
      { field: 'land_cover.impervious_surface_pct',             type: 'number|null',  description: '% impervious surface within 500m buffer (ESA WorldCover 2021)' },
      { field: 'land_cover.mangrove_cover_pct',                 type: 'number|null',  description: '% mangrove cover within 500m buffer (coastal flood buffer)' },
      { field: 'hydrology.distance_to_river_km',                type: 'number|null',  description: 'Distance to nearest river (HydroRIVERS orders 1–7) in km' },
      { field: 'upstream_dam.present',                          type: 'boolean',      description: 'True if a dam exists upstream within 100km' },
      { field: 'upstream_dam.name',                             type: 'string|null',  description: 'Name of the nearest upstream dam' },
      { field: 'upstream_dam.type',                             type: 'string|null',  description: 'Dam type: flood_control / irrigation / hydropower / multipurpose' },
      { field: 'upstream_dam.height_m',                         type: 'number|null',  description: 'Dam height in metres' },
      { field: 'governance.ndma_flood_prone_district',          type: 'boolean',      description: 'True if district is on NDMA 2021 flood-prone district list' },
      { field: 'rainfall.annual_mm',                            type: 'number|null',  description: 'Mean annual rainfall in mm (IMD 0.25° gridded, 1981–2020)' },
      { field: 'rainfall.extreme_days_per_yr',                  type: 'number|null',  description: 'Mean days per year with rainfall >100mm/day (1981–2020)' },
      { field: 'historical.flood_events_per_decade',            type: 'number|null',  description: 'District-level flood events per decade (EM-DAT 1990–2024)' },
      { field: 'meta.data_as_of',                               type: 'string|null',  description: 'Date the flood index was last computed (YYYY-MM-DD)' },
      { field: 'meta.latency_ms',                               type: 'integer',      description: 'Server-side processing time in ms' },
    ],
    exampleRequest: {
      queryString: 'pincode=781001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      pincode: '781001',
      district: 'Kamrup Metropolitan',
      state: 'Assam',
      coordinates: { lat: 26.1445, lng: 91.7362 },
      flood_risk: {
        score: 64.8,
        class: 'High',
        component_scores: { glofas: 38.3, gsw: 82.0, aqueduct: 18.3, hand: 90.0, rainfall: 73.3, dam: 0.0 },
      },
      jrc_glofas: {
        rp10_depth_m: null, rp20_depth_m: null, rp50_depth_m: null, rp75_depth_m: null,
        rp100_depth_m: 1.15, rp200_depth_m: 1.68, rp500_depth_m: 2.24,
        rp100_class: 2, spurious_flag: 0,
        note: 'null = location not in 90m flood zone',
      },
      jrc_gsw: {
        occurrence_pct: 82.0, recurrence_pct: 91.0, seasonality_months: 3.0,
        transition_class: 3, ever_flooded: true, change_abs: 0.0,
        note: 'null = pixel never flooded 1984-2021 (not missing data)',
      },
      aqueduct: {
        baseline_1980: {
          riverine_rp100_m: 0.55, riverine_rp500_m: 1.12,
          coastal_rp100_m: 0, coastal_rp500_m: 0,
          coastal_rp100_with_subsidence_2030_m: 0,
        },
        projections: {
          rcp85_2030_rp100_m: 0.63, rcp45_2050_rp100_m: 0.68,
          rcp85_2050_rp100_m: 0.74, rcp85_2080_rp100_m: 0.91,
        },
        note: '0 = outside flood zone; projections are ensemble mean of 5 GCMs',
      },
      terrain: { hand_elevation_m: 2.0, note: 'MERIT Hydro v1.0.1: height above nearest drainage' },
      land_cover: {
        impervious_surface_pct: 48.2, mangrove_cover_pct: 0.0,
        note: 'ESA WorldCover 2021 within 500m buffer',
      },
      hydrology: { distance_to_river_km: 0.8, note: 'HydroRIVERS v1.0 — orders 1-7 only' },
      upstream_dam: {
        present: false, name: null, type: null, height_m: null, river: null, main_use: null, year_built: null,
        note: 'Global Dam Watch v1.0; nearest dam within 100km upstream',
      },
      governance: { ndma_flood_prone_district: true },
      rainfall: {
        annual_mm: 1680.4, extreme_days_per_yr: 22.0,
        note: 'IMD 0.25° gridded 1981-2020 climatology; extreme = >100mm/day',
      },
      historical: {
        flood_events_per_decade: 0.83, flood_loss_cr: null,
        note: 'EM-DAT 1988-present district-level',
      },
      meta: {
        data_as_of: '2026-07-14', latency_ms: 12,
        sources: ['JRC GloFAS v2.1', 'JRC Global Surface Water v1.4', 'WRI Aqueduct v2', 'MERIT Hydro v1.0.1', 'ESA WorldCover v200', 'HydroRIVERS v1.0', 'Global Dam Watch v1.0', 'NDMA 2021', 'IMD 1981-2020', 'EM-DAT'],
      },
    }, null, 2),
  },

  // ── 7. JRC Global Surface Water (Pincode) ────────────────────────────────
  {
    id: 'gsw-pincode',
    label: 'Surface Water History',
    method: 'GET',
    path: '/api/environmental/gsw',
    shortDescription: 'JRC Global Surface Water v1.4 — 38-year satellite flood history for a pincode',
    description:
      'Returns the complete JRC Global Surface Water v1.4 flood history profile for a 6-digit Indian pincode. ' +
      'Derived from 38 years of Landsat satellite imagery (1984–2021), this is observed ground truth — not modelled. ' +
      'Covers historical water occurrence across 5 time windows (2-year to full 38-year), seasonal patterns mapped to ' +
      'kharif/rabi crop calendars, year-by-year trend with acceleration signal, and extreme event return periods. ' +
      'All metrics are pre-computed over a 500m buffer around the pincode centroid and served from cache (<5ms). ' +
      'Actuarially: occurrence_pct.full is a direct observed flood frequency — if a location had water 15% of months ' +
      'over 38 years, that is roughly a 1-in-7 annual surface flood probability from satellite record. ' +
      'Use year_of_first_occurrence for fraud detection: a flood claim at a location with null first occurrence and ' +
      'overall_classification "none" has zero satellite-observed flood history since 1984.',
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
        required: false,
        type: 'string',
        description: '6-digit Indian PIN code. Use pincode OR lat+lng — not both.',
        example: '682001',
      },
      {
        name: 'lat',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Latitude (6.0–38.0). Use lat+lng for a custom coordinate — bypasses cache, runs live GEE (~30–90s).',
        example: '9.9655',
      },
      {
        name: 'lng',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Longitude (67.0–99.0). Required when lat is provided.',
        example: '76.2414',
      },
    ],
    responseFields: [
      { field: 'source',                                                    type: 'string',       description: '"cache" (pincode mode, <5ms) or "live" (lat/lng, 30–90s via GEE)' },
      { field: 'request.mode',                                              type: 'string',       description: '"pincode" or "latlong"' },
      { field: 'request.buffer_m',                                          type: 'integer',      description: 'Buffer radius used for extraction (default 500m)' },
      { field: 'location.pincode',                                          type: 'string|null',  description: 'Queried pincode' },
      { field: 'location.district',                                         type: 'string|null',  description: 'District resolved from pincode' },
      { field: 'location.state',                                            type: 'string|null',  description: 'State resolved from pincode' },
      { field: 'location.lat',                                              type: 'number',       description: 'Centroid latitude' },
      { field: 'location.lng',                                              type: 'number',       description: 'Centroid longitude' },
      { field: 'data_source.name',                                          type: 'string',       description: 'Source dataset name' },
      { field: 'data_source.coverage',                                      type: 'string',       description: 'Temporal coverage of the dataset' },
      { field: 'data_source.resolution_m',                                  type: 'integer',      description: 'Satellite pixel resolution in metres (30m Landsat)' },
      { field: 'year_of_first_occurrence',                                  type: 'integer|null', description: 'First year satellite detected water here (1984–2021). null = zero flood history.' },
      { field: 'jrc_occurrence_pct',                                        type: 'number|null',  description: 'Raw JRC occurrence band: % of time with water among valid Landsat observations. Conditional metric — differs from our unconditional periods.full.occurrence_pct.' },
      { field: 'jrc_recurrence_pct',                                        type: 'number|null',  description: 'JRC recurrence band: % of years in which water appeared at least once.' },
      { field: 'seasonality_2021_months',                                   type: 'number|null',  description: 'JRC seasonality band for 2021: number of months water was present.' },
      { field: 'change_abs_pct',                                            type: 'number|null',  description: 'Absolute change in occurrence (pp) from first to last epoch. Negative = drying, positive = wetting.' },
      { field: 'overall_classification.label',                              type: 'string',       description: '"permanent" | "seasonal" | "intermittent" | "none" — plurality class across 38 years' },
      { field: 'overall_classification.perm_years_frac',                    type: 'number',       description: 'Fraction of observed years classified as permanent water' },
      { field: 'overall_classification.water_years_frac',                   type: 'number',       description: 'Fraction of observed years with any water (perm + seasonal + intermittent)' },
      { field: 'overall_classification.jrc_transition',                     type: 'integer|null', description: 'JRC transition class code at the centroid pixel (1–11)' },
      { field: 'overall_classification.jrc_transition_label',               type: 'string|null',  description: 'Human label for jrc_transition. Note: centroid pixel may be dry land even if buffer has water.' },
      { field: 'overall_classification.center_is_water',                    type: 'boolean',      description: 'True if the centroid pixel itself had permanent/seasonal water classification' },
      { field: 'buffer_distribution.perm_water_pct',                        type: 'number',       description: '% of 500m buffer classified as permanent water' },
      { field: 'buffer_distribution.flood_zone_pct',                        type: 'number',       description: '% of buffer in seasonal flood zone' },
      { field: 'buffer_distribution.never_water_pct',                       type: 'number',       description: '% of buffer that never had water 1984–2021' },
      { field: 'buffer_distribution.location_position',                     type: 'string',       description: '"permanent_water" | "flood_zone" | "land" — dominant position of this location' },
      { field: 'distance_to_water_m',                                       type: 'number|null',  description: 'Distance in metres from centroid to nearest historical water pixel' },
      { field: 'area_ever_water_frac',                                       type: 'number',       description: 'Fraction of the 500m buffer ever classified as water 1984–2021' },
      { field: 'periods.full.window',                                        type: 'string',       description: 'Year range for this window, e.g. "1984-2021"' },
      { field: 'periods.full.occurrence_pct',                                type: 'number',       description: 'Unconditional occurrence: water_pixels / valid_pixels * 100. Primary actuarial signal over the full 38-year record.' },
      { field: 'periods.full.recurrence_pct',                                type: 'number',       description: '% of years in this window where water appeared at least once' },
      { field: 'periods.full.trend_direction',                               type: 'string',       description: '"increasing" | "decreasing" | "stable" — OLS trend on annual occurrence series' },
      { field: 'periods.full.trend_magnitude',                               type: 'number',       description: 'OLS slope in percentage points per year. Positive = worsening flood risk.' },
      { field: 'periods.full.change_pp',                                     type: 'number',       description: 'Second-half minus first-half mean occurrence within this window' },
      { field: 'periods.full.permanent_years',                               type: 'integer',      description: 'Years classified as permanent water within this window' },
      { field: 'periods.full.seasonal_years',                                type: 'integer',      description: 'Years classified as seasonal water' },
      { field: 'periods.full.land_years',                                    type: 'integer',      description: 'Years with no water classification (including missing data years)' },
      { field: 'periods.full.consecutive_flood_years_max',                   type: 'integer',      description: 'Longest consecutive streak of years with any water in this window' },
      { field: 'periods.full.flood_free_window_years',                       type: 'integer',      description: 'Years since the last flood event to end of window. 0 = flooded in most recent year.' },
      { field: 'periods.w20',                                                type: 'object',       description: 'Same metrics as periods.full for 2002–2021 (last 20 years)' },
      { field: 'periods.w10',                                                type: 'object',       description: 'Same metrics for 2012–2021 (last 10 years)' },
      { field: 'periods.w5',                                                 type: 'object',       description: 'Same metrics for 2017–2021 (last 5 years)' },
      { field: 'periods.w2',                                                 type: 'object',       description: 'Same metrics for 2020–2021 (last 2 years)' },
      { field: 'cross_window.occurrence_trend',                              type: 'string',       description: '"accelerating" | "stable" | "decelerating" — compares w5 vs w20 occurrence' },
      { field: 'cross_window.is_emerging_flood_zone',                        type: 'boolean',      description: 'True if historically dry (<2% full) but recently wet (>5% w5) — new flood risk signal' },
      { field: 'cross_window.is_improving',                                  type: 'boolean',      description: 'True if historically wet (>5% full) but recently dry (<2% w5)' },
      { field: 'cross_window.recent_deviation_pct',                          type: 'number',       description: 'w5 minus w20 occurrence in pp. Positive = recent 5 years wetter than 20-year average.' },
      { field: 'flood_season_timing.peak_flood_month',                       type: 'integer',      description: 'Calendar month (1–12) with highest long-run water occurrence' },
      { field: 'flood_season_timing.onset_month',                            type: 'integer|null', description: 'Month water season begins. null if no meaningful seasonal pattern.' },
      { field: 'flood_season_timing.retreat_month',                          type: 'integer|null', description: 'Month water season ends' },
      { field: 'flood_season_timing.duration_months',                        type: 'integer',      description: 'Number of months with water above 10% of peak occurrence' },
      { field: 'flood_season_timing.monthly_occ_pct',                        type: 'number[]',     description: 'Array of 12 — mean % water occurrence by calendar month (index 0 = January)' },
      { field: 'flood_season_timing.monthly_completeness_pct',               type: 'number[]',     description: 'Array of 12 — % of years contributing observations per month. Low = monsoon cloud gaps.' },
      { field: 'flood_season_timing.cloud_bias_flag',                        type: 'boolean',      description: 'True if any month had <50% of the median valid observations — cloud cover bias warning' },
      { field: 'flood_season_timing.season_aggregates.kharif',               type: 'number',       description: 'Water occurrence Jun–Sep (core monsoon kharif)' },
      { field: 'flood_season_timing.season_aggregates.rabi',                 type: 'number',       description: 'Water occurrence Oct–Feb (rabi crop season)' },
      { field: 'flood_season_timing.season_aggregates.zaid',                 type: 'number',       description: 'Water occurrence Mar–May (zaid/summer)' },
      { field: 'flood_season_timing.pmfby_windows.kharif',                   type: 'number',       description: 'PMFBY kharif window (Apr–Sep) water occurrence. Direct crop insurance input.' },
      { field: 'flood_season_timing.pmfby_windows.rabi',                     type: 'number',       description: 'PMFBY rabi window (Oct–Mar) water occurrence' },
      { field: 'extreme_events.worst_flood_year',                            type: 'integer|null', description: 'Year with highest satellite-observed water occurrence on record' },
      { field: 'extreme_events.severe_flood_years',                          type: 'integer[]',    description: 'Years where occurrence exceeded the 90th percentile threshold' },
      { field: 'extreme_events.return_period_years',                         type: 'number|null',  description: 'Estimated years between severe flood events. null if no severe years on record.' },
      { field: 'extreme_events.severity_threshold_pct',                      type: 'number|null',  description: '90th-percentile occurrence value used as the severity threshold' },
      { field: 'water_regime_transitions.transition_label',                  type: 'string',       description: 'Early (1984–93) vs recent (2012–21) decade comparison, e.g. "stable_permanent", "none_to_seasonal"' },
      { field: 'water_regime_transitions.is_stable',                         type: 'boolean',      description: 'True if early and recent decade classifications match' },
      { field: 'water_regime_transitions.event_log',                         type: 'object[]',     description: 'Year-by-year classification transitions: [{year, from, to}]. Empty array = stable.' },
      { field: 'underwriting_summary.composite_score',                       type: 'number',       description: 'Composite flood risk score 0–100. Weighted across 7 components.' },
      { field: 'underwriting_summary.risk_band',                             type: 'string',       description: '"low" (<20) | "moderate" (<40) | "elevated" (<60) | "high" (<80) | "critical" (≥80)' },
      { field: 'underwriting_summary.components',                            type: 'object',       description: 'Per-component scores (0–100): occurrence, recurrence, trend, volatility, new_flood_zone, spatial_extent, flood_free_window' },
      { field: 'yearly_profile',                                             type: 'object[]',     description: 'Array of 38 — per-year: year, occurrence_pct, perm_pct, seas_pct, months_with_obs, water_class (0–3), water_class_label, has_valid_data' },
    ],
    exampleRequest: {
      queryString: 'pincode=682001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      source: 'cache',
      request: { mode: 'pincode', pincode: '682001', buffer_m: 500, windows_requested: ['w2', 'w5', 'w10', 'w20', 'full'] },
      location: { pincode: '682001', district: 'ERNAKULAM', state: 'KERALA', lat: 9.965556, lng: 76.241417, buffer_m: 500 },
      data_source: { name: 'JRC Global Surface Water v1.4', satellite: 'Landsat 5/7/8', resolution_m: 30, coverage: '1984-2021', years: 38, buffer_m: 500 },
      year_of_first_occurrence: 1988,
      jrc_occurrence_pct: 89.16,
      jrc_recurrence_pct: 96.86,
      seasonality_2021_months: 11.6,
      change_abs_pct: -45.52,
      overall_classification: { label: 'permanent', perm_years_frac: 1.0, water_years_frac: 1.0, jrc_transition: 1, jrc_transition_label: 'no_change', center_is_water: false },
      buffer_distribution: { perm_water_pct: 21.32, flood_zone_pct: 1.25, never_water_pct: 74.8, location_position: 'permanent_water' },
      distance_to_water_m: 276.6,
      area_ever_water_frac: 0.2517,
      periods: {
        full: { window: '1984-2021', years_analyzed: 29, occurrence_pct: 23.9603, recurrence_pct: 100.0, occurrence_stddev_pct: 5.0649, trend_direction: 'increasing', trend_magnitude: 0.123728, change_pp: 2.658, permanent_years: 29, seasonal_years: 0, intermittent_years: 0, land_years: 9, consecutive_flood_years_max: 23, flood_free_window_years: 0 },
        w20:  { window: '2002-2021', years_analyzed: 20, occurrence_pct: 24.2486, recurrence_pct: 100.0, occurrence_stddev_pct: 3.2877, trend_direction: 'decreasing', trend_magnitude: -0.081511, change_pp: -2.8347, permanent_years: 20, seasonal_years: 0, intermittent_years: 0, land_years: 0, consecutive_flood_years_max: 20, flood_free_window_years: 0 },
        w10:  { window: '2012-2021', years_analyzed: 10, occurrence_pct: 23.4943, recurrence_pct: 100.0, occurrence_stddev_pct: 3.2971, trend_direction: 'increasing', trend_magnitude: 0.619174, change_pp: 3.6378, permanent_years: 10, seasonal_years: 0, intermittent_years: 0, land_years: 0, consecutive_flood_years_max: 10, flood_free_window_years: 0 },
        w5:   { window: '2017-2021', years_analyzed: 5,  occurrence_pct: 24.9855, recurrence_pct: 100.0, occurrence_stddev_pct: 0.8047, trend_direction: 'increasing', trend_magnitude: 0.252431, change_pp: 0.004, permanent_years: 5, seasonal_years: 0, intermittent_years: 0, land_years: 0, consecutive_flood_years_max: 5, flood_free_window_years: 0 },
        w2:   { window: '2020-2021', years_analyzed: 2,  occurrence_pct: 24.9847, recurrence_pct: 100.0, occurrence_stddev_pct: 0.9261, trend_direction: 'stable', trend_magnitude: 0.0, change_pp: 1.3097, permanent_years: 2, seasonal_years: 0, intermittent_years: 0, land_years: 0, consecutive_flood_years_max: 2, flood_free_window_years: 0 },
      },
      cross_window: { occurrence_trend: 'stable', is_emerging_flood_zone: false, is_improving: false, recent_deviation_pct: 0.7369 },
      flood_season_timing: {
        peak_flood_month: 7, onset_month: 1, retreat_month: 12, duration_months: 12,
        monthly_occ_pct: [23.332, 22.482, 22.193, 22.59, 25.064, 31.258, 32.039, 26.787, 26.707, 22.91, 24.208, 22.452],
        monthly_completeness_pct: [81.6, 81.6, 100.0, 97.4, 100.0, 97.4, 100.0, 97.4, 97.4, 97.4, 97.4, 97.4],
        cloud_bias_flag: true,
        season_aggregates: { kharif: 27.86, rabi: 23.086, zaid: 22.946 },
        pmfby_windows: { kharif: 25.987, rabi: 22.935 },
      },
      extreme_events: { worst_flood_year: 1996, severe_flood_years: [1996, 2006, 2011], return_period_years: 9.7, severity_threshold_pct: 28.095 },
      water_regime_transitions: { early_decade_label: 'permanent', recent_decade_label: 'permanent', transition_label: 'stable_permanent', is_stable: true, event_log: [] },
      underwriting_summary: { composite_score: 69.5, risk_band: 'high', components: { occurrence: 79.9, recurrence: 100.0, trend: 24.7, volatility: 50.6, new_flood_zone: 72.8, spatial_extent: 45.1, flood_free_window: 100.0 } },
      meta: { data_version: 'v1.4', pincode: '682001', district: 'ERNAKULAM', state: 'KERALA', total_api_latency_ms: 3 },
      yearly_profile: [
        { year: 1984, occurrence_pct: 0.0, perm_pct: 0.0, seas_pct: 0.0, months_with_obs: 10, water_class: 0, water_class_label: 'none', has_valid_data: false },
        { year: 1988, occurrence_pct: 16.99, perm_pct: 65.74, seas_pct: 3.24, months_with_obs: 12, water_class: 3, water_class_label: 'permanent', has_valid_data: true },
        { year: 1996, occurrence_pct: 41.026, perm_pct: 97.92, seas_pct: 2.08, months_with_obs: 12, water_class: 3, water_class_label: 'permanent', has_valid_data: true },
        { year: 2021, occurrence_pct: 25.673, perm_pct: 93.64, seas_pct: 5.45, months_with_obs: 12, water_class: 3, water_class_label: 'permanent', has_valid_data: true },
      ],
    }, null, 2),
  },

  // ── 8. Terrain (MERIT Hydro) ──────────────────────────────────────────────
  {
    id: 'terrain',
    label: 'Terrain',
    method: 'GET',
    path: '/api/environmental/terrain',
    shortDescription: 'MERIT Hydro v1.0.1 — HAND elevation, upstream area, river width, and flood risk class for a pincode or coordinate',
    description:
      'Returns terrain and hydrological attributes for a location from the MERIT Hydro v1.0.1 dataset at 92.77m resolution. ' +
      'Accepts either a 6-digit Indian pincode (fast DB lookup, ~15ms) or a lat/lon coordinate (raster service, ~100ms). ' +
      'Two sections in the response: source contains the raw MERIT Hydro values (HAND, elevation, upstream area, river width, ' +
      'flow direction, permanent water flag), and calculated contains derived risk flags (flood_risk_class, coastal_surge_risk, ' +
      'inland_depression, adjacent_to_river). ' +
      'HAND (Height Above Nearest Drainage) is the primary terrain signal for flood risk: ≤2m is extreme, ≤5m is very high, ' +
      '≤10m is high, ≤20m is moderate, ≤30m is low, >30m is very low.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    modeGroup: 'pincode-or-latlon',
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
        required: false,
        type: 'string',
        description: '6-digit Indian PIN code. Either pincode or lat+lon is required.',
        example: '400001',
      },
      {
        name: 'lat',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Latitude (6.0–38.0). Use with lon for a custom coordinate lookup.',
        example: '19.07',
      },
      {
        name: 'lon',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Longitude (67.0–98.0). Required when lat is provided.',
        example: '72.87',
      },
    ],
    responseFields: [
      { field: 'input.type',                        type: 'string',       description: '"pincode" | "latlon" — which lookup path was used' },
      { field: 'input.pincode',                     type: 'string|null',  description: 'Pincode queried (pincode mode only)' },
      { field: 'input.lat',                         type: 'number|null',  description: 'Latitude of the location' },
      { field: 'input.lon',                         type: 'number|null',  description: 'Longitude of the location' },
      { field: 'terrain.source.hand_m',             type: 'number|null',  description: 'Height Above Nearest Drainage in metres (HAND). Primary flood risk terrain signal.' },
      { field: 'terrain.source.elevation_m',        type: 'number|null',  description: 'Terrain elevation in metres above sea level (EGM96 geoid)' },
      { field: 'terrain.source.upstream_area_km2',  type: 'number|null',  description: 'Upstream catchment area in km². Large values indicate major rivers.' },
      { field: 'terrain.source.river_width_m',      type: 'number|null',  description: 'Width of the nearest river channel in metres. null = no mapped river at this location.' },
      { field: 'terrain.source.on_permanent_water', type: 'boolean|null', description: 'True if the pincode centroid falls on a permanent water body (JRC water mask)' },
      { field: 'terrain.source.flow_direction_code',type: 'integer|null', description: 'D8 flow direction code: 1=E 2=SE 4=S 8=SW 16=W 32=NW 64=N 128=NE 0=river_mouth -1=inland_depression' },
      { field: 'terrain.source.flow_direction_label',type: 'string|null', description: 'Human label for flow_direction_code' },
      { field: 'terrain.calculated.flood_risk_class',type: 'string|null', description: '"extreme" (≤2m) | "very_high" (≤5m) | "high" (≤10m) | "moderate" (≤20m) | "low" (≤30m) | "very_low" (>30m)' },
      { field: 'terrain.calculated.coastal_surge_risk', type: 'boolean|null', description: 'True if elevation_m < 5.0m — indicates coastal storm surge vulnerability' },
      { field: 'terrain.calculated.inland_depression',  type: 'boolean|null', description: 'True if flow_direction_code == -1 — water collects here with no drainage outlet' },
      { field: 'terrain.calculated.adjacent_to_river',  type: 'boolean|null', description: 'True if on_permanent_water OR river_width_m > 0' },
      { field: 'meta.data_source',                  type: 'string',       description: 'Always "MERIT Hydro v1.0.1"' },
      { field: 'meta.resolution_m',                 type: 'number',       description: 'Native raster resolution: 92.77m' },
      { field: 'meta.input_type',                   type: 'string',       description: '"pincode" | "latlon"' },
      { field: 'meta.latency_ms',                   type: 'integer',      description: 'Server-side processing time in ms' },
    ],
    exampleRequest: {
      queryString: 'pincode=400001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      input: { type: 'pincode', pincode: '400001', lat: 18.94206, lon: 72.83544 },
      terrain: {
        source: {
          hand_m: 11.4,
          elevation_m: 11.4,
          upstream_area_km2: 0.097,
          river_width_m: null,
          on_permanent_water: false,
          flow_direction_code: 8,
          flow_direction_label: 'southwest',
        },
        calculated: {
          flood_risk_class: 'moderate',
          coastal_surge_risk: false,
          inland_depression: false,
          adjacent_to_river: false,
        },
      },
      meta: {
        data_source: 'MERIT Hydro v1.0.1',
        resolution_m: 92.77,
        input_type: 'pincode',
        latency_ms: 15,
      },
    }, null, 2),
    about: {
      source: 'Data source: MERIT Hydro v1.0.1, Yamazaki et al. (2019), Water Resources Research.',
      blocks: [
        { type: 'heading', text: 'What this API tells you' },
        { type: 'paragraph', text: 'For any Indian pincode or coordinate, this API tells you what the ground under the insured asset looks like from a hydrological perspective — how high above the nearest drainage channel it sits, whether a river runs through or near it, how water would flow away if it flooded, and whether the location sits on permanently wet ground.' },
        { type: 'paragraph', text: 'It does not tell you whether a flood will happen. It tells you how the terrain behaves if one does. Use it alongside Aqueduct (return-period flood depths) and Surface Water History (observed inundation record) for a complete flood risk picture.' },

        { type: 'divider' },
        { type: 'heading', text: 'Data source' },
        { type: 'paragraph', text: 'MERIT Hydro v1.0.1 is a global hydrography dataset published by Yamazaki et al. (2019) in Water Resources Research. It is built on the MERIT DEM — Multi-Error-Removed Improved-Terrain — which corrects the raw SRTM 3 arc-second elevation data for three systematic errors: vegetation bias (trees raising apparent ground level), stripe noise (satellite orbital artefacts), and absolute elevation bias. After error removal, hydrological conditioning is applied to derive all six bands consistently from the same corrected surface.' },
        { type: 'paragraph', text: 'The dataset is static — terrain does not change with climate, land use, deforestation, or urban growth. It represents the hydrological structure of the land surface as observed from satellite at the time of the SRTM mission (2000). Changes in land use since 2000 (new embankments, urban fill, river channel modification) are not reflected.' },
        {
          type: 'table',
          headers: ['Property', 'Value'],
          rows: [
            ['Dataset',          'MERIT Hydro v1.0.1'],
            ['Published',        'Yamazaki et al. (2019), Water Resources Research'],
            ['Base DEM',         'MERIT DEM — error-corrected SRTM 3 arc-second'],
            ['Resolution',       '92.77m per pixel (3 arc-seconds at equator)'],
            ['Coverage',         'Global 60°S–60°N; India fully covered'],
            ['Reference datum',  'EGM96 geoid (elevation_m)'],
            ['Vintage',          'Static — based on SRTM 2000 acquisition'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Two lookup modes' },
        { type: 'paragraph', text: 'This API accepts either a pincode or a lat/lon coordinate. The underlying data source is identical — MERIT Hydro — but the lookup path differs.' },
        {
          type: 'table',
          headers: ['Mode', 'Input', 'Latency', 'Coverage', 'When to use'],
          rows: [
            ['Pincode', '?pincode=400001', '~15ms',  '19,550 Indian pincodes',                    'Underwriting pipelines where you have a pincode at intake'],
            ['Lat/Lon', '?lat=19.07&lon=72.87', '~100ms', 'Any coordinate 6°–38°N, 67°–98°E', 'GPS coordinates from surveyors, mobile apps, or non-pincode addresses'],
          ],
        },
        { type: 'paragraph', text: 'Pincode mode is pre-computed — values are sampled once at the pincode centroid and stored in the database. Lat/lon mode queries the live raster service on each request, reading directly from the MERIT Hydro GeoTIFF files. Both modes return the same response shape.' },

        { type: 'divider' },
        { type: 'heading', text: 'What is HAND?' },
        { type: 'paragraph', text: 'HAND (Height Above Nearest Drainage) is the single most important number in this response. It is the vertical distance in metres between the ground at this location and the nearest river or drainage channel within the same catchment. A location at HAND = 2m sits just 2 metres above the drainage network — water only needs to rise 2 metres before it reaches that point. A location at HAND = 40m is effectively above any realistic flood.' },
        { type: 'paragraph', text: 'HAND is not a flood model. It is a terrain descriptor. But it is the strongest terrain predictor of flood exposure available at this resolution — stronger than elevation alone, because it accounts for position within the watershed rather than absolute altitude. A mountain valley at 900m elevation with HAND = 3m is far more flood-exposed than a coastal plain at 8m elevation with HAND = 25m.' },
        {
          type: 'table',
          headers: ['flood_risk_class', 'HAND range', 'What it means in practice'],
          rows: [
            ['extreme',   'hand_m ≤ 2m',        'At or near drainage level — floods with any significant rainfall event. Water needs to rise only 2m to reach this location.'],
            ['very_high', '2m < hand_m ≤ 5m',   'Low-lying terrain, floods in moderate to severe events. Standard monsoon years may produce inundation.'],
            ['high',      '5m < hand_m ≤ 10m',  'Elevated above minor floods but still in susceptible terrain. Floods in severe return-period events.'],
            ['moderate',  '10m < hand_m ≤ 20m', 'Some natural protection. Flood exposure limited to rare high-magnitude events.'],
            ['low',       '20m < hand_m ≤ 30m', 'Well above routine drainage. Flood risk exists only in extreme events.'],
            ['very_low',  'hand_m > 30m',        'Effectively outside any realistic flood plain at MERIT resolution.'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'The 6 raw bands' },

        { type: 'subheading', text: 'hand_m — Height Above Nearest Drainage (metres)' },
        { type: 'paragraph', text: 'The vertical distance from this location to the nearest river or drainage channel within the same watershed. Extracted from the MERIT Hydro hnd band. This is the input to flood_risk_class. A value of 0 means the centroid is on the drainage channel itself — maximum flood exposure. null means outside MERIT Hydro coverage (ocean, glacier, or no-data tile).' },

        { type: 'subheading', text: 'elevation_m — Terrain elevation above sea level (metres)' },
        { type: 'paragraph', text: 'Absolute elevation referenced to the EGM96 geoid. Extracted from the MERIT Hydro elv band. Distinct from HAND: elevation measures how high above sea level the point sits; HAND measures how high above the nearest drain it sits. A Deccan Plateau location may have elevation_m = 900 and hand_m = 3 — high above the sea, but at the bottom of a local valley. This is the input to coastal_surge_risk. null = no-data.' },

        { type: 'subheading', text: 'upstream_area_km2 — Upstream catchment area (km²)' },
        { type: 'paragraph', text: 'Total land area that drains through or past this point. Extracted from the MERIT Hydro upa band. Small values (< 1 km²) indicate a local headwater — only rain falling immediately nearby matters. Large values (> 500 km²) mean the location is downstream of a large watershed — a heavy rainfall event anywhere upstream can send water here even with no local rain. Values > 10,000 km² indicate a major river system (Ganga, Brahmaputra, Godavari scale). null = no upstream network mapped.' },

        { type: 'subheading', text: 'river_width_m — Mapped river channel width (metres)' },
        { type: 'paragraph', text: 'Width of the river channel at this location, derived from satellite-measured river widths in the MERIT Hydro wth band. Only populated where a river channel is explicitly mapped in the MERIT network. null means no mapped channel at the centroid — not the same as no flood risk. Many flood-causing waterbodies in India (seasonal rivers, urban drains, nallahs) are below the mapping threshold at 92.77m resolution. Where populated, values range from ~30m (smallest mappable channels) to 10,000m+ (Brahmaputra, Ganga at widest points).' },

        { type: 'subheading', text: 'on_permanent_water — Centroid on permanent water body (boolean)' },
        { type: 'paragraph', text: 'True if the centroid pixel falls on a permanent water body in the JRC Global Surface Water mask, embedded in the MERIT Hydro wat band. This means the location itself sits on a river, lake, reservoir, or estuary. A true value means the insured asset is on a water body — not near one — and warrants immediate escalation. false does not mean the location is away from water; it means the centroid pixel itself is not classified as open water.' },

        { type: 'subheading', text: 'flow_direction_code — D8 drainage direction' },
        { type: 'paragraph', text: 'Indicates which direction water flows from this cell to the next lower cell, using the D8 (8-direction) routing algorithm from the MERIT Hydro dir band. The critical underwriting values are -1 (inland_depression — water cannot drain away) and 0 (river_mouth — terminal drainage to ocean). The compass values (1, 2, 4, 8, 16, 32, 64, 128) indicate normal drainage in the labelled direction.' },
        {
          type: 'table',
          headers: ['Code', 'Label', 'Meaning'],
          rows: [
            ['1',   'east',              'Water drains east'],
            ['2',   'southeast',         'Water drains southeast'],
            ['4',   'south',             'Water drains south'],
            ['8',   'southwest',         'Water drains southwest'],
            ['16',  'west',              'Water drains west'],
            ['32',  'northwest',         'Water drains northwest'],
            ['64',  'north',             'Water drains north'],
            ['128', 'northeast',         'Water drains northeast'],
            ['0',   'river_mouth',       'Terminal drainage — flows into ocean or major sink'],
            ['-1',  'inland_depression', 'No outlet — water that arrives here cannot drain away'],
            ['-9',  'undefined',         'No-data or edge cell'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Calculated flags — exact formulas' },
        { type: 'paragraph', text: 'All four flags are pre-computed from the raw band values above. The formulas are exact and applied at data load time — no approximation or ML is involved.' },

        { type: 'subheading', text: 'flood_risk_class' },
        { type: 'paragraph', text: 'Derived from hand_m using fixed thresholds sourced from HAND-based flood risk literature (Nobre et al. 2011; Sampson et al. 2015):' },
        { type: 'code', text: 'hand_m == null    → null\nhand_m ≤  2.0 m   → "extreme"\nhand_m ≤  5.0 m   → "very_high"\nhand_m ≤ 10.0 m   → "high"\nhand_m ≤ 20.0 m   → "moderate"\nhand_m ≤ 30.0 m   → "low"\nhand_m >  30.0 m  → "very_low"' },

        { type: 'subheading', text: 'coastal_surge_risk' },
        { type: 'paragraph', text: 'Derived from elevation_m. The 5m threshold is the IPCC low-elevation coastal zone definition used in coastal inundation assessments:' },
        { type: 'code', text: 'elevation_m == null   → null\nelevation_m <  5.0 m  → true\nelevation_m ≥  5.0 m  → false' },
        { type: 'paragraph', text: 'Note: this flag uses elevation only. It does not account for distance from the coast — an inland location at 4m elevation may return true without meaningful coastal exposure. Cross-reference with Aqueduct coastal columns to confirm actual coastal hazard.' },

        { type: 'subheading', text: 'inland_depression' },
        { type: 'paragraph', text: 'Derived from flow_direction_code. True means the D8 algorithm found no downslope neighbour — water arriving at this cell cannot drain away:' },
        { type: 'code', text: 'flow_direction_code == null   → false\nflow_direction_code == -1     → true   (inland depression)\nflow_direction_code != -1     → false' },
        { type: 'paragraph', text: 'Inland depressions are topographic sinks: natural hollows, urban low points enclosed by roads or embankments, and filling river cut-offs. Water accumulates here from surrounding terrain even without direct river connection. In practice these are among the highest-risk locations for inundation — the water has nowhere to go regardless of how the event starts.' },

        { type: 'subheading', text: 'adjacent_to_river' },
        { type: 'paragraph', text: 'Derived from on_permanent_water and river_width_m. True if either the centroid is on permanent water, or a mapped river channel exists at this location:' },
        { type: 'code', text: 'on_permanent_water == true   → true\nriver_width_m > 0            → true\notherwise                    → false' },
        { type: 'paragraph', text: 'Captures two distinct situations: the centroid sitting directly on a water body, and a mapped river channel passing through or alongside the centroid. false means neither condition is met at the centroid pixel — the location may still be near an unmapped channel or seasonal watercourse.' },

        { type: 'divider' },
        { type: 'heading', text: 'Worked example' },
        { type: 'paragraph', text: 'Two contrasting pincodes — one moderate urban, one extreme riverine:' },
        { type: 'code', text: '400001 — South Mumbai\n  hand_m = 11.4             → flood_risk_class = "moderate"  (10 < 11.4 ≤ 20)\n  elevation_m = 11.4        → coastal_surge_risk = false      (11.4 ≥ 5.0)\n  upstream_area_km2 = 0.097 → tiny local catchment, no major river upstream\n  river_width_m = null      → no mapped river channel at centroid\n  flow_direction = 8        → southwest drainage toward the sea\n  adjacent_to_river = false\n  inland_depression = false\n\n781001 — Guwahati (near Brahmaputra)\n  hand_m = 2.0              → flood_risk_class = "extreme"    (≤ 2)\n  elevation_m = 55.1        → coastal_surge_risk = false      (55.1 ≥ 5.0)\n  upstream_area_km2 = large → entire northeast watershed drains through here\n  river_width_m > 0         → mapped river channel present\n  adjacent_to_river = true\n  inland_depression = false\n\nReading: Mumbai sits 11.4m above drainage — moderate risk, not river-adjacent.\nGuwahati sits 2m above the Brahmaputra — extreme terrain risk, directly\nriver-adjacent, with the entire northeast watershed upstream.' },

        { type: 'divider' },
        { type: 'heading', text: 'What someone could wrongly read into this data' },
        { type: 'callout', label: '"hand_m = 0 means the location is at ground level — that is safe."', text: 'No. HAND = 0 means the location IS the drainage channel. It is at maximum flood exposure — the first point to inundate when any water rises.' },
        { type: 'callout', label: '"High elevation means low flood risk."', text: 'Not always. A location at 900m elevation with hand_m = 3m (a Deccan Plateau valley bottom) floods severely despite altitude. Elevation and HAND are independent signals.' },
        { type: 'callout', label: '"river_width_m = null means no river nearby."', text: 'No. It means no river is mapped at 92.77m resolution at this centroid. Small streams, seasonal channels, and urban drains are not in MERIT Hydro.' },
        { type: 'callout', label: '"on_permanent_water = false means the location is not near water."', text: 'No. It means the centroid pixel itself is not classified as open water. A river 50m from the centroid, or a seasonal channel, is not captured by this flag.' },
        { type: 'callout', label: '"coastal_surge_risk = false rules out coastal flood exposure."', text: 'Not entirely. This flag uses elevation only — no distance-from-coast check. Cross-reference with Aqueduct coastal columns to confirm actual coastal hazard.' },
        { type: 'callout', label: '"flood_risk_class = very_low means no underwriting action needed."', text: 'HAND captures terrain position only. A very_low HAND location can still face pluvial flooding (urban drainage failure), coastal inundation, or dam-break risk not reflected in terrain data.' },

        { type: 'divider' },
        { type: 'heading', text: 'Parameters — what to use for what' },
        {
          type: 'table',
          headers: ['Field', 'Primary underwriting use'],
          rows: [
            ['flood_risk_class',    'First-pass loading decision at intake. extreme/very_high → apply flood loading. very_low → standard rate.'],
            ['hand_m',             'Custom scoring model input. Use the raw number if building your own risk score rather than the pre-binned class.'],
            ['coastal_surge_risk', 'Coastal product loading. true → apply coastal loading. Cross-check with Aqueduct coastal columns.'],
            ['inland_depression',  'Hard referral or exclusion flag. true = water pooling risk with no drainage outlet — highest-risk terrain signal.'],
            ['adjacent_to_river',  'River proximity loading. true + large upstream_area_km2 = major river adjacency risk.'],
            ['upstream_area_km2',  'Downstream watershed risk. > 500 km² = exposure to upstream rainfall, not just local rain.'],
            ['elevation_m',        'Coastal zone classification. < 5m = within coastal inundation zone.'],
            ['river_width_m',      'River scale proxy. Wider mapped rivers produce larger inundation extents at equivalent return periods.'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Where to use this' },
        {
          type: 'bullets',
          items: [
            'New business intake — flood_risk_class extreme or very_high: apply flood loading. inland_depression = true: referral. on_permanent_water = true: immediate escalation — asset is on a water body.',
            'Combining with Aqueduct — HAND is terrain exposure; Aqueduct rp100_m is hazard depth at the 1-in-100 event. High HAND (extreme/very_high) combined with non-zero Aqueduct rp100 is the worst combination — terrain is susceptible AND the hazard model confirms depth.',
            'Combining with Surface Water History — HAND tells you what the terrain allows; GSW occurrence_pct tells you what has actually happened. high HAND but low occurrence may indicate embankment protection. Low HAND but high occurrence confirms active flooding.',
            'Coastal underwriting — coastal_surge_risk = true combined with non-zero Aqueduct coastal columns is the definitive coastal exposure signal. Neither alone is sufficient.',
            'Fraud detection — a flood claim at a location with hand_m > 30m, adjacent_to_river = false, inland_depression = false, and GSW occurrence_pct = 0% has zero terrain or historical basis for inundation.',
            'Portfolio accumulation — aggregate upstream_area_km2 and flood_risk_class across your book to identify concentration in major river corridors. High upstream area is a correlated risk — one rainfall event affects all downstream pincodes simultaneously.',
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Known limitations' },
        {
          type: 'bullets',
          items: [
            '92.77m resolution. One pixel per ~1 city block. Urban drainage infrastructure, culverts, and small seasonal watercourses are not captured. Understates flood risk in dense urban areas where drainage failure is the primary mechanism.',
            'Static terrain. Based on SRTM 2000. Changes since — new embankments, urban fill, river channel modification, deforestation increasing runoff — are not reflected. Increasing upstream deforestation raises effective flood risk without changing HAND.',
            'Pincode centroid sampling. One coordinate per pincode. If the centroid sits on elevated ground within the pincode boundary, hand_m may understate risk for lower-lying parts of the same pincode.',
            'river_width_m maps major channels only. Many flood-causing waterbodies in India — seasonal rivers, urban drains, nallahs, irrigation canals — are below the mapping threshold and return null.',
            'coastal_surge_risk uses elevation only. No distance-from-coast check. Inland low-elevation locations may trigger true without actual coastal exposure.',
            'No flow velocity or flood duration. Low HAND indicates a location can be reached by depth at a given return period (use Aqueduct), or how long it stays. Duration drives damage more than peak depth for many asset types.',
            'No flood protection modelling. Embankments, levees, and retention structures are not accounted for. A protected pincode behind a major embankment may still return flood_risk_class = extreme based on terrain alone.',
          ],
        },
      ],
    },
  },

  // ── 9. Land Cover (ESRI 10m Annual) ──────────────────────────────────────
  {
    id: 'land-cover',
    label: 'Land Cover',
    method: 'GET',
    path: '/api/environmental/land-cover',
    shortDescription: 'ESRI 10m Annual Land Cover 2017–2024 — 8-year trend analysis across 8 land classes for a pincode or coordinate',
    description:
      'Returns annual land cover class percentages from the ESRI 10m Annual Land Cover dataset (2017–2024) ' +
      'for a 500m radius around the input location. Accepts either a 6-digit Indian pincode (DB lookup, ~15ms) ' +
      'or a lat/lon coordinate (raster service). ' +
      'The annual section gives raw class percentages per year; the trends section gives calculated fields: ' +
      'urban growth rate (linear regression slope), absolute class deltas (2024 vs 2017), greenery loss, ' +
      'cropland-to-urban conversion estimate, flooded vegetation max and trend, and dominant land use shift. ' +
      'Data source: Impact Observatory / Microsoft / Esri, Sentinel-2, 10m resolution, CC BY 4.0.',
    authNote: 'Pass your API key as the `x-api-key` request header.',
    modeGroup: 'pincode-or-latlon',
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
        required: false,
        type: 'string',
        description: '6-digit Indian PIN code. Either pincode or lat+lon is required.',
        example: '400001',
      },
      {
        name: 'lat',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Latitude (6.0–38.0). Use with lon for a custom coordinate lookup.',
        example: '19.07',
      },
      {
        name: 'lon',
        in: 'query',
        required: false,
        type: 'number',
        description: 'Longitude (67.0–99.0). Required when lat is provided.',
        example: '72.87',
      },
    ],
    responseFields: [
      { field: 'input.type',                              type: 'string',       description: '"pincode" | "latlon" — which lookup path was used' },
      { field: 'input.pincode',                           type: 'string|null',  description: 'Pincode queried (pincode mode only)' },
      { field: 'input.lat',                               type: 'number|null',  description: 'Latitude of the location' },
      { field: 'input.lon',                               type: 'number|null',  description: 'Longitude of the location' },
      { field: 'land_cover.coverage_years',               type: 'number[]',     description: 'Years covered: [2017, 2018, ..., 2024]' },
      { field: 'land_cover.annual.{year}.built_area_pct', type: 'number|null',  description: 'Built-up / impervious surface % in that year (500m buffer)' },
      { field: 'land_cover.annual.{year}.trees_pct',      type: 'number|null',  description: 'Tree canopy cover % in that year' },
      { field: 'land_cover.annual.{year}.crops_pct',      type: 'number|null',  description: 'Cropland / agriculture % in that year' },
      { field: 'land_cover.annual.{year}.water_pct',      type: 'number|null',  description: 'Open water % in that year' },
      { field: 'land_cover.annual.{year}.flooded_veg_pct',type: 'number|null',  description: 'Flooded / waterlogged vegetation % in that year' },
      { field: 'land_cover.annual.{year}.grass_pct',      type: 'number|null',  description: 'Grassland / open ground % in that year' },
      { field: 'land_cover.annual.{year}.scrub_shrub_pct',type: 'number|null',  description: 'Scrub / shrubland % in that year' },
      { field: 'land_cover.annual.{year}.bare_ground_pct',type: 'number|null',  description: 'Bare ground / exposed soil % in that year' },
      { field: 'land_cover.trends.urban_growth_rate_pct_per_yr', type: 'number|null', description: 'Linear regression slope of built_area_pct over 2017–2024 (% per year). Positive = expanding urban.' },
      { field: 'land_cover.trends.urban_growth_class',    type: 'string|null',  description: '"rapid" (>3%/yr) | "moderate" (1–3%/yr) | "stable" | "declining" (<-1%/yr)' },
      { field: 'land_cover.trends.built_area_change_pct', type: 'number|null',  description: 'Absolute change in built_area_pct from 2017 to 2024' },
      { field: 'land_cover.trends.trees_change_pct',      type: 'number|null',  description: 'Absolute change in trees_pct from 2017 to 2024 (negative = deforestation)' },
      { field: 'land_cover.trends.crops_change_pct',      type: 'number|null',  description: 'Absolute change in crops_pct from 2017 to 2024' },
      { field: 'land_cover.trends.water_change_pct',      type: 'number|null',  description: 'Absolute change in water_pct from 2017 to 2024' },
      { field: 'land_cover.trends.flooded_veg_change_pct',type: 'number|null',  description: 'Absolute change in flooded_veg_pct from 2017 to 2024' },
      { field: 'land_cover.trends.grass_change_pct',      type: 'number|null',  description: 'Absolute change in grass_pct from 2017 to 2024' },
      { field: 'land_cover.trends.greenery_loss_pct',     type: 'number|null',  description: '(trees+grass) 2017 minus (trees+grass) 2024. Positive = net greenery loss over 8 years.' },
      { field: 'land_cover.trends.cropland_to_urban_pct', type: 'number|null',  description: 'Estimated cropland converted to urban: min(cropland lost, built-up gained). Key agricultural-land-loss signal.' },
      { field: 'land_cover.trends.flooded_veg_max_pct',   type: 'number|null',  description: 'Maximum flooded_veg_pct observed across all 8 years. Indicates seasonal waterlogging peak.' },
      { field: 'land_cover.trends.flooded_vegetation_trend', type: 'string|null', description: '"increasing" | "stable" | "decreasing" — trend direction of waterlogged vegetation over 8 years' },
      { field: 'land_cover.trends.dominant_use_2017',     type: 'string|null',  description: 'Dominant land class in 2017 by area' },
      { field: 'land_cover.trends.dominant_use_2024',     type: 'string|null',  description: 'Dominant land class in 2024 by area' },
      { field: 'land_cover.trends.land_use_shifted',      type: 'boolean|null', description: 'True if dominant class changed between 2017 and 2024' },
      { field: 'meta.data_source',                        type: 'string',       description: 'Always "ESRI 10m Annual Land Cover (Impact Observatory / Microsoft / Esri)"' },
      { field: 'meta.resolution_m',                       type: 'number',       description: 'Native raster resolution: 10m' },
      { field: 'meta.buffer_m',                           type: 'number',       description: 'Radius sampled around centroid for zonal stats: 500m' },
      { field: 'meta.data_as_of',                         type: 'string|null',  description: 'Date the extraction was run (ISO date string)' },
      { field: 'meta.input_type',                         type: 'string',       description: '"pincode" | "latlon"' },
      { field: 'meta.latency_ms',                         type: 'integer',      description: 'Server-side processing time in ms' },
    ],
    exampleRequest: {
      queryString: 'pincode=400001',
    },
    exampleResponse: JSON.stringify({
      success: true,
      input: { type: 'pincode', pincode: '400001', lat: 18.9421, lon: 72.8354 },
      land_cover: {
        coverage_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
        annual: {
          '2017': { built_area_pct: 82.14, trees_pct: 4.21, crops_pct: 0.0,  water_pct: 2.87, flooded_veg_pct: 0.0, grass_pct: 1.92, scrub_shrub_pct: 0.0,  bare_ground_pct: 8.86 },
          '2018': { built_area_pct: 84.02, trees_pct: 3.97, crops_pct: 0.0,  water_pct: 2.81, flooded_veg_pct: 0.0, grass_pct: 1.74, scrub_shrub_pct: 0.0,  bare_ground_pct: 7.46 },
          '2019': { built_area_pct: 85.31, trees_pct: 3.72, crops_pct: 0.0,  water_pct: 2.76, flooded_veg_pct: 0.0, grass_pct: 1.58, scrub_shrub_pct: 0.0,  bare_ground_pct: 6.63 },
          '2020': { built_area_pct: 86.44, trees_pct: 3.48, crops_pct: 0.0,  water_pct: 2.71, flooded_veg_pct: 0.0, grass_pct: 1.41, scrub_shrub_pct: 0.0,  bare_ground_pct: 5.96 },
          '2021': { built_area_pct: 87.12, trees_pct: 3.22, crops_pct: 0.0,  water_pct: 2.69, flooded_veg_pct: 0.0, grass_pct: 1.29, scrub_shrub_pct: 0.0,  bare_ground_pct: 5.68 },
          '2022': { built_area_pct: 87.89, trees_pct: 2.98, crops_pct: 0.0,  water_pct: 2.65, flooded_veg_pct: 0.0, grass_pct: 1.14, scrub_shrub_pct: 0.0,  bare_ground_pct: 5.34 },
          '2023': { built_area_pct: 88.51, trees_pct: 2.79, crops_pct: 0.0,  water_pct: 2.61, flooded_veg_pct: 0.0, grass_pct: 1.02, scrub_shrub_pct: 0.0,  bare_ground_pct: 5.07 },
          '2024': { built_area_pct: 89.07, trees_pct: 2.61, crops_pct: 0.0,  water_pct: 2.58, flooded_veg_pct: 0.0, grass_pct: 0.89, scrub_shrub_pct: 0.0,  bare_ground_pct: 4.85 },
        },
        trends: {
          urban_growth_rate_pct_per_yr: 1.012,
          urban_growth_class:           'moderate',
          built_area_change_pct:        6.93,
          trees_change_pct:             -1.60,
          crops_change_pct:             0.0,
          water_change_pct:             -0.29,
          flooded_veg_change_pct:       0.0,
          grass_change_pct:             -1.03,
          greenery_loss_pct:            2.63,
          cropland_to_urban_pct:        0.0,
          flooded_veg_max_pct:          0.0,
          flooded_vegetation_trend:     'stable',
          dominant_use_2017:            'built_area',
          dominant_use_2024:            'built_area',
          land_use_shifted:             false,
        },
      },
      meta: {
        data_source:  'ESRI 10m Annual Land Cover (Impact Observatory / Microsoft / Esri)',
        resolution_m: 10,
        buffer_m:     500,
        input_type:   'pincode',
        data_as_of:   '2026-07-23',
        latency_ms:   14,
      },
    }, null, 2),
    about: {
      source: 'ESRI 10m Annual Land Cover — Impact Observatory, Microsoft, Esri. Sentinel-2 imagery, 10m resolution, 2017–2024 annually. CC BY 4.0.',
      blocks: [
        { type: 'heading', text: 'What this API provides' },
        { type: 'paragraph', text: 'Eight years of annual land cover composition for every Indian pincode, derived from the ESRI 10m Annual Land Cover dataset. For each pincode centroid, a 500m radius buffer (~785,000 m² = ~78 ha) is sampled and each pixel classified into one of 8 land classes. The result is a percentage breakdown per class, per year, from 2017 to 2024.' },
        { type: 'paragraph', text: 'The trends section is what underwriters use day-to-day: pre-computed linear regression slopes, absolute deltas, greenery loss, and cropland-to-urban conversion — all calculated at index-build time so the API returns instantly (<20ms for pincode queries).' },

        { type: 'divider' },
        { type: 'heading', text: 'The 8 land cover classes' },
        {
          type: 'table',
          headers: ['Class', 'Code', 'What it represents', 'Insurance relevance'],
          rows: [
            ['built_area',   '7', 'Impervious surfaces: roads, buildings, concrete', 'Urban density proxy. High built_area = low green buffer = high runoff'],
            ['trees',        '2', 'Canopy cover ≥2m, both natural and plantation',  'Erosion and runoff buffer. Loss → increased downstream flood load'],
            ['crops',        '5', 'Cultivated agricultural land, all crop types',    'Seasonal inundation risk. Crop→urban shift = high-change zone'],
            ['water',        '1', 'Open water: rivers, lakes, reservoirs',           'Direct water body proximity. Persistent water = flood exposure'],
            ['flooded_veg',  '4', 'Vegetation on waterlogged / seasonally flooded soil', 'Key flood signal. Persistent flooded_veg = wetland or drainage plain'],
            ['grass',        '3', 'Low herbaceous cover, grassland, open ground',    'Combined with trees as "greenery" buffer metric'],
            ['scrub_shrub',  '6', 'Shrubs and low woody vegetation',                'Secondary buffer cover'],
            ['bare_ground',  '8', 'Exposed soil, rock, sand — no vegetation',       'Indicates degraded or dryland terrain'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Source accuracy' },
        { type: 'paragraph', text: 'Overall accuracy: ~75–85% at 10m, validated globally with 70,000+ field samples. Class-level accuracy varies:' },
        {
          type: 'table',
          headers: ['Class', 'User accuracy', 'Producer accuracy'],
          rows: [
            ['built_area',  '~80%', '~75%'],
            ['trees',       '~85%', '~90%'],
            ['crops',       '~75%', '~70%'],
            ['water',       '~95%', '~97%'],
            ['flooded_veg', '~65%', '~60%'],
          ],
        },
        { type: 'paragraph', text: 'Flooded vegetation is the lowest-confidence class — confusion with rice paddies, wetlands, and dense grass is common. Use flooded_veg_pct and flooded_veg_max_pct as directional signals, not precise measurements.' },
        { type: 'callout', label: 'Monsoon and cloud cover', text: 'Annual land cover composites use all cloud-free Sentinel-2 observations across the year — not a single date. Built-up area, trees, and bare ground are reliably detected year-round. Flooded vegetation and water area show seasonal variation across years reflecting actual monsoon intensity, not data gaps.' },

        { type: 'divider' },
        { type: 'heading', text: 'Calculated fields explained' },
        {
          type: 'table',
          headers: ['Field', 'Formula', 'What it tells an underwriter'],
          rows: [
            ['urban_growth_rate_pct_per_yr', 'Linear regression slope of built_area_pct over 2017–2024', 'How fast the location is urbanising. > 3%/yr = rapid expansion. Rapid urbanisers are high-growth-risk zones.'],
            ['urban_growth_class',           'Bins slope: rapid >3, moderate 1–3, stable, declining <-1', 'Quick lookup class for loading tables without computing the slope yourself.'],
            ['built_area_change_pct',        'built_area_pct_2024 − built_area_pct_2017',                'Net impervious surface gain. Positive = more urban, higher runoff coefficient.'],
            ['trees_change_pct',             'trees_pct_2024 − trees_pct_2017',                         'Deforestation signal. Negative values indicate canopy loss.'],
            ['crops_change_pct',             'crops_pct_2024 − crops_pct_2017',                         'Agricultural land loss. Negative crops + positive built_area = cropland conversion.'],
            ['greenery_loss_pct',            '(trees+grass)_2017 − (trees+grass)_2024',                 'Combined canopy+ground cover loss. Positive = net vegetation loss. Key buffer metric.'],
            ['cropland_to_urban_pct',        'min(max(crops lost, 0), max(built gained, 0))',            'Lower bound on cropland area converted to urban. Signals high-change expansion zones.'],
            ['flooded_veg_max_pct',          'max(flooded_veg_pct) across all 8 years',                 'Peak waterlogging extent ever observed. Even a single high year indicates flood-prone terrain.'],
            ['flooded_vegetation_trend',     'Linear regression on flooded_veg_pct → "increasing" | "stable" | "decreasing"', 'Is waterlogging getting worse, stable, or recovering?'],
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Underwriting use cases' },
        {
          type: 'bullets',
          items: [
            'Urban flood loading: high built_area_pct + negative trees/grass change = loss of green buffer → elevated surface runoff → higher pluvial flood risk loading.',
            'Rapid expansion zones: urban_growth_class = "rapid" identifies peri-urban and semi-rural locations transitioning fast. New construction often precedes drainage infrastructure.',
            'Cropland-to-urban conversion: cropland_to_urban_pct > 0 identifies former agricultural land now built over. Agricultural land has lower drainage capacity once paved.',
            'Persistent waterlogging: flooded_veg_max_pct > 10% signals that the 500m buffer has historically had significant waterlogged area — strong correlation with flood depth and duration.',
            'Land use shift alert: land_use_shifted = true means the dominant class changed in 8 years — the location\'s character has materially changed. May require re-rating.',
            'Combine with Terrain: built_area_pct rising + hand_m ≤ 5m = urban growth in a flood-prone drainage plain — the highest-risk combination for pluvial and fluvial flooding.',
          ],
        },

        { type: 'divider' },
        { type: 'heading', text: 'Known limitations' },
        {
          type: 'bullets',
          items: [
            '500m buffer per pincode. All pincodes in a dense city return similar values — the buffer averages across the pincode boundary, not just the insured address.',
            'Flooded vegetation ≠ flood depth. flooded_veg_pct measures waterlogged vegetation by area, not inundation depth. A large flooded_veg area could be shallow seasonal wetland or deep permanent marsh.',
            '10m pixel = ~1 building. A pincode with 500m buffer covers ~10,000 pixels. A single large building complex or water tank changes class percentages by 1–2%. Avoid reading changes below 2% as meaningful.',
            'Monsoon cloud bias in some years. Heavy monsoon years may have fewer cloud-free observations in some tiles, slightly changing class distribution. Year-on-year changes < 1% are within noise.',
            'No sub-annual resolution. This dataset is annual composites. Seasonal flooded_veg and water peaks (e.g. monsoon peaks) are averaged into the annual number.',
            'Urban classification at 10m misses informal settlements. Dense informal urban areas with mixed vegetation between structures may be classified as "trees" or "grass" rather than "built_area". built_area_pct for informal settlements is a lower bound.',
          ],
        },
      ],
    },
  },

  // ── Verification (KYC) — PAN Profile (TKYC) ───────────────────────────────
  {
    id: 'verify-pan',
    label: 'PAN Profile',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan',
    shortDescription: 'Verify a PAN and fetch the linked identity profile (name, address, Aadhaar-link status)',
    description:
      'Verifies an Indian PAN (Permanent Account Number) and returns the linked identity profile — full name, ' +
      'date of birth, address, and Aadhaar-seeding status. The portal calls the verification provider on your ' +
      'behalf using your credentials; you only send your platform API key. Pass "lite":"Y" for a lightweight ' +
      'response (status + name only). Consent must be "Y" — you confirm the end user has consented to the check.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
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
        name: 'pan',
        in: 'body',
        required: true,
        type: 'string',
        label: 'PAN Number',
        uppercase: true,
        description: '10-character PAN (5 letters, 4 digits, 1 letter).',
        validation: { minLength: 10, maxLength: 10, pattern: '^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$', hint: '5 letters, 4 digits, 1 letter' },
      },
      {
        name: 'consent',
        in: 'body',
        required: true,
        type: 'string',
        description: 'End-user consent flag. Must be "Y".',
        example: 'Y',
        enum: ['Y', 'N'],
      },
      {
        name: 'lite',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", returns a lightweight profile (status + name only). Omit or "N" for the full detailed profile.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'name',
        in: 'body',
        required: false,
        type: 'string',
        description: 'Optional name to match against the PAN record.',
      },
      {
        name: 'dob',
        in: 'body',
        required: false,
        type: 'string',
        label: 'Date of Birth',
        placeholder: 'YYYY-MM-DD',
        description: 'Optional date of birth (YYYY-MM-DD) to match against the PAN record.',
        validation: { pattern: '^\\d{4}-\\d{2}-\\d{2}$', hint: 'YYYY-MM-DD' },
      },
      {
        name: 'aadhaarLastFour',
        in: 'body',
        required: false,
        type: 'string',
        description: 'Optional last 4 digits of Aadhaar, to check PAN–Aadhaar linkage.',
        validation: { minLength: 4, maxLength: 4, pattern: '^\\d{4}$', hint: '4 digits' },
      },
      {
        name: 'address',
        in: 'body',
        required: false,
        type: 'string',
        description: 'Optional address to match against the PAN record.',
      },
      {
        name: 'getContactDetails',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", include contact details (email/phone) in the response where available.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'fatherName',
        in: 'body',
        required: false,
        type: 'string',
        label: "Father's Name",
        description: 'If "Y", include the father\'s name in the response.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'PANStatus',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", include PAN status (active/valid) in the response.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'isSalaried',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", include a salaried-individual indicator in the response.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'isDirector',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", include a company-director indicator in the response.',
        example: 'N',
        enum: ['Y', 'N'],
      },
      {
        name: 'isSoleProp',
        in: 'body',
        required: false,
        type: 'string',
        description: 'If "Y", include a sole-proprietor indicator in the response.',
        example: 'N',
        enum: ['Y', 'N'],
      },
    ],
    responseFields: [
      { field: 'data.requestId',                    type: 'string',        description: 'Unique provider request id (for support/audit)' },
      { field: 'data.statusCode',                   type: 'integer',       description: 'Provider status code (101 = success / record found)' },
      { field: 'data.result.pan',                   type: 'string',        description: 'The queried PAN' },
      { field: 'data.result.name',                  type: 'string',        description: 'Full name on the PAN record' },
      { field: 'data.result.firstName',             type: 'string',        description: 'First name' },
      { field: 'data.result.middleName',            type: 'string',        description: 'Middle name (may be empty)' },
      { field: 'data.result.lastName',              type: 'string',        description: 'Last name' },
      { field: 'data.result.gender',                type: 'string|null',   description: '"male" | "female" | null' },
      { field: 'data.result.dob',                   type: 'string|null',   description: 'Date of birth (YYYY-MM-DD)' },
      { field: 'data.result.address.buildingName',  type: 'string|null',   description: 'Building / house name' },
      { field: 'data.result.address.locality',      type: 'string|null',   description: 'Locality / area' },
      { field: 'data.result.address.streetName',    type: 'string|null',   description: 'Street name' },
      { field: 'data.result.address.city',          type: 'string|null',   description: 'City' },
      { field: 'data.result.address.state',         type: 'string|null',   description: 'State' },
      { field: 'data.result.address.pinCode',       type: 'string|null',   description: 'PIN code' },
      { field: 'data.result.address.country',       type: 'string|null',   description: 'Country (may be empty)' },
      { field: 'data.result.aadhaarLinked',         type: 'boolean|null',  description: 'Whether the PAN is seeded/linked with Aadhaar' },
      { field: 'data.result.aadhaarMatch',          type: 'boolean|null',  description: 'Aadhaar match result when aadhaarLastFour is supplied; null otherwise' },
      { field: 'data.result.profileMatch',          type: 'array',         description: 'Field-level match results when name/dob/address are supplied for matching; empty when none requested' },
    ],
    exampleRequest: {
      body: JSON.stringify({ pan: 'ABCDE1234F', consent: 'Y' }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: '932ca3b3-67ce-43f7-85fd-75c1ef20fe89',
        result: {
          pan: 'ABCDE1234F',
          name: 'FIRSTNAME LASTNAME',
          firstName: 'FIRSTNAME',
          lastName: 'LASTNAME',
          middleName: '',
          gender: 'male',
          dob: '1990-01-01',
          address: {
            buildingName: 'MANJU NIWAS',
            locality: 'UTTARI SHIV SHAKTI NAGAR',
            streetName: 'SAMPATCHAK',
            pinCode: '800006',
            city: 'PATNA',
            state: 'BIHAR',
            country: '',
          },
          aadhaarLinked: true,
          profileMatch: [],
          aadhaarMatch: null,
        },
        statusCode: 101,
      },
    }, null, 2),
    variants: PAN_PROFILE_VARIANTS,
  },

  // ── Verification (KYC) — PAN Status Check (TKYC) ──────────────────────────
  {
    id: 'verify-pan-status',
    label: 'PAN Status',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan-status',
    shortDescription: 'Authenticate a PAN and check its status (Active/Inactive) plus name & DOB match against ITD records',
    description:
      'Authenticates the status and details of a given PAN. Returns whether the PAN is Active or Inactive and ' +
      'whether the supplied name and date of birth match the Income Tax Department (ITD) records. The portal ' +
      'calls the verification provider on your behalf using your credentials; you only send your platform API ' +
      'key. Consent must be "Y" — you confirm the end user has consented to the check.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
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
        name: 'consent',
        in: 'body',
        required: true,
        type: 'string',
        description: 'Consent is required to make the API request.',
        example: 'Y',
        enum: ['Y', 'N'],
      },
      {
        name: 'pan',
        in: 'body',
        required: true,
        type: 'string',
        label: 'PAN Number',
        uppercase: true,
        placeholder: 'ABCDE1234F',
        description: 'PAN Number to be authenticated',
        validation: { minLength: 10, maxLength: 10, pattern: '^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$', hint: '5 letters, 4 digits, 1 letter' },
      },
      {
        name: 'name',
        in: 'body',
        required: true,
        type: 'string',
        description: 'Exact name as per PAN',
      },
      {
        name: 'dob',
        in: 'body',
        required: true,
        type: 'string',
        label: 'Date of Birth',
        placeholder: 'DD/MM/YYYY',
        description: 'Date of birth as per PAN',
        validation: { pattern: '^\\d{1,2}/\\d{1,2}/\\d{4}$', hint: 'DD/MM/YYYY' },
      },
      {
        name: 'clientData',
        in: 'body',
        required: false,
        type: 'object',
        description: 'Data of the user sharing consent',
      },
      {
        name: 'clientData.caseId',
        in: 'body',
        required: false,
        type: 'string',
        description: 'Unique case id/lead id of the user sharing consent',
        validation: { maxLength: 200, hint: 'Max-length 200' },
      },
    ],
    responseFields: [
      { field: 'data.status-code',      type: 'string',        required: true,  description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.request_id',       type: 'string',        required: true,  description: 'Unique id of the API request.' },
      { field: 'data.result',           type: 'object',        required: true,  description: 'Response object for the given inputs.' },
      { field: 'data.result.status',    type: 'string',        required: false, description: 'Status of the PAN. [Active or Inactive]' },
      { field: 'data.result.duplicate', type: 'boolean|null',  required: false, description: 'Whether the PAN has been tagged as duplicate by Income Tax Department (Please Note - This detail is no longer supported now)' },
      { field: 'data.result.nameMatch', type: 'boolean',       required: false, description: 'Whether the given name matches with the ITD Records' },
      { field: 'data.result.dobMatch',  type: 'boolean',       required: false, description: 'Whether the given date of birth matches with the ITD Records' },
      { field: 'data.clientData',       type: 'object',        required: true,  description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string',       required: true,  description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ pan: 'ABCDE1234F', name: 'Omkar Milind Shirhatti', dob: '17/08/1987', consent: 'Y' }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        result: {
          status: 'Active',
          duplicate: null,
          nameMatch: true,
          dobMatch: true,
        },
        request_id: 'deff5ed8-0460-11e9-a082-4742912ca12a',
        'status-code': '101',
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PAN_STATUS_VARIANTS,
  },

  // ── Verification (KYC) — PAN DOB Status (TKYC) ──────────────────────────
  {
    id: 'verify-pan-dob-status',
    label: 'PAN DOB Status',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan-dob-status',
    shortDescription: 'Verify a PAN and fetch basic profile: status (Active/Inactive), name, and DOB',
    description:
      'Verifies an Indian PAN (Permanent Account Number) and returns basic profile information — PAN status ' +
      '(Active or Inactive), name, and date of birth from Income Tax Department (ITD) records. The portal calls ' +
      'the verification provider on your behalf using your credentials; you only send your platform API key. ' +
      'Consent must be "Y" — you confirm the end user has consented to the check.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
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
        name: 'consent',
        in: 'body',
        required: true,
        type: 'string',
        description: 'Consent is required to make the API request.',
        example: 'Y',
        enum: ['Y', 'N'],
      },
      {
        name: 'pan',
        in: 'body',
        required: true,
        type: 'string',
        label: 'PAN Number',
        uppercase: true,
        placeholder: 'ABCDE1234F',
        description: 'PAN Number to be authenticated',
        validation: { minLength: 10, maxLength: 10, pattern: '^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$', hint: '5 letters, 4 digits, 1 letter' },
      },
      {
        name: 'clientData',
        in: 'body',
        required: false,
        type: 'object',
        description: 'Data of the user sharing consent',
      },
      {
        name: 'clientData.caseId',
        in: 'body',
        required: false,
        type: 'string',
        description: 'Unique case id/lead id of the user sharing consent',
        validation: { maxLength: 200, hint: 'Max-length 200' },
      },
    ],
    responseFields: [
      { field: 'data.statusCode',        type: 'integer', required: true,  description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId',         type: 'string',  required: true,  description: 'Unique id of the API request.' },
      { field: 'data.result',            type: 'object',  required: true,  description: 'Response object for the given inputs.' },
      { field: 'data.result.status',     type: 'string',  required: false, description: 'PAN Status (Active/Inactive)' },
      { field: 'data.result.name',       type: 'string',  required: false, description: 'Complete Name of PAN holder' },
      { field: 'data.result.dob',        type: 'string',  required: false, description: 'Date of Birth/Incorporation of PAN holder' },
      { field: 'data.clientData',        type: 'object',  required: true,  description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string',  required: true,  description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ pan: 'ABCDE1234E', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: '8c506938-9f57-4490-aa08-fc3659c06d79',
        result: { status: 'Active', name: 'abc', dob: '1992-04-06' },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PAN_DOB_STATUS_VARIANTS,
  },

  // ── Verification (KYC) — PAN Link Status: Share Consent (TKYC) ──────────
  {
    id: 'verify-pan-link-unique-consent',
    label: 'PAN Link Status (Consent)',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan-link-unique-consent',
    shortDescription: 'Step 1 of 2 — share consent and receive an accessKey for the PAN-Aadhaar link check',
    description:
      'First step of the PAN Link Status (unique Aadhaar) flow. Captures the end user\'s consent and returns an ' +
      'accessKey valid for 30 minutes. Pass that accessKey into "PAN Link Status (Check)" along with the PAN and ' +
      'Aadhaar number to complete the check. The portal calls the verification provider on your behalf using ' +
      'your credentials; you only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'lat', in: 'body', required: false, type: 'string', description: 'Latitude details of the user sharing consent (either IP or lat/long required)', validation: { hint: 'Must be valid coordinates' } },
      { name: 'long', in: 'body', required: false, type: 'string', description: 'Longitude details of the user sharing consent (either IP or lat/long required)', validation: { hint: 'Must be valid coordinates' } },
      { name: 'ipAddress', in: 'body', required: false, type: 'string', description: 'IP address of the user sharing consent (either IP or lat/long required)', placeholder: '12.12.12.12', validation: { hint: 'A.B.C.D, each 0-255' } },
      { name: 'userAgent', in: 'body', required: true, type: 'string', description: 'A string that lets servers and network peers identify the application, operating system, vendor, and/or version of the requesting user agent', validation: { maxLength: 256, hint: 'Max-length 256' } },
      { name: 'deviceId', in: 'body', required: false, type: 'string', description: 'User Device ID details', validation: { maxLength: 200, hint: 'Max-length 200' } },
      { name: 'deviceInfo', in: 'body', required: false, type: 'string', description: 'User Device Information', validation: { maxLength: 200, hint: 'Max-length 200' } },
      { name: 'name', in: 'body', required: true, type: 'string', description: 'Name of the user sharing consent' },
      { name: 'consentTime', in: 'body', required: true, type: 'string', description: 'Current Unix/Epoch Timestamp', validation: { hint: 'Must be valid epoch time not before 5 minutes from now' } },
      { name: 'consentText', in: 'body', required: true, type: 'string', description: 'Consent body accepted by the user', validation: { maxLength: 10000, hint: 'Max-length 10000' } },
      { name: 'clientData', in: 'body', required: true, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: true, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.accessKey', type: 'string', required: false, description: 'Access Key to invoke the next set of API/s' },
      { field: 'data.result.accessKeyValidity', type: 'string', required: false, description: 'Validity of the unique access key in Unix/Epoch Timestamp format (valid for 30 minutes from shared consent timestamp)' },
      { field: 'data.result.message', type: 'string', required: false, description: 'Message to display the status of consent capture' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent (passed as is)' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({
        lat: '19', long: '82', ipAddress: '12.12.12.12',
        userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0',
        deviceId: 'xxxx', deviceInfo: '1234', consent: 'Y', name: 'Rahul Kumar',
        consentTime: '1612442987', consentText: 'Customer consent body to be shared here',
        clientData: { caseId: '123456' },
      }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        result: { accessKey: '2cc1610c-3f25-4695-9d7c-4e391758898c', accessKeyValidity: '1612446446', message: 'Consent Accepted' },
        statusCode: 101,
        requestId: '2cc1610c-3f25-4695-9d7c-4e391758898c',
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PAN_LINK_UNIQUE_CONSENT_VARIANTS,
  },

  // ── Verification (KYC) — PAN Link Status: Check (TKYC) ───────────────────
  {
    id: 'verify-pan-link-unique-check',
    label: 'PAN Link Status (Check)',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan-link-unique-check',
    shortDescription: 'Step 2 of 2 — check whether a PAN is linked to a specific Aadhaar number',
    description:
      'Second step of the PAN Link Status (unique Aadhaar) flow. Requires the accessKey returned by "PAN Link ' +
      'Status (Consent)", plus the PAN and Aadhaar number, and returns whether that PAN is linked to that ' +
      'specific Aadhaar. The portal calls the verification provider on your behalf using your credentials; you ' +
      'only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'pan', in: 'body', required: true, type: 'string', label: 'PAN Number', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN number of the user', validation: { minLength: 10, maxLength: 10, pattern: '^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$', hint: '5 letters, 4 digits, 1 letter' } },
      { name: 'aadhaarNo', in: 'body', required: true, type: 'string', label: 'Aadhaar Number', placeholder: '123456789012', description: '12 digit Aadhaar Number of the user', validation: { minLength: 12, maxLength: 12, pattern: '^[0-9]{12}$', hint: '12 digits' } },
      { name: 'accessKey', in: 'body', required: true, type: 'string', description: 'Access Key to invoke the next set of API/s (from the Share Consent step)' },
      { name: 'clientData', in: 'body', required: true, type: 'object', description: 'Data of the user sharing consent (passed as is)' },
      { name: 'clientData.caseId', in: 'body', required: true, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.message', type: 'string', required: false, description: 'Message that describes whether PAN is linked to Aadhaar Number' },
      { field: 'data.result.linked', type: 'boolean', required: false, description: 'Status whether PAN is linked or not (True/False)' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent (passed as is)' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({
        pan: 'BXXXXXXXXR', aadhaarNo: 'xxxxxxxx6917', consent: 'Y',
        accessKey: '5d08f3a0-3a5c-43e4-a4af-1d496bd18cdc',
        clientData: { caseId: '123456' },
      }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: '5c42f558-e193-4ffc-baaf-591383ccbac7',
        result: { message: 'Your PAN is linked to Aadhaar Number XXXX XXXX 6917', linked: true },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PAN_LINK_UNIQUE_CHECK_VARIANTS,
  },

  // ── Verification (KYC) — PAN Link Status (any Aadhaar) (TKYC) ────────────
  {
    id: 'verify-pan-link-any',
    label: 'PAN Link Status (Any Aadhaar)',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/pan-link-any',
    shortDescription: 'Check whether a PAN is linked with any Aadhaar number — only PAN input required',
    description:
      'Checks whether a given PAN is linked with any Aadhaar number. Unlike the unique-Aadhaar flow, this only ' +
      'requires the PAN as input — no Aadhaar number, no consent-and-accessKey handshake. The portal calls the ' +
      'verification provider on your behalf using your credentials; you only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'pan', in: 'body', required: true, type: 'string', label: 'PAN Number', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN Number to be verified', validation: { minLength: 10, maxLength: 10, pattern: '^[A-Za-z]{3}[Pp][A-Za-z][0-9]{4}[A-Za-z]$', hint: '5 letters, 4 digits, 1 letter' } },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.isAadhaarLinked', type: 'boolean', required: false, description: 'Status whether PAN is linked or not (True/False)' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ pan: 'AXXXXXXXXA', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: '4cd50347-a0a7-441e-984c-b2d2c2908110',
        statusCode: 101,
        result: { isAadhaarLinked: true },
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PAN_LINK_ANY_VARIANTS,
  },

  // ── Verification (KYC) — Bank AC Verification Advanced (TKYC) ────────────
  {
    id: 'verify-bank-ac-advanced',
    label: 'Bank AC Verification Advanced',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/bank-ac-advanced',
    shortDescription: 'Verify a bank account by performing a transaction/enquiry call and reading the NPCI response',
    description:
      'Verifies the Bank Account information of an entity or individual by performing a transaction or enquiry ' +
      'call to the given Bank Account, and reading the response received from NPCI for the transaction. Supports ' +
      'both single-name and multi-name matching, with configurable strictness. The portal calls the verification ' +
      'provider on your behalf using your credentials; you only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'accountNumber', in: 'body', required: true, type: 'string', description: 'Account number to be verified.', validation: { minLength: 5, maxLength: 25, pattern: '^[a-zA-Z0-9]+$', hint: 'alphanumeric, 5-25 chars' } },
      { name: 'accountHolderName', in: 'body', required: false, type: 'string', description: 'Name of the account holder whose account is being verified (either accountHolderName or multiNameList to be passed)', validation: { pattern: "^[a-zA-Z0-9&,-/()_'. ]+$", hint: 'letters, numbers, and & , - / ( ) _ \' .' } },
      { name: 'multiNameList', in: 'body', required: false, type: 'array', description: 'Multiple names that needs to be matched with bank name (either accountHolderName or multiNameList to be passed)' },
      { name: 'ifsc', in: 'body', required: true, type: 'string', label: 'IFSC Code', uppercase: true, description: 'IFSC code of the home branch of the account.', validation: { pattern: '^[\\w]{4}0[\\w|\\d]{6}$', hint: '4 chars, 0, 6 chars/digits' } },
      { name: 'nameMatchType', in: 'body', required: false, type: 'string', description: 'Whether the account holder is an individual or an entity', enum: ['individual', 'entity'] },
      { name: 'useCombinedSolution', in: 'body', required: false, type: 'string', description: 'To be passed when combined solution needs to be used (Nonpenny + pennydrop)', example: 'Y' },
      { name: 'allowPartialMatch', in: 'body', required: false, type: 'boolean', description: 'To allow partial name match algorithm' },
      { name: 'preset', in: 'body', required: false, type: 'string', description: 'Strictness level of matching', example: 'G', validation: { hint: 'G (General), L (Lenient), S (Strict); default G' } },
      { name: 'suppressReorderPenalty', in: 'body', required: false, type: 'boolean', description: 'To suppress reordering of name token' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.data', type: 'object', required: false, description: 'Response data for the given inputs' },
      { field: 'data.result.data.source', type: 'array', required: false, description: 'Data as per source for the given inputs' },
      { field: 'data.result.data.source[].statusAsPerSource', type: 'string', required: false, description: 'Validity Status as per source' },
      { field: 'data.result.data.source[].data', type: 'object', required: false, description: 'Response data from source' },
      { field: 'data.result.data.source[].data.accountNumber', type: 'string', required: false, description: 'Provided account number' },
      { field: 'data.result.data.source[].data.ifsc', type: 'string', required: false, description: 'Provided IFSC code' },
      { field: 'data.result.data.source[].data.accountName', type: 'string', required: true, description: 'Name of the account holder' },
      { field: 'data.result.data.source[].data.bankResponse', type: 'string', required: true, description: 'Bank response for the transaction' },
      { field: 'data.result.data.source[].data.bankTxnStatus', type: 'boolean', required: true, description: 'Bank Transaction Status' },
      { field: 'data.result.data.source[].data.bankRRN', type: 'string', required: true, description: 'Bank RRN for the transaction' },
      { field: 'data.result.data.source[].data.statusCode', type: 'string', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.result.data.source[].isValid', type: 'boolean', required: false, description: 'Validity Status' },
      { field: 'data.result.data.identifier', type: 'string', required: false, description: 'Identification of the transaction processed through framework (NON_PENNY OR PENNY)' },
      { field: 'data.result.comparisionData', type: 'object', required: false, description: 'Comparison Data' },
      { field: 'data.result.comparisionData.inputVsSource', type: 'object', required: false, description: 'Comparison of Input vs Source data' },
      { field: 'data.result.comparisionData.inputVsSource.flags', type: 'object', required: false, description: 'Flags from Comparison data' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList', type: 'object', required: false, description: 'Multi name match List' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList.matches', type: 'array', required: false, description: 'Match score and result for all the names provided' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList.matches[].score', type: 'float', required: false, description: 'Name Match Score' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList.matches[].result', type: 'boolean', required: true, description: 'Name Match Result' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList.matches[].name', type: 'string', required: false, description: 'Name provided for matching with the standard given name' },
      { field: 'data.result.comparisionData.inputVsSource.flags.multiNameList.combinedScore', type: 'float', required: false, description: 'Combined score of base name with multiple names provided in the input.' },
      { field: 'data.result.comparisionData.inputVsSource.validity', type: 'string', required: false, description: 'Validity Status as per comparison' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({
        accountNumber: '100xxxxx979',
        accountHolderName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
        multiNameList: ['Perfios', 'Boyapati', 'Technologies'],
        ifsc: 'IDFBxxxx101',
        consent: 'Y',
        nameMatchType: 'Entity',
        useCombinedSolution: 'Y',
        allowPartialMatch: true,
        preset: 'G',
        suppressReorderPenalty: true,
        clientData: { caseId: '123456' },
      }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: 'ee79852b-e3e5-4ae4-b2ef-d81442664be2',
        result: {
          data: {
            source: [
              {
                statusAsPerSource: 'VALID',
                data: {
                  accountNumber: '10052056979',
                  ifsc: 'IDFB0040101',
                  accountName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
                  bankResponse: 'SUCCESSFUL TRANSACTION',
                  bankTxnStatus: true,
                  bankRRN: '521311711179',
                  statusCode: 'KC01',
                },
                isValid: true,
              },
            ],
            identifier: 'NON_PENNY',
          },
          comparisionData: {
            inputVsSource: {
              flags: {
                multiNameList: {
                  matches: [
                    { score: 0.905, result: true, name: 'Perfios' },
                    { score: 0.15076399733723234, result: false, name: 'Boyapati' },
                    { score: 0.14811483597375216, result: false, name: 'Technologies' },
                  ],
                  combinedScore: 0.4012929444369948,
                },
              },
              validity: 'VALID',
            },
          },
        },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: BANK_AC_ADVANCED_VARIANTS,
  },

  // ── Verification (KYC) — Silent Bank Account Verification (TKYC) ─────────
  {
    id: 'verify-bank-ac-silent',
    label: 'Silent Bank Account Verification',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/bank-ac-silent',
    shortDescription: 'Verify a bank account via a non-penny NPCI verification call (no funds moved)',
    description:
      'Verifies the Bank Account information of an entity by performing a verification call to the given Bank ' +
      'Account and reading the response received from NPCI — this is a non-penny based solution, so no funds are ' +
      'moved. The portal calls the verification provider on your behalf using your credentials; you only send ' +
      'your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'accountNumber', in: 'body', required: true, type: 'string', description: 'Account number of the bank account to be verified', validation: { minLength: 5, maxLength: 25, pattern: '^[a-zA-Z0-9]+$', hint: 'alphanumeric, 5-25 chars' } },
      { name: 'accountHolderName', in: 'body', required: false, type: 'string', description: 'Name of the account holder whose account is being verified', validation: { pattern: "^[a-zA-Z0-9&,-/()_'. ]+$", hint: 'letters, numbers, and & , - / ( ) _ \' .' } },
      { name: 'ifsc', in: 'body', required: true, type: 'string', label: 'IFSC Code', uppercase: true, description: 'IFSC of the bank branch to which the account belongs', validation: { pattern: '^[\\w]{4}0[\\w|\\d]{6}$', hint: '4 chars, 0, 6 chars/digits' } },
      { name: 'nameMatchType', in: 'body', required: false, type: 'string', description: 'Whether the account holder is an individual or an entity', enum: ['individual', 'entity'] },
      { name: 'allowPartialMatch', in: 'body', required: false, type: 'boolean', description: 'To allow partial name match algorithm' },
      { name: 'preset', in: 'body', required: false, type: 'string', description: 'Strictness level of matching', example: 'S', validation: { hint: 'G (General), L (Lenient), S (Strict); default G' } },
      { name: 'suppressReorderPenalty', in: 'body', required: false, type: 'boolean', description: 'To suppress reordering of name token' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.data', type: 'object', required: false, description: 'Response data for the given inputs' },
      { field: 'data.result.data.source', type: 'array', required: false, description: 'Data as per source for the given inputs' },
      { field: 'data.result.data.source[].statusAsPerSource', type: 'string', required: false, description: 'Validity Status as per source' },
      { field: 'data.result.data.source[].data', type: 'object', required: false, description: 'Response data from source' },
      { field: 'data.result.data.source[].data.bankTxnStatus', type: 'boolean', required: false, description: 'Bank Transaction Status' },
      { field: 'data.result.data.source[].data.accountNumber', type: 'string', required: false, description: 'Provided account number' },
      { field: 'data.result.data.source[].data.ifsc', type: 'string', required: false, description: 'Provided IFSC code' },
      { field: 'data.result.data.source[].data.accountName', type: 'string', required: true, description: 'Name of the account holder' },
      { field: 'data.result.data.source[].data.bankResponse', type: 'string', required: true, description: 'Bank response for the transaction' },
      { field: 'data.result.data.source[].data.bankRRN', type: 'string', required: true, description: 'Bank RRN for the transaction' },
      { field: 'data.result.data.source[].data.statusCode', type: 'string', required: false, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.result.data.source[].isValid', type: 'boolean', required: false, description: 'Validity Status' },
      { field: 'data.result.comparisonData', type: 'object', required: false, description: 'Comparison Data' },
      { field: 'data.result.comparisonData.inputVsSource', type: 'object', required: false, description: 'Comparison of Input vs Source data' },
      { field: 'data.result.comparisonData.inputVsSource.flags', type: 'object', required: false, description: 'Flags from Comparison data' },
      { field: 'data.result.comparisonData.inputVsSource.flags.accountHolderName', type: 'object', required: false, description: 'Comparison Results against Account Holder Name' },
      { field: 'data.result.comparisonData.inputVsSource.flags.accountHolderName.score', type: 'integer', required: false, description: 'Name Match Score' },
      { field: 'data.result.comparisonData.inputVsSource.flags.accountHolderName.result', type: 'boolean', required: true, description: 'Name Match Result' },
      { field: 'data.result.comparisonData.inputVsSource.validity', type: 'string', required: false, description: 'Validity Status as per comparison' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({
        accountNumber: '501xxxxxxxx679',
        accountHolderName: '',
        ifsc: 'HDFCxxxx810',
        consent: 'Y',
        nameMatchType: '',
        allowPartialMatch: true,
        preset: 'S',
        suppressReorderPenalty: true,
        clientData: { caseId: '123456' },
      }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        statusCode: 101,
        requestId: '118b29e8-d7de-410c-98cf-a0849252e7ec',
        result: {
          data: {
            source: [
              {
                statusAsPerSource: 'VALID',
                data: {
                  bankTxnStatus: true,
                  accountNumber: '501xxxxxxxx679',
                  ifsc: 'HDFCxxxx810',
                  accountName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
                  bankResponse: 'SUCCESSFUL TRANSACTION',
                  bankRRN: '214718512903',
                  statusCode: 'KC01',
                },
                isValid: true,
              },
            ],
          },
          comparisonData: {
            inputVsSource: {
              flags: { accountHolderName: { score: 1, result: true } },
              validity: 'VALID',
            },
          },
        },
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: BANK_AC_SILENT_VARIANTS,
  },

  // ── Verification (KYC) — Driver's License Authentication (TKYC) ──────────
  {
    id: 'verify-dl',
    label: "Driver's License Authentication",
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/dl',
    shortDescription: "Authenticate a Driver's License issued by an Indian Road Transport Office",
    description:
      "Authenticates a Driver's License issued by the Road Transport Offices of the States of India, returning " +
      "owner details, vehicle category authorizations, registered address, and license status. Optionally " +
      "returns endorsement and hazardous-driving validity details. The portal calls the verification provider " +
      "on your behalf using your credentials; you only send your platform API key.",
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'dlNo', in: 'body', required: true, type: 'string', label: 'DL Number', uppercase: true, placeholder: 'MH0120130001960', description: 'Driving License Number as mentioned on the license including special characters and spaces.', validation: { minLength: 9, maxLength: 50, hint: '9-50 chars' } },
      { name: 'dob', in: 'body', required: true, type: 'string', label: 'Date of Birth', placeholder: 'DD-MM-YYYY', description: 'Date of Birth as per License in dd-mm-yyyy format', validation: { pattern: '^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(19|20)\\d\\d$', hint: 'DD-MM-YYYY' } },
      { name: 'additionalDetails', in: 'body', required: false, type: 'boolean', description: 'If this is true, it will return endorsement and hazardous details' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: false, description: 'Response object for the given inputs.' },
      { field: 'data.result.issueDate', type: 'string', required: false, description: 'Date of Issue of the Driving License in dd-mm-yyyy format' },
      { field: 'data.result.father/husband', type: 'string', required: false, description: 'Name of Relative' },
      { field: 'data.result.name', type: 'string', required: false, description: 'Owner Name as per Driving License' },
      { field: 'data.result.img', type: 'string', required: false, description: 'Image of the licence holder' },
      { field: 'data.result.bloodGroup', type: 'string', required: false, description: 'Blood Group of the owner' },
      { field: 'data.result.dob', type: 'string', required: false, description: 'Date of Birth of the owner in dd-mm-yyyy format' },
      { field: 'data.result.dlNumber', type: 'string', required: false, description: 'Driving License Number of the owner' },
      { field: 'data.result.validity', type: 'object', required: false, description: 'Validity of the license as per purpose of driving — transport or non-transport' },
      { field: 'data.result.validity.nonTransport', type: 'string', required: false, description: 'Validity of the license for non-transport ("dd-mm-yyyy to dd-mm-yyyy" or "dd-mm-yyyy" or "" or null)' },
      { field: 'data.result.validity.transport', type: 'string', required: false, description: 'Validity of the license for transport ("dd-mm-yyyy to dd-mm-yyyy" or "dd-mm-yyyy" or "" or null)' },
      { field: 'data.result.covDetails', type: 'array', required: false, description: 'Category of Vehicles the licensee is authorized to drive along with effective date' },
      { field: 'data.result.covDetails[].cov', type: 'string', required: false, description: 'Category of vehicle (LMV, HMV, HPMV, etc.)' },
      { field: 'data.result.covDetails[].issueDate', type: 'string', required: false, description: 'Date of Issue of the license or place where the license has been issued in dd-mm-yyyy format' },
      { field: 'data.result.address', type: 'array', required: false, description: 'Registered addresses as per Driving License' },
      { field: 'data.result.address[].addressLine1', type: 'string', required: false, description: 'Address Line 1' },
      { field: 'data.result.address[].state', type: 'string', required: false, description: 'State' },
      { field: 'data.result.address[].district', type: 'string', required: false, description: 'District' },
      { field: 'data.result.address[].pin', type: 'integer', required: false, description: 'Pin Code' },
      { field: 'data.result.address[].completeAddress', type: 'string', required: false, description: 'Complete Address' },
      { field: 'data.result.address[].country', type: 'string', required: false, description: 'Country' },
      { field: 'data.result.address[].type', type: 'string', required: false, description: 'Address Type (Present/Permanent/NA)' },
      { field: 'data.result.status', type: 'string', required: false, description: 'Status of the Driving License Number as per Government Records' },
      { field: 'data.result.statusDetails', type: 'object', required: false, description: 'Details of the Driving License Status' },
      { field: 'data.result.statusDetails.from', type: 'string', required: false, description: 'Driving License valid from date in dd-mm-yyyy format' },
      { field: 'data.result.statusDetails.to', type: 'string', required: false, description: 'Driving License valid to date in dd-mm-yyyy format' },
      { field: 'data.result.statusDetails.remarks', type: 'string', required: false, description: 'Remarks for the Status' },
      { field: 'data.result.endorsementAndHazardousDetails', type: 'object', required: false, description: 'Details of Endorsement and Hazardous Validity' },
      { field: 'data.result.endorsementAndHazardousDetails.initialIssuingOffice', type: 'string', required: false, description: 'Initial Issuing RTO for given Driving License' },
      { field: 'data.result.endorsementAndHazardousDetails.lastEndorsementDate', type: 'string', required: false, description: 'Latest endorsement date if any act was imposed on Driving License owner in dd-mm-yyyy format' },
      { field: 'data.result.endorsementAndHazardousDetails.lastEndorsedOffice', type: 'string', required: false, description: 'Lastest RTO who imposed the endorsement on Driving License owner' },
      { field: 'data.result.endorsementAndHazardousDetails.endorsementReason', type: 'string', required: false, description: 'Detailed Reason of endorsement' },
      { field: 'data.result.endorsementAndHazardousDetails.hazardousValidTill', type: 'string', required: false, description: 'Date of validity to drive hazardous vehicle' },
      { field: 'data.result.endorsementAndHazardousDetails.hillValidTill', type: 'string', required: false, description: 'Date of validity to drive vehicle in hill roads' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ dlNo: 'MH0120130001960', dob: '05-10-1994', additionalDetails: true, consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: 'ef484b85-34b9-45cb-99de-119accb91066',
        result: {
          issueDate: '08-01-2013',
          'father/husband': 'DIVAKAR PANDEY',
          name: 'PUNEET PANDEY',
          img: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
          bloodGroup: 'B+',
          dob: '05-10-1994',
          dlNumber: 'MH0120130001960',
          validity: { nonTransport: '08-01-2013 to 07-01-2033', transport: '' },
          covDetails: [
            { cov: 'MCWG', issueDate: '08-01-2013' },
            { cov: 'LMV', issueDate: '08-01-2013' },
          ],
          address: [
            {
              addressLine1: '', state: 'MAHARASHTRA', district: 'MUMBAI', pin: 400013,
              completeAddress: 'C/304 PIMPLESHWAR CHS MAHADEV PALAV MARG CURREY RD MUMBAI MUMBAI,MUMBAI,MH 400013',
              country: '', type: 'NA',
            },
          ],
          status: 'Active',
          statusDetails: { from: '', to: '', remarks: '' },
          endorsementAndHazardousDetails: {
            initialIssuingOffice: 'RTO,MUMBAI CENTRAL',
            lastEndorsementDate: '02-01-2018',
            lastEndorsedOffice: 'RTO,MUMBAI CENTRAL',
            endorsementReason: 'ISSUE OF DUPLICATE DL , ISSUE OF DRIVING LICENCE',
            hazardousValidTill: 'NA',
            hillValidTill: 'NA',
          },
        },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: DL_VARIANTS,
  },

  // ── Verification (KYC) — Passport Verification (TKYC) ────────────────────
  {
    id: 'verify-passport',
    label: 'Passport Verification',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/passport',
    shortDescription: 'Verify a passport issued by Passport Seva Kendra using File Number and Date of Birth',
    description:
      'Verifies a passport issued by Passport Seva Kendra basis File Number and Date of Birth (or Passport ' +
      'Number, Date of Issue, and name), returning name-match, dispatch, and application-type details from the ' +
      'source. The portal calls the verification provider on your behalf using your credentials; you only send ' +
      'your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'fileNo', in: 'body', required: false, type: 'string', description: 'Passport application File Number as printed on the last page of the passport' },
      { name: 'dob', in: 'body', required: false, type: 'string', label: 'Date of Birth', placeholder: 'DD/MM/YYYY', description: 'Date of birth as per Passport' },
      { name: 'passportNo', in: 'body', required: false, type: 'string', label: 'Passport Number', uppercase: true, description: 'Passport Number', validation: { pattern: '^(?!^0+$)[a-zA-Z0-9]{3,20}$', hint: '3-20 alphanumeric chars' } },
      { name: 'doi', in: 'body', required: false, type: 'string', label: 'Date of Issue', placeholder: 'DD/MM/YYYY', description: 'Date of Issue as per Passport' },
      { name: 'name', in: 'body', required: false, type: 'string', description: 'Complete name of the passport holder' },
      { name: 'passportStatus', in: 'body', required: false, type: 'string', description: 'If status of passport required', example: 'Y', enum: ['Y', 'N'] },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.passportNumber', type: 'object', required: false, description: 'Object containing the passport number as per source' },
      { field: 'data.result.passportNumber.passportNumberFromSource', type: 'string', required: false, description: 'Passport number allocated for the given File Number and Date of birth' },
      { field: 'data.result.passportNumber.passportNumberMatch', type: 'boolean', required: false, description: 'Whether given passport number matches the number as per source' },
      { field: 'data.result.applicationDate', type: 'string', required: false, description: 'Date of application as per source' },
      { field: 'data.result.typeOfApplication', type: 'string', required: false, description: 'Application type [Normal or Tatkaal]' },
      { field: 'data.result.dateOfIssue', type: 'object', required: false, description: 'Object containing the dispatch date as per source' },
      { field: 'data.result.dateOfIssue.dispatchedOnFromSource', type: 'string', required: false, description: 'Date of Dispatch or Date of Counter Delivery of passport as per source' },
      { field: 'data.result.dateOfIssue.dateOfIssueMatch', type: 'boolean', required: false, description: 'Whether the date of Issue is within 2 days of date of dispatch' },
      { field: 'data.result.name', type: 'object', required: false, description: 'Object containing the details of the passport holder name as per source' },
      { field: 'data.result.name.nameScore', type: 'float', required: false, description: 'Name match score' },
      { field: 'data.result.name.nameMatch', type: 'boolean', required: false, description: 'Whether the given name matches with the name as per source' },
      { field: 'data.result.name.surnameFromPassport', type: 'string', required: false, description: 'Surname as per Source' },
      { field: 'data.result.name.nameFromPassport', type: 'string', required: false, description: 'Given Name [First and Middle] as per source' },
      { field: 'data.result.status', type: 'string', required: false, description: 'Status message as per source' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({
        consent: 'Y', fileNo: 'BO3072344560818', dob: '17/08/1987', passportNo: 'S3733862',
        doi: '14/05/2018', name: 'OMKAR MILIND SHIRHATTI', passportStatus: 'Y',
        clientData: { caseId: '123456' },
      }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        result: {
          passportNumber: { passportNumberFromSource: 'S3733862', passportNumberMatch: true },
          applicationDate: '14/05/2018',
          typeOfApplication: 'Tatkaal',
          dateOfIssue: { dispatchedOnFromSource: '14/05/2018', dateOfIssueMatch: true },
          name: { nameScore: 1, nameMatch: true, surnameFromPassport: 'SHIRHATTI', nameFromPassport: 'OMKAR MILIND' },
          status: 'Passport S3733862 has been dispatched on 14/05/2018 via Speed Post Tracking Number',
        },
        requestId: 'f3de6c55-6c0f-11e9-bf8e-610d4b51e956',
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: PASSPORT_VARIANTS,
  },

  // ── Verification (KYC) — Vehicle RC Authentication - Advanced (TKYC) ─────
  {
    id: 'verify-rc-advanced',
    label: 'Vehicle RC Authentication - Advanced',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/rc-advanced',
    shortDescription: 'Fetch detailed vehicle registration (RC) details for a given Vehicle Registration Number',
    description:
      'Fetches detailed vehicle registration (RC) details against a given Vehicle Registration Number — owner, ' +
      'manufacturer, insurance, permit, fitness, and tax details from the government source. The portal calls ' +
      'the verification provider on your behalf using your credentials; you only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'registrationNumber', in: 'body', required: true, type: 'string', label: 'Registration Number', uppercase: true, placeholder: 'MH04CY4545', description: 'Vehicle Registration Number', validation: { minLength: 6, maxLength: 20, hint: '6-20 chars, e.g. MH04CY4545' } },
      { name: 'version', in: 'body', required: true, type: 'number', description: 'API version', example: 3.1, validation: { hint: 'Value must be greater than 3' } },
      { name: 'partialEngine', in: 'body', required: false, type: 'string', description: 'If Partial engine is required', example: 'Y', enum: ['Y', 'N'] },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'data.result.blackListInfo', type: 'array', required: false, description: 'Blacklist information of the vehicle' },
      { field: 'data.result.blackListStatus', type: 'string', required: false, description: 'Blacklist status of the vehicle' },
      { field: 'data.result.bodyTypeDescription', type: 'string', required: false, description: 'Body Type of the Vehicle' },
      { field: 'data.result.chassisNumber', type: 'string', required: false, description: 'Chassis Number of the Vehicle' },
      { field: 'data.result.color', type: 'string', required: false, description: 'Registered Color of the Vehicle' },
      { field: 'data.result.cubicCapacity', type: 'string', required: false, description: 'Cubic Capacity of the Vehicle Engine' },
      { field: 'data.result.engineNumber', type: 'string', required: false, description: 'Engine Number of the vehicle' },
      { field: 'data.result.fatherName', type: 'string', required: false, description: "Father's Name of Registered Owner of the vehicle" },
      { field: 'data.result.financier', type: 'string', required: false, description: 'Name of Vehicle Financier' },
      { field: 'data.result.fitnessUpto', type: 'string', required: false, description: 'Date of Validity of Vehicle Fitness certificate' },
      { field: 'data.result.fuelDescription', type: 'string', required: false, description: 'Vehicle Fuel Type' },
      { field: 'data.result.grossVehicleWeight', type: 'string', required: false, description: 'Gross Weight of the Vehicle' },
      { field: 'data.result.insuranceCompany', type: 'string', required: false, description: 'Insurer Name of the Vehicle' },
      { field: 'data.result.insurancePolicyNumber', type: 'string', required: false, description: 'Insurance Policy Number of the Vehicle' },
      { field: 'data.result.insuranceUpto', type: 'string', required: false, description: 'Date of validity of RC Insurance' },
      { field: 'data.result.makerDescription', type: 'string', required: false, description: 'Name of Vehicle Manufacturer' },
      { field: 'data.result.makerModel', type: 'string', required: false, description: 'Vehicle Model and Make' },
      { field: 'data.result.manufacturedMonthYear', type: 'string', required: false, description: 'Month & Year of Vehicle Manufacture' },
      { field: 'data.result.nationalPermitExpiryDate', type: 'string', required: false, description: 'Expiry date of the national permit of the vehicle' },
      { field: 'data.result.nationalPermitIssuedBy', type: 'string', required: false, description: 'Name of the body which issued the National Permit for the vehicle' },
      { field: 'data.result.nationalPermitNumber', type: 'string', required: false, description: 'National Permit Number of the vehicle' },
      { field: 'data.result.nocDetails', type: 'string', required: false, description: 'Vehicle No Objection Certificate details issued by RTO' },
      { field: 'data.result.nonUseFrom', type: 'string', required: false, description: 'Date of vehicle non use from' },
      { field: 'data.result.nonUseTo', type: 'string', required: false, description: 'Date of vehicle non use to' },
      { field: 'data.result.normsDescription', type: 'string', required: false, description: 'Vehicle Pollution Norms Description' },
      { field: 'data.result.numberOfCylinders', type: 'string', required: false, description: 'Number of Cylinders' },
      { field: 'data.result.ownerName', type: 'string', required: false, description: 'Registered Name of Owner' },
      { field: 'data.result.ownerSerialNumber', type: 'string', required: false, description: 'Serial Number of Vehicle Owner' },
      { field: 'data.result.permanentAddress', type: 'string', required: false, description: 'Registered Permanent Address of the Vehicle Owner' },
      { field: 'data.result.presentAddress', type: 'string', required: false, description: 'Registered Present Address of the Owner' },
      { field: 'data.result.pucExpiryDate', type: 'string', required: false, description: 'Expiry date of PUC certificate of the vehicle' },
      { field: 'data.result.pucNumber', type: 'string', required: false, description: 'PUC Registration Number of the vehicle' },
      { field: 'data.result.rcMobileNo', type: 'string', required: false, description: 'Mobile number registered for given RC number' },
      { field: 'data.result.rcNonUseStatus', type: 'string', required: false, description: 'Vehicle RC Non use status' },
      { field: 'data.result.rcStatus', type: 'string', required: false, description: 'RC status of vehicle' },
      { field: 'data.result.registeredAt', type: 'string', required: false, description: 'Location of RTO where the vehicle was registered' },
      { field: 'data.result.registrationDate', type: 'string', required: false, description: 'Date of Registration of the Vehicle' },
      { field: 'data.result.registrationNumber', type: 'string', required: false, description: 'Registration Number of the Vehicle' },
      { field: 'data.result.seatingCapacity', type: 'string', required: false, description: 'Vehicle Passenger Seating Capacity' },
      { field: 'data.result.sleeperCapacity', type: 'string', required: false, description: 'Maximum Sleeper Capacity' },
      { field: 'data.result.standingCapacity', type: 'string', required: false, description: 'Capacity of Standing Passengers in the Vehicle' },
      { field: 'data.result.stateCd', type: 'string', required: false, description: 'State code of the vehicle' },
      { field: 'data.result.statePermitExpiryDate', type: 'string', required: false, description: 'Expiry date of the State permit of the vehicle' },
      { field: 'data.result.statePermitIssuedDate', type: 'string', required: false, description: 'Date of issue of State Permit of the vehicle' },
      { field: 'data.result.statePermitNumber', type: 'string', required: false, description: 'State Permit Number of the vehicle' },
      { field: 'data.result.statePermitType', type: 'string', required: false, description: 'Type of State Permit issued for the vehicle' },
      { field: 'data.result.statusAsOn', type: 'string', required: false, description: 'Date of RC Status Verification' },
      { field: 'data.result.stautsMessage', type: 'string', required: false, description: 'Status message of vehicle' },
      { field: 'data.result.taxPaidUpto', type: 'string', required: false, description: 'Duration till the Tax on the Vehicle has been paid (Life time / One time)' },
      { field: 'data.result.unladenWeight', type: 'string', required: false, description: 'Unladden Weight of the Vehicle' },
      { field: 'data.result.vehicleCatgory', type: 'string', required: false, description: 'Category of vehicle' },
      { field: 'data.result.vehicleClassDescription', type: 'string', required: false, description: 'Description of Vehicle Class' },
      { field: 'data.result.wheelbase', type: 'string', required: false, description: 'Wheelbase in mm of the vehicle' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ registrationNumber: 'MH04CY4545', consent: 'Y', partialEngine: 'Y', version: 3.1, clientData: { caseId: '123456' } }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: 'be275edf-f9dd-4c8c-8428-b8b5290b5a5d',
        result: {
          blackListInfo: [], blackListStatus: 'NA', bodyTypeDescription: 'SALOON', chassisNumber: 'MBJ11JV40070650241106',
          color: 'BLACK MET', cubicCapacity: '1998.0', engineNumber: '2KD9780094', fatherName: 'MUKUND SHUKLA',
          financier: 'NA', fitnessUpto: '29-12-2021', fuelDescription: 'DIESEL', grossVehicleWeight: '2290',
          insuranceCompany: 'Reliance General Insurance Co. Ltd.', insurancePolicyNumber: '110522123470007351',
          insuranceUpto: '21-01-2022', makerDescription: 'TOYOTA KIRLOSKAR MOTOR PVT LTD',
          makerModel: 'INNOVA 2.5 G WITH POWER STEER', manufacturedMonthYear: '11-2006',
          nationalPermitExpiryDate: null, nationalPermitIssuedBy: '', nationalPermitNumber: '', nocDetails: 'NA',
          nonUseFrom: null, nonUseTo: null, normsDescription: 'Not Available', numberOfCylinders: '4',
          ownerName: 'SAMEER M SHUKLA', ownerSerialNumber: '3',
          permanentAddress: 'FLAT NO 6 SATCHIDANAND CHS , PHADKE RD DOMBIVALI E OPP,HDFC BANK KALYAN, Thane -421201',
          presentAddress: 'FLAT NO 6 SATCHIDANAND CHS , PHADKE RD DOMBIVALI E OPP,HDFC BANK KALYAN, Thane -421201',
          pucExpiryDate: '22-04-2022', pucNumber: 'MH00500490004913', rcMobileNo: '', rcNonUseStatus: null,
          rcStatus: 'ACTIVE', registeredAt: 'KALYAN, Maharashtra', registrationDate: '30-12-2006',
          registrationNumber: 'MH04CY4545', seatingCapacity: '7', sleeperCapacity: '0', standingCapacity: '0',
          stateCd: null, statePermitExpiryDate: null, statePermitIssuedDate: null, statePermitNumber: '',
          statePermitType: null, statusAsOn: null, stautsMessage: null, taxPaidUpto: '31-Dec-2099',
          unladenWeight: '1630', vehicleCatgory: 'LMV', vehicleClassDescription: 'Motor Car(LMV)', wheelbase: '2750',
        },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: RC_ADVANCED_VARIANTS,
  },

  // ── Verification (KYC) — GST Authentication (TKYC) ────────────────────────
  {
    id: 'verify-gst',
    label: 'GST Authentication',
    group: 'Verification (KYC)',
    method: 'POST',
    path: '/api/verify/gst',
    shortDescription: 'Authenticate a 15-digit GSTIN and fetch registration, business, and (optionally) turnover details',
    description:
      'Authenticates a 15-digit GSTIN issued by the Goods and Service Tax Network in India, returning legal name, ' +
      'registration status, jurisdiction, and address details. When `additionalData` is true, also returns HSN/SAC ' +
      'goods & services details, aggregated annual turnover slab, e-KYC/Aadhaar authentication flags, and gross ' +
      'total income from IT returns. The portal calls the verification provider on your behalf using your ' +
      'credentials; you only send your platform API key.',
    authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',
    params: [
      { name: 'x-api-key', in: 'header', required: true, type: 'string', description: 'Your platform API key', example: 'env_abc123...' },
      { name: 'consent', in: 'body', required: true, type: 'string', description: 'Consent is required to make the API request.', example: 'Y', enum: ['Y', 'N'] },
      { name: 'additionalData', in: 'body', required: false, type: 'boolean', description: 'Optional Parameter: To fetch HSN Summary of the entity and certain additional data-points' },
      { name: 'gstin', in: 'body', required: true, type: 'string', label: 'GSTIN', uppercase: true, placeholder: '27AAACR5055K1Z7', description: 'Fifteen character unique GSTIN to be authenticated', validation: { minLength: 15, maxLength: 15, hint: '15 chars' } },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', validation: { maxLength: 200, hint: 'Max-length 200' } },
    ],
    responseFields: [
      { field: 'data.statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'data.requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'data.result', type: 'object', required: true, description: 'Response object for the given inputs' },
      { field: 'data.result.canFlag', type: 'string', required: false, description: 'Flag to identify if an application for cancellation of GST has been filed' },
      { field: 'data.result.contacted', type: 'object', required: false, description: 'Contact details fetched using internal database' },
      { field: 'data.result.contacted.email', type: 'string', required: false, description: 'Email ID' },
      { field: 'data.result.contacted.mobNum', type: 'string', required: false, description: 'Mobile Number' },
      { field: 'data.result.contacted.name', type: 'string', required: false, description: 'Name' },
      { field: 'data.result.ppr', type: 'string', required: false, description: 'NA' },
      { field: 'data.result.cmpRt', type: 'string', required: false, description: 'Compliance rating if provided by GSP' },
      { field: 'data.result.rgdt', type: 'string', required: false, description: 'Registration date under GST' },
      { field: 'data.result.tradeNam', type: 'string', required: false, description: 'Trade Name' },
      { field: 'data.result.nba', type: 'array', required: false, description: 'Nature of business registered under GST' },
      { field: 'data.result.mbr', type: 'array', required: false, description: 'Member names if provided by GSP' },
      { field: 'data.result.adadr', type: 'array', required: false, description: 'Address information for additional places of business' },
      { field: 'data.result.pradr', type: 'object', required: false, description: 'Address information for principal place of business' },
      { field: 'data.result.stjCd', type: 'string', required: false, description: 'State Jurisdiction Code' },
      { field: 'data.result.lstupdt', type: 'string', required: false, description: 'Last Updated' },
      { field: 'data.result.gstin', type: 'string', required: false, description: 'Given GSTIN' },
      { field: 'data.result.ctjCd', type: 'string', required: false, description: 'Central Jurisdiction Code' },
      { field: 'data.result.stj', type: 'string', required: false, description: 'State Jurisdiction' },
      { field: 'data.result.dty', type: 'string', required: false, description: 'Taxpayer Type' },
      { field: 'data.result.cxdt', type: 'string', required: false, description: 'Date of Cancellation of Registration' },
      { field: 'data.result.ctb', type: 'string', required: false, description: 'Constitution of Business' },
      { field: 'data.result.sts', type: 'string', required: false, description: 'Current status of registration under GST' },
      { field: 'data.result.lgnm', type: 'string', required: false, description: 'Legal Name of the Business or Individual corresponding to the GSTIN' },
      { field: 'data.result.ctj', type: 'string', required: false, description: 'Central Jurisdiction' },
      { field: 'data.result.bzgddtls', type: 'array', required: false, description: '(additionalData) HSN details for Goods' },
      { field: 'data.result.bzsdtls', type: 'array', required: false, description: '(additionalData) SAC details for services' },
      { field: 'data.result.aggreTurnOver', type: 'string', required: false, description: '(additionalData) Aggregated annual PAN level turnover slab of the entity' },
      { field: 'data.result.mandatedeInvoice', type: 'string', required: false, description: '(additionalData) Whether E-Invoice is mandatory for the entity' },
      { field: 'data.result.ntcrbs', type: 'string', required: false, description: '(additionalData) Nature Of Core Business Activity' },
      { field: 'data.result.adhrVFlag', type: 'string', required: false, description: '(additionalData) Whether Aadhaar authenticated' },
      { field: 'data.result.gtiFY', type: 'string', required: false, description: '(additionalData) Gross total income pertaining to the financial year' },
      { field: 'data.result.ekycVFlag', type: 'string', required: false, description: '(additionalData) Whether e-KYC verified' },
      { field: 'data.result.percentTaxInCash', type: 'string', required: false, description: '(additionalData) Percentage of tax payment in cash' },
      { field: 'data.result.compDetl', type: 'boolean', required: false, description: '(additionalData) Whether compliance details available' },
      { field: 'data.result.gti', type: 'string', required: false, description: '(additionalData) Gross total income as per income-tax returns' },
      { field: 'data.result.aggreTurnOverFY', type: 'string', required: false, description: '(additionalData) Aggregated annual PAN level turnover slab pertaining to the financial year' },
      { field: 'data.result.percentTaxInCashFY', type: 'string', required: false, description: '(additionalData) Percentage of tax payment in cash pertaining to the financial year' },
      { field: 'data.clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'data.clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    exampleRequest: {
      body: JSON.stringify({ consent: 'Y', additionalData: false, gstin: '27AAACR5055K1Z7', clientData: { caseId: '123456' } }, null, 2),
    },
    exampleResponse: JSON.stringify({
      success: true,
      data: {
        requestId: 'e17b624f-52ea-48d0-bfdb-320885d4034d',
        result: {
          canFlag: null,
          contacted: { email: '', mobNum: '', name: null },
          ppr: null, cmpRt: 'NA', rgdt: '01/07/2017', tradeNam: 'RELIANCE INDUSTRIES LIMITED',
          nba: ['Factory / Manufacturing', 'Retail Business'],
          mbr: ['Nikhil Rasiklal Meswani'],
          adadr: [],
          pradr: { adr: '5, 5, TTC Industrial Area, Thane, Maharashtra, 400701', em: '', mb: '', ntr: 'Factory / Manufacturing', addr: 'NA', lastUpdatedDate: 'NA' },
          stjCd: null, lstupdt: null, gstin: '27AAACR5055K1Z7', ctjCd: null,
          stj: 'State - Maharashtra,Zone - Thane,Division - RAIGAD,Charge - URAN_701',
          dty: 'Regular', cxdt: null, ctb: 'Public Limited Company', sts: 'Active',
          lgnm: 'RELIANCE INDUSTRIES LIMITED',
          ctj: 'Commissionerate - BELAPUR,Division - DIVISION IV,Range - RANGE-IV (Jurisdictional Office)',
        },
        statusCode: 101,
        clientData: { caseId: '123456' },
      },
    }, null, 2),
    variants: GST_VARIANTS,
  },
]
