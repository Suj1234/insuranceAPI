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

/** Driver's License Authentication endpoint path on the vendor. */
export const KARZA_DL_PATH = '/v3/dl'

/** Passport Verification endpoint path on the vendor. */
export const KARZA_PASSPORT_PATH = '/v3/passport-verification'

/** Vehicle RC Authentication - Advanced endpoint path on the vendor. */
export const KARZA_RC_ADVANCED_PATH = '/v3/rc-advanced'

// The GST family does NOT follow the testapi.karza.in/api.karza.in host-swap
// every other endpoint uses. Per the vendor's own Postman collection ("GST
// Authentication collection.json"), GST test traffic goes to api.karza.in
// (the same host as prod) with the environment baked into the path segment
// instead ('uat' for test, 'prod' for live). Confirmed live 2026-08-20 with
// real 200 responses for both gstdetailed and gst-advanced at this host.
export const KARZA_GST_BASE_URL = 'https://api.karza.in'
// ponytail: env inferred from KARZA_BASE_URL by string match, not its own var.
// TODO: switch to an explicit env var (e.g. KARZA_GST_PATH_ENV=uat|prod) once
// there's a real need to decouple the GST path segment from the base host.
const KARZA_GST_ENV_SEGMENT = KARZA_BASE_URL.includes('testapi.karza.in') ? 'uat' : 'prod'

/** GST Authentication endpoint path on the vendor. Use with KARZA_GST_BASE_URL, not KARZA_BASE_URL. */
export const KARZA_GST_PATH = `/gst/${KARZA_GST_ENV_SEGMENT}/v2/gstdetailed`

/** GST Advanced (PAN to all GSTINs + profile + filing history) endpoint path on the vendor. Use with KARZA_GST_BASE_URL. */
export const KARZA_GST_ADVANCED_PATH = `/gst/${KARZA_GST_ENV_SEGMENT}/v2/gst-advanced`

/** GST Search Basis PAN endpoint path on the vendor. Same /gst/ family as GST Authentication/Advanced — use with KARZA_GST_BASE_URL, not KARZA_BASE_URL. Confirmed live 2026-08-20 (200, real GSTIN data) at api.karza.in/gst/uat/v2/search. */
export const KARZA_GST_BY_PAN_PATH = `/gst/${KARZA_GST_ENV_SEGMENT}/v2/search`

/** MCA Signatories endpoint path on the vendor. */
export const KARZA_MCA_SIGNATORIES_PATH = '/v2/mca-signatories'

/** Udyog Aadhar Number endpoint path on the vendor. */
export const KARZA_UDYOG_AADHAAR_PATH = '/v2/uam'

/** Employment Verification Advanced (PAN Flow) endpoint path on the vendor. */
export const KARZA_EMPLOYMENT_ADVANCED_PATH = '/v2/employment-verification-advanced'

/** Digital FootPrint (Mobile) endpoint path on the vendor. */
export const KARZA_DIGITAL_FOOTPRINT_MOBILE_PATH = '/v3/digitalfootprint/phone'

/** Digital Foot Print (Email) endpoint path on the vendor. */
export const KARZA_DIGITAL_FOOTPRINT_EMAIL_PATH = '/v3/digitalfootprint/email'

/** Email Fraud Check endpoint path on the vendor. */
export const KARZA_EMAIL_FRAUD_PATH = '/v3/email-fraud'

/** Mobile to Form Prefill endpoint path on the vendor. */
export const KARZA_MOBILE_PREFILL_PATH = '/v3/mobile-form-prefill'

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
  'dlNo',
  'dlNumber',
  'img',
  'father/husband',
  'pin',
  'completeAddress',
  'accessKey',
  'fileNo',
  'passportNo',
  'registrationNumber',
  'chassisNumber',
  'engineNumber',
  'fatherName',
  'ownerName',
  'permanentAddress',
  'presentAddress',
  'rcMobileNo',
  'gstin',
  'mobNum',
  'email',
  'lgnm',
  'tradeNam',
  'emailId',
  'gstinId',
  'cin',
  'DIN/DPIN/PAN',
  'full_name',
  'uan',
  'mobile',
  'aadhar',
  'AccountNumber',
  'OwnerName',
  'dateOfBirth',
  'fatherHusbandName',
  'mobileNumber',
  'passport',
  'employeeName',
  'employerName',
  'ipAddress',
  'firstName',
  'lastName',
  'fullName',
  'splitName',
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
