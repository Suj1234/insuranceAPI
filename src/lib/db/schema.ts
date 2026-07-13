import {
  pgTable, text, varchar, integer, decimal, uuid, timestamp,
  index, unique, boolean,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const now = () => sql<Date>`now()`
const genUuid = () => sql<string>`gen_random_uuid()`

// ────────────────────────────────────────────────────────────────────────────
// TABLE: docs_users  (portal login — replaces env-var credentials)
// ────────────────────────────────────────────────────────────────────────────
export const docsUsers = pgTable(
  'docs_users',
  {
    id:           uuid('id').primaryKey().$defaultFn(genUuid),
    email:        text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name:         text('name').notNull(),
    apiKey:       text('api_key').notNull().unique(),
    role:         text('role').notNull().default('developer'),  // developer | admin
    isActive:     boolean('is_active').notNull().default(true),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    emailIdx: index('idx_du_email').on(t.email),
    apiKeyIdx: index('idx_du_api_key').on(t.apiKey),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: api_call_logs  (per-request audit trail)
// ────────────────────────────────────────────────────────────────────────────
export const apiCallLogs = pgTable(
  'api_call_logs',
  {
    id:          uuid('id').primaryKey().$defaultFn(genUuid),
    apiKey:      text('api_key').notNull(),
    endpoint:    text('endpoint').notNull(),
    method:      text('method').notNull().default('GET'),
    queryParams: text('query_params'),
    statusCode:  integer('status_code').notNull(),
    latencyMs:   integer('latency_ms'),
    userAgent:   text('user_agent'),
    ipAddress:   text('ip_address'),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    apiKeyIdx:   index('idx_acl_api_key').on(t.apiKey),
    endpointIdx: index('idx_acl_endpoint').on(t.endpoint),
    createdIdx:  index('idx_acl_created_at').on(t.createdAt),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: pincode_coords
// ────────────────────────────────────────────────────────────────────────────
export const pincodeCoords = pgTable(
  'pincode_coords',
  {
    pincode:      varchar('pincode', { length: 6 }).primaryKey(),
    districtName: text('district_name').notNull(),
    stateName:    text('state_name').notNull(),
    lat:          decimal('lat', { precision: 9, scale: 6 }).notNull(),
    lng:          decimal('lng', { precision: 9, scale: 6 }).notNull(),
    districtCode: text('district_code'),
    cityTier:     integer('city_tier'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    districtIdx: index('idx_pc_district').on(t.districtName, t.stateName),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: district_air_quality  (time series — one row per district/year/month)
// ────────────────────────────────────────────────────────────────────────────
export const districtAirQuality = pgTable(
  'district_air_quality',
  {
    id:           uuid('id').primaryKey().$defaultFn(genUuid),
    districtName: text('district_name').notNull(),
    stateName:    text('state_name').notNull(),
    districtCode: text('district_code'),
    year:         integer('year').notNull(),
    month:        integer('month').notNull(),

    pm25RawSedac:    decimal('pm25_raw_sedac',    { precision: 6, scale: 2 }),
    pm25RawCpcb:     decimal('pm25_raw_cpcb',     { precision: 6, scale: 2 }),
    pm25RawCams:     decimal('pm25_raw_cams',     { precision: 6, scale: 2 }),
    pm25Calibrated:  decimal('pm25_calibrated',   { precision: 6, scale: 2 }).notNull(),
    pm25Source:      text('pm25_source').notNull(),
    pm25BiasFactor:  decimal('pm25_bias_factor',  { precision: 5, scale: 4 }),

    pm10RawCpcb:     decimal('pm10_raw_cpcb',     { precision: 6, scale: 2 }),
    pm10RawCams:     decimal('pm10_raw_cams',     { precision: 6, scale: 2 }),
    pm10Calibrated:  decimal('pm10_calibrated',   { precision: 6, scale: 2 }),
    pm10Source:      text('pm10_source'),

    no2Cams:  decimal('no2_cams', { precision: 6, scale: 2 }),
    no2Source: text('no2_source').default('cams_eac4'),
    so2Cams:  decimal('so2_cams', { precision: 6, scale: 2 }),
    so2Source: text('so2_source').default('cams_eac4'),
    coCams:   decimal('co_cams',  { precision: 8, scale: 2 }),
    coSource:  text('co_source').default('cams_eac4'),
    o3Cams:   decimal('o3_cams',  { precision: 6, scale: 2 }),
    o3Source:  text('o3_source').default('cams_eac4'),

    aqiPm25Subindex:    decimal('aqi_pm25_subindex',    { precision: 6, scale: 2 }),
    aqiPm10Subindex:    decimal('aqi_pm10_subindex',    { precision: 6, scale: 2 }),
    aqiNo2Subindex:     decimal('aqi_no2_subindex',     { precision: 6, scale: 2 }),
    aqiSo2Subindex:     decimal('aqi_so2_subindex',     { precision: 6, scale: 2 }),
    aqiCoSubindex:      decimal('aqi_co_subindex',      { precision: 6, scale: 2 }),
    aqiO3Subindex:      decimal('aqi_o3_subindex',      { precision: 6, scale: 2 }),
    aqiRepresentative:  decimal('aqi_representative',   { precision: 6, scale: 2 }),
    aqiLimitingPollutant: text('aqi_limiting_pollutant'),
    aqiCategory:        text('aqi_category'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    districtYearIdx: index('idx_daq_district_year').on(t.districtName, t.stateName, t.year),
    yearMonthIdx:    index('idx_daq_year_month').on(t.year, t.month),
    uniqueRow:       unique().on(t.districtName, t.stateName, t.year, t.month),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: district_risk_index  (aggregated — one row per district)
// ────────────────────────────────────────────────────────────────────────────
export const districtRiskIndex = pgTable(
  'district_risk_index',
  {
    id:           uuid('id').primaryKey().$defaultFn(genUuid),
    districtName: text('district_name').notNull(),
    stateName:    text('state_name').notNull(),
    districtCode: text('district_code'),

    pm25Mean3yr:      decimal('pm25_mean_3yr',      { precision: 6, scale: 2 }),
    pm25Mean5yr:      decimal('pm25_mean_5yr',      { precision: 6, scale: 2 }),
    pm25Mean20yr:     decimal('pm25_mean_20yr',     { precision: 6, scale: 2 }),
    pm25WorstMonthAvg: decimal('pm25_worst_month_avg', { precision: 6, scale: 2 }),
    pm25Zone:         text('pm25_zone'),
    pm25DataSource:   text('pm25_data_source'),

    pm25Trend5yrPct:   decimal('pm25_trend_5yr_pct',  { precision: 6, scale: 2 }),
    pm25TrendDirection: text('pm25_trend_direction'),
    pm253yrFromYear:   integer('pm25_3yr_from_year'),
    pm253yrToYear:     integer('pm25_3yr_to_year'),
    pm255yrFromYear:   integer('pm25_5yr_from_year'),
    pm255yrToYear:     integer('pm25_5yr_to_year'),

    pm25NationalPctile:      decimal('pm25_national_pctile',      { precision: 5, scale: 1 }),
    compositeNationalPctile: decimal('composite_national_pctile', { precision: 5, scale: 1 }),

    pm10Mean5yr:      decimal('pm10_mean_5yr',      { precision: 6, scale: 2 }),
    pm10WorstMonthAvg: decimal('pm10_worst_month_avg', { precision: 6, scale: 2 }),
    pm10Zone:         text('pm10_zone'),

    aqiAnnualMean:       decimal('aqi_annual_mean',  { precision: 6, scale: 2 }),
    aqiWorstMonth:       decimal('aqi_worst_month',  { precision: 6, scale: 2 }),
    aqiWorstMonthName:   text('aqi_worst_month_name'),
    aqiWorstYear:        integer('aqi_worst_year'),
    aqiCategory5yr:      text('aqi_category_5yr'),
    aqiLimitingPollutant: text('aqi_limiting_pollutant'),

    no2Mean5yr: decimal('no2_mean_5yr', { precision: 6, scale: 2 }),
    no2Zone:    text('no2_zone'),
    so2Mean5yr: decimal('so2_mean_5yr', { precision: 6, scale: 2 }),
    so2Zone:    text('so2_zone'),
    coMean5yr:  decimal('co_mean_5yr',  { precision: 8, scale: 2 }),
    coZone:     text('co_zone'),
    o3Mean5yr:  decimal('o3_mean_5yr',  { precision: 6, scale: 2 }),
    o3Zone:     text('o3_zone'),

    heatWaveDaysPerYear: integer('heat_wave_days_per_year'),
    heatStressZone:      text('heat_stress_zone'),

    floodEventsPerDecade:      decimal('flood_events_per_decade',      { precision: 4, scale: 1 }),
    cycloneEventsPerDecade:    decimal('cyclone_events_per_decade',    { precision: 4, scale: 1 }),
    earthquakeEventsPerDecade: decimal('earthquake_events_per_decade', { precision: 4, scale: 1 }),
    disasterInsuranceLossCr:   decimal('disaster_insurance_loss_cr',   { precision: 10, scale: 2 }),
    disasterFrequencyScore:    decimal('disaster_frequency_score',     { precision: 4, scale: 1 }),

    hypertensionPct: decimal('hypertension_pct', { precision: 5, scale: 2 }),
    diabetesPct:     decimal('diabetes_pct',     { precision: 5, scale: 2 }),
    obesityPct:      decimal('obesity_pct',      { precision: 5, scale: 2 }),
    tobaccoUsePct:   decimal('tobacco_use_pct',  { precision: 5, scale: 2 }),
    anaemiaPct:      decimal('anaemia_pct',      { precision: 5, scale: 2 }),

    compositeRiskScore: decimal('composite_risk_score', { precision: 5, scale: 2 }),
    riskTier:           text('risk_tier'),

    dataAsOfYear:    integer('data_as_of_year'),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    districtIdx:     index('idx_dri_district').on(t.districtName, t.stateName),
    pm25ZoneIdx:     index('idx_dri_pm25_zone').on(t.pm25Zone),
    riskTierIdx:     index('idx_dri_risk_tier').on(t.riskTier),
    uniqueDistrict:  unique().on(t.districtName, t.stateName),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: pincode_risk_index  (one row per pincode — lat/lng raster extraction)
// ────────────────────────────────────────────────────────────────────────────
export const pincodeRiskIndex = pgTable(
  'pincode_risk_index',
  {
    id:           uuid('id').primaryKey().$defaultFn(genUuid),
    pincode:      varchar('pincode', { length: 10 }).notNull(),
    districtName: text('district_name'),
    stateName:    text('state_name'),
    lat:          decimal('lat', { precision: 9, scale: 6 }),
    lng:          decimal('lng', { precision: 9, scale: 6 }),

    no2Ppb:     decimal('no2_ppb',     { precision: 7, scale: 3 }),
    so2Ppb:     decimal('so2_ppb',     { precision: 7, scale: 3 }),
    coPpm:      decimal('co_ppm',      { precision: 7, scale: 3 }),
    o3Ppb:      decimal('o3_ppb',      { precision: 7, scale: 3 }),
    pm25CamsUg: decimal('pm25_cams_ug', { precision: 7, scale: 2 }),
    pm10CamsUg: decimal('pm10_cams_ug', { precision: 7, scale: 2 }),

    pm25SedacUg:   decimal('pm25_sedac_ug',   { precision: 7, scale: 2 }),
    pm25BlendedUg: decimal('pm25_blended_ug', { precision: 7, scale: 2 }),

    pm25Blended3yrUg:  decimal('pm25_blended_3yr_ug', { precision: 7, scale: 2 }),
    pm25Trend5yrPct:   decimal('pm25_trend_5yr_pct',  { precision: 6, scale: 2 }),
    pm25TrendDirection: text('pm25_trend_direction'),
    pm253yrFromYear:   integer('pm25_3yr_from_year'),
    pm253yrToYear:     integer('pm25_3yr_to_year'),
    pm255yrFromYear:   integer('pm25_5yr_from_year'),
    pm255yrToYear:     integer('pm25_5yr_to_year'),

    pm25NationalPctile:      decimal('pm25_national_pctile',      { precision: 5, scale: 1 }),
    compositeNationalPctile: decimal('composite_national_pctile', { precision: 5, scale: 1 }),

    heatWaveMonthsPerYear: decimal('heat_wave_months_per_year', { precision: 4, scale: 2 }),

    hypertensionPct: decimal('hypertension_pct', { precision: 5, scale: 2 }),
    diabetesPct:     decimal('diabetes_pct',     { precision: 5, scale: 2 }),
    obesityPct:      decimal('obesity_pct',      { precision: 5, scale: 2 }),
    tobaccoUsePct:   decimal('tobacco_use_pct',  { precision: 5, scale: 2 }),
    anaemiaPct:      decimal('anaemia_pct',      { precision: 5, scale: 2 }),

    floodEventsPerDecade:      decimal('flood_events_per_decade',      { precision: 5, scale: 2 }),
    cycloneEventsPerDecade:    decimal('cyclone_events_per_decade',    { precision: 5, scale: 2 }),
    earthquakeEventsPerDecade: decimal('earthquake_events_per_decade', { precision: 5, scale: 2 }),
    disasterInsuranceLossCr:   decimal('disaster_insurance_loss_cr',   { precision: 10, scale: 2 }),
    disasterFrequencyScore:    decimal('disaster_frequency_score',     { precision: 4, scale: 2 }),

    compositeRiskScore: decimal('composite_risk_score', { precision: 5, scale: 2 }).notNull(),
    riskTier:           text('risk_tier').notNull(),

    scorePm25:    decimal('score_pm25',    { precision: 5, scale: 2 }),
    scoreAqi:     decimal('score_aqi',     { precision: 5, scale: 2 }),
    scoreNo2:     decimal('score_no2',     { precision: 5, scale: 2 }),
    scoreHeat:    decimal('score_heat',    { precision: 5, scale: 2 }),
    scoreDisease: decimal('score_disease', { precision: 5, scale: 2 }),
    scoreDisaster: decimal('score_disaster', { precision: 5, scale: 2 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    pincodeIdx:   index('idx_pri_pincode').on(t.pincode),
    districtIdx:  index('idx_pri_district').on(t.districtName, t.stateName),
    riskTierIdx:  index('idx_pri_risk_tier').on(t.riskTier),
    uniquePincode: unique().on(t.pincode),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// WATER QUALITY — STATE LEVEL
// ────────────────────────────────────────────────────────────────────────────
export const waterQualityState = pgTable(
  'water_quality_state',
  {
    id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    stateName: text('state_name').notNull().unique(),

    fluoridePctExceeding:     decimal('fluoride_pct_exceeding',    { precision: 5, scale: 2 }),
    fluorideRiskLevel:        text('fluoride_risk_level'),
    fluorideSamplesAnalyzed:  integer('fluoride_samples_analyzed'),
    fluorideSamplesExceeding: integer('fluoride_samples_exceeding'),

    nitratePctExceeding:     decimal('nitrate_pct_exceeding',     { precision: 5, scale: 2 }),
    nitrateRiskLevel:        text('nitrate_risk_level'),
    nitrateSamplesAnalyzed:  integer('nitrate_samples_analyzed'),
    nitrateSamplesExceeding: integer('nitrate_samples_exceeding'),

    arsenicPctExceeding:     decimal('arsenic_pct_exceeding',     { precision: 5, scale: 2 }),
    arsenicRiskLevel:        text('arsenic_risk_level'),
    arsenicSamplesAnalyzed:  integer('arsenic_samples_analyzed'),
    arsenicSamplesExceeding: integer('arsenic_samples_exceeding'),

    overallWaterRisk:       text('overall_water_risk'),
    totalSamplesInState:    integer('total_samples_in_state'),
    knownHighRiskDistricts: text('known_high_risk_districts').array().default(sql`'{}'::text[]`),

    monitoringSeason: text('monitoring_season'),
    dataSource:       text('data_source').default('cgwb_annual_report'),
    dataAsOfYear:     integer('data_as_of_year'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    stateNameIdx:  index('idx_wqs_state_name').on(t.stateName),
    overallRiskIdx: index('idx_wqs_overall_risk').on(t.overallWaterRisk),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// WATER QUALITY HOTSPOTS
// ────────────────────────────────────────────────────────────────────────────
export const waterQualityHotspots = pgTable(
  'water_quality_hotspots',
  {
    id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    hotspotNo:        integer('hotspot_no'),
    stateName:        text('state_name').notNull(),
    district:         text('district').notNull(),
    blockTaluka:      text('block_taluka'),
    village:          text('village'),
    lat:              decimal('lat', { precision: 9, scale: 6 }),
    lng:              decimal('lng', { precision: 9, scale: 6 }),
    sourceType:       text('source_type'),
    contaminant:      text('contaminant').notNull(),
    concentration:    decimal('concentration', { precision: 10, scale: 4 }).notNull(),
    unit:             text('unit').notNull(),
    bisLimit:         decimal('bis_limit',     { precision: 8, scale: 4 }).notNull(),
    exceedanceFactor: decimal('exceedance_factor', { precision: 8, scale: 3 }),
    severity:         text('severity'),
    dataAsOfYear:     integer('data_as_of_year'),
    dataSource:       text('data_source').default('cgwb_annual_report'),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    stateIdx:       index('idx_wqh_state').on(t.stateName),
    contaminantIdx: index('idx_wqh_contaminant').on(t.contaminant),
    stateContIdx:   index('idx_wqh_state_cont').on(t.stateName, t.contaminant),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// WATER CONTAMINANT HEALTH RISKS  (seed table)
// ────────────────────────────────────────────────────────────────────────────
export const waterContaminantHealthRisks = pgTable(
  'water_contaminant_health_risks',
  {
    id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    contaminant:   text('contaminant').notNull(),
    riskCode:      text('risk_code').notNull(),
    displayLabel:  text('display_label').notNull(),
    severity:      text('severity').notNull(),
    clinicalBasis: text('clinical_basis'),
    sortOrder:     integer('sort_order').notNull().default(0),
  },
  (t) => ({
    contaminantIdx: index('idx_wchr_contaminant').on(t.contaminant),
    uniqueRisk:     unique().on(t.contaminant, t.riskCode),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ────────────────────────────────────────────────────────────────────────────
export type DocsUser            = typeof docsUsers.$inferSelect
export type NewDocsUser         = typeof docsUsers.$inferInsert
export type ApiCallLog          = typeof apiCallLogs.$inferSelect
export type NewApiCallLog       = typeof apiCallLogs.$inferInsert
export type PincodeCoord        = typeof pincodeCoords.$inferSelect
export type NewPincodeCoord     = typeof pincodeCoords.$inferInsert
export type DistrictAirQuality  = typeof districtAirQuality.$inferSelect
export type NewDistrictAirQuality = typeof districtAirQuality.$inferInsert
export type DistrictRiskIndex   = typeof districtRiskIndex.$inferSelect
export type NewDistrictRiskIndex = typeof districtRiskIndex.$inferInsert
export type PincodeRiskIndex    = typeof pincodeRiskIndex.$inferSelect
export type NewPincodeRiskIndex = typeof pincodeRiskIndex.$inferInsert
export type WaterQualityState   = typeof waterQualityState.$inferSelect
export type NewWaterQualityState = typeof waterQualityState.$inferInsert
export type WaterQualityHotspot = typeof waterQualityHotspots.$inferSelect
export type NewWaterQualityHotspot = typeof waterQualityHotspots.$inferInsert
export type WaterContaminantHealthRisk = typeof waterContaminantHealthRisks.$inferSelect
export type NewWaterContaminantHealthRisk = typeof waterContaminantHealthRisks.$inferInsert
