'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  open?: boolean                    // controlled open state (overrides internal)
  onOpenChange?: (open: boolean) => void
  rightSlot?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  rightSlot,
  children,
  className,
  id,
}: CollapsibleSectionProps) {
  const [openState, setOpenState] = useState(defaultOpen)
  // Controlled when `open` is provided; otherwise use internal state.
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = (next: boolean) => {
    if (!isControlled) setOpenState(next)
    onOpenChange?.(next)
  }

  return (
    <div id={id} className={cn('bg-[--color-surface] rounded-xl overflow-hidden mb-5 shadow-[0_0_0_1px_var(--color-border)]', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between px-5 py-3.5',
          'bg-[--color-surface]',
          'hover:bg-[--color-surface-2] transition-colors duration-150',
          'cursor-pointer select-none',
          open ? 'shadow-[inset_0_-1px_0_var(--color-border)]' : ''
        )}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={14} className="text-[--color-text-muted] flex-shrink-0" />
            : <ChevronRight size={14} className="text-[--color-text-muted] flex-shrink-0" />}
          <span className="text-[15px] font-semibold text-[--color-text-primary] tracking-tight">{title}</span>
        </div>
        {rightSlot && (
          <div className="text-[13px] text-[--color-text-body]" onClick={e => e.stopPropagation()}>
            {rightSlot}
          </div>
        )}
      </button>

      {open && children}
    </div>
  )
}
