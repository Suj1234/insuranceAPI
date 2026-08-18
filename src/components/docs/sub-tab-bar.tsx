import { cn } from '@/lib/utils'

interface SubTabBarProps {
  tabs: readonly string[]
  active: string
  onChange: (tab: string) => void
}

export function SubTabBar({ tabs, active, onChange }: SubTabBarProps) {
  return (
    <div className="flex border-b border-[--color-border] bg-[--color-surface] px-3">
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            'px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors duration-150',
            active === tab
              ? 'border-[--color-text-primary] text-[--color-text-primary] font-semibold'
              : 'border-transparent text-[--color-text-muted] hover:text-[--color-text-body] font-normal'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
