/**
 * Load water_quality_hotspots from CSV (handles fully-quoted CSV format).
 * Run: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/load-hotspots.mjs
 */
import { readFileSync } from 'fs'
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

function parseCsvLine(line) {
  const vals = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (c === ',' && !inQuote) {
      vals.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  vals.push(cur)
  return vals
}

function num(v) { return (v === '' || v === 'None' || v == null) ? null : Number(v) }
function str(v) { return (v === '' || v === 'None' || v == null) ? null : String(v).trim() }

const content = readFileSync(resolve(__dir, '..', 'data/output/water_quality_hotspots.csv'), 'utf8')
const lines = content.split('\n').filter(l => l.trim())
const headers = parseCsvLine(lines[0])
const rows = lines.slice(1).map(line => {
  const vals = parseCsvLine(line)
  const obj = {}
  headers.forEach((h, i) => { obj[h] = vals[i]?.trim() === '' ? null : vals[i]?.trim() ?? null })
  return obj
})
console.log(`${rows.length} rows parsed`)

await sql`TRUNCATE TABLE water_quality_hotspots`

let ok = 0, fail = 0
const BATCH = 20
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  await Promise.all(batch.map(async r => {
    try {
      await sql`
        INSERT INTO water_quality_hotspots (
          hotspot_no, state_name, district, block_taluka, village,
          lat, lng, source_type,
          contaminant, concentration, unit, bis_limit, exceedance_factor, severity,
          data_as_of_year, data_source
        ) VALUES (
          ${num(r.hotspot_no)}, ${str(r.state_name)}, ${str(r.district)},
          ${str(r.block_taluka)}, ${str(r.village)},
          ${num(r.lat)}, ${num(r.lng)}, ${str(r.source_type)},
          ${str(r.contaminant)}, ${num(r.concentration)}, ${str(r.unit)},
          ${num(r.bis_limit)}, ${num(r.exceedance_factor)}, ${str(r.severity)},
          ${num(r.data_as_of_year)}, ${str(r.data_source)}
        )
      `
      ok++
    } catch (e) {
      fail++
      if (fail <= 3) console.error(`  FAIL [${r.state_name}/${r.district}]: ${e.message.slice(0, 100)}`)
    }
  }))
}
console.log(`Done: ${ok} inserted, ${fail} failed`)

const [{ n }] = await sql`SELECT COUNT(*) AS n FROM water_quality_hotspots`
console.log(`water_quality_hotspots: ${n} rows in DB`)
