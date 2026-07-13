import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dir = dirname(fileURLToPath(import.meta.url))
const envVars = {}
try {
  const content = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    envVars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
} catch {}
const { neon } = await import('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL ?? envVars.DATABASE_URL)

console.log('=== Maharashtra districts in district_air_quality ===')
const mh = await sql`SELECT DISTINCT district_name FROM district_air_quality WHERE state_name ILIKE 'Maharashtra' ORDER BY district_name`
mh.forEach(r => console.log(' ', r.district_name))

console.log('\n=== State names in district_air_quality (sample) ===')
const states = await sql`SELECT DISTINCT state_name FROM district_air_quality ORDER BY state_name`
states.forEach(r => console.log(' ', r.state_name))

console.log('\n=== Hotspots by state ===')
const hs = await sql`SELECT state_name, COUNT(*) as n FROM water_quality_hotspots GROUP BY state_name ORDER BY state_name`
hs.forEach(r => console.log(` ${r.state_name}: ${r.n}`))

console.log('\n=== Hotspots contaminants ===')
const hc = await sql`SELECT contaminant, COUNT(*) as n FROM water_quality_hotspots GROUP BY contaminant ORDER BY contaminant`
hc.forEach(r => console.log(` ${r.contaminant}: ${r.n}`))
