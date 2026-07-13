'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DocsLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/docs/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) { setError(data.error ?? 'Invalid credentials'); return }
      router.push('/docs/environmental')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh', background: '#f3f4f6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    wrap:      { width: '100%', maxWidth: '400px' },
    logoArea:  { textAlign: 'center', marginBottom: '28px' },
    logoRow:   { display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
    logoIcon:  { width: '38px', height: '38px', background: '#1d4ed8', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    logoTitle: { fontSize: '20px', fontWeight: 700, color: '#111827' },
    logoSub:   { fontSize: '13px', color: '#6b7280', display: 'block' },
    card:      { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
    cardTitle: { fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '4px' },
    cardSub:   { fontSize: '13px', color: '#6b7280', marginBottom: '24px' },
    form:      { display: 'flex', flexDirection: 'column', gap: '18px' },
    fieldWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label:     { fontSize: '13px', fontWeight: 500, color: '#374151' },
    input:     { width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#fff', outline: 'none', fontFamily: 'inherit' },
    pwWrap:    { position: 'relative' },
    pwInput:   { width: '100%', padding: '10px 44px 10px 14px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#fff', outline: 'none', fontFamily: 'inherit' },
    eyeBtn:    { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: '0' },
    errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' },
    btn:       { width: '100%', padding: '11px', background: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    btnOff:    { width: '100%', padding: '11px', background: '#bfdbfe', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'not-allowed', fontFamily: 'inherit' },
    footer:    { textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '20px' },
  }

  const isDisabled = !email.trim() || !password || loading

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.logoArea}>
          <div style={s.logoRow}>
            <div style={s.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span style={s.logoTitle}>Insuretech Data Platform</span>
          </div>
          <span style={s.logoSub}>Developer Documentation</span>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Sign in</div>
          <div style={s.cardSub}>Enter your developer credentials to access the portal.</div>

          <form style={s.form} onSubmit={handleSubmit}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                style={s.input}
              />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Password</label>
              <div style={s.pwWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={s.pwInput}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} style={s.eyeBtn} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <button type="submit" disabled={isDisabled} style={isDisabled ? s.btnOff : s.btn}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={s.footer}>© 2026 Insuretech Data Platform · API Portal v1</div>
      </div>
    </div>
  )
}
