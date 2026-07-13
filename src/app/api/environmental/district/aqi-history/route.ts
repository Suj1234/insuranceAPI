import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDistrictAQIHistory, aqiToCategory } from '@/lib/services/environmental-risk'
import type { AqiHistoryPoint, AqiHistoryResponse, DataQuality, AqiCategory } from '@/types/environmental'

const MONTH_NAMES: Record<number, string> = {
  1:'January',2:'February',3:'March',4:'April',5:'May',6:'June',
  7:'July',8:'August',9:'September',10:'October',11:'November',12:'December',
}

const YEAR_MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

const QuerySchema = z.object({
  district:   z.string().min(1).max(200),
  state:      z.string().min(1).max(200),
  from:       z.string().regex(YEAR_MONTH_RE, 'from must be YYYY-MM'),
  to:         z.string().regex(YEAR_MONTH_RE, 'to must be YYYY-MM'),
  pollutants: z.string().optional(),
})

function parseYearMonth(s: string): { year: number; month: number } {
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m }
}

function monthsBetween(
  fromYear: number, fromMonth: number,
  toYear: number, toMonth: number,
): number {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const envKey = process.env.INTERNAL_ENV_API_KEY
  if (!apiKey || !envKey || apiKey !== envKey) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    district:   searchParams.get('district'),
    state:      searchParams.get('state'),
    from:       searchParams.get('from'),
    to:         searchParams.get('to'),
    pollutants: searchParams.get('pollutants') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { district, state, from, to, pollutants: pollutantsParam } = parsed.data
  const fromParsed = parseYearMonth(from)
  const toParsed   = parseYearMonth(to)

  // Validate range
  if (
    toParsed.year < fromParsed.year ||
    (toParsed.year === fromParsed.year && toParsed.month < fromParsed.month)
  ) {
    return NextResponse.json(
      { success: false, error: "'to' must be after 'from'.", code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  if (monthsBetween(fromParsed.year, fromParsed.month, toParsed.year, toParsed.month) > 60) {
    return NextResponse.json(
      { success: false, error: 'Maximum date range is 5 years (60 months).', code: 'RANGE_TOO_LARGE' },
      { status: 400 }
    )
  }

  // Default pollutants = pm25, aqi
  const requestedPollutants = new Set(
    (pollutantsParam ?? 'pm25,aqi').split(',').map(p => p.trim().toLowerCase())
  )

  try {
    const rows = await getDistrictAQIHistory(
      district, state,
      fromParsed.year, fromParsed.month,
      toParsed.year, toParsed.month,
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No AQI history found for this district and date range.', code: 'DISTRICT_DATA_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Build series
    const gapFilledMonths: string[] = []

    const series: AqiHistoryPoint[] = rows.map(row => {
      const point: AqiHistoryPoint = {
        year:       row.year,
        month:      row.month,
        month_name: MONTH_NAMES[row.month] ?? String(row.month),
      }

      const pm25Quality: DataQuality = row.pm25Source === 'cpcb_direct' ? 'measured'
        : row.pm25Source === 'cams_gap_fill' ? 'gap_filled'
        : 'modelled'

      if (row.pm25Source === 'cams_gap_fill') {
        gapFilledMonths.push(`${row.year}-${String(row.month).padStart(2, '0')}`)
      }

      if (requestedPollutants.has('pm25') || requestedPollutants.has('all')) {
        point.pm25 = { value: row.pm25Calibrated ? Number(row.pm25Calibrated) : null, data_quality: pm25Quality }
      }
      if (requestedPollutants.has('pm10') || requestedPollutants.has('all')) {
        point.pm10 = { value: row.pm10Calibrated ? Number(row.pm10Calibrated) : null, data_quality: 'measured' }
      }
      if (requestedPollutants.has('no2') || requestedPollutants.has('all')) {
        point.no2 = { value: row.no2Cams ? Number(row.no2Cams) : null, data_quality: 'modelled' }
      }
      if (requestedPollutants.has('so2') || requestedPollutants.has('all')) {
        point.so2 = { value: row.so2Cams ? Number(row.so2Cams) : null, data_quality: 'modelled' }
      }
      if (requestedPollutants.has('co') || requestedPollutants.has('all')) {
        point.co = { value: row.coCams ? Number(row.coCams) : null, data_quality: 'modelled' }
      }
      if (requestedPollutants.has('o3') || requestedPollutants.has('all')) {
        point.o3 = { value: row.o3Cams ? Number(row.o3Cams) : null, data_quality: 'modelled' }
      }
      if (requestedPollutants.has('aqi') || requestedPollutants.has('all')) {
        const aqiVal = row.aqiRepresentative ? Number(row.aqiRepresentative) : null
        point.aqi = { value: aqiVal, category: aqiToCategory(aqiVal) }
      }

      return point
    })

    // Annual means summary
    const yearGroups = new Map<number, { pm25: number[]; aqi: number[] }>()
    for (const row of rows) {
      if (!yearGroups.has(row.year)) yearGroups.set(row.year, { pm25: [], aqi: [] })
      const g = yearGroups.get(row.year)!
      if (row.pm25Calibrated) g.pm25.push(Number(row.pm25Calibrated))
      if (row.aqiRepresentative) g.aqi.push(Number(row.aqiRepresentative))
    }
    const annualMeans = [...yearGroups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, g]) => ({
        year,
        pm25_mean: g.pm25.length ? Number((g.pm25.reduce((s, v) => s + v, 0) / g.pm25.length).toFixed(1)) : null,
        aqi_mean:  g.aqi.length  ? Number((g.aqi.reduce((s, v)  => s + v, 0) / g.aqi.length).toFixed(1))  : null,
      }))

    // Worst and best month
    const withAqi = rows.filter(r => r.aqiRepresentative !== null)
    let worstMonth = null
    let bestMonth = null
    if (withAqi.length > 0) {
      const worst = withAqi.reduce((a, b) =>
        Number(a.aqiRepresentative) >= Number(b.aqiRepresentative) ? a : b
      )
      const best = withAqi.reduce((a, b) =>
        Number(a.aqiRepresentative) <= Number(b.aqiRepresentative) ? a : b
      )
      const aqiCatFor = (r: typeof worst) =>
        aqiToCategory(r.aqiRepresentative ? Number(r.aqiRepresentative) : null)

      worstMonth = {
        year: worst.year, month: worst.month,
        month_name: MONTH_NAMES[worst.month] ?? String(worst.month),
        pm25: worst.pm25Calibrated ? Number(worst.pm25Calibrated) : null,
        aqi: worst.aqiRepresentative ? Number(worst.aqiRepresentative) : null,
        category: aqiCatFor(worst),
      }
      bestMonth = {
        year: best.year, month: best.month,
        month_name: MONTH_NAMES[best.month] ?? String(best.month),
        pm25: best.pm25Calibrated ? Number(best.pm25Calibrated) : null,
        aqi: best.aqiRepresentative ? Number(best.aqiRepresentative) : null,
        category: aqiCatFor(best),
      }
    }

    // Trend: compare first half vs second half annual means
    const trend = (() => {
      if (annualMeans.length < 2) return 'stable' as const
      const mid = Math.floor(annualMeans.length / 2)
      const firstHalf  = annualMeans.slice(0, mid).map(y => y.pm25_mean ?? 0)
      const secondHalf = annualMeans.slice(mid).map(y => y.pm25_mean ?? 0)
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
      const diff = avg(secondHalf) - avg(firstHalf)
      if (diff > 5)  return 'worsening' as const
      if (diff < -5) return 'improving' as const
      return 'stable' as const
    })()

    const measuredCount = rows.filter(r => r.pm25Source === 'cpcb_direct').length

    const data: AqiHistoryResponse = {
      district_name: district,
      state_name:    state,
      series,
      summary: {
        annual_means:     annualMeans,
        worst_month_ever: worstMonth,
        best_month_ever:  bestMonth,
        trend,
      },
      meta: {
        total_months:               rows.length,
        months_with_measured_data:  measuredCount,
        months_gap_filled:          gapFilledMonths.length,
        gap_filled_months:          gapFilledMonths,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/environmental/district/aqi-history]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
