/**
 * Seed an initial docs portal user.
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/seed-docs-user.mjs
 * Reads DATABASE_URL and INTERNAL_ENV_API_KEY from .env.local in the project root.
 *
 * The user's api_key is set to INTERNAL_ENV_API_KEY so the tryout panel
 * automatically uses a valid key.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ──────────────────────────────────────────────────────────

const envVars = {}
try {
  const content = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    envVars[k] = v
  }
} catch {
  // .env.local may not exist in CI — rely on process.env
}

const databaseUrl   = process.env.DATABASE_URL   ?? envVars.DATABASE_URL
const internalApiKey = process.env.INTERNAL_ENV_API_KEY ?? envVars.INTERNAL_ENV_API_KEY

if (!databaseUrl) {
  console.error('DATABASE_URL not found in environment or .env.local')
  process.exit(1)
}
if (!internalApiKey) {
  console.error('INTERNAL_ENV_API_KEY not found in environment or .env.local')
  process.exit(1)
}

// ── Dependencies ─────────────────────────────────────────────────────────────

const { default: bcrypt } = await import('bcryptjs')
const { neon }            = await import('@neondatabase/serverless')

// ── Config ───────────────────────────────────────────────────────────────────

const USER = {
  name:     'Sujeet Kumar',
  email:    'sujeet.kumar@perfios.com',
  password: 'Admin@1234',
  role:     'admin',
}

// ── Run ──────────────────────────────────────────────────────────────────────

const sql = neon(databaseUrl)
const passwordHash = await bcrypt.hash(USER.password, 12)

try {
  await sql`
    INSERT INTO docs_users (email, password_hash, name, api_key, role, is_active)
    VALUES (
      ${USER.email.toLowerCase()},
      ${passwordHash},
      ${USER.name},
      ${internalApiKey},
      ${USER.role},
      true
    )
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      name          = EXCLUDED.name,
      api_key       = ${internalApiKey},
      role          = EXCLUDED.role,
      is_active     = true,
      updated_at    = now()
  `
  console.log('✓ User seeded:')
  console.log('  Email:   ', USER.email)
  console.log('  Password:', USER.password, ' ← change after first login')
  console.log('  API Key: ', internalApiKey, ' (= INTERNAL_ENV_API_KEY)')
  console.log('  Role:    ', USER.role)
} catch (err) {
  console.error('Failed to seed user:', err)
  process.exit(1)
}
