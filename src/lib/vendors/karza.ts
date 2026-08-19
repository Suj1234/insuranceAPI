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

/** PAN Status Check (authentication) endpoint path on the vendor. */
export const KARZA_PAN_STATUS_PATH = '/v2/pan-authentication'

/** PAN DOB Status (basic profile) endpoint path on the vendor. */
export const KARZA_PAN_DOB_STATUS_PATH = '/v3/pan-profile-basic'

/** PAN Link Status (unique Aadhaar) — step 1: share consent, get accessKey. */
export const KARZA_PAN_LINK_UNIQUE_CONSENT_PATH = '/v3/aadhaar-consent'

/** PAN Link Status (unique Aadhaar) — step 2: check PAN-Aadhaar link using accessKey. */
export const KARZA_PAN_LINK_UNIQUE_CHECK_PATH = '/v3/pan-aadhaar-link'

/** PAN Link Status (any Aadhaar) endpoint path on the vendor. */
export const KARZA_PAN_LINK_ANY_PATH = '/v3/pan-link'

/** Bank AC Verification Advanced endpoint path on the vendor. */
export const KARZA_BANK_AC_ADVANCED_PATH = '/v3/bankacc-verification'

/** Silent Bank Account Verification (non-penny) endpoint path on the vendor. */
export const KARZA_BANK_AC_SILENT_PATH = '/v3/bankacc-verification-non-penny'

/**
 * Fields in the PAN request/response that are PII and must never be logged raw.
 * Used by the redactor before writing api_call_logs.
 */
export const PAN_PII_FIELDS = [
  'pan',
  'aadhaarLastFour',
  'aadhaarNo',
  'dob',
  'name',
  'address',
  'ipAddress',
  'accountNumber',
  'accountHolderName',
  'ifsc',
  'bankRRN',
  'accessKey',
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
