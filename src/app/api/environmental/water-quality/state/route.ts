import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { waterQualityState, waterContaminantHealthRisks, pincodeCoords } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type {
  WaterQualityStateResponse,
  ContaminantProfile,
  WaterRiskLevel,
  WaterHealthRisk,
  ContaminantType,
} from '@/types/environmental'

const QuerySchema = z.object({
  state:   z.string().min(2).optional(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),
}).refine((d) => d.state || d.pincode, {
  message: 'Provide either state or pincode',
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

// BIS permissible limits
const BIS_LIMITS: Record<ContaminantType, { value: number; unit: string }> = {
  fluoride: { value: 1.5,  unit: 'mg/L' },
  arsenic:  { value: 0.01, unit: 'mg/L' },
  nitrate:  { value: 45,   unit: 'mg/L' },
}

function riskLevel(pct: number | null): WaterRiskLevel | null {
  if (pct === null) return null
  if (pct < 5)  return 'low'
  if (pct < 20) return 'moderate'
  if (pct < 40) return 'high'
  return 'very_high'
}

function buildContaminantProfile(
  pctExceeding: string | null,
  samplesAnalyzed: number | null,
  samplesExceeding: number | null,
  contaminant: ContaminantType,
): ContaminantProfile {
  const pct = pctExceeding ? Number(pctExceeding) : null
  return {
    pct_exceeding:    pct,
    samples_analyzed: samplesAnalyzed,
    samples_exceeding: samplesExceeding,
    risk_level:       riskLevel(pct),
    bis_limit:        BIS_LIMITS[contaminant].value,
    unit:             BIS_LIMITS[contaminant].unit,
  }
}

function buildUwSummary(
  stateName: string,
  overall: WaterRiskLevel | null,
  fluoride: ContaminantProfile,
  arsenic: ContaminantProfile,
  nitrate: ContaminantProfile,
  knownDistricts: string[],
): string {
  const parts: string[] = []

  if (overall === 'very_high' || overall === 'high') {
    parts.push(`${stateName} has ${overall.replace('_', ' ')} ground water contamination risk.`)
  } else if (overall === 'moderate') {
    parts.push(`${stateName} has moderate ground water contamination risk.`)
  } else {
    parts.push(`${stateName} has low ground water contamination risk.`)
  }

  const elevatedContaminants: string[] = []
  if (arsenic.risk_level === 'high' || arsenic.risk_level === 'very_high') {
    elevatedContaminants.push(`arsenic (${arsenic.pct_exceeding?.toFixed(1)}% samples above BIS limit of ${BIS_LIMITS.arsenic.value} mg/L)`)
  }
  if (fluoride.risk_level === 'high' || fluoride.risk_level === 'very_high') {
    elevatedContaminants.push(`fluoride (${fluoride.pct_exceeding?.toFixed(1)}% samples above BIS limit of ${BIS_LIMITS.fluoride.value} mg/L)`)
  }
  if (nitrate.risk_level === 'high' || nitrate.risk_level === 'very_high') {
    elevatedContaminants.push(`nitrate (${nitrate.pct_exceeding?.toFixed(1)}% samples above BIS limit of ${BIS_LIMITS.nitrate.value} mg/L)`)
  }
  if (elevatedContaminants.length > 0) {
    parts.push(`Elevated: ${elevatedContaminants.join('; ')}.`)
  }

  if (knownDistricts.length > 0) {
    const listed = knownDistricts.slice(0, 5).join(', ')
    const more   = knownDistricts.length > 5 ? ` and ${knownDistricts.length - 5} others` : ''
    parts.push(`Known high-risk districts: ${listed}${more}.`)
  }

  if (arsenic.risk_level === 'high' || arsenic.risk_level === 'very_high') {
    parts.push('Arsenic exceedance is a significant underwriting signal: chronic exposure increases risk of arsenicosis, liver disease, and bladder cancer.')
  }

  return parts.join(' ')
}

// ── State name normaliser (handles common variations) ─────────────────────────
const STATE_ALIASES: Record<string, string> = {
  'andaman and nicobar': 'Andaman & Nicobar Islands',
  'andaman & nicobar':   'Andaman & Nicobar Islands',
  'andaman':             'Andaman & Nicobar Islands',
  'ap':                  'Andhra Pradesh',
  'arunachal':           'Arunachal Pradesh',
  'chandigarh':          'Chandigarh',
  'chhattisgarh':        'Chattisgarh',
  'dadra':               'Dadra & Nagar Haveli and Daman & Diu',
  'daman':               'Dadra & Nagar Haveli and Daman & Diu',
  'delhi':               'Delhi',
  'dnhdd':               'Dadra & Nagar Haveli and Daman & Diu',
  'goa':                 'Goa',
  'gujarat':             'Gujarat',
  'haryana':             'Haryana',
  'hp':                  'Himachal Pradesh',
  'himachal':            'Himachal Pradesh',
  'jammu':               'Jammu & Kashmir',
  'j&k':                 'Jammu & Kashmir',
  'jk':                  'Jammu & Kashmir',
  'jharkhand':           'Jharkhand',
  'karnataka':           'Karnataka',
  'kerala':              'Kerala',
  'lakshadweep':         'Lakshadweep',
  'ladakh':              'Ladakh',
  'madhya pradesh':      'Madhya Pradesh',
  'mp':                  'Madhya Pradesh',
  'maharashtra':         'Maharashtra',
  'manipur':             'Manipur',
  'meghalaya':           'Meghalaya',
  'mizoram':             'Mizoram',
  'nagaland':            'Nagaland',
  'odisha':              'Odisha',
  'orissa':              'Odisha',
  'puducherry':          'Puducherry',
  'pondicherry':         'Puducherry',
  'punjab':              'Punjab',
  'rajasthan':           'Rajasthan',
  'sikkim':              'Sikkim',
  'tn':                  'Tamil Nadu',
  'tamil nadu':          'Tamil Nadu',
  'telangana':           'Telangana',
  'tripura':             'Tripura',
  'up':                  'Uttar Pradesh',
  'uttar pradesh':       'Uttar Pradesh',
  'uttarakhand':         'Uttarakhand',
  'wb':                  'West Bengal',
  'west bengal':         'West Bengal',
}

function normaliseStateName(input: string): string {
  const lower = input.toLowerCase().trim()
  return STATE_ALIASES[lower] ?? input.trim()
}

export async function GET(req: NextRequest) {
  const start = Date.now()

  // ── Auth ───────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || !isValidApiKey(apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
      { status: 401 }
    )
  }

  // ── Parse query ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    state:   searchParams.get('state')   ?? undefined,
    pincode: searchParams.get('pincode') ?? undefined,
  })

  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request'
    return NextResponse.json({ success: false, error: msg, code: 'INVALID_REQUEST' }, { status: 400 })
  }

  const { state: stateParam, pincode } = parsed.data

  try {
    // ── Resolve state name ─────────────────────────────────────────────────
    let resolvedState: string
    let pincodeProvided: string | null = null

    if (pincode) {
      pincodeProvided = pincode
      const coords = await db
        .select({ stateName: pincodeCoords.stateName })
        .from(pincodeCoords)
        .where(eq(pincodeCoords.pincode, pincode))
        .limit(1)

      if (!coords.length || !coords[0].stateName) {
        return NextResponse.json(
          { success: false, error: 'Pincode not found.', code: 'PINCODE_NOT_FOUND' },
          { status: 404 }
        )
      }
      resolvedState = coords[0].stateName
    } else {
      resolvedState = normaliseStateName(stateParam!)
    }

    // ── Fetch state water quality row ──────────────────────────────────────
    const rows = await db
      .select()
      .from(waterQualityState)
      .where(eq(waterQualityState.stateName, resolvedState))
      .limit(1)

    if (!rows.length) {
      // Try case-insensitive fallback
      const allStates = await db
        .select({ stateName: waterQualityState.stateName })
        .from(waterQualityState)

      const match = allStates.find(
        (r) => r.stateName.toLowerCase() === resolvedState.toLowerCase()
      )
      if (!match) {
        return NextResponse.json(
          { success: false, error: `Water quality data not available for state: ${resolvedState}`, code: 'STATE_NOT_FOUND' },
          { status: 404 }
        )
      }
      resolvedState = match.stateName
      const refetch = await db
        .select()
        .from(waterQualityState)
        .where(eq(waterQualityState.stateName, resolvedState))
        .limit(1)
      rows.push(...refetch)
    }

    const wq = rows[0]

    // ── Fetch health risks from DB ─────────────────────────────────────────
    const healthRiskRows = await db
      .select()
      .from(waterContaminantHealthRisks)
      .orderBy(waterContaminantHealthRisks.sortOrder)

    const healthRisks = {
      fluoride: healthRiskRows
        .filter((r) => r.contaminant === 'fluoride')
        .map((r): WaterHealthRisk => ({
          risk_code:      r.riskCode,
          display_label:  r.displayLabel,
          severity:       r.severity as WaterHealthRisk['severity'],
          clinical_basis: r.clinicalBasis,
        })),
      arsenic: healthRiskRows
        .filter((r) => r.contaminant === 'arsenic')
        .map((r): WaterHealthRisk => ({
          risk_code:      r.riskCode,
          display_label:  r.displayLabel,
          severity:       r.severity as WaterHealthRisk['severity'],
          clinical_basis: r.clinicalBasis,
        })),
      nitrate: healthRiskRows
        .filter((r) => r.contaminant === 'nitrate')
        .map((r): WaterHealthRisk => ({
          risk_code:      r.riskCode,
          display_label:  r.displayLabel,
          severity:       r.severity as WaterHealthRisk['severity'],
          clinical_basis: r.clinicalBasis,
        })),
    }

    // ── Build contaminant profiles ─────────────────────────────────────────
    const fluoride = buildContaminantProfile(
      wq.fluoridePctExceeding, wq.fluorideSamplesAnalyzed, wq.fluorideSamplesExceeding, 'fluoride'
    )
    const arsenic = buildContaminantProfile(
      wq.arsenicPctExceeding, wq.arsenicSamplesAnalyzed, wq.arsenicSamplesExceeding, 'arsenic'
    )
    const nitrate = buildContaminantProfile(
      wq.nitratePctExceeding, wq.nitrateSamplesAnalyzed, wq.nitrateSamplesExceeding, 'nitrate'
    )

    // ── Data coverage ──────────────────────────────────────────────────────
    const missingContaminants: ContaminantType[] = []
    if (fluoride.pct_exceeding === null) missingContaminants.push('fluoride')
    if (arsenic.pct_exceeding  === null) missingContaminants.push('arsenic')
    if (nitrate.pct_exceeding  === null) missingContaminants.push('nitrate')

    const overallCoverage =
      missingContaminants.length === 0 ? 'full'
      : missingContaminants.length === 1 ? 'partial'
      : 'minimal'

    const knownDistricts = (wq.knownHighRiskDistricts as string[]) ?? []

    const data: WaterQualityStateResponse = {
      lookup: {
        state_name:       wq.stateName,
        pincode_provided: pincodeProvided,
        resolution:       'state',
        note:             pincode
          ? `Result is at state level. Pincode ${pincode} was mapped to state "${wq.stateName}". Ground water quality data is only available at state level from CGWB.`
          : 'Result is at state level. Ground water quality data is only available at state level from CGWB.',
      },
      contaminants: { fluoride, arsenic, nitrate },
      overall_water_risk:        (wq.overallWaterRisk as WaterRiskLevel) ?? null,
      known_high_risk_districts: knownDistricts,
      health_risks:              healthRisks,
      uw_summary: buildUwSummary(
        wq.stateName,
        (wq.overallWaterRisk as WaterRiskLevel) ?? null,
        fluoride, arsenic, nitrate,
        knownDistricts,
      ),
      data_coverage: {
        overall_coverage:      overallCoverage,
        missing_contaminants:  missingContaminants,
      },
      meta: {
        monitoring_season: wq.monitoringSeason,
        data_source:       wq.dataSource ?? 'cgwb_annual_report',
        data_as_of_year:   wq.dataAsOfYear,
        response_time_ms:  Date.now() - start,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/environmental/water-quality/state]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
