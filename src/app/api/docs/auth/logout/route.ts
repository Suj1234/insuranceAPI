import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ success: true })
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    // Must match the path the login cookie was set with (basePath-aware), or the
    // browser won't clear it. See login route COOKIE_PATH — __NEXT_ROUTER_BASEPATH
    // is client-bundle-only and is undefined here, so mirror next.config.mjs's literal.
    path:     `${process.env.NEXT_PUBLIC_BASE_PATH ?? '/demo/api-playground'}/docs`,
    maxAge:   0,
  }
  res.cookies.set('docs_session', '', cookieOpts)
  res.cookies.set('docs_api_key', '', { ...cookieOpts, httpOnly: false })
  res.cookies.set('docs_user_name', '', { ...cookieOpts, httpOnly: false })
  return res
}
