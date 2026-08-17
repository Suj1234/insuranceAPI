/**
 * Karza (TKYC) vendor config + helpers.
 *
 * v1 is intentionally minimal: one capability (PAN Profile), one tenant, key
 * from an env var. The multi-tenant secrets-file + DB auth described in
 * docs/vendor-proxy-design.md come later — the shape here is meant to grow into
 * a proper VendorAdapter without a rewrite.
 */

/** Vendor base URL (internal — the user never sees this). Test by default. */
export const KARZA_BASE_URL =
  process.env.KARZA_BASE_URL ?? 'https://testapi.karza.in'

/** Static auth header name for Karza. */
export const KARZA_AUTH_HEADER = 'x-karza-key'

/** PAN Profile endpoint path on the vendor. */
export const KARZA_PAN_PATH = '/v3/pan-profile'

/**
 * Fields in the PAN request/response that are PII and must never be logged raw.
 * Used by the redactor before writing api_call_logs.
 */
export const PAN_PII_FIELDS = [
  'pan',
  'aadhaarLastFour',
  'dob',
  'name',
  'address',
] as const

/**
 * Mask a PII string, keeping only the last 4 characters.
 * "ABCDE1234F" -> "******234F"  ·  "" / null -> ""
 */
function maskValue(v: unknown): string {
  const s = String(v ?? '')
  if (s.length <= 4) return '*'.repeat(s.length)
  return '*'.repeat(s.length - 4) + s.slice(-4)
}

/**
 * Return a shallow copy of an object with any PII fields masked. Safe to log.
 */
export function redactPii<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj }
  for (const field of PAN_PII_FIELDS) {
    if (field in out && out[field] != null && out[field] !== '') {
      out[field] = maskValue(out[field])
    }
  }
  return out as T
}
