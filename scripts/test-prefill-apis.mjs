/**
 * End-to-end test script for all 3 prefill APIs
 * Run: node scripts/test-prefill-apis.mjs
 *
 * Covers 20 scenarios across mobile-prefill, pan-prefill, email-prefill, and KSCAN litigation
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Load env ──────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const KARZA_BASE_URL = envVars.KARZA_BASE_URL ?? ''
const KARZA_API_KEY = envVars.KARZA_API_KEY ?? ''
const KSCAN_BASE_URL = envVars.KARZA_KSCAN_BASE_URL ?? 'https://api.karza.in/kscan/test'
// KSCAN uses its own key; falls back to the general Karza key if not set separately
const KSCAN_API_KEY = envVars.KARZA_KSCAN_API_KEY ?? KARZA_API_KEY

const PASS = '✅ PASS'
const FAIL = '❌ FAIL'
const SKIP = '⚠️  SKIP'

let passed = 0
let failed = 0
let skipped = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

async function karzaPost(path, body, timeoutMs = 30000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${KARZA_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'x-karza-key': KARZA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return { ok: res.ok, status: res.status, data: await res.json() }
  } finally {
    clearTimeout(t)
  }
}

async function kscanPost(body, timeoutMs = 60000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${KSCAN_BASE_URL}/v1/litigations/bi/all/classification`, {
      method: 'POST',
      headers: { 'x-karza-key': KSCAN_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const initial = await res.json()
    // KSCAN two-step: POST returns { result: { location } } → GET that URL for actual data
    if (initial.result?.location) {
      const dlRes = await fetch(initial.result.location, { signal: controller.signal })
      const data = await dlRes.json()
      return { ok: res.ok, status: res.status, data }
    }
    return { ok: res.ok, status: res.status, data: initial }
  } finally {
    clearTimeout(t)
  }
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS}  ${label}`)
    passed++
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function skip(label, reason) {
  console.log(`  ${SKIP}  ${label} (${reason})`)
  skipped++
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

// ── Inline litigation filtering logic (mirrors route logic) ───────────────────

function fuzzyDistrictMatch(courtDistrict, targetDistrict) {
  const a = courtDistrict.toLowerCase().trim()
  const b = targetDistrict.toLowerCase().trim()
  return a === b || a.includes(b) || b.includes(a)
}

function determineRole(searchName, petitioners, respondents) {
  const name = searchName.toLowerCase()
  const inPetitioner = petitioners.some((n) => {
    const nl = n.toLowerCase()
    return nl.includes(name) || name.includes(nl)
  })
  const inRespondent = respondents.some((n) => {
    const nl = n.toLowerCase()
    return nl.includes(name) || name.includes(nl)
  })
  if (inPetitioner && inRespondent) return 'both'
  if (inPetitioner) return 'petitioner'
  return 'respondent'
}

function buildLitigationResult(cases, searchName, filterDistrict, filterState, pincodeMatched) {
  const filtered = filterDistrict && filterState
    ? cases.filter(
        (c) =>
          c.state.toLowerCase() === filterState.toLowerCase() &&
          fuzzyDistrictMatch(c.district, filterDistrict)
      )
    : cases

  const stats = { asPetitioner: { total: 0, civil: 0, criminal: 0 }, asRespondent: { total: 0, civil: 0, criminal: 0 } }
  let pending = 0, disposed = 0, criminal = 0, civil = 0, highSeverity = 0

  for (const c of filtered) {
    if (c.caseStatus === 'Pending') pending++; else disposed++
    if (c.civilCriminal === 'Criminal') criminal++; else civil++
    if (c.severity_ === 'high' || c.severity_ === 'highRelevance') highSeverity++

    const role = determineRole(searchName, c.petitionerNameList, c.respondentNameList)
    const isCivil = c.civilCriminal === 'Civil'
    if (role === 'petitioner' || role === 'both') {
      stats.asPetitioner.total++
      if (isCivil) stats.asPetitioner.civil++; else stats.asPetitioner.criminal++
    }
    if (role === 'respondent' || role === 'both') {
      stats.asRespondent.total++
      if (isCivil) stats.asRespondent.civil++; else stats.asRespondent.criminal++
    }
  }

  const top10 = [...filtered]
    .sort((a, b) => {
      if (!a.filingDate) return 1
      if (!b.filingDate) return -1
      return b.filingDate.localeCompare(a.filingDate)
    })
    .slice(0, 10)
    .map((c) => ({
      cino: c.cino,
      caseNumber: c.casetypeCaseNoCaseYr,
      type: c.civilCriminal,
      status: c.caseStatus,
      filingDate: c.filingDate,
      nextHearingDate: c.nextHearingDate,
      decisionDate: c.decisionDate,
      court: c.courtEstablishment,
      district: c.district,
      state: c.state,
      acts: c.standardAct,
      sections: c.standardSection,
      partyRole: determineRole(searchName, c.petitionerNameList, c.respondentNameList),
      petitioners: c.petitionerNameList,
      respondents: c.respondentNameList,
      severity: c.severity_,
      firDetails: c.firDetails,
      riskTags: [...new Set(c.standardTags.map((t) => t.keyword).filter(Boolean))],
    }))

  return {
    filter: { district: filterDistrict, state: filterState, pincode_matched: pincodeMatched },
    totalCases: filtered.length,
    pendingCases: pending,
    disposedCases: disposed,
    criminalCases: criminal,
    civilCases: civil,
    highSeverityCases: highSeverity,
    statistics: stats,
    cases: top10,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK 1 — Mobile Form Prefill
// ═══════════════════════════════════════════════════════════════════════════════

section('BLOCK 1 — Mobile Form Prefill (/v3/mobile-form-prefill)')

// TC-01: Known mobile with PAN linked
console.log('\nTC-01: Mobile with PAN linked (test number from Postman)')
try {
  const r = await karzaPost('/v3/mobile-form-prefill', { mobile: '9554259281', consent: 'Y' })
  console.log('  Status code:', r.data.statusCode)
  if (r.data.statusCode === 101 && r.data.result?.pan) {
    console.log('  Case A — PAN found:', r.data.result.pan)
    console.log('  Name:', r.data.result.panDetails?.fullName)
    console.log('  DOB:', r.data.result.panDetails?.dob)
    console.log('  City:', r.data.result.panDetails?.address?.city)
    console.log('  Pincode:', r.data.result.panDetails?.address?.zip)
    assert('statusCode 101', r.data.statusCode === 101)
    assert('pan is non-empty string', typeof r.data.result.pan === 'string' && r.data.result.pan.length > 0)
    assert('fullName present', !!r.data.result.panDetails?.fullName)
    assert('dob present', !!r.data.result.panDetails?.dob)
    assert('address.zip present', !!r.data.result.panDetails?.address?.zip)
  } else {
    console.log('  Case B — no PAN linked (statusCode:', r.data.statusCode, ')')
    assert('API responded (102 = no PAN is valid)', r.data.statusCode === 101 || r.data.statusCode === 102)
    skip('PAN field assertions', 'no PAN linked to this mobile')
  }
} catch (e) {
  assert('TC-01 completed without error', false, e.message)
}

// TC-02: Random mobile (unlikely to have PAN)
console.log('\nTC-02: Random mobile — expect Case B (no PAN)')
try {
  const r = await karzaPost('/v3/mobile-form-prefill', { mobile: '9000000001', consent: 'Y' })
  console.log('  Status code:', r.data.statusCode)
  // 101 = success with/without PAN, 102 = no record, 103 = mobile not found
  assert('returns valid status (101/102/103)', [101, 102, 103].includes(r.data.statusCode))
  if (r.data.statusCode !== 101 || !r.data.result?.pan) {
    assert('Case B shape — pan absent or empty', !r.data.result?.pan)
  } else {
    console.log('  Unexpected: PAN found:', r.data.result.pan)
    assert('Case A shape — pan present', !!r.data.result.pan)
  }
} catch (e) {
  assert('TC-02 completed without error', false, e.message)
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK 2 — PAN Profile
// ═══════════════════════════════════════════════════════════════════════════════

section('BLOCK 2 — PAN Profile (/v3/pan-profile)')

const TEST_PAN = 'DUBPK2402Q'

// TC-03: Valid PAN — full profile with fatherName toggle
console.log('\nTC-03: PAN profile with fatherName enabled')
let panProfileResult = null
try {
  const r = await karzaPost('/v3/pan-profile', {
    pan: TEST_PAN,
    getContactDetails: 'Y',
    PANStatus: 'Y',
    isSalaried: 'Y',
    isDirector: 'Y',
    isSoleProp: 'Y',
    fatherName: 'Y',
    consent: 'Y',
  })
  console.log('  Status code:', r.data.statusCode)
  if (r.data.statusCode === 101) {
    panProfileResult = r.data.result
    console.log('  Name:', r.data.result.name)
    console.log('  DOB:', r.data.result.dob)
    console.log('  Gender:', r.data.result.gender)
    console.log('  Father Name:', r.data.result.fatherName ?? '(not returned)')
    console.log('  PAN Status:', r.data.result.status)
    console.log('  isSalaried:', r.data.result.isSalaried)
    console.log('  isDirector:', r.data.result.isDirector)
    console.log('  isSoleProp:', r.data.result.isSoleProp)
    console.log('  Pincode:', r.data.result.address?.pinCode)
    assert('statusCode 101', r.data.statusCode === 101)
    assert('name present', !!r.data.result.name)
    assert('dob present', !!r.data.result.dob)
    assert('gender present', !!r.data.result.gender)
    assert('address.pinCode present', !!r.data.result.address?.pinCode)
    assert('status present', !!r.data.result.status)
    assert('isSalaried is boolean or null', r.data.result.isSalaried === null || typeof r.data.result.isSalaried === 'boolean')
  } else {
    assert('PAN valid', false, `statusCode ${r.data.statusCode}`)
  }
} catch (e) {
  assert('TC-03 completed without error', false, e.message)
}

// TC-04: Invalid PAN format (API-level)
console.log('\nTC-04: Invalid PAN — expect error response')
try {
  const r = await karzaPost('/v3/pan-profile', {
    pan: 'INVALID123',
    getContactDetails: 'Y',
    PANStatus: 'Y',
    consent: 'Y',
  })
  console.log('  Status code:', r.data.statusCode)
  assert('non-101 status for invalid PAN', r.data.statusCode !== 101)
} catch (e) {
  assert('TC-04 responded (error is ok)', true)
}

// TC-05: PAN from mobile prefill result (if TC-01 got one)
console.log('\nTC-05: Cross-validate — PAN from mobile prefill used in PAN profile')
try {
  const mobilePanRes = await karzaPost('/v3/mobile-form-prefill', { mobile: '9554259281', consent: 'Y' })
  if (mobilePanRes.data.statusCode === 101 && mobilePanRes.data.result?.pan) {
    const pan = mobilePanRes.data.result.pan
    const panRes = await karzaPost('/v3/pan-profile', { pan, getContactDetails: 'Y', PANStatus: 'Y', fatherName: 'Y', consent: 'Y' })
    console.log('  Mobile → PAN:', pan)
    console.log('  PAN profile name:', panRes.data.result?.name)
    console.log('  Mobile prefill name:', mobilePanRes.data.result.panDetails.fullName)
    assert('PAN profile status 101', panRes.data.statusCode === 101)
    assert('Name consistent between mobile and PAN profile',
      panRes.data.result?.name?.toUpperCase().includes(
        mobilePanRes.data.result.panDetails.fullName.split(' ')[0]
      )
    )
  } else {
    skip('TC-05 cross-validation', 'mobile TC-01 did not return PAN')
  }
} catch (e) {
  assert('TC-05 completed without error', false, e.message)
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK 3 — Employment Verification
// ═══════════════════════════════════════════════════════════════════════════════

section('BLOCK 3 — Employment Verification (/v2/employment-verification-advanced)')

// TC-06: Employment for known PAN
console.log('\nTC-06: Employment verification for test PAN')
try {
  const name = panProfileResult?.name ?? 'TEST USER'
  const r = await karzaPost('/v2/employment-verification-advanced', {
    pan: TEST_PAN,
    runPanFlow: true,
    isLatestEmployer: true,
    showFailures: false,
    employeeName: name,
    consent: 'Y',
  })
  console.log('  Status code:', r.data['status-code'])
  console.log('  Organization:', r.data.result?.nameLookup?.organizationName ?? '(none)')
  console.log('  isEmployed:', r.data.result?.nameLookup?.isEmployed)
  console.log('  Personal name:', r.data.result?.personalInfo?.name ?? '(none)')
  console.log('  Father/Husband name:', r.data.result?.personalInfo?.fatherHusbandName ?? '(none)')
  console.log('  Relation:', r.data.result?.personalInfo?.relation ?? '(none)')
  assert('status-code 101', r.data['status-code'] === '101')
  assert('result present', !!r.data.result)
  if (r.data.result?.nameLookup) {
    assert('organizationName is string or empty', typeof r.data.result.nameLookup.organizationName === 'string')
    assert('isEmployed is boolean', typeof r.data.result.nameLookup.isEmployed === 'boolean')
  } else {
    skip('nameLookup assertions', 'nameLookup absent in response')
  }
} catch (e) {
  assert('TC-06 completed without error', false, e.message)
}

// TC-07: Employment without employeeName (should still work)
console.log('\nTC-07: Employment verification without employeeName (PAN-only flow)')
try {
  const r = await karzaPost('/v2/employment-verification-advanced', {
    pan: TEST_PAN,
    runPanFlow: true,
    isLatestEmployer: true,
    showFailures: false,
    consent: 'Y',
  })
  console.log('  Status code:', r.data['status-code'])
  assert('status-code 101 without employeeName', r.data['status-code'] === '101')
} catch (e) {
  assert('TC-07 completed without error', false, e.message)
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK 4 — Email Verification + Fraud
// ═══════════════════════════════════════════════════════════════════════════════

section('BLOCK 4 — Email Verification (/v2/email-verification)')

const testEmails = [
  { email: 'rahul.sharma@tcs.com', label: 'Corporate email' },
  { email: 'test.user@gmail.com', label: 'Webmail (Gmail)' },
  { email: 'fake@mailinator.com', label: 'Disposable email' },
  { email: 'notarealemail@fakexyz12345.com', label: 'Non-existent domain' },
]

for (let i = 0; i < testEmails.length; i++) {
  const { email, label } = testEmails[i]
  const tcNum = String(8 + i).padStart(2, '0')
  console.log(`\nTC-${tcNum}: ${label} (${email})`)
  try {
    const r = await karzaPost('/v2/email-verification', { email, version: '3', consent: 'y' })
    console.log('  Status code:', r.data['status-code'])
    const d = r.data.result?.data
    console.log('  status-code:', r.data['status-code'])
    if (r.data['status-code'] === '101' && r.data.result?.data) {
      console.log('  disposable:', d.disposable, '| webmail:', d.webmail, '| smtp_check:', d.smtp_check)
      console.log('  overall_result:', r.data.result?.result_summary?.overall_result)
      assert(`${label}: status-code 101`, true)
      assert(`${label}: data.email matches`, d.email === email)
      assert(`${label}: result_summary present`, !!r.data.result?.result_summary)
    } else {
      // 102 = no record (test API may not have data for these emails — still a valid response)
      assert(`${label}: responded with valid status`, ['101', '102', '103'].includes(String(r.data['status-code'])))
      skip(`${label}: detailed assertions`, `statusCode ${r.data['status-code']} — no data returned`)
    }
  } catch (e) {
    assert(`TC-${tcNum} completed without error`, false, e.message)
  }
}

section('BLOCK 5 — Email Fraud (/v3/email-fraud)')

for (let i = 0; i < testEmails.length; i++) {
  const { email, label } = testEmails[i]
  const tcNum = String(12 + i).padStart(2, '0')
  console.log(`\nTC-${tcNum}: Fraud check — ${label} (${email})`)
  try {
    const r = await karzaPost('/v3/email-fraud', { email, consent: 'Y' })
    console.log('  Status code:', r.data.statusCode)
    const entry = r.data.result?.[0]
    if (entry) {
      const v = entry.emailAndDomainValidationDetails
      const f = entry.emailAndDomainRiskDetails
      console.log(`  status: ${v.status} | domainExists: ${v.domainExists} | emailExists: ${v.emailExists ?? 'N/A'}`)
      console.log(`  fraudRisk: ${f.fraudRisk} | score: ${f.score} | domainRiskLevel: ${f.domainRiskLevel}`)
      assert(`${label}: statusCode 101`, r.data.statusCode === 101)
      assert(`${label}: result array non-empty`, Array.isArray(r.data.result) && r.data.result.length > 0)
      assert(`${label}: fraudRisk present`, !!f.fraudRisk)
      assert(`${label}: domainRiskLevel present`, !!f.domainRiskLevel)
    } else {
      assert(`${label}: responded`, r.data.statusCode !== undefined)
    }
  } catch (e) {
    assert(`TC-${tcNum} completed without error`, false, e.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK 6 — KSCAN Litigation + filtering logic
// ═══════════════════════════════════════════════════════════════════════════════

section('BLOCK 6 — KSCAN Litigation + filtering logic')

const kscanBase = {
  entityRelation: 'b',
  countOnly: false,
  fuzziness: true,
  fuzzinessLevel: 'general',
  pageNo: 1,
  pageSize: 50,
  dateType: 'filingDate',
  aggregationType: 'date',
  type: 'lite',
}

// TC-17: Very common name — expect large count, top 10 cases
console.log('\nTC-17: Common name "Amit Kumar" — large result set')
let amitCases = []
try {
  const r = await kscanPost({ ...kscanBase, entityName: 'Amit Kumar' })
  console.log('  statusCode:', r.data.statusCode)
  console.log('  total (national):', r.data.result?.totalCases?.total ?? 0)
  amitCases = r.data.result?.records?.districtCourts ?? []
  console.log('  cases in page:', amitCases.length)
  assert('statusCode 101', r.data.statusCode === 101)
  assert('totalCases > 0', (r.data.result?.totalCases?.total ?? 0) > 0)
  assert('records.districtCourts is array', Array.isArray(amitCases))
  assert('page has 50 cases', amitCases.length === 50)
  if (amitCases[0]) {
    assert('case has cino', !!amitCases[0].cino)
    assert('case has state', !!amitCases[0].state)
    assert('case has district', !!amitCases[0].district)
    assert('case has civilCriminal', !!amitCases[0].civilCriminal)
    assert('case has caseStatus', !!amitCases[0].caseStatus)
    assert('case has petitionerNameList', Array.isArray(amitCases[0].petitionerNameList))
    assert('case has respondentNameList', Array.isArray(amitCases[0].respondentNameList))
    assert('case has severity_ field', 'severity_' in amitCases[0])
    assert('party address is null (confirmed)', amitCases[0].petitionerAndAdvocate?.[0]?.address === null)
  }
} catch (e) {
  assert('TC-17 completed without error', false, e.message)
}

// TC-18: Uncommon name — expect 0 or very few results
console.log('\nTC-18: Uncommon name "Zephyr Krishnamurthy" — expect 0 results')
try {
  const r = await kscanPost({ ...kscanBase, entityName: 'Zephyr Krishnamurthy' })
  console.log('  statusCode:', r.data.statusCode, '| total:', r.data.result?.totalCases?.total ?? 0)
  assert('API responded (101 or 102)', r.data.statusCode === 101 || r.data.statusCode === 102)
  const count = r.data.result?.totalCases?.total ?? 0
  assert('0 cases for uncommon name', count === 0)
} catch (e) {
  assert('TC-18 completed without error', false, e.message)
}

// TC-19: District filter — pincode_coords gives districtName, fuzzy match vs KSCAN district
console.log('\nTC-19: District filtering — "Amit Kumar" by districtName "Rohtas Sasaram" / state "Bihar"')
if (amitCases.length > 0) {
  const result = buildLitigationResult(amitCases, 'Amit Kumar', 'Rohtas Sasaram', 'Bihar', true)
  console.log('  Total before filter:', amitCases.length)
  console.log('  After filter (district=Rohtas Sasaram / state=Bihar):', result.totalCases)
  console.log('  Pending:', result.pendingCases, '| Disposed:', result.disposedCases)
  console.log('  Criminal:', result.criminalCases, '| Civil:', result.civilCases)
  console.log('  High severity:', result.highSeverityCases)
  console.log('  Cases returned:', result.cases.length, '(top 10)')
  console.log('  asPetitioner:', JSON.stringify(result.statistics.asPetitioner))
  console.log('  asRespondent:', JSON.stringify(result.statistics.asRespondent))
  assert('filter reduces case count', result.totalCases < amitCases.length)
  assert('cases <= 10', result.cases.length <= 10)
  assert('all returned cases are in Bihar', result.cases.every(c => c.state === 'Bihar'))
  assert('pending + disposed = total', result.pendingCases + result.disposedCases === result.totalCases)
  assert('criminal + civil = total', result.criminalCases + result.civilCases === result.totalCases)
  assert('pincode_matched true', result.filter.pincode_matched === true)
  assert('cases sorted by filingDate desc', (() => {
    const dates = result.cases.map(c => c.filingDate).filter(Boolean)
    return dates.every((d, i) => i === 0 || d <= dates[i - 1])
  })())
} else {
  skip('TC-19 filtering', 'TC-17 returned no cases')
}

// TC-20: Filtering — non-matching state filters out all cases
console.log('\nTC-20: Filtering — non-existing state "Atlantis / FakeCity" → 0 cases')
if (amitCases.length > 0) {
  const result = buildLitigationResult(amitCases, 'Amit Kumar', 'FakeCity', 'Atlantis', true)
  console.log('  After filter:', result.totalCases, 'cases')
  assert('all filtered out', result.totalCases === 0)
  assert('cases array empty', result.cases.length === 0)
  assert('all stats are 0', result.pendingCases === 0 && result.disposedCases === 0 && result.criminalCases === 0)
} else {
  skip('TC-20 filtering', 'TC-17 returned no cases')
}

// TC-21: No filter (pincode not in DB) — all cases returned
console.log('\nTC-21: No filter — pincode_matched false, all cases pass through')
if (amitCases.length > 0) {
  const result = buildLitigationResult(amitCases, 'Amit Kumar', null, null, false)
  console.log('  Cases returned (no filter):', result.totalCases)
  assert('all cases returned when no filter', result.totalCases === amitCases.length)
  assert('pincode_matched false', result.filter.pincode_matched === false)
  assert('filter.district is null', result.filter.district === null)
} else {
  skip('TC-21 no-filter', 'TC-17 returned no cases')
}

// TC-22: Role determination — name in respondent list → "respondent"
console.log('\nTC-22: Role determination — "Amit Kumar" as respondent')
if (amitCases.length > 0) {
  const respondentCases = amitCases.filter(c =>
    c.respondentNameList.some(n => n.toLowerCase().includes('amit kumar'))
  )
  const petitionerCases = amitCases.filter(c =>
    c.petitionerNameList.some(n => n.toLowerCase().includes('amit kumar'))
  )
  console.log('  Cases where "Amit Kumar" is respondent:', respondentCases.length)
  console.log('  Cases where "Amit Kumar" is petitioner:', petitionerCases.length)
  if (respondentCases.length > 0) {
    const role = determineRole('Amit Kumar', respondentCases[0].petitionerNameList, respondentCases[0].respondentNameList)
    console.log('  Determined role for first respondent case:', role)
    assert('role is respondent or both', role === 'respondent' || role === 'both')
  } else {
    skip('role respondent assertion', 'no cases with exact name match')
  }
  assert('role function returns string', typeof determineRole('X', [], ['X Person']) === 'string')
} else {
  skip('TC-22 role determination', 'TC-17 returned no cases')
}

// TC-23: Fuzzy district match function
console.log('\nTC-23: Fuzzy district matching edge cases')
assert('"Mumbai Suburban" matches "Mumbai"', fuzzyDistrictMatch('Mumbai Suburban', 'Mumbai'))
assert('"Mumbai" matches "Mumbai Suburban"', fuzzyDistrictMatch('Mumbai', 'Mumbai Suburban'))
assert('"Rohtas Sasaram" matches "Rohtas"', fuzzyDistrictMatch('Rohtas Sasaram', 'Rohtas'))
assert('"Pune" matches "Pune"', fuzzyDistrictMatch('Pune', 'Pune'))
assert('"Delhi" does NOT match "Mumbai"', !fuzzyDistrictMatch('Delhi', 'Mumbai'))
assert('case-insensitive match', fuzzyDistrictMatch('PUNE', 'pune'))

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60))
console.log('  TEST SUMMARY')
console.log('═'.repeat(60))
console.log(`  ${PASS} Passed:  ${passed}`)
console.log(`  ${FAIL} Failed:  ${failed}`)
console.log(`  ${SKIP} Skipped: ${skipped}`)
console.log(`  Total:   ${passed + failed + skipped}`)
console.log('═'.repeat(60))

if (failed > 0) process.exit(1)
