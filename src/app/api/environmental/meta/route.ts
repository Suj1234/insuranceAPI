import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { districtAirQuality, waterQualityState, waterQualityHotspots } from '@/lib/db/schema'

export interface MetaPayload {
  aqiStates: string[]
  aqiDistrictsByState: Record<string, string[]>
  waterStates: string[]
  hotspotStates: string[]
}

let cached: { data: MetaPayload; expiresAt: number } | null = null

export async function GET() {
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ success: true, data: cached.data })
  }

  try {
    const [aqiRows, waterRows, hotspotRows] = await Promise.all([
      db.selectDistinct({
        stateName: districtAirQuality.stateName,
        districtName: districtAirQuality.districtName,
      })
        .from(districtAirQuality)
        .orderBy(districtAirQuality.stateName, districtAirQuality.districtName),

      db.selectDistinct({ stateName: waterQualityState.stateName })
        .from(waterQualityState)
        .orderBy(waterQualityState.stateName),

      db.selectDistinct({ stateName: waterQualityHotspots.stateName })
        .from(waterQualityHotspots)
        .orderBy(waterQualityHotspots.stateName),
    ])

    const aqiStatesSet = new Set<string>()
    const aqiDistrictsByState: Record<string, string[]> = {}
    for (const { stateName, districtName } of aqiRows) {
      aqiStatesSet.add(stateName)
      if (!aqiDistrictsByState[stateName]) aqiDistrictsByState[stateName] = []
      aqiDistrictsByState[stateName].push(districtName)
    }

    const data: MetaPayload = {
      aqiStates: [...aqiStatesSet].sort(),
      aqiDistrictsByState,
      waterStates: waterRows.map(r => r.stateName).sort(),
      hotspotStates: hotspotRows.map(r => r.stateName).sort(),
    }

    cached = { data, expiresAt: Date.now() + 60 * 60 * 1000 }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[meta] failed:', err)
    return NextResponse.json({ success: false, error: 'Failed to load metadata' }, { status: 500 })
  }
}
