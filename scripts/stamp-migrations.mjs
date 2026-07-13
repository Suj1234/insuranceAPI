import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const migrations = [
  { hash: '40939f7ec5e76f2892c8426ffd9a973925b4429a8f90b2be7829d6c181a02663', created_at: 1782297460232 },
  { hash: '0601ab9c428498edc06d3076d68850f674809755122f34b840cf5cd627f9d032', created_at: 1782391230094 },
  { hash: '896ecfd58439ef73d81ea5f80f78b75f7e347db7d5bf56cfe3e58c01047296da', created_at: 1751155200000 },
  { hash: 'bc881f012deddc290936d284c348c401c24358fffe83776dc62648ed2ff8957d',  created_at: 1782970921148 },
  { hash: '7564f3c9e3761ffec979cf7617ad61f2c82b8c0a857cfcdb75818b37e42af6e4', created_at: 1751500000000 },
  { hash: '2bd564e0210256e938892b95e2a7774447ae6a69b908563888c98484a6e81e8e', created_at: 1751620000000 },
  { hash: '8f0bd895e03ed322b474e4f9821f53aab7a12d9a2353f84d85c9a3231fdd33ee', created_at: 1783506061132 },
]

for (const m of migrations) {
  const existing = await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${m.hash}`
  if (existing.length > 0) {
    console.log('Already tracked:', m.hash.substring(0, 16) + '...')
  } else {
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${m.hash}, ${m.created_at})`
    console.log('Stamped:', m.hash.substring(0, 16) + '...')
  }
}

const rows = await sql`SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at`
console.log('Total tracked migrations:', rows.length)
rows.forEach(r => console.log(' -', r.id, r.hash.substring(0, 16) + '...'))
