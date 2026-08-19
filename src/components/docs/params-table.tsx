import { cn } from '@/lib/utils'
import type { Param } from '@/app/docs/(protected)/_data/api-definitions'

// Location badge — quiet neutral chips (no accent purple). `header` keeps a
// warm amber tint to distinguish auth headers; the rest are ink-on-stone.
const IN_BADGE: Record<string, string> = {
  header: 'text-[--color-warning] bg-[--color-warning]/10 ring-[--color-warning]/25',
  query:  'text-[--color-text-body] bg-[--color-surface-2] ring-[--color-border]',
  path:   'text-[--color-text-body] bg-[--color-surface-2] ring-[--color-border]',
  body:   'text-[--color-text-body] bg-[--color-surface-2] ring-[--color-border]',
}

interface ParamsTableProps {
  params: Param[]
}

// A param name may be a dotted path (clientData.caseId) — indent depth is the
// number of dots, and only the leaf segment is shown, so nested body params read
// as a tree like the reference docs.
function depthOf(name: string) {
  return name.split('.').length - 1
}
function leafOf(name: string) {
  const s = name.split('.')
  return s[s.length - 1]
}

export function ParamsTable({ params }: ParamsTableProps) {
  // When every param sits in the body (e.g. a POST with a JSON payload), the
  // Location column is dead weight — show Validations instead, matching the
  // vendor docs. Otherwise keep Location (needed for query/header/path APIs).
  const allBody = params.every(p => p.in === 'body')
  const midCol = allBody ? 'Validations' : 'Location'

  return (
    <div className="border-t border-[--color-border] overflow-x-auto">
      <table className="w-full border-collapse text-sm table-fixed min-w-[680px]">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[9%]" />
          <col className={allBody ? 'w-[22%]' : 'w-[9%]'} />
          <col />
          <col className="w-[9%]" />
        </colgroup>
        <thead>
          <tr className="text-left border-b border-[--color-border-strong] bg-[--color-surface-2]">
            {['Attribute', 'Type', midCol, 'Description', 'Required'].map(h => (
              <th
                key={h}
                className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[--color-text-muted] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => {
            const depth = depthOf(p.name)
            const isParent = p.type === 'object' || p.type === 'array'
            return (
              <tr
                key={`${p.in}-${p.name}`}
                className={cn(
                  'align-top border-b border-[--color-border] last:border-b-0',
                  isParent ? 'bg-[--color-surface-2]' : i % 2 === 1 && 'bg-[--color-surface-2]/50',
                )}
              >
                {/* Attribute — the anchor column. Per DESIGN.md: mono, emphasis
                    from ink color + size, NOT heavy weight (700+ is a slop tell). */}
                <td className="py-3 pr-5" style={{ paddingLeft: `${20 + depth * 22}px` }}>
                  <span className={cn(
                    'font-mono break-all text-[13px] text-[--color-text-primary]',
                    isParent ? 'font-medium' : 'font-normal',
                  )}>
                    {leafOf(p.name)}
                  </span>
                </td>

                {/* Type — recedes into a quiet chip */}
                <td className="px-5 py-3">
                  <span className="font-mono text-[11.5px] text-[--color-text-muted]">
                    {p.type}
                  </span>
                </td>

                {/* Validations (body-only) or Location badge */}
                <td className="px-5 py-3">
                  {allBody ? (
                    <span className="font-mono text-[11.5px] text-[--color-text-muted] break-all">
                      {p.enum ? p.enum.join(' / ') : p.example ? String(p.example) : '—'}
                    </span>
                  ) : (
                    <span className={cn(
                      'inline-flex items-center font-mono text-[10.5px] px-1.5 py-px rounded ring-1 ring-inset',
                      IN_BADGE[p.in] ?? IN_BADGE.query,
                    )}>
                      {p.in}
                    </span>
                  )}
                </td>

                {/* Description */}
                <td className="px-5 py-3 text-[13px] text-[--color-text-body] leading-relaxed">
                  {p.description}
                </td>

                {/* Required */}
                <td className="px-5 py-3 whitespace-nowrap">
                  {p.required
                    ? <span className="inline-flex items-center text-[10.5px] font-medium px-1.5 py-px rounded text-[--color-error] bg-[--color-error-bg] ring-1 ring-inset ring-[--color-error-border]">Yes</span>
                    : <span className="text-[12px] text-[--color-text-xmuted]">No</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
