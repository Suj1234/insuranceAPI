import { readFileSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const envVars = {}
try {
  const content = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    envVars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL ?? envVars.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const { neon } = await import('@neondatabase/serverless')
const sql = neon(DATABASE_URL)

function num(v) { return (v === '' || v === 'None' || v === 'nan' || v == null) ? null : Number(v) }
function str(v) { return (v === '' || v === 'None' || v == null) ? null : String(v).trim() }
function unquoteCsv(v) {
  if (v == null) return null
  const t = v.trim()
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"')
  return t
}

async function readCsv(relPath) {
  const rows = []
  const rl = createInterface({ input: createReadStream(resolve(__dir, '..', relPath)), crlfDelay: Infinity })
  let headers = null
  for await (const line of rl) {
    if (!headers) { headers = line.split(',').map(h => unquoteCsv(h)); continue }
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => { obj[h] = unquoteCsv(vals[i]) ?? null })
    rows.push(obj)
  }
  return rows
}

const _AQ_RPS       = [10, 25, 50, 100, 250, 500, 1000]
const _AQ_SCENARIOS = ['rcp45_2030', 'rcp85_2030', 'rcp45_2050', 'rcp85_2050', 'rcp45_2080', 'rcp85_2080']
const AQD_DATA_COLS = [
  ..._AQ_RPS.map(rp => `riverine_rp${rp}_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.map(rp => `riverine_${s}_rp${rp}_m`)),
  ..._AQ_RPS.map(rp => `coastal_nosub_hist_rp${rp}_p95_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.flatMap(rp => [
    `coastal_nosub_${s}_rp${rp}_p95_m`,
    `coastal_nosub_${s}_rp${rp}_p50_m`,
  ])),
  ..._AQ_RPS.map(rp => `coastal_wtsub_hist_rp${rp}_p95_m`),
  ..._AQ_SCENARIOS.flatMap(s => _AQ_RPS.flatMap(rp => [
    `coastal_wtsub_${s}_rp${rp}_p95_m`,
    `coastal_wtsub_${s}_rp${rp}_p50_m`,
  ])),
]
const AQD_ALL_COLS   = ['pincode', ...AQD_DATA_COLS, 'data_as_of_date']
const AQD_COL_LIST   = AQD_ALL_COLS.join(', ')
const AQD_PARAM_LIST = AQD_ALL_COLS.map((_, i) => `$${i + 1}`).join(', ')
const AQD_STMT       = `INSERT INTO pincode_aqueduct (${AQD_COL_LIST}) VALUES (${AQD_PARAM_LIST}) ON CONFLICT (pincode) DO UPDATE SET updated_at = NOW()`

console.log('Loading pincode_aqueduct...')
const aqd = await readCsv('data/flood/gee_outputs/aqueduct_full.csv')
console.log(`  ${aqd.length.toLocaleString()} rows read`)

await sql`TRUNCATE TABLE pincode_aqueduct`

let ok = 0, fail = 0
for (let i = 0; i < aqd.length; i += 50) {
  const batch = aqd.slice(i, i + 50)
  await Promise.all(batch.map(async r => {
    try {
      await sql(AQD_STMT, [str(r.pincode), ...AQD_DATA_COLS.map(c => num(r[c])), '2020-04'])
      ok++
    } catch (e) {
      fail++
      if (fail <= 3) console.error(`  FAIL: ${e.message.slice(0, 120)}`)
    }
  }))
  if ((i + 50) % 1000 === 0 || i + 50 >= aqd.length) {
    process.stdout.write(`\r  ${Math.min(i + 50, aqd.length).toLocaleString()}/${aqd.length.toLocaleString()} rows...`)
  }
}

console.log(`\n  Done: ${ok.toLocaleString()} ok, ${fail} failed`)
const [{ n }] = await sql`SELECT COUNT(*) AS n FROM pincode_aqueduct`
console.log(`  pincode_aqueduct: ${Number(n).toLocaleString()} rows in DB`)
