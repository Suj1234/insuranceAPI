'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

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
      const data = (await res.json()) as { success: boolean; error?: string }
      if (!data.success) {
        setError(data.error ?? 'Invalid credentials')
        return
      }
      router.push('/docs/environmental')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = !email.trim() || !password || loading

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-head">
          <div className="logo-row">
            <span className="logo-mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span className="logo-word">Insuretech</span>
            <span className="logo-sep">/</span>
            <span className="logo-sub">API Platform</span>
          </div>
          <h1>Sign in to the developer API portal</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="eye-btn"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={isDisabled} className="submit-btn">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <footer className="login-footer">
        © 2026 Perfios Software Solutions Private Limited
      </footer>

      <style jsx>{`
        .login-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          position: relative;
          background: var(--color-bg);
          font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        /* faint contour-grid base — nods to terrain / hazard data */
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(var(--color-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
          background-size: 52px 52px;
          -webkit-mask-image: radial-gradient(70% 70% at 50% 45%, #000, transparent 82%);
          mask-image: radial-gradient(70% 70% at 50% 45%, #000, transparent 82%);
          opacity: 0.5;
        }
        .login-card {
          position: relative;
          width: 100%;
          max-width: 460px;
          background: var(--color-surface);
          border-radius: 16px;
          /* warm-tinted shadow (matches paper hue) + inner edge highlight for refraction */
          box-shadow: 0 0 0 1px var(--color-border),
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 12px 40px -8px rgba(74, 58, 42, 0.16),
            0 4px 12px -4px rgba(74, 58, 42, 0.1);
          overflow: hidden;
        }
        :global(.dark) .login-card {
          box-shadow: 0 0 0 1px var(--color-border),
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 16px 44px -10px rgba(0, 0, 0, 0.7);
        }
        .login-head {
          padding: 34px 36px 4px;
        }
        .logo-row {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 32px;
        }
        .logo-mark {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--color-text-primary);
          display: grid;
          place-items: center;
          flex: none;
        }
        :global(.dark) .logo-mark {
          background: var(--color-accent);
        }
        .logo-word {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }
        .logo-sep {
          color: var(--color-border-strong);
        }
        .logo-sub {
          font-size: 14px;
          color: var(--color-text-muted);
        }
        h1 {
          margin: 0 0 10px;
          font-family: var(--font-serif), Georgia, serif;
          font-size: 29px;
          font-weight: 600;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
          line-height: 1.12;
          text-wrap: balance;
        }
        .sub {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-muted);
          line-height: 1.6;
        }
        .login-form {
          padding: 28px 36px 34px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .submit-btn {
          margin-top: 6px;
        }
        .field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-body);
          margin-bottom: 7px;
        }
        .field input,
        .pw-wrap input {
          width: 100%;
          font-family: inherit;
          font-size: 14px;
          padding: 12px 13px;
          border: 0;
          border-radius: 9px;
          background: var(--color-surface);
          box-shadow: 0 0 0 1px var(--color-border-strong);
          color: var(--color-text-primary);
          outline: none;
          transition: box-shadow 0.15s;
        }
        .pw-wrap input {
          padding-right: 42px;
        }
        .field input::placeholder,
        .pw-wrap input::placeholder {
          color: var(--color-text-xmuted);
        }
        .field input:focus,
        .pw-wrap input:focus {
          box-shadow: 0 0 0 1px var(--color-accent), 0 0 0 4px var(--color-accent-tint);
        }
        .pw-wrap {
          position: relative;
        }
        .eye-btn {
          position: absolute;
          right: 5px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: 0;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
        }
        .eye-btn:hover {
          color: var(--color-text-body);
        }
        .error-box {
          background: var(--color-error-bg, #f8e9e6);
          box-shadow: inset 0 0 0 1px var(--color-error-border, #eec2ba);
          border-radius: 9px;
          padding: 10px 13px;
          font-size: 13px;
          color: var(--color-error);
        }
        .submit-btn {
          width: 100%;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 12px 14px;
          border: 0;
          border-radius: 9px;
          background: var(--color-text-primary);
          color: var(--color-bg);
          cursor: pointer;
          transition: opacity 0.15s, transform 0.08s ease;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        :global(.dark) .submit-btn {
          background: var(--color-accent);
          color: #fff;
        }
        @media (prefers-reduced-motion: reduce) {
          .field input,
          .pw-wrap input,
          .submit-btn,
          .eye-btn {
            transition: none;
          }
        }
        .login-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          padding: 20px 16px 22px;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-xmuted);
        }
      `}</style>
    </div>
  )
}
