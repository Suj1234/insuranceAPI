/**
 * Run schema migrations against the Neon database.
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const envVars = {}
try {
  const content = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    envVars[k] = v
  }
} catch { /* rely on process.env */ }

const databaseUrl = process.env.DATABASE_URL ?? envVars.DATABASE_URL
if (!databaseUrl) { console.error('DATABASE_URL not set'); process.exit(1) }

const { neon } = await import('@neondatabase/serverless')
const sql = neon(databaseUrl)

const statements = [
  `CREATE TABLE IF NOT EXISTS "api_call_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "api_key" text NOT NULL,
    "endpoint" text NOT NULL,
    "method" text DEFAULT 'GET' NOT NULL,
    "query_params" text,
    "status_code" integer NOT NULL,
    "latency_ms" integer,
    "user_agent" text,
    "ip_address" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "docs_users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "name" text NOT NULL,
    "api_key" text NOT NULL,
    "role" text DEFAULT 'developer' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "docs_users_email_unique" UNIQUE("email"),
    CONSTRAINT "docs_users_api_key_unique" UNIQUE("api_key")
  )`,
  `CREATE TABLE IF NOT EXISTS "district_air_quality" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "district_name" text NOT NULL,
    "state_name" text NOT NULL,
    "district_code" text,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "pm25_raw_sedac" numeric(6,2),
    "pm25_raw_cpcb" numeric(6,2),
    "pm25_raw_cams" numeric(6,2),
    "pm25_calibrated" numeric(6,2) NOT NULL,
    "pm25_source" text NOT NULL,
    "pm25_bias_factor" numeric(5,4),
    "pm10_raw_cpcb" numeric(6,2),
    "pm10_raw_cams" numeric(6,2),
    "pm10_calibrated" numeric(6,2),
    "pm10_source" text,
    "no2_cams" numeric(6,2),
    "no2_source" text DEFAULT 'cams_eac4',
    "so2_cams" numeric(6,2),
    "so2_source" text DEFAULT 'cams_eac4',
    "co_cams" numeric(8,2),
    "co_source" text DEFAULT 'cams_eac4',
    "o3_cams" numeric(6,2),
    "o3_source" text DEFAULT 'cams_eac4',
    "aqi_pm25_subindex" numeric(6,2),
    "aqi_pm10_subindex" numeric(6,2),
    "aqi_no2_subindex" numeric(6,2),
    "aqi_so2_subindex" numeric(6,2),
    "aqi_co_subindex" numeric(6,2),
    "aqi_o3_subindex" numeric(6,2),
    "aqi_representative" numeric(6,2),
    "aqi_limiting_pollutant" text,
    "aqi_category" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "district_air_quality_district_name_state_name_year_month_unique" UNIQUE("district_name","state_name","year","month")
  )`,
  `CREATE TABLE IF NOT EXISTS "district_risk_index" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "district_name" text NOT NULL,
    "state_name" text NOT NULL,
    "district_code" text,
    "pm25_mean_3yr" numeric(6,2),
    "pm25_mean_5yr" numeric(6,2),
    "pm25_mean_20yr" numeric(6,2),
    "pm25_worst_month_avg" numeric(6,2),
    "pm25_zone" text,
    "pm25_data_source" text,
    "pm25_trend_5yr_pct" numeric(6,2),
    "pm25_trend_direction" text,
    "pm25_3yr_from_year" integer,
    "pm25_3yr_to_year" integer,
    "pm25_5yr_from_year" integer,
    "pm25_5yr_to_year" integer,
    "pm25_national_pctile" numeric(5,1),
    "composite_national_pctile" numeric(5,1),
    "pm10_mean_5yr" numeric(6,2),
    "pm10_worst_month_avg" numeric(6,2),
    "pm10_zone" text,
    "aqi_annual_mean" numeric(6,2),
    "aqi_worst_month" numeric(6,2),
    "aqi_worst_month_name" text,
    "aqi_worst_year" integer,
    "aqi_category_5yr" text,
    "aqi_limiting_pollutant" text,
    "no2_mean_5yr" numeric(6,2),
    "no2_zone" text,
    "so2_mean_5yr" numeric(6,2),
    "so2_zone" text,
    "co_mean_5yr" numeric(8,2),
    "co_zone" text,
    "o3_mean_5yr" numeric(6,2),
    "o3_zone" text,
    "heat_wave_days_per_year" integer,
    "heat_stress_zone" text,
    "flood_events_per_decade" numeric(4,1),
    "cyclone_events_per_decade" numeric(4,1),
    "earthquake_events_per_decade" numeric(4,1),
    "disaster_insurance_loss_cr" numeric(10,2),
    "disaster_frequency_score" numeric(4,1),
    "hypertension_pct" numeric(5,2),
    "diabetes_pct" numeric(5,2),
    "obesity_pct" numeric(5,2),
    "tobacco_use_pct" numeric(5,2),
    "anaemia_pct" numeric(5,2),
    "composite_risk_score" numeric(5,2),
    "risk_tier" text,
    "data_as_of_year" integer,
    "last_refreshed_at" timestamptz,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "district_risk_index_district_name_state_name_unique" UNIQUE("district_name","state_name")
  )`,
  `CREATE TABLE IF NOT EXISTS "pincode_coords" (
    "pincode" varchar(6) PRIMARY KEY NOT NULL,
    "district_name" text NOT NULL,
    "state_name" text NOT NULL,
    "lat" numeric(9,6) NOT NULL,
    "lng" numeric(9,6) NOT NULL,
    "district_code" text,
    "city_tier" integer,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "pincode_risk_index" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "pincode" varchar(10) NOT NULL,
    "district_name" text,
    "state_name" text,
    "lat" numeric(9,6),
    "lng" numeric(9,6),
    "no2_ppb" numeric(7,3),
    "so2_ppb" numeric(7,3),
    "co_ppm" numeric(7,3),
    "o3_ppb" numeric(7,3),
    "pm25_cams_ug" numeric(7,2),
    "pm10_cams_ug" numeric(7,2),
    "pm25_sedac_ug" numeric(7,2),
    "pm25_blended_ug" numeric(7,2),
    "pm25_blended_3yr_ug" numeric(7,2),
    "pm25_trend_5yr_pct" numeric(6,2),
    "pm25_trend_direction" text,
    "pm25_3yr_from_year" integer,
    "pm25_3yr_to_year" integer,
    "pm25_5yr_from_year" integer,
    "pm25_5yr_to_year" integer,
    "pm25_national_pctile" numeric(5,1),
    "composite_national_pctile" numeric(5,1),
    "heat_wave_months_per_year" numeric(4,2),
    "hypertension_pct" numeric(5,2),
    "diabetes_pct" numeric(5,2),
    "obesity_pct" numeric(5,2),
    "tobacco_use_pct" numeric(5,2),
    "anaemia_pct" numeric(5,2),
    "flood_events_per_decade" numeric(5,2),
    "cyclone_events_per_decade" numeric(5,2),
    "earthquake_events_per_decade" numeric(5,2),
    "disaster_insurance_loss_cr" numeric(10,2),
    "disaster_frequency_score" numeric(4,2),
    "composite_risk_score" numeric(5,2) NOT NULL,
    "risk_tier" text NOT NULL,
    "score_pm25" numeric(5,2),
    "score_aqi" numeric(5,2),
    "score_no2" numeric(5,2),
    "score_heat" numeric(5,2),
    "score_disease" numeric(5,2),
    "score_disaster" numeric(5,2),
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "pincode_risk_index_pincode_unique" UNIQUE("pincode")
  )`,
  `CREATE TABLE IF NOT EXISTS "water_contaminant_health_risks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "contaminant" text NOT NULL,
    "risk_code" text NOT NULL,
    "display_label" text NOT NULL,
    "severity" text NOT NULL,
    "clinical_basis" text,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "water_contaminant_health_risks_contaminant_risk_code_unique" UNIQUE("contaminant","risk_code")
  )`,
  `CREATE TABLE IF NOT EXISTS "water_quality_hotspots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "hotspot_no" integer,
    "state_name" text NOT NULL,
    "district" text NOT NULL,
    "block_taluka" text,
    "village" text,
    "lat" numeric(9,6),
    "lng" numeric(9,6),
    "source_type" text,
    "contaminant" text NOT NULL,
    "concentration" numeric(10,4) NOT NULL,
    "unit" text NOT NULL,
    "bis_limit" numeric(8,4) NOT NULL,
    "exceedance_factor" numeric(8,3),
    "severity" text,
    "data_as_of_year" integer,
    "data_source" text DEFAULT 'cgwb_annual_report',
    "created_at" timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "water_quality_state" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "state_name" text NOT NULL,
    "fluoride_pct_exceeding" numeric(5,2),
    "fluoride_risk_level" text,
    "fluoride_samples_analyzed" integer,
    "fluoride_samples_exceeding" integer,
    "nitrate_pct_exceeding" numeric(5,2),
    "nitrate_risk_level" text,
    "nitrate_samples_analyzed" integer,
    "nitrate_samples_exceeding" integer,
    "arsenic_pct_exceeding" numeric(5,2),
    "arsenic_risk_level" text,
    "arsenic_samples_analyzed" integer,
    "arsenic_samples_exceeding" integer,
    "overall_water_risk" text,
    "total_samples_in_state" integer,
    "known_high_risk_districts" text[] DEFAULT '{}',
    "monitoring_season" text,
    "data_source" text DEFAULT 'cgwb_annual_report',
    "data_as_of_year" integer,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "water_quality_state_state_name_unique" UNIQUE("state_name")
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS "idx_acl_api_key" ON "api_call_logs" ("api_key")`,
  `CREATE INDEX IF NOT EXISTS "idx_acl_endpoint" ON "api_call_logs" ("endpoint")`,
  `CREATE INDEX IF NOT EXISTS "idx_acl_created_at" ON "api_call_logs" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_daq_district_year" ON "district_air_quality" ("district_name","state_name","year")`,
  `CREATE INDEX IF NOT EXISTS "idx_daq_year_month" ON "district_air_quality" ("year","month")`,
  `CREATE INDEX IF NOT EXISTS "idx_dri_district" ON "district_risk_index" ("district_name","state_name")`,
  `CREATE INDEX IF NOT EXISTS "idx_dri_pm25_zone" ON "district_risk_index" ("pm25_zone")`,
  `CREATE INDEX IF NOT EXISTS "idx_dri_risk_tier" ON "district_risk_index" ("risk_tier")`,
  `CREATE INDEX IF NOT EXISTS "idx_du_email" ON "docs_users" ("email")`,
  `CREATE INDEX IF NOT EXISTS "idx_du_api_key" ON "docs_users" ("api_key")`,
  `CREATE INDEX IF NOT EXISTS "idx_pc_district" ON "pincode_coords" ("district_name","state_name")`,
  `CREATE INDEX IF NOT EXISTS "idx_pri_pincode" ON "pincode_risk_index" ("pincode")`,
  `CREATE INDEX IF NOT EXISTS "idx_pri_district" ON "pincode_risk_index" ("district_name","state_name")`,
  `CREATE INDEX IF NOT EXISTS "idx_pri_risk_tier" ON "pincode_risk_index" ("risk_tier")`,
  `CREATE INDEX IF NOT EXISTS "idx_wchr_contaminant" ON "water_contaminant_health_risks" ("contaminant")`,
  `CREATE INDEX IF NOT EXISTS "idx_wqh_state" ON "water_quality_hotspots" ("state_name")`,
  `CREATE INDEX IF NOT EXISTS "idx_wqh_contaminant" ON "water_quality_hotspots" ("contaminant")`,
  `CREATE INDEX IF NOT EXISTS "idx_wqh_state_cont" ON "water_quality_hotspots" ("state_name","contaminant")`,
  `CREATE INDEX IF NOT EXISTS "idx_wqs_state_name" ON "water_quality_state" ("state_name")`,
  `CREATE INDEX IF NOT EXISTS "idx_wqs_overall_risk" ON "water_quality_state" ("overall_water_risk")`,
]

console.log(`Running ${statements.length} migration statements...`)
for (const stmt of statements) {
  const label = stmt.trim().split('\n')[0].slice(0, 60)
  try {
    await sql.call(sql, stmt)
    console.log(`  ✓ ${label}`)
  } catch (err) {
    console.error(`  ✗ ${label}`)
    console.error('    ', err.message)
    process.exit(1)
  }
}
console.log('\n✓ All tables and indexes created.')
