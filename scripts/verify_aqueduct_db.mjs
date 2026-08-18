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
const { neon } = await import('@neondatabase/serverless')
const sql = neon(DATABASE_URL)

const [cnt]  = await sql`SELECT COUNT(*) AS n FROM pincode_aqueduct`
const [cols] = await sql`SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_name = 'pincode_aqueduct'`
console.log(`rows   : ${cnt.n}`)
console.log(`columns: ${cols.n}`)

const [cov] = await sql`
  SELECT
    COUNT(*) FILTER (WHERE riverine_rp100_m IS NOT NULL)                    AS riverine_baseline,
    COUNT(*) FILTER (WHERE riverine_rcp85_2080_rp100_m IS NOT NULL)         AS riverine_proj,
    COUNT(*) FILTER (WHERE coastal_nosub_hist_rp100_p95_m IS NOT NULL)      AS coastal_nosub_hist,
    COUNT(*) FILTER (WHERE coastal_nosub_rcp85_2080_rp100_p95_m IS NOT NULL) AS coastal_nosub_proj,
    COUNT(*) FILTER (WHERE coastal_wtsub_hist_rp100_p95_m IS NOT NULL)      AS coastal_wtsub_hist,
    COUNT(*) FILTER (WHERE coastal_wtsub_rcp85_2080_rp100_p95_m IS NOT NULL) AS coastal_wtsub_proj
  FROM pincode_aqueduct`
console.log('\nnon-null pincodes per section:')
console.log(`  riverine baseline  : ${cov.riverine_baseline}`)
console.log(`  riverine projected : ${cov.riverine_proj}`)
console.log(`  coastal nosub hist : ${cov.coastal_nosub_hist}`)
console.log(`  coastal nosub proj : ${cov.coastal_nosub_proj}`)
console.log(`  coastal wtsub hist : ${cov.coastal_wtsub_hist}`)
console.log(`  coastal wtsub proj : ${cov.coastal_wtsub_proj}`)

const [row] = await sql`
  SELECT pincode,
    riverine_rp100_m,
    riverine_rcp85_2080_rp100_m,
    coastal_nosub_hist_rp100_p95_m,
    coastal_nosub_rcp85_2080_rp100_p95_m,
    coastal_nosub_rcp85_2080_rp100_p50_m,
    coastal_wtsub_hist_rp100_p95_m,
    coastal_wtsub_rcp85_2080_rp100_p95_m,
    coastal_wtsub_rcp85_2080_rp100_p50_m
  FROM pincode_aqueduct
  WHERE riverine_rp100_m IS NOT NULL
  LIMIT 1`
console.log('\nsample row:')
console.log(JSON.stringify(row, null, 2))
