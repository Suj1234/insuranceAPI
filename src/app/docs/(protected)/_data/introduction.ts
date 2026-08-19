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
]

export const HTTP_STATUS_CODES = [
  { code: '200', label: 'OK',                       meaning: 'Request Successful' },
  { code: '400', label: 'Bad Request',              meaning: 'Mandatory fields are missing / invalid' },
  { code: '401', label: 'Unauthorized Access',      meaning: 'API Key is missing or invalid.' },
  { code: '402', label: 'Insufficient Credits',     meaning: 'Credits to access the APIs expired.' },
  { code: '500', label: 'Internal Server Error',    meaning: 'Internal processing error of Perfios.' },
  { code: '503', label: 'Source Unavailable',       meaning: 'The source for authentication is down for maintenance or inaccessible.' },
  { code: '504', label: 'Endpoint Request Timed Out', meaning: 'The response latency from the source for authentication is >30sec.' },
]

export const ALTERNATE_RESPONSES = [
  { tab: '400',     status: 400, error: 'Bad Request' },
  { tab: '401',     status: 401, error: 'Unauthorized Access' },
  { tab: '402',     status: 402, error: 'Insufficient Credits' },
  { tab: '500',     status: 500, error: 'Internal Server Error' },
  { tab: '503',     status: 503, error: 'Source Unavailable' },
  { tab: '504 (v2)', status: 504, error: 'Endpoint Request Timed Out' },
  { tab: '504 (v3)', status: 504, error: 'Endpoint Request Timed Out' },
]

export const INTERNAL_STATUS_CODES = [
  { code: '101', auth: 'Valid Authentication',                     ocr: 'Successful OCR' },
  { code: '102', auth: 'Invalid ID number or combination of inputs', ocr: 'No KYC Document identified' },
  { code: '103', auth: 'No records found for the given ID or combination of inputs', ocr: 'Image Format Not Supported OR Size Exceeds 6MB' },
  { code: '104', auth: 'Max retries exceeded',                     ocr: 'N/A' },
  { code: '105', auth: 'Missing Consent',                          ocr: 'N/A' },
  { code: '106', auth: 'Multiple Records Exist',                   ocr: 'N/A' },
  { code: '107', auth: 'Not Supported',                            ocr: 'N/A' },
  { code: '108', auth: 'Internal Resource Unavailable',            ocr: 'N/A' },
  { code: '109', auth: 'Too many records Found',                   ocr: 'N/A' },
]

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://data.insuretech.in'

export const BASE_URL_TABLE = [
  { environment: 'Production', url: BASE_URL, status: 'Live' },
]
