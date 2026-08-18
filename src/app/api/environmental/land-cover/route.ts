import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pincodeLandCover } from '@/lib/db/schema'

// ── Auth ──────────────────────────────────────────────────────────────────────

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const PincodeSchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode format'),
})

const LatLonSchema = z.object({
  lat: z.coerce.number().min(6.0,  'Latitude must be between 6.0 and 38.0' ).max(38.0),
  lon: z.coerce.number().min(67.0, 'Longitude must be between 67.0 and 99.0').max(99.0),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const YEARS   = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] as const
const BANDS   = ['built_area', 'trees', 'crops', 'water', 'flooded_veg', 'grass', 'scrub_shrub', 'bare_ground'] as const

type BandKey = typeof BANDS[number]

function toNum(v: string | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Map Drizzle camelCase → snake_case col names used in response
const BAND_COL_MAP: Record<BandKey, string> = {
  built_area:   'builtArea',
  trees:        'trees',
  crops:        'crops',
  water:        'water',
  flooded_veg:  'floodedVeg',
  grass:        'grass',
  scrub_shrub:  'scrubShrub',
  bare_ground:  'bareGround',
}

function buildAnnual(row: Record<string, unknown>) {
  const annual: Record<string, Record<string, number | null>> = {}
  for (const year of YEARS) {
    const yr: Record<string, number | null> = {}
    for (const band of BANDS) {
      const drizzleKey = `${BAND_COL_MAP[band]}${year}Pct` as keyof typeof row
      yr[`${band}_pct`] = toNum(row[drizzleKey] as string | null | undefined)
    }
    annual[String(year)] = yr
  }
  return annual
}

function buildTrends(row: {
  urbanGrowthRatePctPerYr: string | null
  urbanGrowthClass:        string | null
  builtAreaChangePct:      string | null
  treesChangePct:          string | null
  cropsChangePct:          string | null
  waterChangePct:          string | null
  floodedVegChangePct:     string | null
  grassChangePct:          string | null
  greeneryLossPct:         string | null
  croplandToUrbanPct:      string | null
  floodedVegMaxPct:        string | null
  floodedVegetationTrend:  string | null
  dominantUse2017:         string | null
  dominantUse2024:         string | null
  landUseShifted:          boolean | null
}) {
  return {
    urban_growth_rate_pct_per_yr: toNum(row.urbanGrowthRatePctPerYr),
    urban_growth_class:           row.urbanGrowthClass,
    built_area_change_pct:        toNum(row.builtAreaChangePct),
    trees_change_pct:             toNum(row.treesChangePct),
    crops_change_pct:             toNum(row.cropsChangePct),
    water_change_pct:             toNum(row.waterChangePct),
    flooded_veg_change_pct:       toNum(row.floodedVegChangePct),
    grass_change_pct:             toNum(row.grassChangePct),
    greenery_loss_pct:            toNum(row.greeneryLossPct),
    cropland_to_urban_pct:        toNum(row.croplandToUrbanPct),
    flooded_veg_max_pct:          toNum(row.floodedVegMaxPct),
    flooded_vegetation_trend:     row.floodedVegetationTrend,
    dominant_use_2017:            row.dominantUse2017,
    dominant_use_2024:            row.dominantUse2024,
    land_use_shifted:             row.landUseShifted ?? null,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
  const rawPincode = searchParams.get('pincode')
  const rawLat     = searchParams.get('lat')
  const rawLon     = searchParams.get('lon')

  if (!rawPincode && (!rawLat || !rawLon)) {
    return NextResponse.json(
      { success: false, error: 'Provide either pincode or lat+lon.', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  // ── Path 1: Pincode → DB ──────────────────────────────────────────────────
  if (rawPincode) {
    const parsed = PincodeSchema.safeParse({ pincode: rawPincode })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid pincode', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    try {
      const rows = await db
        .select()
        .from(pincodeLandCover)
        .where(eq(pincodeLandCover.pincode, parsed.data.pincode))
        .limit(1)

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'PIN code not found.', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      const r = rows[0]
      return NextResponse.json({
        success: true,
        input: {
          type:    'pincode',
          pincode: r.pincode,
          lat:     toNum(r.lat),
          lon:     toNum(r.lon),
        },
        land_cover: {
          annual:           buildAnnual(r as unknown as Record<string, unknown>),
          trends:           buildTrends(r),
          coverage_years:   YEARS,
        },
        meta: {
          data_source:  'ESRI 10m Annual Land Cover (Impact Observatory / Microsoft / Esri)',
          resolution_m: 10,
          buffer_m:     500,
          input_type:   'pincode',
          data_as_of:   r.dataAsOfDate ?? null,
          latency_ms:   Date.now() - start,
        },
      })
    } catch (err) {
      console.error('[land-cover] pincode error:', err)
      return NextResponse.json(
        { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }

  // ── Path 2: Lat/Lon → raster service ──────────────────────────────────────
  const parsedLatLon = LatLonSchema.safeParse({ lat: rawLat, lon: rawLon })
  if (!parsedLatLon.success) {
    return NextResponse.json(
      { success: false, error: parsedLatLon.error.errors[0]?.message ?? 'Invalid coordinates', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { lat, lon } = parsedLatLon.data
  const rasterUrl    = process.env.LAND_COVER_RASTER_SERVICE_URL

  if (!rasterUrl) {
    return NextResponse.json(
      { success: false, error: 'Lat/lon lookup not configured on this server.', code: 'NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(
      `${rasterUrl}/lookup?lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(15_000) }
    )

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return NextResponse.json(
        { success: false, error: (body as Record<string, string>).detail ?? 'Raster service error.', code: 'RASTER_ERROR' },
        { status: res.status }
      )
    }

    const data = await res.json() as Record<string, unknown>

    return NextResponse.json({
      success: true,
      input: { type: 'latlon', lat, lon },
      land_cover: data,
      meta: {
        data_source:  'ESRI 10m Annual Land Cover (Impact Observatory / Microsoft / Esri)',
        resolution_m: 10,
        input_type:   'latlon',
        latency_ms:   Date.now() - start,
      },
    })
  } catch (err) {
    console.error('[land-cover] latlon error:', err)
    return NextResponse.json(
      { success: false, error: 'Raster service unavailable.', code: 'RASTER_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
