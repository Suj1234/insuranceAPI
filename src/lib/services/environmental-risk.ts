import { db } from '@/lib/db'
import { pincodeCoords, pincodeRiskIndex, districtRiskIndex, districtAirQuality } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import type {
  AqiCategory,
  RiskTier,
} from '@/types/environmental'

// ── In-memory cache (24h TTL) ─────────────────────────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number }
const pincodeCache  = new Map<string, CacheEntry<typeof pincodeRiskIndex.$inferSelect | null>>()
const districtCache = new Map<string, CacheEntry<typeof districtRiskIndex.$inferSelect | null>>()
const aqiHistoryCache = new Map<string, CacheEntry<(typeof districtAirQuality.$inferSelect)[]>>()

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { map.delete(key); return null }
  return entry.data
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
  map.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ── Pincode risk index lookup ─────────────────────────────────────────────────

export async function getPincodeRiskIndex(pincode: string) {
  const cacheKey = `pincode_risk:${pincode}`
  const cached = cacheGet(pincodeCache, cacheKey)
  if (cached !== null) return cached

  const rows = await db
    .select()
    .from(pincodeRiskIndex)
    .where(eq(pincodeRiskIndex.pincode, pincode))
    .limit(1)

  const result = rows[0] ?? null
  cacheSet(pincodeCache, cacheKey, result)
  return result
}

// ── Pincode → district lookup ─────────────────────────────────────────────────

export async function getDistrictByPincode(pincode: string) {
  const rows = await db
    .select()
    .from(pincodeCoords)
    .where(eq(pincodeCoords.pincode, pincode))
    .limit(1)

  return rows[0] ?? null
}

// ── District risk index lookup ────────────────────────────────────────────────

export async function getDistrictRiskIndex(districtName: string, stateName: string) {
  const cacheKey = `district_risk:${districtName}:${stateName}`
  const cached = cacheGet(districtCache, cacheKey)
  if (cached !== null) return cached

  const rows = await db
    .select()
    .from(districtRiskIndex)
    .where(
      and(
        eq(districtRiskIndex.districtName, districtName),
        eq(districtRiskIndex.stateName, stateName),
      )
    )
    .limit(1)

  const result = rows[0] ?? null
  cacheSet(districtCache, cacheKey, result)
  return result
}

// ── AQI history query ─────────────────────────────────────────────────────────

export async function getDistrictAQIHistory(
  districtName: string,
  stateName: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
) {
  const cacheKey = `aqi_history:${districtName}:${stateName}:${fromYear}-${fromMonth}:${toYear}-${toMonth}`
  const cached = cacheGet(aqiHistoryCache, cacheKey)
  if (cached !== null) return cached

  const rows = await db
    .select()
    .from(districtAirQuality)
    .where(
      and(
        eq(districtAirQuality.districtName, districtName),
        eq(districtAirQuality.stateName, stateName),
        sql`(${districtAirQuality.year} * 100 + ${districtAirQuality.month}) >= ${fromYear * 100 + fromMonth}`,
        sql`(${districtAirQuality.year} * 100 + ${districtAirQuality.month}) <= ${toYear * 100 + toMonth}`,
      )
    )
    .orderBy(districtAirQuality.year, districtAirQuality.month)

  cacheSet(aqiHistoryCache, cacheKey, rows)
  return rows
}

// ── UW narrative generator ────────────────────────────────────────────────────

type NarrativeInput = {
  districtName: string
  stateName: string
  pm25Mean3yr: number | null
  pm25Mean5yr: number | null
  pm25Zone: string | null
  pm25TrendDirection: string | null
  pm25Trend5yrPct: number | null
  pm25NationalPctile: number | null
  compositeRiskScore: number | null
  compositeNationalPctile: number | null
  riskTier: string | null
  disasterFrequencyScore: number | null
  floodEventsPerDecade: number | null
  cycloneEventsPerDecade: number | null
  heatWaveDaysPerYear: number | null
  hypertensionPct: number | null
}

export function generateUwNarrative(d: NarrativeInput): string {
  const parts: string[] = []

  const pm25Primary = d.pm25Mean3yr ?? d.pm25Mean5yr
  const pctile      = d.pm25NationalPctile
  const zone        = d.pm25Zone ?? 'Unknown'
  const trendDir    = d.pm25TrendDirection
  const trendPct    = d.pm25Trend5yrPct

  const pctileStr = pctile != null ? `${pctile.toFixed(0)}th national percentile` : 'unknown national percentile'
  const pm25Str   = pm25Primary != null ? `PM2.5 3yr mean: ${pm25Primary.toFixed(1)} µg/m³` : 'PM2.5 data unavailable'
  const trendStr  = trendDir ? `, trend: ${trendDir}` : ''
  parts.push(
    `${d.districtName}, ${d.stateName} ranks in the ${pctileStr} for air quality (${pm25Str}, ${zone} zone${trendStr}).`
  )

  if (trendDir === 'worsening' && trendPct != null) {
    parts.push(`Air quality has deteriorated ${Math.abs(trendPct).toFixed(0)}% over 5 years — elevated long-tail respiratory exposure risk.`)
  } else if (trendDir === 'improving' && trendPct != null) {
    parts.push(`Air quality has improved ${Math.abs(trendPct).toFixed(0)}% over 5 years.`)
  }

  if (d.disasterFrequencyScore != null && d.disasterFrequencyScore > 5) {
    const flood   = d.floodEventsPerDecade   != null ? `${d.floodEventsPerDecade.toFixed(1)} flood` : null
    const cyclone = d.cycloneEventsPerDecade != null ? `${d.cycloneEventsPerDecade.toFixed(1)} cyclone` : null
    const evts    = [flood, cyclone].filter(Boolean).join(', ')
    parts.push(`Disaster exposure: ${d.disasterFrequencyScore.toFixed(1)}/10${evts ? ` (${evts} events/decade)` : ''}.`)
  }

  if (d.heatWaveDaysPerYear != null && d.heatWaveDaysPerYear > 30) {
    parts.push(`${d.heatWaveDaysPerYear} heat wave days/year — elevated risk for cardiovascular conditions and elderly insured.`)
  }

  if (d.hypertensionPct != null && d.hypertensionPct > 30) {
    parts.push(`District hypertension prevalence ${d.hypertensionPct.toFixed(1)}% (national avg ~26%) — higher baseline for chronic condition claims.`)
  }

  const compPctile = d.compositeNationalPctile != null ? ` (${d.compositeNationalPctile.toFixed(0)}th national percentile)` : ''
  const score      = d.compositeRiskScore != null ? d.compositeRiskScore.toFixed(1) : 'N/A'
  parts.push(`Risk tier: ${d.riskTier ?? 'Unknown'}. Composite score: ${score}/100${compPctile}.`)

  return parts.join(' ')
}

// ── Helper: pm25_source → data_quality label ─────────────────────────────────

export function pm25SourceToQuality(source: string | null): 'measured' | 'modelled' | 'gap_filled' | 'missing' {
  if (!source || source === 'missing') return 'missing'
  if (source === 'cpcb_direct')       return 'measured'
  if (source === 'sedac_calibrated')  return 'modelled'
  return 'gap_filled'
}

// ── Helper: AQI value → category string ──────────────────────────────────────

export function aqiToCategory(aqi: number | null): AqiCategory | null {
  if (aqi === null || aqi === undefined) return null
  if (aqi <= 50)  return 'Good'
  if (aqi <= 100) return 'Satisfactory'
  if (aqi <= 200) return 'Moderate'
  if (aqi <= 300) return 'Poor'
  if (aqi <= 400) return 'Very Poor'
  return 'Severe'
}

// ── Unused in this project but kept for type completeness ────────────────────
// computeRiskFlags and storeGeographicRiskOnApplication are health-platform only
// (they depend on the applications table which does not exist here)
export type { RiskTier }
