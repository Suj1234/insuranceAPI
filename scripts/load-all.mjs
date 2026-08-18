/**
 * Load all environmental data tables into the new Neon DB.
 * Run from project root: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/load-all.mjs
 *
 * Load order:
 *  1. pincode_risk_index     (19,560 rows) — critical for district API
 *  2. district_risk_index    (676 rows)
 *  3. water_quality_state    (~34 rows)
 *  4. water_quality_hotspots (~400 rows)
 *  5. district_air_quality   (186,216 rows) — large, takes ~3 min
 *  6. pincode_coords         (165,627 rows, deduped) — fallback lookup
 *  7. pincode_aqueduct       (~19,561 rows) — WRI Aqueduct Floods v2
 */

import { readFileSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Read .env.local ───────────────────────────────────────────────────────────
const envVars = {}
try {
  const content = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    envVars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL ?? envVars.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const { neon } = await import('@neondatabase/serverless')
const sql = neon(DATABASE_URL)

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v) { return (v === '' || v === 'None' || v === 'nan' || v == null) ? null : Number(v) }
function str(v) { return (v === '' || v === 'None' || v == null) ? null : String(v).trim() }

function unquoteCsv(v) {
  if (v == null) return null
  const t = v.trim()
  // Strip surrounding double-quotes and unescape internal "" → "
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"')
  return t
}

async function readCsv(relPath) {
  const rows = []
  const rl = createInterface({ input: createReadStream(resolve(__dir, '..', relPath)), crlfDelay: Infinity })
  let headers = null
  for await (const line of rl) {
    if (!headers) { headers = line.split(',').map(h => unquoteCsv(h)); continue }
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => { obj[h] = unquoteCsv(vals[i]) ?? null })
    rows.push(obj)
  }
  return rows
}

async function runBatch(label, rows, batchSize, fn) {
  let ok = 0, fail = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    await Promise.all(batch.map(async r => {
      try { await fn(r); ok++ }
      catch (e) { fail++; if (fail <= 3) console.error(`  FAIL: ${e.message.slice(0, 120)}`) }
    }))
    if ((i + batchSize) % (batchSize * 20) === 0 || i + batchSize >= rows.length) {
      process.stdout.write(`\r  ${Math.min(i + batchSize, rows.length).toLocaleString()}/${rows.length.toLocaleString()} ${label}...`)
    }
  }
  console.log(`\n  Done: ${ok.toLocaleString()} ok, ${fail.toLocaleString()} failed`)
  return { ok, fail }
}

// ── 1. pincode_risk_index ─────────────────────────────────────────────────────
console.log('\n[1/7] pincode_risk_index...')
const pri = await readCsv('data/output/pincode_risk_index.csv')
console.log(`  ${pri.length.toLocaleString()} rows read`)
await sql`TRUNCATE TABLE pincode_risk_index`
await runBatch('pincodes', pri, 40, async r => {
  await sql`
    INSERT INTO pincode_risk_index (
      pincode, district_name, state_name, lat, lng,
      no2_ppb, so2_ppb, co_ppm, o3_ppb,
      pm25_cams_ug, pm10_cams_ug, pm25_sedac_ug, pm25_blended_ug,
      pm25_blended_3yr_ug, pm25_trend_5yr_pct, pm25_trend_direction,
      pm25_3yr_from_year, pm25_3yr_to_year, pm25_5yr_from_year, pm25_5yr_to_year,
      pm25_national_pctile, composite_national_pctile,
      heat_wave_months_per_year,
      hypertension_pct, diabetes_pct, obesity_pct, tobacco_use_pct, anaemia_pct,
      flood_events_per_decade, cyclone_events_per_decade, earthquake_events_per_decade,
      disaster_insurance_loss_cr, disaster_frequency_score,
      composite_risk_score, risk_tier,
      score_pm25, score_aqi, score_no2, score_heat, score_disease, score_disaster
    ) VALUES (
      ${str(r.pincode)}, ${str(r.district_name)}, ${str(r.state_name)},
      ${num(r.lat)}, ${num(r.lng)},
      ${num(r.no2_ppb)}, ${num(r.so2_ppb)}, ${num(r.co_ppm)}, ${num(r.o3_ppb)},
      ${num(r.pm25_cams_ug)}, ${num(r.pm10_cams_ug)}, ${num(r.pm25_sedac_ug)}, ${num(r.pm25_blended_ug)},
      ${num(r.pm25_blended_3yr_ug)}, ${num(r.pm25_trend_5yr_pct)}, ${str(r.pm25_trend_direction)},
      ${num(r.pm25_3yr_from_year)}, ${num(r.pm25_3yr_to_year)},
      ${num(r.pm25_5yr_from_year)}, ${num(r.pm25_5yr_to_year)},
      ${num(r.pm25_national_pctile)}, ${num(r.composite_national_pctile)},
      ${num(r.heat_wave_months_per_year)},
      ${num(r.hypertension_pct)}, ${num(r.diabetes_pct)}, ${num(r.obesity_pct)},
      ${num(r.tobacco_use_pct)}, ${num(r.anaemia_pct)},
      ${num(r.flood_events_per_decade)}, ${num(r.cyclone_events_per_decade)},
      ${num(r.earthquake_events_per_decade)}, ${num(r.disaster_insurance_loss_cr)},
      ${num(r.disaster_frequency_score)},
      ${num(r.composite_risk_score)}, ${str(r.risk_tier)},
      ${num(r.score_pm25)}, ${num(r.score_aqi)}, ${num(r.score_no2)},
      ${num(r.score_heat)}, ${num(r.score_disease)}, ${num(r.score_disaster)}
    )
    ON CONFLICT (pincode) DO UPDATE SET
      district_name             = EXCLUDED.district_name,
      state_name                = EXCLUDED.state_name,
      pm25_blended_ug           = EXCLUDED.pm25_blended_ug,
      pm25_blended_3yr_ug       = EXCLUDED.pm25_blended_3yr_ug,
      composite_risk_score      = EXCLUDED.composite_risk_score,
      risk_tier                 = EXCLUDED.risk_tier,
      updated_at                = NOW()
  `
})

// ── 2. district_risk_index ────────────────────────────────────────────────────
console.log('\n[2/7] district_risk_index...')
const dri = await readCsv('data/output/district_risk_index_final.csv')
console.log(`  ${dri.length.toLocaleString()} rows read`)
await sql`TRUNCATE TABLE district_risk_index`
await runBatch('districts', dri, 20, async r => {
  await sql`
    INSERT INTO district_risk_index (
      district_name, state_name,
      pm25_mean_3yr, pm25_mean_5yr, pm25_mean_20yr, pm25_worst_month_avg,
      pm25_zone, pm25_data_source, pm25_trend_5yr_pct, pm25_trend_direction,
      pm25_3yr_from_year, pm25_3yr_to_year, pm25_5yr_from_year, pm25_5yr_to_year,
      pm25_national_pctile, composite_national_pctile,
      pm10_mean_5yr, pm10_worst_month_avg, pm10_zone,
      aqi_annual_mean, aqi_worst_month, aqi_worst_month_name, aqi_worst_year,
      aqi_category_5yr, aqi_limiting_pollutant,
      no2_mean_5yr, no2_zone, so2_mean_5yr, so2_zone,
      co_mean_5yr, co_zone, o3_mean_5yr, o3_zone,
      heat_wave_days_per_year, heat_stress_zone,
      flood_events_per_decade, cyclone_events_per_decade, earthquake_events_per_decade,
      disaster_insurance_loss_cr, disaster_frequency_score,
      hypertension_pct, diabetes_pct, obesity_pct, tobacco_use_pct, anaemia_pct,
      composite_risk_score, risk_tier, data_as_of_year, last_refreshed_at
    ) VALUES (
      ${str(r.district_name)}, ${str(r.state_name)},
      ${num(r.pm25_mean_3yr)}, ${num(r.pm25_mean_5yr)}, ${num(r.pm25_mean_20yr)}, ${num(r.pm25_worst_month_avg)},
      ${str(r.pm25_zone)}, ${str(r.pm25_data_source)}, ${num(r.pm25_trend_5yr_pct)}, ${str(r.pm25_trend_direction)},
      ${num(r.pm25_3yr_from_year)}, ${num(r.pm25_3yr_to_year)},
      ${num(r.pm25_5yr_from_year)}, ${num(r.pm25_5yr_to_year)},
      ${num(r.pm25_national_pctile)}, ${num(r.composite_national_pctile)},
      ${num(r.pm10_mean_5yr)}, ${num(r.pm10_worst_month_avg)}, ${str(r.pm10_zone)},
      ${num(r.aqi_annual_mean)}, ${num(r.aqi_worst_month)}, ${str(r.aqi_worst_month_name)}, ${num(r.aqi_worst_year)},
      ${str(r.aqi_category_5yr)}, ${str(r.aqi_limiting_pollutant)},
      ${num(r.no2_mean_5yr)}, ${str(r.no2_zone)}, ${num(r.so2_mean_5yr)}, ${str(r.so2_zone)},
      ${num(r.co_mean_5yr)}, ${str(r.co_zone)}, ${num(r.o3_mean_5yr)}, ${str(r.o3_zone)},
      ${num(r.heat_wave_days_per_year)}, ${str(r.heat_stress_zone)},
      ${num(r.flood_events_per_decade)}, ${num(r.cyclone_events_per_decade)}, ${num(r.earthquake_events_per_decade)},
      ${num(r.disaster_insurance_loss_cr)}, ${num(r.disaster_frequency_score)},
      ${num(r.hypertension_pct)}, ${num(r.diabetes_pct)}, ${num(r.obesity_pct)},
      ${num(r.tobacco_use_pct)}, ${num(r.anaemia_pct)},
      ${num(r.composite_risk_score)}, ${str(r.risk_tier)},
      ${num(r.data_as_of_year)}, ${str(r.last_refreshed_at)}
    )
    ON CONFLICT (district_name, state_name) DO UPDATE SET
      composite_risk_score = EXCLUDED.composite_risk_score,
      risk_tier            = EXCLUDED.risk_tier,
      pm25_mean_3yr        = EXCLUDED.pm25_mean_3yr,
      updated_at           = NOW()
  `
})

// ── 3. water_quality_state ────────────────────────────────────────────────────
console.log('\n[3/7] water_quality_state...')
const wqs = await readCsv('data/output/water_quality_state.csv')
console.log(`  ${wqs.length} rows read`)
await sql`TRUNCATE TABLE water_quality_state`
await runBatch('states', wqs, 10, async r => {
  const districts = r.known_high_risk_districts
    ? r.known_high_risk_districts.split('|').filter(Boolean)
    : []
  await sql`
    INSERT INTO water_quality_state (
      state_name,
      fluoride_pct_exceeding, fluoride_risk_level, fluoride_samples_analyzed, fluoride_samples_exceeding,
      nitrate_pct_exceeding,  nitrate_risk_level,  nitrate_samples_analyzed,  nitrate_samples_exceeding,
      arsenic_pct_exceeding,  arsenic_risk_level,  arsenic_samples_analyzed,  arsenic_samples_exceeding,
      overall_water_risk, total_samples_in_state, known_high_risk_districts,
      monitoring_season, data_source, data_as_of_year
    ) VALUES (
      ${str(r.state_name)},
      ${num(r.fluoride_pct_exceeding)}, ${str(r.fluoride_risk_level)},
      ${num(r.fluoride_samples_analyzed)}, ${num(r.fluoride_samples_exceeding)},
      ${num(r.nitrate_pct_exceeding)},  ${str(r.nitrate_risk_level)},
      ${num(r.nitrate_samples_analyzed)},  ${num(r.nitrate_samples_exceeding)},
      ${num(r.arsenic_pct_exceeding)},  ${str(r.arsenic_risk_level)},
      ${num(r.arsenic_samples_analyzed)},  ${num(r.arsenic_samples_exceeding)},
      ${str(r.overall_water_risk)}, ${num(r.total_samples_in_state)}, ${districts},
      ${str(r.monitoring_season)}, ${str(r.data_source)}, ${num(r.data_as_of_year)}
    )
    ON CONFLICT (state_name) DO UPDATE SET
      overall_water_risk = EXCLUDED.overall_water_risk, updated_at = NOW()
  `
})

// ── 4. water_quality_hotspots ─────────────────────────────────────────────────
console.log('\n[4/7] water_quality_hotspots...')
const wqh = await readCsv('data/output/water_quality_hotspots.csv')
console.log(`  ${wqh.length} rows read`)
await sql`TRUNCATE TABLE water_quality_hotspots`
await runBatch('hotspots', wqh, 20, async r => {
  await sql`
    INSERT INTO water_quality_hotspots (
      hotspot_no, state_name, district, block_taluka, village,
      lat, lng, source_type,
      contaminant, concentration, unit, bis_limit, exceedance_factor, severity,
      data_as_of_year, data_source
    ) VALUES (
      ${num(r.hotspot_no)}, ${str(r.state_name)}, ${str(r.district)},
      ${str(r.block_taluka)}, ${str(r.village)},
      ${num(r.lat)}, ${num(r.lng)}, ${str(r.source_type)},
      ${str(r.contaminant)}, ${num(r.concentration)}, ${str(r.unit)},
      ${num(r.bis_limit)}, ${num(r.exceedance_factor)}, ${str(r.severity)},
      ${num(r.data_as_of_year)}, ${str(r.data_source)}
    )
  `
})

// ── 5. district_air_quality ───────────────────────────────────────────────────
console.log('\n[5/7] district_air_quality (186K rows — ~3 min)...')
const daq = await readCsv('data/output/district_air_quality_final.csv')
console.log(`  ${daq.length.toLocaleString()} rows read`)
await sql`TRUNCATE TABLE district_air_quality`
await runBatch('AQI rows', daq, 50, async r => {
  await sql`
    INSERT INTO district_air_quality (
      district_name, state_name, year, month,
      pm25_raw_sedac, pm25_raw_cpcb, pm25_raw_cams, pm25_calibrated,
      pm25_source, pm25_bias_factor,
      pm10_raw_cpcb, pm10_raw_cams, pm10_calibrated, pm10_source,
      no2_cams, so2_cams, co_cams, o3_cams,
      aqi_pm25_subindex, aqi_pm10_subindex, aqi_no2_subindex,
      aqi_so2_subindex, aqi_co_subindex, aqi_o3_subindex,
      aqi_representative, aqi_limiting_pollutant, aqi_category
    ) VALUES (
      ${str(r.district_name)}, ${str(r.state_name)}, ${num(r.year)}, ${num(r.month)},
      ${num(r.pm25_raw_sedac)}, ${num(r.pm25_raw_cpcb)}, ${num(r.pm25_raw_cams)},
      ${num(r.pm25_calibrated)}, ${str(r.pm25_source)}, ${num(r.pm25_bias_factor)},
      ${num(r.pm10_raw_cpcb)}, ${num(r.pm10_raw_cams)}, ${num(r.pm10_calibrated)}, ${str(r.pm10_source)},
      ${num(r.no2_cams)}, ${num(r.so2_cams)}, ${num(r.co_cams)}, ${num(r.o3_cams)},
      ${num(r.aqi_pm25_subindex)}, ${num(r.aqi_pm10_subindex)}, ${num(r.aqi_no2_subindex)},
      ${num(r.aqi_so2_subindex)}, ${num(r.aqi_co_subindex)}, ${num(r.aqi_o3_subindex)},
      ${num(r.aqi_representative)}, ${str(r.aqi_limiting_pollutant)}, ${str(r.aqi_category)}
    )
    ON CONFLICT (district_name, state_name, year, month) DO NOTHING
  `
})

// ── 6. pincode_coords ─────────────────────────────────────────────────────────
console.log('\n[6/7] pincode_coords (165K rows, deduped by pincode)...')
const pc = await readCsv('data/output/pincode_coords.csv')
console.log(`  ${pc.length.toLocaleString()} rows read`)
// Deduplicate — keep first occurrence per pincode with valid coords
const seen = new Set()
const pcUniq = pc.filter(r => {
  const p = str(r.pincode)
  if (!p || seen.has(p)) return false
  if (!num(r.latitude) && !num(r.longitude)) return false
  seen.add(p)
  return true
})
console.log(`  ${pcUniq.length.toLocaleString()} unique pincodes after dedup`)
await sql`TRUNCATE TABLE pincode_coords`
await runBatch('coords', pcUniq, 50, async r => {
  await sql`
    INSERT INTO pincode_coords (pincode, district_name, state_name, lat, lng)
    VALUES (
      ${str(r.pincode)}, ${str(r.district)}, ${str(r.statename)},
      ${num(r.latitude)}, ${num(r.longitude)}
    )
    ON CONFLICT (pincode) DO NOTHING
  `
})

// ── 7. pincode_aqueduct ───────────────────────────────────────────────────────
console.log('\n[7/7] pincode_aqueduct...')
const aqd = await readCsv('data/flood/gee_outputs/aqueduct_full.csv')
console.log(`  ${aqd.length.toLocaleString()} rows read`)

// Column list mirrors extract_aqueduct.py's build_queries() output order
const _AQ_RPS       = [10, 25, 50, 100, 250, 500, 1000]
const _AQ_SCENARIOS = ['rcp45_2030', 'rcp85_2030', 'rcp45_2050', 'rcp85_2050', 'rcp45_2080', 'rcp85_2080']
const AQD_DATA_COLS = [
  ..._AQ_RPS.map(rp => `riverine_rp${rp}_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.map(rp => `riverine_${s}_rp${rp}_m`)),
  ..._AQ_RPS.map(rp => `coastal_nosub_hist_rp${rp}_p95_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.flatMap(rp => [
    `coastal_nosub_${s}_rp${rp}_p95_m`,
    `coastal_nosub_${s}_rp${rp}_p50_m`,
  ])),
  ..._AQ_RPS.map(rp => `coastal_wtsub_hist_rp${rp}_p95_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.flatMap(rp => [
    `coastal_wtsub_${s}_rp${rp}_p95_m`,
    `coastal_wtsub_${s}_rp${rp}_p50_m`,
  ])),
]
const AQD_ALL_COLS  = ['pincode', ...AQD_DATA_COLS, 'data_as_of_date']
const AQD_COL_LIST  = AQD_ALL_COLS.join(', ')
const AQD_PARAM_LIST = AQD_ALL_COLS.map((_, i) => `$${i + 1}`).join(', ')
const AQD_CONFLICT   = `ON CONFLICT (pincode) DO UPDATE SET updated_at = NOW()`
const AQD_STMT       = `INSERT INTO pincode_aqueduct (${AQD_COL_LIST}) VALUES (${AQD_PARAM_LIST}) ${AQD_CONFLICT}`

await sql`TRUNCATE TABLE pincode_aqueduct`
await runBatch('aqueduct', aqd, 50, async r => {
  const values = [
    str(r.pincode),
    ...AQD_DATA_COLS.map(c => num(r[c])),
    '2020-04',
  ]
  await sql(AQD_STMT, values)
})

// ── Final verification ────────────────────────────────────────────────────────
console.log('\n── Verification ─────────────────────────────────────────────────')
const counts = await Promise.all([
  sql`SELECT COUNT(*) AS n FROM pincode_risk_index`,
  sql`SELECT COUNT(*) AS n FROM district_risk_index`,
  sql`SELECT COUNT(*) AS n FROM water_quality_state`,
  sql`SELECT COUNT(*) AS n FROM water_quality_hotspots`,
  sql`SELECT COUNT(*) AS n FROM district_air_quality`,
  sql`SELECT COUNT(*) AS n FROM pincode_coords`,
  sql`SELECT COUNT(*) AS n FROM pincode_aqueduct`,
])
console.log(`  pincode_risk_index:     ${Number(counts[0][0].n).toLocaleString()}`)
console.log(`  district_risk_index:    ${Number(counts[1][0].n).toLocaleString()}`)
console.log(`  water_quality_state:    ${Number(counts[2][0].n).toLocaleString()}`)
console.log(`  water_quality_hotspots: ${Number(counts[3][0].n).toLocaleString()}`)
console.log(`  district_air_quality:   ${Number(counts[4][0].n).toLocaleString()}`)
console.log(`  pincode_coords:         ${Number(counts[5][0].n).toLocaleString()}`)
console.log(`  pincode_aqueduct:       ${Number(counts[6][0].n).toLocaleString()}`)
console.log('\n✓ All done.')
