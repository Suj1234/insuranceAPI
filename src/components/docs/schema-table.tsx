import { cn } from '@/lib/utils'
import type { ResponseField } from '@/app/docs/(protected)/_data/api-definitions'

interface SchemaTableProps {
  fields: ResponseField[]
}

// ── Tree model ────────────────────────────────────────────────────────────────
// Field paths encode nesting (result.address.city, result.profileMatch[].parameter).
// Container rows (result, address) usually appear as their own explicit entries
// in the source; where a container is missing we synthesize it so children never
// dangle. Depth comes from the path, so indentation is always true to the parent.

interface Row {
  key: string
  name: string
  depth: number
  type: string
  description: string
  required: boolean
  isParent: boolean
}

function segmentsOf(path: string): string[] {
  return path.replace(/^data\./, '').split('.')
}

function buildRows(fields: ResponseField[]): Row[] {
  const rows: Row[] = []
  const seen = new Set<string>()

  for (const f of fields) {
    const segs = segmentsOf(f.field)
    let prefix = ''
    segs.forEach((seg, idx) => {
      prefix = prefix ? `${prefix}.${seg}` : seg
      if (seen.has(prefix)) return
      seen.add(prefix)
      const isLeaf = idx === segs.length - 1
      const isContainer = !isLeaf || f.type === 'object' || f.type === 'array' || f.type === 'Object' || f.type === 'Array'
      rows.push({
        key: prefix,
        name: seg,
        depth: idx,
        type: isLeaf ? f.type : seg.endsWith('[]') ? 'array' : 'object',
        description: isLeaf ? f.description : '',
        required: isLeaf ? (f.required ?? !/\|\s*null/.test(f.type)) : true,
        isParent: isContainer,
      })
    })
  }
  return rows
}

// ── Render ────────────────────────────────────────────────────────────────────

export function SchemaTable({ fields }: SchemaTableProps) {
  const rows = buildRows(fields)

  return (
    <div className="border-t border-[--color-border] overflow-x-auto">
      <table className="w-full border-collapse text-sm table-fixed min-w-[620px]">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[13%]" />
          <col />
          <col className="w-[9%]" />
        </colgroup>
        <thead>
          <tr className="text-left border-b border-[--color-border-strong] bg-[--color-surface-2]">
            {['Attribute', 'Type', 'Description', 'Required'].map(h => (
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
          {rows.map(r => (
            <tr
              key={r.key}
              className={cn(
                'align-top border-b border-[--color-border] last:border-b-0',
                // Container (object/array) rows get a tinted band so they read as
                // the group header for the indented children below them.
                r.isParent && 'bg-[--color-surface-2]',
              )}
            >
              {/* Attribute — anchor column. Per DESIGN.md: mono, emphasis from
                  ink color + size, NOT heavy weight. Container names = medium. */}
              <td className="py-3 pr-5" style={{ paddingLeft: `${20 + r.depth * 22}px` }}>
                <span
                  className={cn(
                    'font-mono break-all text-[13px] text-[--color-text-primary]',
                    r.isParent ? 'font-medium' : 'font-normal',
                  )}
                >
                  {r.name}
                </span>
              </td>

              {/* Type */}
              <td className="px-5 py-3 whitespace-nowrap">
                {r.isParent ? (
                  <span className="inline-flex items-center font-mono text-[10.5px] px-1.5 py-px rounded ring-1 ring-inset text-[--color-text-muted] bg-[--color-surface] ring-[--color-border]">
                    {r.type}
                  </span>
                ) : (
                  <span className="font-mono text-[12px] text-[--color-text-muted]">{r.type}</span>
                )}
              </td>

              {/* Description */}
              <td className="px-5 py-3 text-[13px] text-[--color-text-body] leading-relaxed">
                {r.description}
              </td>

              {/* Required */}
              <td className="px-5 py-3 whitespace-nowrap text-[12px] text-[--color-text-muted]">
                {r.required ? 'Yes' : 'No'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
