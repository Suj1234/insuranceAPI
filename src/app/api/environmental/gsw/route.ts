import { NextRequest, NextResponse } from 'next/server'
import { spawn }                    from 'child_process'
import { z }                        from 'zod'
import { eq }                       from 'drizzle-orm'
import path                         from 'path'
import { db }                       from '@/lib/db'
import { pincodeCoords, pincodeGswCache } from '@/lib/db/schema'

// ── Auth ──────────────────────────────────────────────────────────────────────

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_WINDOWS = ['w2', 'w5', 'w10', 'w20', 'full'] as const

const LatLngSchema = z.object({
  mode:     z.literal('latlong'),
  lat:      z.coerce.number().min(6.0).max(38.0),
  lng:      z.coerce.number().min(67.0).max(99.0),
  buffer_m: z.coerce.number().int().min(250).max(2000).default(500),
  windows:  z.string().default('w2,w5,w10,w20,full'),
})

const PincodeSchema = z.object({
  mode:     z.literal('pincode'),
  pincode:  z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode format'),
  buffer_m: z.coerce.number().int().min(250).max(2000).default(500),
  windows:  z.string().default('w2,w5,w10,w20,full'),
})

function parseWindows(raw: string): string[] {
  return raw.split(',')
    .map(w => w.trim())
    .filter((w): w is typeof VALID_WINDOWS[number] => VALID_WINDOWS.includes(w as never))
}

// ── Python runner ─────────────────────────────────────────────────────────────

const SCRIPT = path.join(process.cwd(), 'scripts', 'compute_gsw.py')
const TIMEOUT_MS = 90_000  // GEE computation can take up to 60-90s

interface GswArgs {
  lat:      number
  lng:      number
  bufferM:  number
  windows:  string[]
  pincode?: string
  district?: string
  state?:   string
}

function runGswScript(args: GswArgs): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const argv = [
      SCRIPT,
      '--lat',      args.lat.toString(),
      '--lng',      args.lng.toString(),
      '--buffer_m', args.bufferM.toString(),
      '--windows',  args.windows.join(','),
      ...(args.pincode  ? ['--pincode',  args.pincode]  : []),
      ...(args.district ? ['--district', args.district] : []),
      ...(args.state    ? ['--state',    args.state]    : []),
    ]

    const geeKeyFile = process.env.GEE_KEY_FILE ?? 'gee-key.json'
    const geeProject = process.env.GEE_PROJECT  ?? 'insuretech-data-platform'

    const proc = spawn('python', argv, {
      env:     { ...process.env, GEE_KEY_FILE: geeKeyFile, GEE_PROJECT: geeProject },
      timeout: TIMEOUT_MS,
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`GSW script exited ${code}: ${stderr.slice(-500)}`))
        return
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>)
      } catch {
        reject(new Error(`GSW script returned non-JSON: ${stdout.slice(0, 300)}`))
      }
    })

    proc.on('error', (err) => reject(err))
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const start = Date.now()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || !isValidApiKey(apiKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const rawMode     = searchParams.has('pincode') ? 'pincode' : 'latlong'
  const rawWindows  = searchParams.get('windows') ?? 'w2,w5,w10,w20,full'
  const rawBuffer   = searchParams.get('buffer_m') ?? '500'

  // ── Resolve lat/lng + location metadata ───────────────────────────────────
  let lat: number
  let lng: number
  let pincode: string | undefined
  let district: string | undefined
  let state: string | undefined

  if (rawMode === 'pincode') {
    const parsed = PincodeSchema.safeParse({
      mode:     'pincode',
      pincode:  searchParams.get('pincode'),
      buffer_m: rawBuffer,
      windows:  rawWindows,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    pincode = parsed.data.pincode

    try {
      const rows = await db
        .select()
        .from(pincodeCoords)
        .where(eq(pincodeCoords.pincode, pincode))
        .limit(1)

      if (!rows.length) {
        return NextResponse.json(
          { success: false, error: `Pincode ${pincode} not found in coordinate database.`, code: 'PINCODE_NOT_FOUND' },
          { status: 404 }
        )
      }

      const coord = rows[0]
      lat      = parseFloat(coord.lat as string)
      lng      = parseFloat(coord.lng as string)
      district = coord.districtName ?? undefined
      state    = coord.stateName    ?? undefined
    } catch (err) {
      console.error('[gsw] DB lookup error:', err)
      return NextResponse.json(
        { success: false, error: 'Database error during pincode lookup.', code: 'DB_ERROR' },
        { status: 500 }
      )
    }
  } else {
    const parsed = LatLngSchema.safeParse({
      mode:     'latlong',
      lat:      searchParams.get('lat'),
      lng:      searchParams.get('lng'),
      buffer_m: rawBuffer,
      windows:  rawWindows,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }
    lat = parsed.data.lat
    lng = parsed.data.lng
  }

  const bufferM  = parseInt(rawBuffer, 10) || 500
  const windows  = parseWindows(rawWindows)
  if (!windows.length) {
    return NextResponse.json(
      { success: false, error: `No valid windows specified. Valid: ${VALID_WINDOWS.join(', ')}.`, code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  // ── Cache lookup (pincode mode only) ─────────────────────────────────────
  if (pincode) {
    try {
      const cached = await db
        .select({ data: pincodeGswCache.data })
        .from(pincodeGswCache)
        .where(eq(pincodeGswCache.pincode, pincode))
        .limit(1)

      if (cached.length && cached[0].data) {
        const stored = cached[0].data as Record<string, unknown>
        const storedMeta = (stored.meta ?? {}) as Record<string, unknown>
        return NextResponse.json({
          success: true,
          source:  'cache',
          request: { mode: 'pincode', pincode, buffer_m: bufferM, windows_requested: windows },
          location: { pincode, district, state, lat, lng, buffer_m: bufferM },
          ...stored,
          meta: { ...storedMeta, pincode, district, state, total_api_latency_ms: Date.now() - start },
        })
      }
    } catch (err) {
      // Cache miss or error — fall through to live GEE
      console.warn('[gsw] cache lookup failed, falling through to GEE:', err)
    }
  }

  // ── Run GEE computation ───────────────────────────────────────────────────
  try {
    const result = await runGswScript({ lat, lng, bufferM, windows, pincode, district, state })

    // Stamp total API latency (GEE fetch + overhead)
    if (result.meta && typeof result.meta === 'object') {
      (result.meta as Record<string, unknown>).total_api_latency_ms = Date.now() - start
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[gsw] computation error:', msg)

    // Distinguish timeout from other failures
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')
    return NextResponse.json(
      {
        success: false,
        error:   isTimeout
          ? 'GEE computation timed out. Try a smaller buffer or fewer windows.'
          : 'GEE computation failed. Check server logs.',
        code:    isTimeout ? 'COMPUTATION_TIMEOUT' : 'COMPUTATION_ERROR',
        detail:  process.env.NODE_ENV === 'development' ? msg : undefined,
      },
      { status: 503 }
    )
  }
}
