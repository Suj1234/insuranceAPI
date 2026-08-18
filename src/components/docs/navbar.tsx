'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Copy, Check, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { cn } from '@/lib/utils'

interface NavbarProps {
  userName: string
  apiKey: string
}

function maskKey(k: string) {
  if (!k || k.length <= 6) return '••••••••••••••••'
  return k.slice(0, 6) + '••••••••••••'
}

export function Navbar({ userName, apiKey }: NavbarProps) {
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const [keyRevealed, setKeyRevealed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const initials = userName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  async function copyKey() {
    await navigator.clipboard.writeText(apiKey)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/docs/auth/logout', { method: 'POST' })
    router.push('/docs/login')
  }

  return (
    <nav className="h-[52px] flex-shrink-0 flex items-center justify-between px-5 bg-[--color-surface] border-b border-[--color-border] z-10">

      {/* Left — logo + nav */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          {/* Logo icon — ink mark, matches login */}
          <div className="w-[26px] h-[26px] bg-[--color-text-primary] dark:bg-[--color-accent] rounded-md flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[--color-text-primary] tracking-tight">Insuretech</span>
          <span className="text-[--color-border-strong]">/</span>
          <span className="text-sm text-[--color-text-muted]">API Platform</span>
        </div>
      </div>

      {/* Right — theme toggle + profile */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[--color-surface-2] transition-colors duration-150"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <div className="w-[30px] h-[30px] rounded-full bg-[--color-text-primary] dark:bg-[--color-accent] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="text-left">
              <div className="text-[13px] font-medium text-[--color-text-primary] leading-tight">{userName}</div>
              <div className="text-[11px] text-[--color-text-muted]">Developer</div>
            </div>
            <ChevronDown size={12} className="text-[--color-text-muted]" />
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[110%] w-64 bg-[--color-surface] border border-[--color-border] rounded-md shadow-sm z-50 overflow-hidden"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-[--color-border]">
                <div className="text-sm font-semibold text-[--color-text-primary]">{userName}</div>
                <div className="text-xs text-[--color-text-muted] mt-0.5">Developer</div>
              </div>

              {/* API Key */}
              <div className="px-4 py-3 border-b border-[--color-border]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[--color-text-xmuted] mb-2">
                  API Key
                </div>
                <div className="flex items-center justify-between bg-[--color-surface-2] border border-[--color-border] rounded px-3 py-2">
                  <code className="text-xs font-mono text-[--color-text-body] flex-1 min-w-0 break-all">
                    {keyRevealed ? apiKey : maskKey(apiKey)}
                  </code>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      onClick={() => setKeyRevealed(v => !v)}
                      aria-label={keyRevealed ? 'Hide API key' : 'Reveal API key'}
                      title={keyRevealed ? 'Hide API key' : 'Reveal API key'}
                      className="text-[--color-text-muted] hover:text-[--color-text-body] transition-colors duration-150"
                    >
                      {keyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      onClick={copyKey}
                      aria-label="Copy API key"
                      title="Copy API key"
                      className="text-[--color-text-muted] hover:text-[--color-text-body] transition-colors duration-150"
                    >
                      {keyCopied
                        ? <Check size={13} className="text-[--color-success]" />
                        : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <div className="px-2 py-1.5">
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium',
                    'text-[--color-error] hover:bg-red-50 dark:hover:bg-red-950/20',
                    'transition-colors duration-150',
                    loggingOut && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
