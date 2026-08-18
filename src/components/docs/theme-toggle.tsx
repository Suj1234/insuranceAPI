'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className={cn('w-8 h-8', className)} />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded',
        'text-[--color-text-muted] hover:text-[--color-text-body]',
        'hover:bg-[--color-surface-2]',
        'transition-colors duration-150',
        className
      )}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
