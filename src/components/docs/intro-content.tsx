import { useState } from 'react'
import { CodeBlock } from './code-block'
import { CollapsibleSection } from './collapsible-section'
import {
  HTTP_STATUS_CODES, ALTERNATE_RESPONSES, INTERNAL_STATUS_CODES, BASE_URL, BASE_URL_TABLE,
} from '@/app/docs/(protected)/_data/introduction'
import { cn } from '@/lib/utils'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[15px] text-[--color-text-body] leading-relaxed', className)}>
      {children}
    </p>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12.5px] bg-[--color-surface-2] border border-[--color-border] px-1.5 py-0.5 rounded-sm text-[--color-text-body]">
      {children}
    </code>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[--color-text-muted] tracking-wide bg-[--color-surface-2]">
      {children}
    </th>
  )
}

function Td({ children, shade }: { children: React.ReactNode; shade?: boolean }) {
  return (
    <td className={cn(
      'px-4 py-2.5 text-[13px] text-[--color-text-body]',
      shade ? 'bg-[--color-surface-2]/40' : 'bg-[--color-surface]'
    )}>
      {children}
    </td>
  )
}

// ── Section bodies ────────────────────────────────────────────────────────────

function AbstractBody() {
  return (
    <div className="space-y-3">
      <Prose>
        The Insuretech Data Platform provides structured, enriched data for integration into insurance
        underwriting pipelines. It spans KYC authentication, employment &amp; income, asset &amp; vehicle,
        banking &amp; payments, and digital essentials — giving underwriting teams a single, consistent
        interface across every data domain they need.
      </Prose>
      <Prose>
        APIs are exposed as <InlineCode>GET</InlineCode> or <InlineCode>POST</InlineCode> endpoints depending
        on the data source, and every endpoint returns a predictable JSON response shape. Authentication is
        via a static API key passed as a request header on every call.
      </Prose>
    </div>
  )
}

function AuthenticationBody() {
  const host = BASE_URL.replace(/^https?:\/\//, '')
  const exampleCode = `GET /api/environmental/district?pincode=110001\n\nHost: ${host}\nx-api-key: YOUR_API_KEY`

  return (
    <div className="space-y-4">
      <Prose>
        All API endpoints require authentication via an API key. Pass your key in the{' '}
        <InlineCode>x-api-key</InlineCode> request header on every request.
      </Prose>
      <CodeBlock code={exampleCode} lang="bash" />
      <Prose className="text-[--color-text-muted]">
        Your API key is displayed in the profile menu (top-right corner). Keep it confidential
        — do not expose it in client-side code or commit it to source control.
      </Prose>
    </div>
  )
}

function EndPointsBody() {
  return (
    <div className="space-y-4">
      <div className="border border-[--color-border] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
              <Th>Environment</Th>
              <Th>Base URL</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {BASE_URL_TABLE.map((r, i) => (
              <tr key={r.environment} className="divide-x divide-[--color-border]">
                <Td shade={i % 2 !== 0}>{r.environment}</Td>
                <Td shade={i % 2 !== 0}>
                  <code className="font-mono text-[12.5px] text-[--color-accent]">{r.url}</code>
                </Td>
                <Td shade={i % 2 !== 0}>
                  <span className="text-[--color-success] font-semibold">● {r.status}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HttpStatusCodesBody() {
  const [activeTab, setActiveTab] = useState(0)
  const active = ALTERNATE_RESPONSES[activeTab]
  const sampleJson = `{\n  "status": ${active.status},\n  "error": "${active.error}",\n  "request_id": "73cdbde2-80f7-11e7-8f0c-e7e769f70bd1"\n}`

  return (
    <div className="space-y-5">
      <div className="border border-[--color-border] rounded overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[220px]" />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
              <Th>Code</Th>
              <Th>Message</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {HTTP_STATUS_CODES.map((r, i) => {
              const n = Number(r.code)
              const codeColor = n < 300 ? 'text-[--color-success]' : n < 500 ? 'text-[--color-warning]' : 'text-[--color-error]'
              return (
                <tr key={r.code} className="divide-x divide-[--color-border]">
                  <Td shade={i % 2 !== 0}>
                    <code className={cn('font-mono font-bold text-[12.5px]', codeColor)}>{r.code}</code>
                  </Td>
                  <Td shade={i % 2 !== 0}>{r.label}</Td>
                  <Td shade={i % 2 !== 0}>{r.meaning}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-[--color-text-primary] mb-2">
          Alternate Responses <span className="text-[--color-text-muted] font-normal">(By Status Codes)</span>
        </h3>
        <div className="border border-[--color-border] rounded overflow-hidden">
          <div className="flex items-center gap-1 px-2 pt-1.5 bg-[--color-surface-2] shadow-[inset_0_-1px_0_var(--color-border)] overflow-x-auto">
            {ALTERNATE_RESPONSES.map((r, i) => (
              <button
                key={r.tab}
                type="button"
                onClick={() => setActiveTab(i)}
                className={cn(
                  'px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap border-b-2 transition-colors duration-150',
                  i === activeTab
                    ? 'border-[--color-accent] text-[--color-accent]'
                    : 'border-transparent text-[--color-text-muted] hover:text-[--color-text-body]'
                )}
              >
                {r.tab}
              </button>
            ))}
          </div>
          <CodeBlock code={sampleJson} lang="json" showHeader={false} showCopy />
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-[--color-text-primary] mb-2">Internal Status Codes</h3>
        <div className="border border-[--color-border] rounded overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[90px]" />
              <col />
              <col className="w-1/3" />
            </colgroup>
            <thead>
              <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
                <Th>Code</Th>
                <Th>Description (for Authentication APIs)</Th>
                <Th>Description (for OCR APIs)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {INTERNAL_STATUS_CODES.map((r, i) => (
                <tr key={r.code} className="divide-x divide-[--color-border]">
                  <Td shade={i % 2 !== 0}>
                    <code className="font-mono font-bold text-[12.5px] text-[--color-accent]">{r.code}</code>
                  </Td>
                  <Td shade={i % 2 !== 0}>{r.auth}</Td>
                  <Td shade={i % 2 !== 0}>{r.ocr}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── IntroPage — all sections as collapsible cards, id for scroll anchoring ────

const SECTIONS = [
  { id: 'abstract',          label: 'Abstract',          Body: AbstractBody },
  { id: 'authentication',    label: 'Authentication',    Body: AuthenticationBody },
  { id: 'end-points',        label: 'End Points',        Body: EndPointsBody },
  { id: 'http-status-codes', label: 'HTTP Status Codes', Body: HttpStatusCodesBody },
]

interface IntroPageProps {
  activeSectionId?: string
  onSectionChange?: (id: string) => void
}

export function IntroPage({ activeSectionId, onSectionChange }: IntroPageProps) {
  return (
    <div className="px-6 py-5">
      {SECTIONS.map(({ id, label, Body }) => (
        <CollapsibleSection
          key={id}
          id={id}
          title={label}
          open={activeSectionId ? activeSectionId === id : id === 'abstract'}
          onOpenChange={next => onSectionChange?.(next ? id : '')}
        >
          <div className="px-6 py-5">
            <Body />
          </div>
        </CollapsibleSection>
      ))}
    </div>
  )
}
