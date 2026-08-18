'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchableSelectProps {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '— select —',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function select(v: string) {
    onChange(v)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          'px-3 py-[7px] rounded border text-sm text-left',
          'transition-colors duration-150',
          disabled
            ? 'bg-[--color-surface-2] border-[--color-border] text-[--color-text-xmuted] cursor-not-allowed'
            : 'bg-[--color-surface] border-[--color-border] text-[--color-text-body] cursor-pointer hover:border-[--color-border-strong]',
          open && !disabled && 'border-[--color-accent]'
        )}
      >
        <span className={cn(
          'truncate',
          !value && 'text-[--color-text-xmuted]'
        )}>
          {value || placeholder}
        </span>
        {open
          ? <ChevronUp size={13} className="text-[--color-text-muted] flex-shrink-0" />
          : <ChevronDown size={13} className="text-[--color-text-muted] flex-shrink-0" />}
      </button>

      {open && (
        <div role="listbox" className="absolute top-full left-0 right-0 z-50 mt-1 bg-[--color-surface] border border-[--color-border] rounded shadow-sm overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[--color-border]">
            <Search size={12} className="text-[--color-text-xmuted] flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent border-none outline-none text-xs text-[--color-text-body] placeholder:text-[--color-text-xmuted]"
            />
          </div>

          {/* Options list */}
          <div className="max-h-[180px] overflow-y-auto">
            {filtered.length === 0
              ? (
                <div className="px-3 py-2.5 text-xs text-[--color-text-muted]">No results</div>
              )
              : filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  onMouseDown={() => select(opt)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors duration-150',
                    opt === value
                      ? 'bg-[--color-accent-tint] text-[--color-accent] font-medium'
                      : 'text-[--color-text-body] hover:bg-[--color-surface-2]'
                  )}
                >
                  {opt}
                </button>
              ))}
          </div>

          {/* Clear */}
          {value && (
            <div className="border-t border-[--color-border] px-2 py-1">
              <button
                type="button"
                onMouseDown={() => select('')}
                className="text-xs text-[--color-text-muted] hover:text-[--color-text-body] px-1 py-0.5 transition-colors duration-150"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
