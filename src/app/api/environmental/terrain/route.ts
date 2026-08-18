import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pincodeTerrain } from '@/lib/db/schema'

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
  lon: z.coerce.number().min(67.0, 'Longitude must be between 67.0 and 98.0').max(98.0),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: string | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function buildTerrainResponse(row: {
  handM:              string | null
  elevationM:         string | null
  upstreamAreaKm2:    string | null
  riverWidthM:        string | null
  onPermanentWater:   boolean | null
  flowDirectionCode:  number | null
  flowDirectionLabel: string | null
  floodRiskClass:     string | null
  coastalSurgeRisk:   boolean | null
  inlandDepression:   boolean | null
  adjacentToRiver:    boolean | null
}) {
  return {
    source: {
      hand_m:              toNum(row.handM),
      elevation_m:         toNum(row.elevationM),
      upstream_area_km2:   toNum(row.upstreamAreaKm2),
      river_width_m:       toNum(row.riverWidthM),
      on_permanent_water:  row.onPermanentWater ?? null,
      flow_direction_code: row.flowDirectionCode ?? null,
      flow_direction_label: row.flowDirectionLabel ?? null,
    },
    calculated: {
      flood_risk_class:  row.floodRiskClass    ?? null,
      coastal_surge_risk: row.coastalSurgeRisk ?? null,
      inland_depression:  row.inlandDepression  ?? null,
      adjacent_to_river:  row.adjacentToRiver   ?? null,
    },
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const start = Date.now()

  // Auth
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

  // Must provide pincode OR lat+lon — not neither
  if (!rawPincode && (!rawLat || !rawLon)) {
    return NextResponse.json(
      { success: false, error: 'Provide either pincode or lat+lon.', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  // ── Path 1: PIN code → DB lookup ──────────────────────────────────────────
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
        .from(pincodeTerrain)
        .where(eq(pincodeTerrain.pincode, parsed.data.pincode))
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
        terrain: buildTerrainResponse(r),
        meta: {
          data_source:  'MERIT Hydro v1.0.1',
          resolution_m: 92.77,
          input_type:   'pincode',
          latency_ms:   Date.now() - start,
        },
      })
    } catch (err) {
      console.error('[terrain] pincode error:', err)
      return NextResponse.json(
        { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }

  // ── Path 2: Lat/Lon → raster service ────────────────────────────────────
  const parsedLatLon = LatLonSchema.safeParse({ lat: rawLat, lon: rawLon })
  if (!parsedLatLon.success) {
    return NextResponse.json(
      { success: false, error: parsedLatLon.error.errors[0]?.message ?? 'Invalid coordinates', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { lat, lon } = parsedLatLon.data
  const rasterUrl    = process.env.RASTER_SERVICE_URL

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
        { success: false, error: body.detail ?? 'Raster service error.', code: 'RASTER_ERROR' },
        { status: res.status }
      )
    }

    const data = await res.json()

    return NextResponse.json({
      success: true,
      input: {
        type: 'latlon',
        lat,
        lon,
      },
      terrain: {
        source: data.source,
        calculated: data.calculated,
      },
      meta: {
        data_source:  'MERIT Hydro v1.0.1',
        resolution_m: 92.77,
        input_type:   'latlon',
        latency_ms:   Date.now() - start,
      },
    })
  } catch (err) {
    console.error('[terrain] latlon error:', err)
    return NextResponse.json(
      { success: false, error: 'Raster service unavailable.', code: 'RASTER_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
