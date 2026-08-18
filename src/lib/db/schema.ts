import {
  pgTable, text, varchar, integer, decimal, uuid, timestamp,
  index, unique, boolean, jsonb,
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
// TABLE: pincode_flood_index  (one row per pincode — all raw flood columns)
// ────────────────────────────────────────────────────────────────────────────
export const pincodeFloodIndex = pgTable(
  'pincode_flood_index',
  {
    // Identity
    pincode:      varchar('pincode', { length: 6 }).primaryKey(),
    districtName: text('district_name'),
    stateName:    text('state_name'),
    lat:          decimal('lat', { precision: 9, scale: 6 }),
    lng:          decimal('lng', { precision: 9, scale: 6 }),

    // JRC GloFAS v2.1 — null = outside 90m flood zone (correct, not missing)
    jrcRp10DepthM:    decimal('jrc_rp10_depth_m',  { precision: 6, scale: 2 }),
    jrcRp20DepthM:    decimal('jrc_rp20_depth_m',  { precision: 6, scale: 2 }),
    jrcRp50DepthM:    decimal('jrc_rp50_depth_m',  { precision: 6, scale: 2 }),
    jrcRp75DepthM:    decimal('jrc_rp75_depth_m',  { precision: 6, scale: 2 }),
    jrcRp100DepthM:   decimal('jrc_rp100_depth_m', { precision: 6, scale: 2 }),
    jrcRp200DepthM:   decimal('jrc_rp200_depth_m', { precision: 6, scale: 2 }),
    jrcRp500DepthM:   decimal('jrc_rp500_depth_m', { precision: 6, scale: 2 }),
    jrcRp100Class:    integer('jrc_rp100_class'),          // 0=no hazard..4=severe
    jrcSpuriousDepthFlag: integer('jrc_spurious_depth_flag'),

    // JRC Global Surface Water v1.4 (1984-2021) — null = never flooded
    gswOccurrencePct:    decimal('gsw_occurrence_pct',     { precision: 5, scale: 2 }),
    gswSeasonalityMonths: decimal('gsw_seasonality_months', { precision: 4, scale: 1 }),
    gswRecurrencePct:    decimal('gsw_recurrence_pct',     { precision: 5, scale: 2 }),
    gswTransitionClass:  integer('gsw_transition_class'),
    gswMaxExtent:        boolean('gsw_max_extent'),        // true = pixel ever water
    gswChangeAbs:        decimal('gsw_change_abs',         { precision: 5, scale: 2 }),

    // WRI Aqueduct v2 — 0 = outside flood zone; null = no data
    aqdRiverineRp100M:          decimal('aqd_riverine_rp100_m',           { precision: 6, scale: 3 }),
    aqdRiverineRp500M:          decimal('aqd_riverine_rp500_m',           { precision: 6, scale: 3 }),
    aqdCoastalRp100M:           decimal('aqd_coastal_rp100_m',            { precision: 6, scale: 3 }),
    aqdCoastalRp500M:           decimal('aqd_coastal_rp500_m',            { precision: 6, scale: 3 }),
    aqdCoastalRp100Wtsub2030M:  decimal('aqd_coastal_rp100_wtsub_2030_m', { precision: 6, scale: 3 }),
    aqd2030Rcp85Rp100M:         decimal('aqd_2030_rcp85_rp100_m',         { precision: 6, scale: 3 }),
    aqd2050Rcp45Rp100M:         decimal('aqd_2050_rcp45_rp100_m',         { precision: 6, scale: 3 }),
    aqd2050Rcp85Rp100M:         decimal('aqd_2050_rcp85_rp100_m',         { precision: 6, scale: 3 }),
    aqd2080Rcp85Rp100M:         decimal('aqd_2080_rcp85_rp100_m',         { precision: 6, scale: 3 }),

    // MERIT Hydro HAND — height above nearest drainage (terrain flood proxy)
    handElevationM:    decimal('hand_elevation_m', { precision: 6, scale: 2 }),

    // ESA WorldCover 2021 (fraction within 500m buffer)
    imperviousSurfacePct: decimal('impervious_surface_pct', { precision: 5, scale: 2 }),
    mangroveCoverPct:     decimal('mangrove_cover_pct',     { precision: 5, scale: 2 }),

    // HydroRIVERS v1.0
    distanceToRiverKm: decimal('distance_to_river_km', { precision: 7, scale: 3 }),

    // Global Dam Watch v1.0 (nearest upstream dam within 100km)
    upstreamDamPresent:  boolean('upstream_dam_present'),
    upstreamDamName:     text('upstream_dam_name'),
    upstreamDamType:     text('upstream_dam_type'),      // flood_control/irrigation/hydropower/multipurpose
    upstreamDamHeightM:  decimal('upstream_dam_height_m', { precision: 6, scale: 1 }),
    upstreamDamRiver:    text('upstream_dam_river'),
    upstreamDamMainUse:  text('upstream_dam_main_use'),  // raw GDW MAIN_USE field
    upstreamDamYear:     integer('upstream_dam_year'),

    // NDMA flood-prone district (joined from district list)
    ndmaFloodProneDistrict: boolean('ndma_flood_prone_district'),

    // IMD rainfall 0.25° (1981-2020 climatology)
    imdAnnualRainfallMm:     decimal('imd_annual_rainfall_mm',       { precision: 7, scale: 1 }),
    imdExtremeRainDaysPerYr: decimal('imd_extreme_rain_days_per_yr', { precision: 5, scale: 2 }),

    // EM-DAT historical disasters (district level, joined)
    emdatFloodEventsPerDecade: decimal('emdat_flood_events_per_decade', { precision: 5, scale: 1 }),
    emdatFloodLossCr:          decimal('emdat_flood_loss_cr',           { precision: 10, scale: 2 }),

    // Computed flood risk score (0-100)
    floodRiskScore: decimal('flood_risk_score', { precision: 5, scale: 2 }),
    floodRiskClass: text('flood_risk_class'),   // Low / Medium / High / Very High

    // Component sub-scores
    scoreGlofas:   decimal('score_glofas',   { precision: 5, scale: 2 }),
    scoreGsw:      decimal('score_gsw',      { precision: 5, scale: 2 }),
    scoreAqueduct: decimal('score_aqueduct', { precision: 5, scale: 2 }),
    scoreHand:     decimal('score_hand',     { precision: 5, scale: 2 }),
    scoreRainfall: decimal('score_rainfall', { precision: 5, scale: 2 }),
    scoreDam:      decimal('score_dam',      { precision: 5, scale: 2 }),

    dataAsOfDate: text('data_as_of_date'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    districtIdx:  index('idx_pfi_district').on(t.districtName, t.stateName),
    stateIdx:     index('idx_pfi_state').on(t.stateName),
    riskClassIdx: index('idx_pfi_risk_class').on(t.floodRiskClass),
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
// TABLE: pincode_aqueduct  (WRI Aqueduct Floods v2 — full expansion, 231 cols)
// Riverine baseline (7) + projections (42) + coastal nosub (91) + wtsub (91)
// ────────────────────────────────────────────────────────────────────────────
export const pincodeAqueduct = pgTable(
  'pincode_aqueduct',
  {
    pincode: varchar('pincode', { length: 6 }).primaryKey(),

    // ── Riverine baseline 1980 (WATCH reanalysis) — 7 return periods ────────
    riverineRp10M:   decimal('riverine_rp10_m',   { precision: 6, scale: 3 }),
    riverineRp25M:   decimal('riverine_rp25_m',   { precision: 6, scale: 3 }),
    riverineRp50M:   decimal('riverine_rp50_m',   { precision: 6, scale: 3 }),
    riverineRp100M:  decimal('riverine_rp100_m',  { precision: 6, scale: 3 }),
    riverineRp250M:  decimal('riverine_rp250_m',  { precision: 6, scale: 3 }),
    riverineRp500M:  decimal('riverine_rp500_m',  { precision: 6, scale: 3 }),
    riverineRp1000M: decimal('riverine_rp1000_m', { precision: 6, scale: 3 }),

    // ── Riverine projections — ensemble mean of 5 CMIP5 GCMs ─────────────────
    // rcp45_2030
    riverineRcp452030Rp10M:   decimal('riverine_rcp45_2030_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp452030Rp25M:   decimal('riverine_rcp45_2030_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp452030Rp50M:   decimal('riverine_rcp45_2030_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp452030Rp100M:  decimal('riverine_rcp45_2030_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp452030Rp250M:  decimal('riverine_rcp45_2030_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp452030Rp500M:  decimal('riverine_rcp45_2030_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp452030Rp1000M: decimal('riverine_rcp45_2030_rp1000_m', { precision: 6, scale: 3 }),
    // rcp85_2030
    riverineRcp852030Rp10M:   decimal('riverine_rcp85_2030_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp852030Rp25M:   decimal('riverine_rcp85_2030_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp852030Rp50M:   decimal('riverine_rcp85_2030_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp852030Rp100M:  decimal('riverine_rcp85_2030_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp852030Rp250M:  decimal('riverine_rcp85_2030_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp852030Rp500M:  decimal('riverine_rcp85_2030_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp852030Rp1000M: decimal('riverine_rcp85_2030_rp1000_m', { precision: 6, scale: 3 }),
    // rcp45_2050
    riverineRcp452050Rp10M:   decimal('riverine_rcp45_2050_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp452050Rp25M:   decimal('riverine_rcp45_2050_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp452050Rp50M:   decimal('riverine_rcp45_2050_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp452050Rp100M:  decimal('riverine_rcp45_2050_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp452050Rp250M:  decimal('riverine_rcp45_2050_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp452050Rp500M:  decimal('riverine_rcp45_2050_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp452050Rp1000M: decimal('riverine_rcp45_2050_rp1000_m', { precision: 6, scale: 3 }),
    // rcp85_2050
    riverineRcp852050Rp10M:   decimal('riverine_rcp85_2050_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp852050Rp25M:   decimal('riverine_rcp85_2050_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp852050Rp50M:   decimal('riverine_rcp85_2050_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp852050Rp100M:  decimal('riverine_rcp85_2050_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp852050Rp250M:  decimal('riverine_rcp85_2050_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp852050Rp500M:  decimal('riverine_rcp85_2050_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp852050Rp1000M: decimal('riverine_rcp85_2050_rp1000_m', { precision: 6, scale: 3 }),
    // rcp45_2080
    riverineRcp452080Rp10M:   decimal('riverine_rcp45_2080_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp452080Rp25M:   decimal('riverine_rcp45_2080_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp452080Rp50M:   decimal('riverine_rcp45_2080_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp452080Rp100M:  decimal('riverine_rcp45_2080_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp452080Rp250M:  decimal('riverine_rcp45_2080_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp452080Rp500M:  decimal('riverine_rcp45_2080_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp452080Rp1000M: decimal('riverine_rcp45_2080_rp1000_m', { precision: 6, scale: 3 }),
    // rcp85_2080
    riverineRcp852080Rp10M:   decimal('riverine_rcp85_2080_rp10_m',   { precision: 6, scale: 3 }),
    riverineRcp852080Rp25M:   decimal('riverine_rcp85_2080_rp25_m',   { precision: 6, scale: 3 }),
    riverineRcp852080Rp50M:   decimal('riverine_rcp85_2080_rp50_m',   { precision: 6, scale: 3 }),
    riverineRcp852080Rp100M:  decimal('riverine_rcp85_2080_rp100_m',  { precision: 6, scale: 3 }),
    riverineRcp852080Rp250M:  decimal('riverine_rcp85_2080_rp250_m',  { precision: 6, scale: 3 }),
    riverineRcp852080Rp500M:  decimal('riverine_rcp85_2080_rp500_m',  { precision: 6, scale: 3 }),
    riverineRcp852080Rp1000M: decimal('riverine_rcp85_2080_rp1000_m', { precision: 6, scale: 3 }),

    // ── Coastal no-subsidence historical (~1986-2005) — 7 RPs, p95 only ─────
    coastalNosubHistRp10P95M:   decimal('coastal_nosub_hist_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubHistRp25P95M:   decimal('coastal_nosub_hist_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubHistRp50P95M:   decimal('coastal_nosub_hist_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubHistRp100P95M:  decimal('coastal_nosub_hist_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubHistRp250P95M:  decimal('coastal_nosub_hist_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubHistRp500P95M:  decimal('coastal_nosub_hist_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubHistRp1000P95M: decimal('coastal_nosub_hist_rp1000_p95_m', { precision: 6, scale: 3 }),

    // ── Coastal no-subsidence projected — 6 scenarios × 7 RPs × p95 + p50 ──
    // rcp45_2030
    coastalNosubRcp452030Rp10P95M:   decimal('coastal_nosub_rcp45_2030_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp10P50M:   decimal('coastal_nosub_rcp45_2030_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp25P95M:   decimal('coastal_nosub_rcp45_2030_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp25P50M:   decimal('coastal_nosub_rcp45_2030_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp50P95M:   decimal('coastal_nosub_rcp45_2030_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp50P50M:   decimal('coastal_nosub_rcp45_2030_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp100P95M:  decimal('coastal_nosub_rcp45_2030_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp100P50M:  decimal('coastal_nosub_rcp45_2030_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp250P95M:  decimal('coastal_nosub_rcp45_2030_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp250P50M:  decimal('coastal_nosub_rcp45_2030_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp500P95M:  decimal('coastal_nosub_rcp45_2030_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp500P50M:  decimal('coastal_nosub_rcp45_2030_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp1000P95M: decimal('coastal_nosub_rcp45_2030_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp452030Rp1000P50M: decimal('coastal_nosub_rcp45_2030_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2030
    coastalNosubRcp852030Rp10P95M:   decimal('coastal_nosub_rcp85_2030_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp10P50M:   decimal('coastal_nosub_rcp85_2030_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp25P95M:   decimal('coastal_nosub_rcp85_2030_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp25P50M:   decimal('coastal_nosub_rcp85_2030_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp50P95M:   decimal('coastal_nosub_rcp85_2030_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp50P50M:   decimal('coastal_nosub_rcp85_2030_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp100P95M:  decimal('coastal_nosub_rcp85_2030_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp100P50M:  decimal('coastal_nosub_rcp85_2030_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp250P95M:  decimal('coastal_nosub_rcp85_2030_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp250P50M:  decimal('coastal_nosub_rcp85_2030_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp500P95M:  decimal('coastal_nosub_rcp85_2030_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp500P50M:  decimal('coastal_nosub_rcp85_2030_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp1000P95M: decimal('coastal_nosub_rcp85_2030_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp852030Rp1000P50M: decimal('coastal_nosub_rcp85_2030_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp45_2050
    coastalNosubRcp452050Rp10P95M:   decimal('coastal_nosub_rcp45_2050_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp10P50M:   decimal('coastal_nosub_rcp45_2050_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp25P95M:   decimal('coastal_nosub_rcp45_2050_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp25P50M:   decimal('coastal_nosub_rcp45_2050_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp50P95M:   decimal('coastal_nosub_rcp45_2050_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp50P50M:   decimal('coastal_nosub_rcp45_2050_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp100P95M:  decimal('coastal_nosub_rcp45_2050_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp100P50M:  decimal('coastal_nosub_rcp45_2050_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp250P95M:  decimal('coastal_nosub_rcp45_2050_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp250P50M:  decimal('coastal_nosub_rcp45_2050_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp500P95M:  decimal('coastal_nosub_rcp45_2050_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp500P50M:  decimal('coastal_nosub_rcp45_2050_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp1000P95M: decimal('coastal_nosub_rcp45_2050_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp452050Rp1000P50M: decimal('coastal_nosub_rcp45_2050_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2050
    coastalNosubRcp852050Rp10P95M:   decimal('coastal_nosub_rcp85_2050_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp10P50M:   decimal('coastal_nosub_rcp85_2050_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp25P95M:   decimal('coastal_nosub_rcp85_2050_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp25P50M:   decimal('coastal_nosub_rcp85_2050_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp50P95M:   decimal('coastal_nosub_rcp85_2050_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp50P50M:   decimal('coastal_nosub_rcp85_2050_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp100P95M:  decimal('coastal_nosub_rcp85_2050_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp100P50M:  decimal('coastal_nosub_rcp85_2050_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp250P95M:  decimal('coastal_nosub_rcp85_2050_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp250P50M:  decimal('coastal_nosub_rcp85_2050_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp500P95M:  decimal('coastal_nosub_rcp85_2050_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp500P50M:  decimal('coastal_nosub_rcp85_2050_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp1000P95M: decimal('coastal_nosub_rcp85_2050_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp852050Rp1000P50M: decimal('coastal_nosub_rcp85_2050_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp45_2080
    coastalNosubRcp452080Rp10P95M:   decimal('coastal_nosub_rcp45_2080_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp10P50M:   decimal('coastal_nosub_rcp45_2080_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp25P95M:   decimal('coastal_nosub_rcp45_2080_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp25P50M:   decimal('coastal_nosub_rcp45_2080_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp50P95M:   decimal('coastal_nosub_rcp45_2080_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp50P50M:   decimal('coastal_nosub_rcp45_2080_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp100P95M:  decimal('coastal_nosub_rcp45_2080_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp100P50M:  decimal('coastal_nosub_rcp45_2080_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp250P95M:  decimal('coastal_nosub_rcp45_2080_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp250P50M:  decimal('coastal_nosub_rcp45_2080_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp500P95M:  decimal('coastal_nosub_rcp45_2080_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp500P50M:  decimal('coastal_nosub_rcp45_2080_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp1000P95M: decimal('coastal_nosub_rcp45_2080_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp452080Rp1000P50M: decimal('coastal_nosub_rcp45_2080_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2080
    coastalNosubRcp852080Rp10P95M:   decimal('coastal_nosub_rcp85_2080_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp10P50M:   decimal('coastal_nosub_rcp85_2080_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp25P95M:   decimal('coastal_nosub_rcp85_2080_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp25P50M:   decimal('coastal_nosub_rcp85_2080_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp50P95M:   decimal('coastal_nosub_rcp85_2080_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp50P50M:   decimal('coastal_nosub_rcp85_2080_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp100P95M:  decimal('coastal_nosub_rcp85_2080_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp100P50M:  decimal('coastal_nosub_rcp85_2080_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp250P95M:  decimal('coastal_nosub_rcp85_2080_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp250P50M:  decimal('coastal_nosub_rcp85_2080_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp500P95M:  decimal('coastal_nosub_rcp85_2080_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp500P50M:  decimal('coastal_nosub_rcp85_2080_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp1000P95M: decimal('coastal_nosub_rcp85_2080_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalNosubRcp852080Rp1000P50M: decimal('coastal_nosub_rcp85_2080_rp1000_p50_m', { precision: 6, scale: 3 }),

    // ── Coastal with-subsidence baseline_2030 — 7 RPs, p95 only ─────────────
    coastalWtsubHistRp10P95M:   decimal('coastal_wtsub_hist_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubHistRp25P95M:   decimal('coastal_wtsub_hist_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubHistRp50P95M:   decimal('coastal_wtsub_hist_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubHistRp100P95M:  decimal('coastal_wtsub_hist_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubHistRp250P95M:  decimal('coastal_wtsub_hist_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubHistRp500P95M:  decimal('coastal_wtsub_hist_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubHistRp1000P95M: decimal('coastal_wtsub_hist_rp1000_p95_m', { precision: 6, scale: 3 }),

    // ── Coastal with-subsidence projected — 6 scenarios × 7 RPs × p95 + p50 ─
    // rcp45_2030
    coastalWtsubRcp452030Rp10P95M:   decimal('coastal_wtsub_rcp45_2030_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp10P50M:   decimal('coastal_wtsub_rcp45_2030_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp25P95M:   decimal('coastal_wtsub_rcp45_2030_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp25P50M:   decimal('coastal_wtsub_rcp45_2030_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp50P95M:   decimal('coastal_wtsub_rcp45_2030_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp50P50M:   decimal('coastal_wtsub_rcp45_2030_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp100P95M:  decimal('coastal_wtsub_rcp45_2030_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp100P50M:  decimal('coastal_wtsub_rcp45_2030_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp250P95M:  decimal('coastal_wtsub_rcp45_2030_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp250P50M:  decimal('coastal_wtsub_rcp45_2030_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp500P95M:  decimal('coastal_wtsub_rcp45_2030_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp500P50M:  decimal('coastal_wtsub_rcp45_2030_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp1000P95M: decimal('coastal_wtsub_rcp45_2030_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp452030Rp1000P50M: decimal('coastal_wtsub_rcp45_2030_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2030
    coastalWtsubRcp852030Rp10P95M:   decimal('coastal_wtsub_rcp85_2030_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp10P50M:   decimal('coastal_wtsub_rcp85_2030_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp25P95M:   decimal('coastal_wtsub_rcp85_2030_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp25P50M:   decimal('coastal_wtsub_rcp85_2030_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp50P95M:   decimal('coastal_wtsub_rcp85_2030_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp50P50M:   decimal('coastal_wtsub_rcp85_2030_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp100P95M:  decimal('coastal_wtsub_rcp85_2030_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp100P50M:  decimal('coastal_wtsub_rcp85_2030_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp250P95M:  decimal('coastal_wtsub_rcp85_2030_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp250P50M:  decimal('coastal_wtsub_rcp85_2030_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp500P95M:  decimal('coastal_wtsub_rcp85_2030_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp500P50M:  decimal('coastal_wtsub_rcp85_2030_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp1000P95M: decimal('coastal_wtsub_rcp85_2030_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp852030Rp1000P50M: decimal('coastal_wtsub_rcp85_2030_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp45_2050
    coastalWtsubRcp452050Rp10P95M:   decimal('coastal_wtsub_rcp45_2050_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp10P50M:   decimal('coastal_wtsub_rcp45_2050_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp25P95M:   decimal('coastal_wtsub_rcp45_2050_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp25P50M:   decimal('coastal_wtsub_rcp45_2050_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp50P95M:   decimal('coastal_wtsub_rcp45_2050_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp50P50M:   decimal('coastal_wtsub_rcp45_2050_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp100P95M:  decimal('coastal_wtsub_rcp45_2050_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp100P50M:  decimal('coastal_wtsub_rcp45_2050_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp250P95M:  decimal('coastal_wtsub_rcp45_2050_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp250P50M:  decimal('coastal_wtsub_rcp45_2050_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp500P95M:  decimal('coastal_wtsub_rcp45_2050_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp500P50M:  decimal('coastal_wtsub_rcp45_2050_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp1000P95M: decimal('coastal_wtsub_rcp45_2050_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp452050Rp1000P50M: decimal('coastal_wtsub_rcp45_2050_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2050
    coastalWtsubRcp852050Rp10P95M:   decimal('coastal_wtsub_rcp85_2050_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp10P50M:   decimal('coastal_wtsub_rcp85_2050_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp25P95M:   decimal('coastal_wtsub_rcp85_2050_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp25P50M:   decimal('coastal_wtsub_rcp85_2050_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp50P95M:   decimal('coastal_wtsub_rcp85_2050_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp50P50M:   decimal('coastal_wtsub_rcp85_2050_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp100P95M:  decimal('coastal_wtsub_rcp85_2050_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp100P50M:  decimal('coastal_wtsub_rcp85_2050_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp250P95M:  decimal('coastal_wtsub_rcp85_2050_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp250P50M:  decimal('coastal_wtsub_rcp85_2050_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp500P95M:  decimal('coastal_wtsub_rcp85_2050_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp500P50M:  decimal('coastal_wtsub_rcp85_2050_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp1000P95M: decimal('coastal_wtsub_rcp85_2050_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp852050Rp1000P50M: decimal('coastal_wtsub_rcp85_2050_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp45_2080
    coastalWtsubRcp452080Rp10P95M:   decimal('coastal_wtsub_rcp45_2080_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp10P50M:   decimal('coastal_wtsub_rcp45_2080_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp25P95M:   decimal('coastal_wtsub_rcp45_2080_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp25P50M:   decimal('coastal_wtsub_rcp45_2080_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp50P95M:   decimal('coastal_wtsub_rcp45_2080_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp50P50M:   decimal('coastal_wtsub_rcp45_2080_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp100P95M:  decimal('coastal_wtsub_rcp45_2080_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp100P50M:  decimal('coastal_wtsub_rcp45_2080_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp250P95M:  decimal('coastal_wtsub_rcp45_2080_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp250P50M:  decimal('coastal_wtsub_rcp45_2080_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp500P95M:  decimal('coastal_wtsub_rcp45_2080_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp500P50M:  decimal('coastal_wtsub_rcp45_2080_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp1000P95M: decimal('coastal_wtsub_rcp45_2080_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp452080Rp1000P50M: decimal('coastal_wtsub_rcp45_2080_rp1000_p50_m', { precision: 6, scale: 3 }),
    // rcp85_2080
    coastalWtsubRcp852080Rp10P95M:   decimal('coastal_wtsub_rcp85_2080_rp10_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp10P50M:   decimal('coastal_wtsub_rcp85_2080_rp10_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp25P95M:   decimal('coastal_wtsub_rcp85_2080_rp25_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp25P50M:   decimal('coastal_wtsub_rcp85_2080_rp25_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp50P95M:   decimal('coastal_wtsub_rcp85_2080_rp50_p95_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp50P50M:   decimal('coastal_wtsub_rcp85_2080_rp50_p50_m',   { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp100P95M:  decimal('coastal_wtsub_rcp85_2080_rp100_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp100P50M:  decimal('coastal_wtsub_rcp85_2080_rp100_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp250P95M:  decimal('coastal_wtsub_rcp85_2080_rp250_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp250P50M:  decimal('coastal_wtsub_rcp85_2080_rp250_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp500P95M:  decimal('coastal_wtsub_rcp85_2080_rp500_p95_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp500P50M:  decimal('coastal_wtsub_rcp85_2080_rp500_p50_m',  { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp1000P95M: decimal('coastal_wtsub_rcp85_2080_rp1000_p95_m', { precision: 6, scale: 3 }),
    coastalWtsubRcp852080Rp1000P50M: decimal('coastal_wtsub_rcp85_2080_rp1000_p50_m', { precision: 6, scale: 3 }),

    dataAsOfDate: text('data_as_of_date'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  }
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: pincode_gsw_cache  (pre-computed GSW metrics — one row per pincode)
// ────────────────────────────────────────────────────────────────────────────
export const pincodeGswCache = pgTable(
  'pincode_gsw_cache',
  {
    pincode:    text('pincode').primaryKey(),
    data:       jsonb('data').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().default(now()),
  }
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: pincode_terrain  (standalone MERIT Hydro terrain API)
// ────────────────────────────────────────────────────────────────────────────
export const pincodeTerrain = pgTable(
  'pincode_terrain',
  {
    pincode:            varchar('pincode', { length: 6 }).primaryKey(),
    lat:                decimal('lat', { precision: 9, scale: 6 }),
    lon:                decimal('lon', { precision: 9, scale: 6 }),

    // Source — direct values from MERIT Hydro v1.0.1 raster
    handM:              decimal('hand_m',           { precision: 7, scale: 2 }),
    elevationM:         decimal('elevation_m',       { precision: 7, scale: 2 }),
    upstreamAreaKm2:    decimal('upstream_area_km2', { precision: 12, scale: 3 }),
    riverWidthM:        decimal('river_width_m',     { precision: 7, scale: 2 }),
    onPermanentWater:   boolean('on_permanent_water'),
    flowDirectionCode:  integer('flow_direction_code'),
    flowDirectionLabel: text('flow_direction_label'),

    // Calculated — derived from source values
    floodRiskClass:   text('flood_risk_class'),     // extreme/very_high/high/moderate/low/very_low
    coastalSurgeRisk: boolean('coastal_surge_risk'), // elevation_m < 5
    inlandDepression: boolean('inland_depression'),  // flow_direction_code == -1
    adjacentToRiver:  boolean('adjacent_to_river'),  // on_permanent_water OR river_width_m > 0

    dataAsOfDate: text('data_as_of_date'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    latLonIdx: index('idx_pter_lat_lon').on(t.lat, t.lon),
  })
)

// ────────────────────────────────────────────────────────────────────────────
// TABLE: pincode_land_cover  (standalone ESRI Land Cover API)
// One row per pincode. 64 raw columns (8 years × 8 bands) + 14 calculated.
// ────────────────────────────────────────────────────────────────────────────
export const pincodeLandCover = pgTable(
  'pincode_land_cover',
  {
    pincode: varchar('pincode', { length: 6 }).primaryKey(),
    lat:     decimal('lat', { precision: 9, scale: 6 }),
    lon:     decimal('lon', { precision: 9, scale: 6 }),

    // ── Raw: 2017 ────────────────────────────────────────────────────────────
    builtArea2017Pct:  decimal('built_area_pct_2017',  { precision: 5, scale: 2 }),
    trees2017Pct:      decimal('trees_pct_2017',        { precision: 5, scale: 2 }),
    crops2017Pct:      decimal('crops_pct_2017',        { precision: 5, scale: 2 }),
    water2017Pct:      decimal('water_pct_2017',        { precision: 5, scale: 2 }),
    floodedVeg2017Pct: decimal('flooded_veg_pct_2017', { precision: 5, scale: 2 }),
    grass2017Pct:      decimal('grass_pct_2017',        { precision: 5, scale: 2 }),
    scrubShrub2017Pct: decimal('scrub_shrub_pct_2017', { precision: 5, scale: 2 }),
    bareGround2017Pct: decimal('bare_ground_pct_2017', { precision: 5, scale: 2 }),

    // ── Raw: 2018 ────────────────────────────────────────────────────────────
    builtArea2018Pct:  decimal('built_area_pct_2018',  { precision: 5, scale: 2 }),
    trees2018Pct:      decimal('trees_pct_2018',        { precision: 5, scale: 2 }),
    crops2018Pct:      decimal('crops_pct_2018',        { precision: 5, scale: 2 }),
    water2018Pct:      decimal('water_pct_2018',        { precision: 5, scale: 2 }),
    floodedVeg2018Pct: decimal('flooded_veg_pct_2018', { precision: 5, scale: 2 }),
    grass2018Pct:      decimal('grass_pct_2018',        { precision: 5, scale: 2 }),
    scrubShrub2018Pct: decimal('scrub_shrub_pct_2018', { precision: 5, scale: 2 }),
    bareGround2018Pct: decimal('bare_ground_pct_2018', { precision: 5, scale: 2 }),

    // ── Raw: 2019 ────────────────────────────────────────────────────────────
    builtArea2019Pct:  decimal('built_area_pct_2019',  { precision: 5, scale: 2 }),
    trees2019Pct:      decimal('trees_pct_2019',        { precision: 5, scale: 2 }),
    crops2019Pct:      decimal('crops_pct_2019',        { precision: 5, scale: 2 }),
    water2019Pct:      decimal('water_pct_2019',        { precision: 5, scale: 2 }),
    floodedVeg2019Pct: decimal('flooded_veg_pct_2019', { precision: 5, scale: 2 }),
    grass2019Pct:      decimal('grass_pct_2019',        { precision: 5, scale: 2 }),
    scrubShrub2019Pct: decimal('scrub_shrub_pct_2019', { precision: 5, scale: 2 }),
    bareGround2019Pct: decimal('bare_ground_pct_2019', { precision: 5, scale: 2 }),

    // ── Raw: 2020 ────────────────────────────────────────────────────────────
    builtArea2020Pct:  decimal('built_area_pct_2020',  { precision: 5, scale: 2 }),
    trees2020Pct:      decimal('trees_pct_2020',        { precision: 5, scale: 2 }),
    crops2020Pct:      decimal('crops_pct_2020',        { precision: 5, scale: 2 }),
    water2020Pct:      decimal('water_pct_2020',        { precision: 5, scale: 2 }),
    floodedVeg2020Pct: decimal('flooded_veg_pct_2020', { precision: 5, scale: 2 }),
    grass2020Pct:      decimal('grass_pct_2020',        { precision: 5, scale: 2 }),
    scrubShrub2020Pct: decimal('scrub_shrub_pct_2020', { precision: 5, scale: 2 }),
    bareGround2020Pct: decimal('bare_ground_pct_2020', { precision: 5, scale: 2 }),

    // ── Raw: 2021 ────────────────────────────────────────────────────────────
    builtArea2021Pct:  decimal('built_area_pct_2021',  { precision: 5, scale: 2 }),
    trees2021Pct:      decimal('trees_pct_2021',        { precision: 5, scale: 2 }),
    crops2021Pct:      decimal('crops_pct_2021',        { precision: 5, scale: 2 }),
    water2021Pct:      decimal('water_pct_2021',        { precision: 5, scale: 2 }),
    floodedVeg2021Pct: decimal('flooded_veg_pct_2021', { precision: 5, scale: 2 }),
    grass2021Pct:      decimal('grass_pct_2021',        { precision: 5, scale: 2 }),
    scrubShrub2021Pct: decimal('scrub_shrub_pct_2021', { precision: 5, scale: 2 }),
    bareGround2021Pct: decimal('bare_ground_pct_2021', { precision: 5, scale: 2 }),

    // ── Raw: 2022 ────────────────────────────────────────────────────────────
    builtArea2022Pct:  decimal('built_area_pct_2022',  { precision: 5, scale: 2 }),
    trees2022Pct:      decimal('trees_pct_2022',        { precision: 5, scale: 2 }),
    crops2022Pct:      decimal('crops_pct_2022',        { precision: 5, scale: 2 }),
    water2022Pct:      decimal('water_pct_2022',        { precision: 5, scale: 2 }),
    floodedVeg2022Pct: decimal('flooded_veg_pct_2022', { precision: 5, scale: 2 }),
    grass2022Pct:      decimal('grass_pct_2022',        { precision: 5, scale: 2 }),
    scrubShrub2022Pct: decimal('scrub_shrub_pct_2022', { precision: 5, scale: 2 }),
    bareGround2022Pct: decimal('bare_ground_pct_2022', { precision: 5, scale: 2 }),

    // ── Raw: 2023 ────────────────────────────────────────────────────────────
    builtArea2023Pct:  decimal('built_area_pct_2023',  { precision: 5, scale: 2 }),
    trees2023Pct:      decimal('trees_pct_2023',        { precision: 5, scale: 2 }),
    crops2023Pct:      decimal('crops_pct_2023',        { precision: 5, scale: 2 }),
    water2023Pct:      decimal('water_pct_2023',        { precision: 5, scale: 2 }),
    floodedVeg2023Pct: decimal('flooded_veg_pct_2023', { precision: 5, scale: 2 }),
    grass2023Pct:      decimal('grass_pct_2023',        { precision: 5, scale: 2 }),
    scrubShrub2023Pct: decimal('scrub_shrub_pct_2023', { precision: 5, scale: 2 }),
    bareGround2023Pct: decimal('bare_ground_pct_2023', { precision: 5, scale: 2 }),

    // ── Raw: 2024 ────────────────────────────────────────────────────────────
    builtArea2024Pct:  decimal('built_area_pct_2024',  { precision: 5, scale: 2 }),
    trees2024Pct:      decimal('trees_pct_2024',        { precision: 5, scale: 2 }),
    crops2024Pct:      decimal('crops_pct_2024',        { precision: 5, scale: 2 }),
    water2024Pct:      decimal('water_pct_2024',        { precision: 5, scale: 2 }),
    floodedVeg2024Pct: decimal('flooded_veg_pct_2024', { precision: 5, scale: 2 }),
    grass2024Pct:      decimal('grass_pct_2024',        { precision: 5, scale: 2 }),
    scrubShrub2024Pct: decimal('scrub_shrub_pct_2024', { precision: 5, scale: 2 }),
    bareGround2024Pct: decimal('bare_ground_pct_2024', { precision: 5, scale: 2 }),

    // ── Calculated: precomputed at load time ──────────────────────────────────
    urbanGrowthRatePctPerYr: decimal('urban_growth_rate_pct_per_yr', { precision: 6, scale: 3 }),
    urbanGrowthClass:        text('urban_growth_class'),    // rapid/moderate/stable/declining
    builtAreaChangePct:      decimal('built_area_change_pct', { precision: 5, scale: 2 }),
    treesChangePct:          decimal('trees_change_pct',      { precision: 5, scale: 2 }),
    cropsChangePct:          decimal('crops_change_pct',      { precision: 5, scale: 2 }),
    waterChangePct:          decimal('water_change_pct',      { precision: 5, scale: 2 }),
    floodedVegChangePct:     decimal('flooded_veg_change_pct',{ precision: 5, scale: 2 }),
    grassChangePct:          decimal('grass_change_pct',      { precision: 5, scale: 2 }),
    greeneryLossPct:         decimal('greenery_loss_pct',     { precision: 5, scale: 2 }),
    croplandToUrbanPct:      decimal('cropland_to_urban_pct', { precision: 5, scale: 2 }),
    floodedVegMaxPct:        decimal('flooded_veg_max_pct',   { precision: 5, scale: 2 }),
    floodedVegetationTrend:  text('flooded_vegetation_trend'), // increasing/stable/decreasing
    dominantUse2017:         text('dominant_use_2017'),
    dominantUse2024:         text('dominant_use_2024'),
    landUseShifted:          boolean('land_use_shifted'),

    dataAsOfDate: text('data_as_of_date'),
    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().default(now()),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  },
  (t) => ({
    latLonIdx: index('idx_plc_lat_lon').on(t.lat, t.lon),
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
export type PincodeGswCache    = typeof pincodeGswCache.$inferSelect
export type NewPincodeGswCache = typeof pincodeGswCache.$inferInsert
export type PincodeAqueduct    = typeof pincodeAqueduct.$inferSelect
export type NewPincodeAqueduct = typeof pincodeAqueduct.$inferInsert
export type PincodeTerrain     = typeof pincodeTerrain.$inferSelect
export type NewPincodeTerrain  = typeof pincodeTerrain.$inferInsert
export type PincodeLandCover   = typeof pincodeLandCover.$inferSelect
export type NewPincodeLandCover = typeof pincodeLandCover.$inferInsert
