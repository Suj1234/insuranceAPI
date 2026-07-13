/**
 * Live API test with Sujeet Kumar's personal details
 * Run: node scripts/test-my-data.mjs
 */
import { readFileSync } from 'fs'

const envVars = Object.fromEntries(
  readFileSync('e:/Insuretech/india-health-platform/.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
)

const KARZA_BASE_URL = envVars.KARZA_BASE_URL
const KARZA_API_KEY  = envVars.KARZA_API_KEY
const KSCAN_BASE_URL = envVars.KARZA_KSCAN_BASE_URL ?? 'https://api.karza.in/kscan/test'
const KSCAN_API_KEY  = envVars.KARZA_KSCAN_API_KEY ?? KARZA_API_KEY

const MOBILE = '9554259281'
const PAN    = 'DUBPK2402Q'
const EMAIL  = 'sujeet.kr2496@gmail.com'

const sep  = () => console.log('\n' + '═'.repeat(60))
const head = (t) => { sep(); console.log('  ' + t); sep() }

async function karzaPost(path, body) {
  const res = await fetch(`${KARZA_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'x-karza-key': KARZA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function kscanPost(entityName) {
  const res = await fetch(`${KSCAN_BASE_URL}/v1/litigations/bi/all/classification`, {
    method: 'POST',
    headers: { 'x-karza-key': KSCAN_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityName, entityRelation: 'b', countOnly: false,
      fuzziness: true, fuzzinessLevel: 'general',
      pageNo: 1, pageSize: 50,
      dateType: 'filingDate', aggregationType: 'date', type: 'lite',
    }),
    signal: AbortSignal.timeout(60000),
  })
  const initial = await res.json()
  if (initial.result?.location) {
    const dl = await fetch(initial.result.location, { signal: AbortSignal.timeout(30000) })
    return dl.json()
  }
  return initial
}

// ─────────────────────────────────────────────────────────
// 1. MOBILE PREFILL
// ─────────────────────────────────────────────────────────
head('1. MOBILE PREFILL — ' + MOBILE)
try {
  const d = await karzaPost('/v3/mobile-form-prefill', { mobile: MOBILE, consent: 'Y' })
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

// ─────────────────────────────────────────────────────────
// 2. PAN PROFILE
// ─────────────────────────────────────────────────────────
head('2. PAN PROFILE — ' + PAN)
let entityName = 'SUJEET KUMAR'
let pincode = null
try {
  const d = await karzaPost('/v3/pan-profile', {
    pan: PAN, getContactDetails: 'Y', PANStatus: 'Y',
    isSalaried: 'Y', isDirector: 'Y', isSoleProp: 'Y',
    fatherName: 'Y', consent: 'Y',
  })
  entityName = d.result?.name ?? entityName
  pincode    = d.result?.address?.pinCode
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

// ─────────────────────────────────────────────────────────
// 3. EMPLOYMENT VERIFICATION
// ─────────────────────────────────────────────────────────
head('3. EMPLOYMENT VERIFICATION — PAN: ' + PAN + ' | Name: ' + entityName)
try {
  const d = await karzaPost('/v2/employment-verification-advanced', {
    pan: PAN, employeeName: entityName, mobile: MOBILE,
    runPanFlow: true, isLatestEmployer: true, showFailures: false, consent: 'Y',
  })
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

// ─────────────────────────────────────────────────────────
// 4. EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────
head('4. EMAIL VERIFICATION — ' + EMAIL)
try {
  const d = await karzaPost('/v2/email-verification', { email: EMAIL, version: '3', consent: 'y' })
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

// ─────────────────────────────────────────────────────────
// 5. EMAIL FRAUD
// ─────────────────────────────────────────────────────────
head('5. EMAIL FRAUD CHECK — ' + EMAIL)
try {
  const d = await karzaPost('/v3/email-fraud', {
    email: EMAIL, firstName: 'SUJEET', lastName: 'KUMAR', consent: 'Y',
  })
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

// ─────────────────────────────────────────────────────────
// 6. KSCAN LITIGATION (includeLitigation: true)
// ─────────────────────────────────────────────────────────
head('6. KSCAN LITIGATION — ' + entityName + ' (includeLitigation: true)')
try {
  const d = await kscanPost(entityName)
  console.log(JSON.stringify(d, null, 2))
} catch (e) { console.error('ERROR:', e.message) }

sep()
console.log('  ALL DONE')
sep()
