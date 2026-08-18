import { cn } from '@/lib/utils'

// Soft tinted badges — colored text on a tint with a hairline ring (DESIGN.md),
// not heavy saturated fills. Uses design tokens so they stay warm/consistent.
const METHOD_STYLES: Record<string, string> = {
  GET:    'text-[--color-success] bg-[--color-success]/10 ring-1 ring-inset ring-[--color-success]/25',
  POST:   'text-[--color-text-body] bg-[--color-surface-2] ring-1 ring-inset ring-[--color-border-strong]',
  PUT:    'text-[--color-warning] bg-[--color-warning]/10 ring-1 ring-inset ring-[--color-warning]/25',
  DELETE: 'text-[--color-error] bg-[--color-error]/10 ring-1 ring-inset ring-[--color-error]/25',
}

interface MethodBadgeProps {
  method: string
  size?: 'sm' | 'md'
  className?: string
}

export function MethodBadge({ method, size = 'md', className }: MethodBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-semibold rounded flex-shrink-0 tracking-wide',
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
        METHOD_STYLES[method] ?? METHOD_STYLES.GET,
        className
      )}
    >
      {method}
    </span>
  )
}
