// Types for the environmental risk DB and API layer.
// All field shapes mirror the district_risk_index and district_air_quality tables.

export type DataQuality = 'measured' | 'modelled' | 'surveyed' | 'gap_filled' | 'missing'
export type AqiCategory = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe'
export type RiskTier = 'Low' | 'Medium' | 'High' | 'Very High'
export type HeatStressZone = 'Low' | 'Moderate' | 'High' | 'Extreme'

// ── Endpoint 1 response ──────────────────────────────────────────────────────

export interface PincodeLookup {
  pincode: string
  district_name: string
  state_name: string
  lat: number
  lng: number
  city_tier: number | null
}

export interface Pm25Vintage {
  mean_3yr_from: number | null
  mean_3yr_to: number | null
  mean_5yr_from: number | null
  mean_5yr_to: number | null
}

export interface PollutantProfile {
  mean_3yr: number | null
  mean_5yr: number | null
  worst_month_avg: number | null
  trend_5yr_pct: number | null
  trend_direction: 'improving' | 'stable' | 'worsening' | null
  vintage: Pm25Vintage
  zone: string | null
  unit: string
  data_quality: DataQuality
  data_source: string
}

export interface GasPollutantProfile {
  mean_5yr: number | null
  zone: string | null
  unit: string
  data_quality: DataQuality
  data_source: string
}

export interface AqiProfile {
  annual_mean: number | null
  worst_month_value: number | null
  worst_month_name: string | null
  worst_year: number | null
  category: AqiCategory | null
  limiting_pollutant: string | null
}

export interface DisasterProfile {
  flood_events_per_decade: number | null
  cyclone_events_per_decade: number | null
  earthquake_events_per_decade: number | null
  disaster_insurance_loss_cr: number | null
  disaster_frequency_score: number | null
  data_quality: DataQuality
  data_source: string
}

export interface HeatProfile {
  heat_wave_days_per_year: number | null
  heat_stress_zone: HeatStressZone | null
  data_quality: DataQuality
  data_source: string
}

export interface HealthBurdenProfile {
  hypertension_pct: number | null
  diabetes_pct: number | null
  obesity_pct: number | null
  tobacco_use_pct: number | null
  anaemia_pct: number | null
  data_quality: DataQuality
  data_source: string
  data_as_of_year: number | null
}

export interface CompositeProfile {
  composite_risk_score: number
  risk_tier: RiskTier
  pm25_national_percentile: number | null
  composite_national_percentile: number | null
}

export interface DistrictRiskResponse {
  uw_narrative: string
  lookup: PincodeLookup
  air_quality: {
    pm25: PollutantProfile
    pm10: PollutantProfile
    no2: GasPollutantProfile
    so2: GasPollutantProfile
    co: GasPollutantProfile
    o3: GasPollutantProfile
    aqi: AqiProfile
  }
  disasters: DisasterProfile
  heat: HeatProfile
  health_burden: HealthBurdenProfile
  composite: CompositeProfile
  data_coverage: {
    overall_coverage: 'full' | 'partial' | 'minimal'
    missing_fields: string[]
  }
  meta: {
    db_last_refreshed: string | null
    response_time_ms: number
    stored_on_application: boolean
  }
}

// ── Endpoint 2 request / response ────────────────────────────────────────────

export interface DeclaredHealth {
  is_smoker: boolean
  cigarettes_per_day?: number | null
  alcohol_consumption: 'none' | 'occasional' | 'regular' | 'heavy'
  ped_conditions: {
    diabetes: boolean
    hypertension: boolean
    heart_disease: boolean
    asthma: boolean
    kidney_disease: boolean
    cancer: boolean
    thyroid: boolean
    arthritis: boolean
    respiratory_disorder?: boolean
    copd?: boolean
  }
  bmi?: number | null
  has_disability?: boolean
}

export interface CoverInfo {
  sum_insured: number
  cover_type: 'individual' | 'family_floater' | 'parents'
  proposer_age: number
}

export interface RiskFlagsRequest {
  application_id: string
  pincode: string
  declared_health: DeclaredHealth
  cover: CoverInfo
}

export interface RiskFlags {
  respiratory_risk_flag: boolean
  respiratory_risk_reason: string | null
  respiratory_risk_severity: 'low' | 'medium' | 'high' | null

  nuralx_mandatory: boolean
  nuralx_mandatory_reason: string | null

  disaster_risk_flag: boolean
  heat_mortality_flag: boolean

  medical_exam_flag: boolean
  medical_exam_reason: string | null
  medical_exam_threshold_applied: number | null

  stp_refer_flag: boolean
  stp_refer_reasons: string[]
  stp_refer_weight: number
}

export interface UwContext {
  summary: string
  key_signals: string[]
}

export interface RiskFlagsResponse {
  flags: RiskFlags
  uw_context: UwContext
  meta: {
    flags_computed_at: string
    stored_on_application: boolean
  }
}

// ── Endpoint 3 response ──────────────────────────────────────────────────────

export interface AqiHistoryPoint {
  year: number
  month: number
  month_name: string
  pm25?: { value: number | null; data_quality: DataQuality }
  pm10?: { value: number | null; data_quality: DataQuality }
  no2?: { value: number | null; data_quality: DataQuality }
  so2?: { value: number | null; data_quality: DataQuality }
  co?: { value: number | null; data_quality: DataQuality }
  o3?: { value: number | null; data_quality: DataQuality }
  aqi?: { value: number | null; category: AqiCategory | null }
}

export interface AqiHistoryResponse {
  district_name: string
  state_name: string
  series: AqiHistoryPoint[]
  summary: {
    annual_means: Array<{ year: number; pm25_mean: number | null; aqi_mean: number | null }>
    worst_month_ever: {
      year: number; month: number; month_name: string
      pm25: number | null; aqi: number | null; category: AqiCategory | null
    } | null
    best_month_ever: {
      year: number; month: number; month_name: string
      pm25: number | null; aqi: number | null; category: AqiCategory | null
    } | null
    trend: 'improving' | 'worsening' | 'stable'
  }
  meta: {
    total_months: number
    months_with_measured_data: number
    months_gap_filled: number
    gap_filled_months: string[]
  }
}

// ── Water quality types ──────────────────────────────────────────────────────

export type WaterRiskLevel = 'low' | 'moderate' | 'high' | 'very_high'
export type ContaminantType = 'fluoride' | 'arsenic' | 'nitrate'
export type HealthRiskSeverity = 'low' | 'moderate' | 'high'

export interface ContaminantProfile {
  pct_exceeding: number | null
  samples_analyzed: number | null
  samples_exceeding: number | null
  risk_level: WaterRiskLevel | null
  bis_limit: number
  unit: string
}

export interface WaterHealthRisk {
  risk_code: string
  display_label: string
  severity: HealthRiskSeverity
  clinical_basis: string | null
}

export interface WaterQualityLookup {
  state_name: string
  pincode_provided: string | null
  resolution: 'state'
  note: string
}

export interface WaterQualityStateResponse {
  lookup: WaterQualityLookup
  contaminants: {
    fluoride: ContaminantProfile
    arsenic: ContaminantProfile
    nitrate: ContaminantProfile
  }
  overall_water_risk: WaterRiskLevel | null
  known_high_risk_districts: string[]
  health_risks: {
    fluoride: WaterHealthRisk[]
    arsenic: WaterHealthRisk[]
    nitrate: WaterHealthRisk[]
  }
  uw_summary: string
  data_coverage: {
    overall_coverage: 'full' | 'partial' | 'minimal'
    missing_contaminants: ContaminantType[]
  }
  meta: {
    monitoring_season: string | null
    data_source: string
    data_as_of_year: number | null
    response_time_ms: number
  }
}

export interface WaterHotspot {
  hotspot_no: number | null
  state_name: string
  district: string
  block_taluka: string | null
  village: string | null
  lat: number | null
  lng: number | null
  source_type: string | null
  contaminant: ContaminantType
  concentration: number
  unit: string
  bis_limit: number
  exceedance_factor: number | null
  severity: WaterRiskLevel | null
}

export interface WaterHotspotsResponse {
  lookup: {
    state_name: string
    pincode_provided: string | null
    resolution: 'state'
    note: string
  }
  hotspots: WaterHotspot[]
  summary: {
    total_hotspots: number
    fluoride_hotspots: number
    arsenic_hotspots: number
    nitrate_hotspots: number
    worst_contaminant: ContaminantType | null
    max_exceedance_factor: number | null
  }
  meta: {
    data_source: string
    data_as_of_year: number | null
    response_time_ms: number
  }
}

// ── What gets stored on applications.geographic_risk ─────────────────────────

export interface GeographicRisk {
  district_name: string
  state_name: string
  pincode: string
  lat: number
  lng: number
  pm25_mean_5yr: number | null
  pm25_zone: string | null
  aqi_annual_mean: number | null
  aqi_worst_month: number | null
  aqi_category: AqiCategory | null
  aqi_limiting_pollutant: string | null
  no2_mean_5yr: number | null
  disaster_frequency_score: number | null
  heat_wave_days_per_year: number | null
  hypertension_pct: number | null
  diabetes_pct: number | null
  composite_risk_score: number
  risk_tier: RiskTier
  // Flags added by Endpoint 2
  respiratory_risk_flag?: boolean
  nuralx_mandatory?: boolean
  disaster_risk_flag?: boolean
  heat_mortality_flag?: boolean
  medical_exam_flag?: boolean
  stp_refer_flag?: boolean
  stp_refer_weight?: number
  data_fetched_at: string
  db_last_refreshed: string | null
}
