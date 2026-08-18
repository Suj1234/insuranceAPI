import { CodeBlock } from './code-block'
import { CollapsibleSection } from './collapsible-section'
import {
  HTTP_STATUS_CODES, ERROR_CODES, BASE_URL, BASE_URL_TABLE,
} from '@/app/docs/(protected)/environmental/_data/introduction'
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
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[--color-text-muted] tracking-wide bg-[--color-surface-2] whitespace-nowrap">
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
        The Insuretech Data Platform provides structured, enriched alternate data for Indian geographies
        — identified by PIN code or state name. It is designed for integration into health insurance
        underwriting pipelines.
      </Prose>
      <Prose>
        The <strong>Environmental API</strong> covers air quality (CPCB/CAMS/SEDAC), heat stress (ERA5),
        natural disasters (EM-DAT), population health burden (NFHS-5), and ground water contamination (CGWB).
      </Prose>
      <Prose>
        All APIs are read-only <InlineCode>GET</InlineCode> endpoints. Authentication is via a static API
        key passed as a request header.
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
      <CodeBlock code={exampleCode} lang="http" />
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
      <Prose className="text-[--color-text-muted] text-xs">
        All endpoints use HTTPS. HTTP requests are not supported.
      </Prose>
    </div>
  )
}

function HttpStatusCodesBody() {
  return (
    <div className="border border-[--color-border] rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
            <Th>Code</Th>
            <Th>Label</Th>
            <Th>Meaning</Th>
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
  )
}

function ErrorCodesBody() {
  return (
    <div className="space-y-4">
      <Prose>
        All error responses follow the shape:{' '}
        <InlineCode>{`{ "success": false, "error": "...", "code": "..." }`}</InlineCode>
      </Prose>
      <div className="border border-[--color-border] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[--color-surface-2] border-b border-[--color-border] divide-x divide-[--color-border]">
              <Th>Code</Th>
              <Th>HTTP</Th>
              <Th>Meaning</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {ERROR_CODES.map((r, i) => (
              <tr key={r.code} className="divide-x divide-[--color-border]">
                <Td shade={i % 2 !== 0}>
                  <span className="inline-flex items-center font-mono text-[11px] px-1.5 py-0.5 rounded-sm border text-[--color-error] bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900">
                    {r.code}
                  </span>
                </Td>
                <Td shade={i % 2 !== 0}>
                  <code className={cn(
                    'font-mono font-bold text-[12.5px]',
                    r.httpStatus < 500 ? 'text-[--color-warning]' : 'text-[--color-error]'
                  )}>
                    {r.httpStatus}
                  </code>
                </Td>
                <Td shade={i % 2 !== 0}>{r.meaning}</Td>
              </tr>
            ))}
          </tbody>
        </table>
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
  { id: 'error-codes',       label: 'Error Codes',       Body: ErrorCodesBody },
]

export function IntroPage() {
  return (
    <div className="px-6 py-5">
      {SECTIONS.map(({ id, label, Body }) => (
        <CollapsibleSection key={id} id={id} title={label} defaultOpen={id === 'abstract'}>
          <div className="px-6 py-5">
            <Body />
          </div>
        </CollapsibleSection>
      ))}
    </div>
  )
}
