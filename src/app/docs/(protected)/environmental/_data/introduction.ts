export interface IntroPage {
  id: string
  label: string
  content: React.ReactNode
}

export const INTRO_SECTIONS = [
  'abstract',
  'authentication',
  'end-points',
  'http-status-codes',
  'error-codes',
] as const

export type IntroSectionId = typeof INTRO_SECTIONS[number]

export interface IntroSection {
  id: IntroSectionId
  label: string
}

export const INTRO_ITEMS: IntroSection[] = [
  { id: 'abstract',          label: 'Abstract' },
  { id: 'authentication',    label: 'Authentication' },
  { id: 'end-points',        label: 'End Points' },
  { id: 'http-status-codes', label: 'HTTP Status Codes' },
  { id: 'error-codes',       label: 'Error Codes' },
]

export const HTTP_STATUS_CODES = [
  { code: '200', label: 'OK',                    meaning: 'Request succeeded. Response body contains the requested data.' },
  { code: '400', label: 'Bad Request',           meaning: 'The request is malformed — missing required parameters or invalid values.' },
  { code: '401', label: 'Unauthorized',          meaning: 'Authentication failed. The API key is missing, invalid, or expired.' },
  { code: '404', label: 'Not Found',             meaning: 'The requested resource (pincode, state) does not exist in our database.' },
  { code: '429', label: 'Too Many Requests',     meaning: 'Rate limit exceeded. Slow down request frequency.' },
  { code: '500', label: 'Internal Server Error', meaning: 'An unexpected error occurred on our servers. Contact support if this persists.' },
]

export const ERROR_CODES = [
  { code: 'INVALID_REQUEST',   httpStatus: 400, meaning: 'Missing or invalid query parameters. Check required fields.' },
  { code: 'API_KEY_INVALID',   httpStatus: 401, meaning: 'The x-api-key header value does not match any active key.' },
  { code: 'PINCODE_NOT_FOUND', httpStatus: 404, meaning: 'The PIN code supplied is not in our reference database.' },
  { code: 'STATE_NOT_FOUND',   httpStatus: 404, meaning: 'The state name could not be resolved. Try a common alias (e.g. UP, WB, TN).' },
  { code: 'DISTRICT_DATA_NOT_FOUND', httpStatus: 404, meaning: 'No AQI history data found for the requested district and date range.' },
  { code: 'RANGE_TOO_LARGE',   httpStatus: 400, meaning: 'The requested date range exceeds the 5-year (60-month) limit.' },
  { code: 'INTERNAL_ERROR',    httpStatus: 500, meaning: 'Unexpected server-side failure. Retry once; if it persists, contact support.' },
]

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://data.insuretech.in'

export const BASE_URL_TABLE = [
  { environment: 'Production', url: BASE_URL, status: 'Live' },
]
