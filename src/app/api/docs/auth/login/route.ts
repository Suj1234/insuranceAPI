import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { docsUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const BodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

// Cookies must be scoped to the app's real path. Behind the gateway the app lives
// at /demo/api-playground, so Path=/docs would NOT match /demo/api-playground/docs
// and the browser would never send the session cookie back → redirect loop.
const COOKIE_PATH = `${process.env.__NEXT_ROUTER_BASEPATH ?? ''}/docs`

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 })
  }

  const { email, password } = parsed.data

  try {
    const rows = await db
      .select()
      .from(docsUsers)
      .where(eq(docsUsers.email, email.toLowerCase().trim()))
      .limit(1)

    const user = rows[0]
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set('docs_session', 'authenticated', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     COOKIE_PATH,
      maxAge:   60 * 60 * 8, // 8 hours
    })
    // Store masked API key for the profile dropdown (read by page.tsx via DOM)
    res.cookies.set('docs_api_key', user.apiKey, {
      httpOnly: false,   // needs to be readable by client JS
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     COOKIE_PATH,
      maxAge:   60 * 60 * 8,
    })
    res.cookies.set('docs_user_name', user.name, {
      httpOnly: false,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     COOKIE_PATH,
      maxAge:   60 * 60 * 8,
    })
    return res
  } catch (err) {
    console.error('[POST /api/docs/auth/login]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
