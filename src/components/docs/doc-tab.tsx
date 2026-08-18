'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CollapsibleSection } from './collapsible-section'
import { SubTabBar } from './sub-tab-bar'
import { ParamsTable } from './params-table'
import { SchemaTable } from './schema-table'
import { CodeBlock } from './code-block'
import type { ApiDefinition, ApiVariant, Param, ResponseField } from '@/app/docs/(protected)/environmental/_data/api-definitions'

interface DocTabProps {
  api: ApiDefinition
}

// Normalize the legacy single-variant shape into an ApiVariant so both paths
// render through the same Request/Response Schema/Body/Headers UI.
function legacyVariant(api: ApiDefinition): ApiVariant {
  const headerParams = api.params.filter(p => p.in === 'header')
  const reqHeaders = headerParams
    .map(p => `${p.name}: YOUR_${p.name.toUpperCase().replace(/-/g, '_')}`)
    .join('\n') || 'x-api-key: YOUR_API_KEY'
  return {
    label: 'Default',
    request: {
      params: api.params,
      body: api.exampleRequest.body ?? '',
      headers: `Content-Type: application/json\n${reqHeaders}`,
    },
    response: {
      // ResponseField[] uses `field`; SchemaTable reads that directly.
      fields: api.responseFields as ResponseField[],
      body: api.exampleResponse,
      headers: 'content-type: application/json\ncache-control: no-store',
    },
  }
}

export function DocTab({ api }: DocTabProps) {
  const variants = api.variants ?? [legacyVariant(api)]
  const [variantIdx, setVariantIdx] = useState(0)
  const [reqTab, setReqTab] = useState('Schema')
  const [resTab, setResTab] = useState('Schema')

  const variant = variants[Math.min(variantIdx, variants.length - 1)]
  const hasVariants = (api.variants?.length ?? 0) > 1

  return (
    <div className="px-8 py-6 space-y-5">

      {/* Response-type selector — each option returns a different depth of
          profile (full / basic-lite / with father name). Naming reflects the
          actual response shape, not the raw request flag. All options visible. */}
      {hasVariants && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[--color-text-xmuted] mb-2">
            Response type
          </div>
          <div role="tablist" aria-label="Response type" className="flex flex-wrap gap-1.5">
            {variants.map((v, i) => (
              <button
                key={v.label}
                role="tab"
                aria-selected={variantIdx === i}
                onClick={() => setVariantIdx(i)}
                className={cn(
                  'text-[12.5px] px-3 py-1.5 rounded border cursor-pointer transition-colors duration-150',
                  variantIdx === i
                    ? 'bg-[--color-text-primary] text-[--color-bg] border-[--color-text-primary] font-medium'
                    : 'bg-[--color-surface] text-[--color-text-body] border-[--color-border] hover:border-[--color-border-strong] hover:text-[--color-text-primary]',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Request ── */}
      <CollapsibleSection title="Request" defaultOpen>
        <SubTabBar tabs={['Schema', 'Body', 'Headers']} active={reqTab} onChange={setReqTab} />
        {reqTab === 'Schema'  && <ParamsTable params={variant.request.params as Param[]} />}
        {reqTab === 'Body'    && <CodeBlock code={variant.request.body || '—'} lang="json" showHeader={false} showCopy />}
        {reqTab === 'Headers' && <CodeBlock code={variant.request.headers} lang="http" showHeader={false} showCopy />}
      </CollapsibleSection>

      {/* ── Response ── */}
      <CollapsibleSection title="Response" defaultOpen>
        <SubTabBar tabs={['Schema', 'Body', 'Headers']} active={resTab} onChange={setResTab} />
        {resTab === 'Schema'  && <SchemaTable fields={variant.response.fields} />}
        {resTab === 'Body'    && <CodeBlock code={variant.response.body || '—'} lang="json" showHeader={false} showCopy />}
        {resTab === 'Headers' && <CodeBlock code={variant.response.headers} lang="http" showHeader={false} showCopy />}
      </CollapsibleSection>

    </div>
  )
}
