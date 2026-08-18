/**
 * Drop and recreate pincode_aqueduct with the full expanded schema.
 * Run BEFORE extract_aqueduct.py and BEFORE load-all.mjs.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate_aqueduct_v2_expand.mjs
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

// ── Generate all 231 data column definitions ──────────────────────────────────
const RPS       = [10, 25, 50, 100, 250, 500, 1000]
const SCENARIOS = ['rcp45_2030', 'rcp85_2030', 'rcp45_2050', 'rcp85_2050', 'rcp45_2080', 'rcp85_2080']

function col(name) { return `${name} NUMERIC(6,3)` }

const dataCols = [
  // Riverine baseline (7)
  ...RPS.map(rp => col(`riverine_rp${rp}_m`)),
  // Riverine projections (42)
  ...SCENARIOS.flatMap(s => RPS.map(rp => col(`riverine_${s}_rp${rp}_m`))),
  // Coastal nosub historical (7)
  ...RPS.map(rp => col(`coastal_nosub_hist_rp${rp}_p95_m`)),
  // Coastal nosub projected (84)
  ...SCENARIOS.flatMap(s => RPS.flatMap(rp => [
    col(`coastal_nosub_${s}_rp${rp}_p95_m`),
    col(`coastal_nosub_${s}_rp${rp}_p50_m`),
  ])),
  // Coastal wtsub baseline (7)
  ...RPS.map(rp => col(`coastal_wtsub_hist_rp${rp}_p95_m`)),
  // Coastal wtsub projected (84)
  ...SCENARIOS.flatMap(s => RPS.flatMap(rp => [
    col(`coastal_wtsub_${s}_rp${rp}_p95_m`),
    col(`coastal_wtsub_${s}_rp${rp}_p50_m`),
  ])),
]

console.log(`Dropping pincode_aqueduct...`)
await sql(`DROP TABLE IF EXISTS pincode_aqueduct CASCADE`)

console.log(`Creating pincode_aqueduct (${dataCols.length} data columns)...`)
await sql(`
  CREATE TABLE pincode_aqueduct (
    pincode        VARCHAR(6) PRIMARY KEY,
    ${dataCols.join(',\n    ')},
    data_as_of_date TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

const [{ n }] = await sql(`SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_name = 'pincode_aqueduct'`)
console.log(`Done — ${n} columns in pincode_aqueduct.`)
console.log('\nNext steps:')
console.log('  1. python scripts/extract_aqueduct.py   (~10-14 hours, resumable)')
console.log('  2. NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/load-all.mjs')
