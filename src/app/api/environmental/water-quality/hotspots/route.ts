import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { waterQualityHotspots, pincodeCoords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type {
  WaterHotspotsResponse,
  WaterHotspot,
  ContaminantType,
  WaterRiskLevel,
} from '@/types/environmental'

const QuerySchema = z.object({
  state:       z.string().min(2).optional(),
  pincode:     z.string().regex(/^[1-9][0-9]{5}$/).optional(),
  contaminant: z.enum(['fluoride', 'arsenic', 'nitrate']).optional(),
}).refine((d) => d.state || d.pincode, {
  message: 'Provide either state or pincode',
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

const STATE_ALIASES: Record<string, string> = {
  'andaman & nicobar':   'Andaman & Nicobar Islands',
  'andaman and nicobar': 'Andaman & Nicobar Islands',
  'ap':                  'Andhra Pradesh',
  'chhattisgarh':        'Chattisgarh',
  'delhi':               'Delhi',
  'hp':                  'Himachal Pradesh',
  'himachal':            'Himachal Pradesh',
  'j&k':                 'Jammu & Kashmir',
  'jk':                  'Jammu & Kashmir',
  'jammu':               'Jammu & Kashmir',
  'mp':                  'Madhya Pradesh',
  'madhya pradesh':      'Madhya Pradesh',
  'orissa':              'Odisha',
  'pondicherry':         'Puducherry',
  'puducherry':          'Puducherry',
  'tn':                  'Tamil Nadu',
  'tamil nadu':          'Tamil Nadu',
  'up':                  'Uttar Pradesh',
  'uttar pradesh':       'Uttar Pradesh',
  'wb':                  'West Bengal',
  'west bengal':         'West Bengal',
}

function normaliseStateName(input: string): string {
  const lower = input.toLowerCase().trim()
  return STATE_ALIASES[lower] ?? input.trim()
}

function worstContaminant(hotspots: WaterHotspot[]): ContaminantType | null {
  if (!hotspots.length) return null
  const counts: Record<ContaminantType, number> = { fluoride: 0, arsenic: 0, nitrate: 0 }
  for (const h of hotspots) counts[h.contaminant]++
  const max = Math.max(...Object.values(counts))
  return (Object.entries(counts).find(([, v]) => v === max)?.[0] as ContaminantType) ?? null
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
    state:       searchParams.get('state')       ?? undefined,
    pincode:     searchParams.get('pincode')     ?? undefined,
    contaminant: searchParams.get('contaminant') ?? undefined,
  })

  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request'
    return NextResponse.json({ success: false, error: msg, code: 'INVALID_REQUEST' }, { status: 400 })
  }

  const { state: stateParam, pincode, contaminant: contaminantFilter } = parsed.data

  try {
    // ── Resolve state ──────────────────────────────────────────────────────
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

    // ── Query hotspots ─────────────────────────────────────────────────────
    const conditions = contaminantFilter
      ? and(
          eq(waterQualityHotspots.stateName, resolvedState),
          eq(waterQualityHotspots.contaminant, contaminantFilter)
        )
      : eq(waterQualityHotspots.stateName, resolvedState)

    const rows = await db
      .select()
      .from(waterQualityHotspots)
      .where(conditions)
      .orderBy(waterQualityHotspots.exceedanceFactor)

    // Case-insensitive fallback if no rows
    let finalState = resolvedState
    let finalRows = rows
    if (!rows.length) {
      const all = await db.select().from(waterQualityHotspots)
      const matchedState = all.find(
        (r) => r.stateName.toLowerCase() === resolvedState.toLowerCase()
      )?.stateName
      if (matchedState) {
        finalState = matchedState
        finalRows = all.filter(
          (r) =>
            r.stateName === matchedState &&
            (!contaminantFilter || r.contaminant === contaminantFilter)
        )
      }
    }

    const hotspots: WaterHotspot[] = finalRows.map((r) => ({
      hotspot_no:       r.hotspotNo,
      state_name:       r.stateName,
      district:         r.district,
      block_taluka:     r.blockTaluka,
      village:          r.village,
      lat:              r.lat ? Number(r.lat) : null,
      lng:              r.lng ? Number(r.lng) : null,
      source_type:      r.sourceType,
      contaminant:      r.contaminant as ContaminantType,
      concentration:    Number(r.concentration),
      unit:             r.unit,
      bis_limit:        Number(r.bisLimit),
      exceedance_factor: r.exceedanceFactor ? Number(r.exceedanceFactor) : null,
      severity:         (r.severity as WaterRiskLevel) ?? null,
    }))

    const fluorideHotspots = hotspots.filter((h) => h.contaminant === 'fluoride').length
    const arsenicHotspots  = hotspots.filter((h) => h.contaminant === 'arsenic').length
    const nitrateHotspots  = hotspots.filter((h) => h.contaminant === 'nitrate').length

    const exceedanceFactors = hotspots
      .map((h) => h.exceedance_factor)
      .filter((v): v is number => v !== null)
    const maxExceedance = exceedanceFactors.length
      ? Math.max(...exceedanceFactors)
      : null

    const data: WaterHotspotsResponse = {
      lookup: {
        state_name:       finalState,
        pincode_provided: pincodeProvided,
        resolution:       'state',
        note:             pincode
          ? `Hotspots shown for state "${finalState}" (mapped from pincode ${pincode}). Point-measured CGWB monitoring stations — not all districts in the state will have hotspots listed.`
          : `Hotspots shown for state "${finalState}". Point-measured CGWB monitoring stations — not all districts in the state will have hotspots listed.`,
      },
      hotspots,
      summary: {
        total_hotspots:      hotspots.length,
        fluoride_hotspots:   fluorideHotspots,
        arsenic_hotspots:    arsenicHotspots,
        nitrate_hotspots:    nitrateHotspots,
        worst_contaminant:   worstContaminant(hotspots),
        max_exceedance_factor: maxExceedance ? Number(maxExceedance.toFixed(2)) : null,
      },
      meta: {
        data_source:     'cgwb_annual_report',
        data_as_of_year: 2024,
        response_time_ms: Date.now() - start,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/environmental/water-quality/hotspots]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
