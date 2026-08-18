import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pincodeFloodIndex } from '@/lib/db/schema'

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
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request'
    return NextResponse.json(
      { success: false, error: msg, code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { pincode } = parsed.data

  try {
    const rows = await db
      .select()
      .from(pincodeFloodIndex)
      .where(eq(pincodeFloodIndex.pincode, pincode))
      .limit(1)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Flood data not yet available for this pincode.', code: 'PINCODE_NOT_FOUND' },
        { status: 404 }
      )
    }

    const r = rows[0]

    const response = {
      success:     true,
      pincode:     r.pincode,
      district:    r.districtName ?? null,
      state:       r.stateName ?? null,
      coordinates: { lat: toNum(r.lat), lng: toNum(r.lng) },

      // ── Risk summary ───────────────────────────────────────────────────────
      flood_risk: {
        score:       toNum(r.floodRiskScore),
        class:       r.floodRiskClass ?? null,
        component_scores: {
          glofas:    toNum(r.scoreGlofas),
          gsw:       toNum(r.scoreGsw),
          aqueduct:  toNum(r.scoreAqueduct),
          hand:      toNum(r.scoreHand),
          rainfall:  toNum(r.scoreRainfall),
          dam:       toNum(r.scoreDam),
        },
      },

      // ── JRC GloFAS v2.1 — Return Period Flood Depths ───────────────────────
      jrc_glofas: {
        rp10_depth_m:       toNum(r.jrcRp10DepthM),
        rp20_depth_m:       toNum(r.jrcRp20DepthM),
        rp50_depth_m:       toNum(r.jrcRp50DepthM),
        rp75_depth_m:       toNum(r.jrcRp75DepthM),
        rp100_depth_m:      toNum(r.jrcRp100DepthM),
        rp200_depth_m:      toNum(r.jrcRp200DepthM),
        rp500_depth_m:      toNum(r.jrcRp500DepthM),
        rp100_class:        r.jrcRp100Class ?? null,
        spurious_flag:      r.jrcSpuriousDepthFlag ?? null,
        note:               'null = location not in 90m flood zone',
      },

      // ── JRC Global Surface Water (1984–2021) ───────────────────────────────
      jrc_gsw: {
        occurrence_pct:     toNum(r.gswOccurrencePct),
        recurrence_pct:     toNum(r.gswRecurrencePct),
        seasonality_months: toNum(r.gswSeasonalityMonths),
        transition_class:   r.gswTransitionClass ?? null,
        ever_flooded:       r.gswMaxExtent ?? false,
        change_abs:         toNum(r.gswChangeAbs),
        note:               'null = pixel never flooded 1984-2021 (not missing data)',
      },

      // ── WRI Aqueduct v2 ────────────────────────────────────────────────────
      aqueduct: {
        baseline_1980: {
          riverine_rp100_m: toNum(r.aqdRiverineRp100M),
          riverine_rp500_m: toNum(r.aqdRiverineRp500M),
          coastal_rp100_m:  toNum(r.aqdCoastalRp100M),
          coastal_rp500_m:  toNum(r.aqdCoastalRp500M),
          coastal_rp100_with_subsidence_2030_m: toNum(r.aqdCoastalRp100Wtsub2030M),
        },
        projections: {
          rcp85_2030_rp100_m: toNum(r.aqd2030Rcp85Rp100M),
          rcp45_2050_rp100_m: toNum(r.aqd2050Rcp45Rp100M),
          rcp85_2050_rp100_m: toNum(r.aqd2050Rcp85Rp100M),
          rcp85_2080_rp100_m: toNum(r.aqd2080Rcp85Rp100M),
        },
        note: '0 = outside flood zone; projections are ensemble mean of 5 GCMs',
      },

      // ── Terrain ────────────────────────────────────────────────────────────
      terrain: {
        hand_elevation_m: toNum(r.handElevationM),
        note:             'MERIT Hydro v1.0.1: height above nearest drainage',
      },

      // ── Land Cover (500m buffer) ───────────────────────────────────────────
      land_cover: {
        impervious_surface_pct: toNum(r.imperviousSurfacePct),
        mangrove_cover_pct:     toNum(r.mangroveCoverPct),
        note:                   'ESA WorldCover 2021 within 500m buffer',
      },

      // ── River Proximity ────────────────────────────────────────────────────
      hydrology: {
        distance_to_river_km: toNum(r.distanceToRiverKm),
        note:                  'HydroRIVERS v1.0 — orders 1-7 only',
      },

      // ── Upstream Dams ──────────────────────────────────────────────────────
      upstream_dam: {
        present:    r.upstreamDamPresent ?? false,
        name:       r.upstreamDamName ?? null,
        type:       r.upstreamDamType ?? null,
        height_m:   toNum(r.upstreamDamHeightM),
        river:      r.upstreamDamRiver ?? null,
        main_use:   r.upstreamDamMainUse ?? null,
        year_built: r.upstreamDamYear ?? null,
        note:       'Global Dam Watch v1.0; nearest dam within 100km upstream',
      },

      // ── Governance ─────────────────────────────────────────────────────────
      governance: {
        ndma_flood_prone_district: r.ndmaFloodProneDistrict ?? false,
      },

      // ── Rainfall ───────────────────────────────────────────────────────────
      rainfall: {
        annual_mm:            toNum(r.imdAnnualRainfallMm),
        extreme_days_per_yr:  toNum(r.imdExtremeRainDaysPerYr),
        note:                 'IMD 0.25° gridded 1981-2020 climatology; extreme = >100mm/day',
      },

      // ── Historical Disasters ───────────────────────────────────────────────
      historical: {
        flood_events_per_decade: toNum(r.emdatFloodEventsPerDecade),
        flood_loss_cr:           toNum(r.emdatFloodLossCr),
        note:                    'EM-DAT 1988-present district-level',
      },

      meta: {
        data_as_of:   r.dataAsOfDate ?? null,
        latency_ms:   Date.now() - start,
        sources: [
          'JRC GloFAS v2.1',
          'JRC Global Surface Water v1.4',
          'WRI Aqueduct v2',
          'MERIT Hydro v1.0.1',
          'ESA WorldCover v200',
          'HydroRIVERS v1.0',
          'Global Dam Watch v1.0',
          'NDMA 2021',
          'IMD 1981-2020',
          'EM-DAT',
        ],
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[flood/pincode] error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
