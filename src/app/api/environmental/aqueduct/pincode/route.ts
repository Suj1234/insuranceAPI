import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pincodeAqueduct } from '@/lib/db/schema'

const QuerySchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode format'),
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// ── Response helpers ──────────────────────────────────────────────────────────

const RPS       = [10, 25, 50, 100, 250, 500, 1000] as const
const SCENARIOS = ['rcp45_2030', 'rcp85_2030', 'rcp45_2050', 'rcp85_2050', 'rcp45_2080', 'rcp85_2080'] as const

// camelCase segment for each scenario, e.g. "rcp45_2030" → "Rcp452030"
const S: Record<string, string> = {
  rcp45_2030: 'Rcp452030', rcp85_2030: 'Rcp852030',
  rcp45_2050: 'Rcp452050', rcp85_2050: 'Rcp852050',
  rcp45_2080: 'Rcp452080', rcp85_2080: 'Rcp852080',
}

type AqRow = typeof pincodeAqueduct.$inferSelect

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function g(r: any, key: string): number | null { return toNum(r[key]) }

function rvHistBlock(r: AqRow) {
  return Object.fromEntries(RPS.map(rp => [`rp${rp}_m`, g(r, `riverineRp${rp}M`)]))
}

function rvProjBlock(r: AqRow, scenario: string) {
  return Object.fromEntries(RPS.map(rp => [`rp${rp}_m`, g(r, `riverine${S[scenario]}Rp${rp}M`)]))
}

function coastalHistBlock(r: AqRow, type: 'Nosub' | 'Wtsub') {
  // historical = p95 only
  return Object.fromEntries(RPS.map(rp => [`rp${rp}_p95_m`, g(r, `coastal${type}HistRp${rp}P95M`)]))
}

function coastalProjBlock(r: AqRow, type: 'Nosub' | 'Wtsub', scenario: string) {
  return Object.fromEntries(RPS.flatMap(rp => [
    [`rp${rp}_p50_m`, g(r, `coastal${type}${S[scenario]}Rp${rp}P50M`)],
    [`rp${rp}_p95_m`, g(r, `coastal${type}${S[scenario]}Rp${rp}P95M`)],
  ]))
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const start = Date.now()

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || !isValidApiKey(apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({ pincode: searchParams.get('pincode') })
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { pincode } = parsed.data

  try {
    const rows = await db
      .select()
      .from(pincodeAqueduct)
      .where(eq(pincodeAqueduct.pincode, pincode))
      .limit(1)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aqueduct data not available for this pincode.', code: 'PINCODE_NOT_FOUND' },
        { status: 404 }
      )
    }

    const r = rows[0]

    return NextResponse.json({
      success: true,
      pincode: r.pincode,

      aqueduct: {

        riverine: {
          baseline_1980: rvHistBlock(r),
          projections: Object.fromEntries(
            SCENARIOS.map(s => [s, rvProjBlock(r, s)])
          ),
        },

        coastal: {
          nosub: {
            historical: coastalHistBlock(r, 'Nosub'),
            ...Object.fromEntries(SCENARIOS.map(s => [s, coastalProjBlock(r, 'Nosub', s)])),
          },
          with_subsidence: {
            baseline_2030: coastalHistBlock(r, 'Wtsub'),
            ...Object.fromEntries(SCENARIOS.map(s => [s, coastalProjBlock(r, 'Wtsub', s)])),
          },
        },

        meta: {
          source:             'WRI Aqueduct Floods v2',
          published:          '2020-04',
          baseline_year:      1980,
          baseline_model:     'WATCH reanalysis 1960–1999',
          projection_models:  'ensemble mean — NorESM1-M, GFDL-ESM2M, HadGEM2-ES, IPSL-CM5A-LR, MIROC-ESM-CHEM',
          resolution_m:       1000,
          zero_means:         'outside flood zone at this return period',
          null_means:         'no raster coverage at this location',
          sampling:           'point-sampled at pincode centroid',
          latency_ms:         Date.now() - start,
        },
      },
    })
  } catch (err) {
    console.error('[aqueduct/pincode] error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
