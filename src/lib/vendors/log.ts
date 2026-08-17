import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiCallLogs } from '@/lib/db/schema'

/**
 * Write one row to api_call_logs. Never throws — logging must not break a
 * request. Call this on BOTH success and failure (from a finally block).
 *
 * NOTE: `details` must already be PII-redacted by the caller. It is stored in
 * the existing `queryParams` text column (the table has no dedicated body
 * column yet); JSON-stringified.
 */
export async function logApiCall(params: {
  req: NextRequest
  apiKey: string
  endpoint: string
  method: string
  statusCode: number
  latencyMs: number
  details?: unknown
}): Promise<void> {
  try {
    await db.insert(apiCallLogs).values({
      apiKey:      params.apiKey,
      endpoint:    params.endpoint,
      method:      params.method,
      queryParams: params.details != null ? JSON.stringify(params.details) : null,
      statusCode:  params.statusCode,
      latencyMs:   params.latencyMs,
      userAgent:   params.req.headers.get('user-agent') ?? null,
      ipAddress:
        params.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        params.req.headers.get('x-real-ip') ??
        null,
    })
  } catch (err) {
    // Swallow — a logging failure must never surface to the caller.
    console.error('[logApiCall] failed to write api_call_logs', err)
  }
}
