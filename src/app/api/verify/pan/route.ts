import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  KARZA_BASE_URL,
  KARZA_AUTH_HEADER,
  KARZA_PAN_PATH,
  redactPii,
} from '@/lib/vendors/karza'
import { logApiCall } from '@/lib/vendors/log'

const ENDPOINT = '/api/verify/pan'
const VENDOR_TIMEOUT_MS = 15_000

// Public request body. `pan` + `consent` are required; the rest are optional
// pass-throughs to Karza (full vs lite profile). We keep validation light and
// let Karza be the source of truth on business rules.
const BodySchema = z.object({
  pan:               z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  consent:           z.enum(['Y', 'N']).default('Y'),
  lite:              z.enum(['Y', 'N']).optional(),
  aadhaarLastFour:   z.string().length(4).optional(),
  dob:               z.string().optional(),
  name:              z.string().optional(),
  address:           z.string().optional(),
  getContactDetails: z.enum(['Y', 'N']).optional(),
  PANStatus:         z.enum(['Y', 'N']).optional(),
  isSalaried:        z.enum(['Y', 'N']).optional(),
  isDirector:        z.enum(['Y', 'N']).optional(),
  isSoleProp:        z.enum(['Y', 'N']).optional(),
})

function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  const apiKey = req.headers.get('x-api-key') ?? ''

  let statusCode = 500
  let logDetails: unknown = null

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    if (!apiKey || !isValidApiKey(apiKey)) {
      statusCode = 401
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key.', code: 'API_KEY_INVALID' },
        { status: 401 }
      )
    }

    // ── Vendor key (v1: single tenant via env) ────────────────────────────
    const karzaKey = process.env.KARZA_KEY
    if (!karzaKey) {
      statusCode = 503
      return NextResponse.json(
        { success: false, error: 'PAN verification is not configured.', code: 'VENDOR_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    // ── Parse + validate body ─────────────────────────────────────────────
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      statusCode = 400
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const parsed = BodySchema.safeParse(raw)
    if (!parsed.success) {
      statusCode = 400
      const msg = parsed.error.errors[0]?.message ?? 'Invalid request'
      return NextResponse.json(
        { success: false, error: msg, code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const body = parsed.data
    // Redacted copy for logging (never log raw PII).
    logDetails = redactPii(body as Record<string, unknown>)

    // ── Call vendor (Karza) with the tenant's key injected server-side ────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS)

    let vendorRes: Response
    try {
      vendorRes = await fetch(`${KARZA_BASE_URL}${KARZA_PAN_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          [KARZA_AUTH_HEADER]: karzaKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      const aborted = err instanceof Error && err.name === 'AbortError'
      statusCode = 504
      return NextResponse.json(
        {
          success: false,
          error: aborted ? 'PAN verification timed out.' : 'PAN verification is temporarily unavailable.',
          code: aborted ? 'VENDOR_TIMEOUT' : 'VENDOR_UNAVAILABLE',
        },
        { status: 504 }
      )
    }
    clearTimeout(timer)

    // ── Normalise vendor response ─────────────────────────────────────────
    let vendorBody: unknown = null
    try {
      vendorBody = await vendorRes.json()
    } catch {
      vendorBody = null
    }

    if (!vendorRes.ok) {
      statusCode = 502
      return NextResponse.json(
        {
          success: false,
          error: 'PAN verification failed at the provider.',
          code: 'VENDOR_ERROR',
          vendor_status: vendorRes.status,
        },
        { status: 502 }
      )
    }

    statusCode = 200
    return NextResponse.json({ success: true, data: vendorBody })
  } catch (err) {
    console.error(`[POST ${ENDPOINT}]`, err)
    statusCode = 500
    return NextResponse.json(
      { success: false, error: 'Internal server error.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  } finally {
    // Log on BOTH success and failure. Never throws.
    await logApiCall({
      req,
      apiKey,
      endpoint: ENDPOINT,
      method: 'POST',
      statusCode,
      latencyMs: Date.now() - start,
      details: logDetails,
    })
  }
}
