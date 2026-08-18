import { CollapsibleSection } from './collapsible-section'
import { cn } from '@/lib/utils'
import type { AboutBlock } from '@/app/docs/(protected)/environmental/_data/api-definitions'

interface AboutTabProps {
  blocks: AboutBlock[]
  source: string
}

function groupByHeading(blocks: AboutBlock[]): AboutBlock[][] {
  const groups: AboutBlock[][] = []
  let current: AboutBlock[] = []
  for (const block of blocks) {
    if (block.type === 'heading') {
      if (current.length > 0) groups.push(current)
      current = [block]
    } else if (block.type !== 'divider') {
      current.push(block)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function renderBlock(block: AboutBlock, i: number) {
  switch (block.type) {

    case 'subheading':
      return (
        <h3 key={i} className="text-sm font-semibold text-[--color-text-primary] pt-3 first:pt-0">
          {block.text}
        </h3>
      )

    case 'paragraph':
      return (
        <p key={i} className="text-[15px] text-[--color-text-body] leading-relaxed">
          {block.text}
        </p>
      )

    case 'code':
      return (
        <pre key={i} className="bg-[--color-surface-2] border border-[--color-border] rounded px-4 py-3 text-xs font-mono text-[--color-text-body] whitespace-pre overflow-x-auto leading-relaxed">
          {block.text}
        </pre>
      )

    case 'table':
      return (
        <div key={i} className="border border-[--color-border] rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
                {block.headers.map(h => (
                  <th key={h} className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[--color-text-muted]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {block.rows.map((row, ri) => (
                <tr key={ri} className={cn('divide-x divide-[--color-border]', ri % 2 === 0 ? 'bg-[--color-surface]' : 'bg-[--color-surface-2]')}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-[--color-text-body]">
                      {ci === 0
                        ? <span className="font-mono text-[--color-accent]">{cell}</span>
                        : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'bullets':
      return (
        <ul key={i} className="space-y-1.5 pl-4">
          {block.items.map((item, ii) => (
            <li key={ii} className="relative pl-3 text-[15px] text-[--color-text-body] leading-relaxed before:absolute before:left-0 before:top-[0.5em] before:w-1 before:h-1 before:rounded-full before:bg-[--color-text-muted]">
              {item}
            </li>
          ))}
        </ul>
      )

    case 'callout':
      return (
        <div key={i} className="border-l-2 border-[--color-border-strong] pl-4 py-0.5">
          <p className="text-sm font-medium text-[--color-text-primary] mb-0.5">{block.label}</p>
          <p className="text-sm text-[--color-text-muted]">{block.text}</p>
        </div>
      )

    default:
      return null
  }
}

export function AboutTab({ blocks, source }: AboutTabProps) {
  const groups = groupByHeading(blocks)

  return (
    <div className="px-6 py-5">
      {groups.map((group, gi) => {
        const heading = group[0]
        const rest = group.slice(1)
        if (heading.type !== 'heading') return null

        return (
          <CollapsibleSection key={gi} title={heading.text}>
            <div className="px-5 py-4 space-y-4">
              {rest.map((block, i) => renderBlock(block, i))}
            </div>
          </CollapsibleSection>
        )
      })}

      <p className="text-xs text-[--color-text-muted] pt-2 border-t border-[--color-border]">
        {source}
      </p>
    </div>
  )
}
