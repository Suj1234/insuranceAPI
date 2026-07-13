import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getPincodeRiskIndex,
  getDistrictByPincode,
  aqiToCategory,
  generateUwNarrative,
} from '@/lib/services/environmental-risk'
import type {
  DistrictRiskResponse,
  DataQuality,
  AqiCategory,
  RiskTier,
} from '@/types/environmental'

const QuerySchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode format'),
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
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
    const risk = await getPincodeRiskIndex(pincode)

    if (!risk) {
      const coord = await getDistrictByPincode(pincode)
      if (!coord) {
        return NextResponse.json(
          { success: false, error: 'Pincode not found.', code: 'PINCODE_NOT_FOUND' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Environmental risk data not yet available for this pincode.', code: 'RISK_DATA_NOT_FOUND' },
        { status: 404 }
      )
    }

    const pm25 = risk.pm25BlendedUg ? Number(risk.pm25BlendedUg) : null
    const pm25Zone = pm25 === null ? 'Unknown'
      : pm25 <= 12  ? 'Good'
      : pm25 <= 35  ? 'Satisfactory'
      : pm25 <= 55  ? 'Moderate'
      : pm25 <= 150 ? 'Poor'
      : pm25 <= 250 ? 'Very Poor'
      : 'Severe'

    const missingFields: string[] = []
    if (!risk.pm25BlendedUg || Number(risk.pm25BlendedUg) === 0) missingFields.push('pm25')
    if (!risk.no2Ppb)                                            missingFields.push('no2')
    if (!risk.disasterFrequencyScore)                            missingFields.push('disasters')
    if (!risk.heatWaveMonthsPerYear)                             missingFields.push('heat')
    if (!risk.hypertensionPct)                                   missingFields.push('health_burden')

    const overallCoverage =
      missingFields.length === 0 ? 'full'
      : missingFields.length <= 2 ? 'partial'
      : 'minimal'

    const pm25Mean3yr        = risk.pm25Blended3yrUg        ? Number(risk.pm25Blended3yrUg)        : null
    const pm25Trend5yrPct    = risk.pm25Trend5yrPct         ? Number(risk.pm25Trend5yrPct)         : null
    const pm25TrendDirection = risk.pm25TrendDirection      ?? null
    const pm25NationalPctile = risk.pm25NationalPctile      ? Number(risk.pm25NationalPctile)      : null
    const compNationalPctile = risk.compositeNationalPctile ? Number(risk.compositeNationalPctile) : null
    const disasterScore      = risk.disasterFrequencyScore  ? Number(risk.disasterFrequencyScore)  : null
    const heatDays           = risk.heatWaveMonthsPerYear
      ? Math.round(Number(risk.heatWaveMonthsPerYear) * 30)
      : null

    const uwNarrative = generateUwNarrative({
      districtName:            risk.districtName ?? pincode,
      stateName:               risk.stateName    ?? '',
      pm25Mean3yr,
      pm25Mean5yr:             pm25,
      pm25Zone,
      pm25TrendDirection,
      pm25Trend5yrPct,
      pm25NationalPctile,
      compositeRiskScore:      Number(risk.compositeRiskScore),
      compositeNationalPctile: compNationalPctile,
      riskTier:                risk.riskTier ?? null,
      disasterFrequencyScore:  disasterScore,
      floodEventsPerDecade:    risk.floodEventsPerDecade   ? Number(risk.floodEventsPerDecade)   : null,
      cycloneEventsPerDecade:  risk.cycloneEventsPerDecade ? Number(risk.cycloneEventsPerDecade) : null,
      heatWaveDaysPerYear:     heatDays,
      hypertensionPct:         risk.hypertensionPct ? Number(risk.hypertensionPct) : null,
    })

    const data: DistrictRiskResponse = {
      uw_narrative: uwNarrative,
      lookup: {
        pincode,
        district_name: risk.districtName ?? '',
        state_name:    risk.stateName    ?? '',
        lat:           risk.lat ? Number(risk.lat) : 0,
        lng:           risk.lng ? Number(risk.lng) : 0,
        city_tier:     null,
      },
      air_quality: {
        pm25: {
          mean_3yr:        pm25Mean3yr,
          mean_5yr:        pm25,
          worst_month_avg: null,
          trend_5yr_pct:   pm25Trend5yrPct,
          trend_direction: pm25TrendDirection as 'improving' | 'stable' | 'worsening' | null,
          vintage: {
            mean_3yr_from: risk.pm253yrFromYear ?? null,
            mean_3yr_to:   risk.pm253yrToYear   ?? null,
            mean_5yr_from: risk.pm255yrFromYear ?? null,
            mean_5yr_to:   risk.pm255yrToYear   ?? null,
          },
          zone:         pm25Zone,
          unit:         'µg/m³',
          data_quality: 'modelled' as DataQuality,
          data_source:  'sedac_cams_blended',
        },
        pm10: {
          mean_3yr:        null,
          mean_5yr:        risk.pm10CamsUg ? Number(risk.pm10CamsUg) : null,
          worst_month_avg: null,
          trend_5yr_pct:   null,
          trend_direction: null,
          vintage:         { mean_3yr_from: null, mean_3yr_to: null, mean_5yr_from: null, mean_5yr_to: null },
          zone:            null,
          unit:            'µg/m³',
          data_quality:    'modelled' as DataQuality,
          data_source:     'cams_eac4',
        },
        no2: {
          mean_5yr:     risk.no2Ppb ? Number(risk.no2Ppb) : null,
          zone:         null,
          unit:         'ppb',
          data_quality: 'modelled' as DataQuality,
          data_source:  'cams_eac4',
        },
        so2: {
          mean_5yr:     risk.so2Ppb ? Number(risk.so2Ppb) : null,
          zone:         null,
          unit:         'ppb',
          data_quality: 'modelled' as DataQuality,
          data_source:  'cams_eac4',
        },
        co: {
          mean_5yr:     risk.coPpm ? Number(risk.coPpm) : null,
          zone:         null,
          unit:         'ppm',
          data_quality: 'modelled' as DataQuality,
          data_source:  'cams_eac4',
        },
        o3: {
          mean_5yr:     risk.o3Ppb ? Number(risk.o3Ppb) : null,
          zone:         null,
          unit:         'ppb',
          data_quality: 'modelled' as DataQuality,
          data_source:  'cams_eac4',
        },
        aqi: {
          annual_mean:        null,
          worst_month_value:  null,
          worst_month_name:   null,
          worst_year:         null,
          category:           aqiToCategory(pm25) as AqiCategory ?? null,
          limiting_pollutant: 'PM2.5',
        },
      },
      disasters: {
        flood_events_per_decade:      risk.floodEventsPerDecade      ? Number(risk.floodEventsPerDecade)      : null,
        cyclone_events_per_decade:    risk.cycloneEventsPerDecade    ? Number(risk.cycloneEventsPerDecade)    : null,
        earthquake_events_per_decade: risk.earthquakeEventsPerDecade ? Number(risk.earthquakeEventsPerDecade) : null,
        disaster_insurance_loss_cr:   risk.disasterInsuranceLossCr   ? Number(risk.disasterInsuranceLossCr)   : null,
        disaster_frequency_score:     disasterScore,
        data_quality: 'measured' as DataQuality,
        data_source:  'emdat',
      },
      heat: {
        heat_wave_days_per_year: heatDays,
        heat_stress_zone: (() => {
          const m = risk.heatWaveMonthsPerYear ? Number(risk.heatWaveMonthsPerYear) : 0
          return m >= 3 ? 'Extreme' : m >= 2 ? 'High' : m >= 1 ? 'Moderate' : 'Low'
        })() as 'Low' | 'Moderate' | 'High' | 'Extreme',
        data_quality: 'modelled' as DataQuality,
        data_source:  'era5',
      },
      health_burden: {
        hypertension_pct: risk.hypertensionPct ? Number(risk.hypertensionPct) : null,
        diabetes_pct:     risk.diabetesPct     ? Number(risk.diabetesPct)     : null,
        obesity_pct:      risk.obesityPct      ? Number(risk.obesityPct)      : null,
        tobacco_use_pct:  risk.tobaccoUsePct   ? Number(risk.tobaccoUsePct)   : null,
        anaemia_pct:      risk.anaemiaPct      ? Number(risk.anaemiaPct)      : null,
        data_quality:     'surveyed' as DataQuality,
        data_source:      'nfhs5',
        data_as_of_year:  2021,
      },
      composite: {
        composite_risk_score:          Number(risk.compositeRiskScore),
        risk_tier:                     (risk.riskTier ?? 'low') as RiskTier,
        pm25_national_percentile:      pm25NationalPctile,
        composite_national_percentile: compNationalPctile,
      },
      data_coverage: {
        overall_coverage: overallCoverage,
        missing_fields:   missingFields,
      },
      meta: {
        db_last_refreshed:     risk.createdAt?.toISOString() ?? null,
        response_time_ms:      Date.now() - start,
        stored_on_application: false,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/environmental/district]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
