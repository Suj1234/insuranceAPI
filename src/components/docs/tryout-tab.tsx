'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Info } from 'lucide-react'
import { cn, apiPath } from '@/lib/utils'
import { CollapsibleSection } from './collapsible-section'
import { SubTabBar } from './sub-tab-bar'
import { CodeBlock } from './code-block'
import { SearchableSelect } from './searchable-select'
import type { ApiDefinition, ParamValidation } from '@/app/docs/(protected)/_data/api-definitions'

// ── Types ────────────────────────────────────────────────────────────────────

type MetaData = {
  aqiStates: string[]
  aqiDistrictsByState: Record<string, string[]>
  waterStates: string[]
  hotspotStates: string[]
}

type ApiResult = {
  status: number
  latency: number
  body: string
  headers: Record<string, string>
}

// Module-level meta cache — persists across tab switches without refetching
let _metaCache: { data: MetaData; ts: number } | null = null

const POLLUTANTS = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'aqi']

const SELECT_CLS = [
  'px-3 py-[7px] rounded border text-sm',
  'bg-[--color-surface] border-[--color-border] text-[--color-text-body]',
  'focus:outline-none focus:border-[--color-accent]',
  'transition-colors duration-150 cursor-pointer',
].join(' ')

// ── Helpers ──────────────────────────────────────────────────────────────────

// Turn a dotted/camelCase key into a readable label — e.g.
// "result.firstName" → "First Name", "pinCode" → "Pin Code".
function humanizeKey(key: string): string {
  const leaf = key.split('.').pop() ?? key
  return leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

// A flattened row for the Data Preview tree. Nested objects emit a container
// row (isParent) followed by their children at depth+1, so the preview mirrors
// the response hierarchy instead of a flat key→value dump.
type PreviewRow = {
  key: string
  label: string      // humanized leaf name
  depth: number
  value: unknown     // leaf value; undefined for container rows
  isParent: boolean
  arrayLen?: number  // set when value is an array
}

function buildPreviewRows(obj: unknown, depth = 0, prefix = '', out: PreviewRow[] = []): PreviewRow[] {
  if (typeof obj !== 'object' || obj === null) return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    const isObject = typeof v === 'object' && v !== null && !Array.isArray(v)
    const isArray = Array.isArray(v)
    if (isObject) {
      out.push({ key, label: humanizeKey(k), depth, value: undefined, isParent: true })
      buildPreviewRows(v, depth + 1, key, out)
    } else {
      out.push({
        key, label: humanizeKey(k), depth, isParent: false,
        value: isArray ? undefined : v,
        arrayLen: isArray ? (v as unknown[]).length : undefined,
      })
    }
  }
  return out
}

// ── MonthPicker ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split('-') : ['', '']
  const year = parts[0] ?? ''
  const month = parts[1] ?? ''
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - 7 + i))

  function update(y: string, m: string) {
    if (y && m) onChange(`${y}-${m}`)
    else onChange('')
  }

  return (
    <div className="flex gap-2">
      <select
        value={month}
        onChange={e => update(year, e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">Month</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={String(i + 1).padStart(2, '0')}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={e => update(e.target.value, month)}
        className={SELECT_CLS}
      >
        <option value="">Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, latency }: { status: number; latency: number }) {
  const ok = status >= 200 && status < 300
  return (
    <span className="text-xs text-[--color-text-body] flex items-center gap-2">
      Status:{' '}
      <strong className={ok ? 'text-[--color-success]' : 'text-[--color-error]'}>{status}</strong>
      <span className="text-[--color-border-strong]">|</span>
      Latency:{' '}
      <strong className="text-[--color-text-body]">{latency}ms</strong>
    </span>
  )
}

// ── Validation ────────────────────────────────────────────────────────────────
// Drives inline errors from the SAME documented rules shown in the docs
// "Validations" column (param.validation) — single source of truth. Returns an
// error string, or null if the value is valid. Empty optional fields pass.
function validateField(p: { required: boolean; label?: string; name: string; validation?: ParamValidation }, raw: string): string | null {
  const value = raw.trim()
  const label = p.label ?? p.name
  if (!value) return p.required ? `${label} is required` : null
  const v = p.validation
  if (!v) return null
  if (v.minLength != null && value.length < v.minLength) return `${label} must be at least ${v.minLength} characters`
  if (v.maxLength != null && value.length > v.maxLength) return `${label} must be at most ${v.maxLength} characters`
  if (v.pattern && !new RegExp(v.pattern).test(value)) {
    return v.hint ? `${label} must match ${v.hint}` : `${label} has an invalid format`
  }
  return null
}

// ── FieldLabel ────────────────────────────────────────────────────────────────
// Name + type + optional required pill + an info icon that reveals the field
// description on hover/focus — so 12 fields don't need 12 permanent help lines.

function FieldLabel({ name, label, required, description, noMargin }: {
  name: string
  label?: string
  required?: boolean
  description?: string
  noMargin?: boolean
}) {
  const pretty = label ?? name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <label className={cn(
      'flex items-center gap-2 text-[12.5px] font-medium text-[--color-text-body]',
      noMargin ? '' : 'mb-1.5',
    )}>
      <span>
        {pretty}
        {required && <span className="text-[--color-error] ml-0.5" title="Required" aria-label="required">*</span>}
      </span>
      {required && <span className="sr-only">required</span>}
      {description && (
        <span className="group/tip relative inline-flex items-center">
          <button
            type="button"
            tabIndex={0}
            aria-label={`Help: ${description}`}
            className="text-[--color-text-muted] hover:text-[--color-text-primary] focus:text-[--color-text-primary] focus:outline-none transition-colors duration-150 cursor-pointer"
          >
            <Info size={13} />
          </button>
          {/* Tooltip — appears on hover/focus of the icon */}
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full mt-1.5 z-20 w-64 rounded-md bg-[--color-text-primary] px-2.5 py-1.5 text-[11.5px] font-normal leading-snug text-[--color-bg] opacity-0 shadow-sm transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
          >
            {description}
          </span>
        </span>
      )}
    </label>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TryoutTabProps {
  api: ApiDefinition
  apiKey: string
}

export function TryoutTab({ api, apiKey }: TryoutTabProps) {
  const queryParams = api.params.filter(p => p.in === 'query')
  const bodyParams  = api.params.filter(p => p.in === 'body')
  // Params rendered as form inputs = query + body (body only for POST/PUT etc.)
  const formParams  = [...queryParams, ...bodyParams]
  const responseRef = useRef<HTMLDivElement>(null)

  const [inputMode, setInputMode] = useState<'pincode' | 'latlon'>('pincode')

  const activeQueryParams = api.modeGroup === 'pincode-or-latlon'
    ? formParams.filter(p => {
        if (p.name === 'pincode') return inputMode === 'pincode'
        if (p.name === 'lat' || p.name === 'lon') return inputMode === 'latlon'
        return true
      })
    : formParams

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of formParams) {
      if (p.inputType === 'pollutant-select') { init[p.name] = 'pm25,aqi'; continue }
      if (p.inputType === 'state-select' || p.inputType === 'district-select') { init[p.name] = ''; continue }
      // Params with an explicit placeholder (e.g. pan/dob) start empty — their
      // `example` holds validation hints, not a fillable value. Others prefill.
      init[p.name] = !p.placeholder && p.example !== undefined ? String(p.example) : ''
    }
    return init
  })

  const [meta, setMeta] = useState<MetaData | null>(_metaCache?.data ?? null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [resTab, setResTab] = useState('Data Preview')
  const [responseOpen, setResponseOpen] = useState(false)  // auto-expands on send
  // Show a field's error only after it's been touched (blurred) or after a
  // Send attempt — so the form doesn't shout errors before the user has typed.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  // Current per-field errors (from the documented validation rules).
  const errors: Record<string, string> = {}
  for (const p of activeQueryParams) {
    const err = validateField(p, values[p.name] ?? '')
    if (err) errors[p.name] = err
  }
  const hasErrors = Object.keys(errors).length > 0

  useEffect(() => {
    if (_metaCache && Date.now() - _metaCache.ts < 60 * 60 * 1000) {
      setMeta(_metaCache.data); return
    }
    fetch(apiPath('api/environmental/meta'))
      .then(r => r.json())
      .then(j => {
        if (j.success) { _metaCache = { data: j.data, ts: Date.now() }; setMeta(j.data) }
      })
      .catch(() => {})
  }, [])

  function setVal(name: string, val: string) {
    setValues(v => ({ ...v, [name]: val }))
  }

  function renderInput(p: typeof queryParams[number]) {
    if (p.inputType === 'state-select') {
      const options = p.metaKey === 'aqiStates' ? (meta?.aqiStates ?? [])
        : p.metaKey === 'waterStates' ? (meta?.waterStates ?? [])
        : p.metaKey === 'hotspotStates' ? (meta?.hotspotStates ?? [])
        : []
      const districtParam = queryParams.find(q => q.inputType === 'district-select' && q.cascadesFrom === p.name)
      return (
        <SearchableSelect
          options={options}
          value={values[p.name] ?? ''}
          onChange={v => {
            if (districtParam) {
              setValues(prev => ({ ...prev, [p.name]: v, [districtParam.name]: '' }))
            } else {
              setVal(p.name, v)
            }
          }}
          placeholder={meta ? '— select state —' : 'Loading states…'}
          disabled={!meta || options.length === 0}
          className="w-full"
        />
      )
    }

    if (p.inputType === 'district-select') {
      const stateVal = p.cascadesFrom ? (values[p.cascadesFrom] ?? '') : ''
      const options = stateVal ? (meta?.aqiDistrictsByState[stateVal] ?? []) : []
      return (
        <SearchableSelect
          options={options}
          value={values[p.name] ?? ''}
          onChange={v => setVal(p.name, v)}
          placeholder={!stateVal ? 'Select state first' : options.length ? '— select district —' : 'No districts found'}
          disabled={!stateVal || options.length === 0}
          className="w-full"
        />
      )
    }

    if (p.inputType === 'month') {
      return (
        <MonthPicker
          value={values[p.name] ?? ''}
          onChange={v => setVal(p.name, v)}
        />
      )
    }

    if (p.inputType === 'pollutant-select') {
      const selected = (values[p.name] ?? '').split(',').filter(Boolean)
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-0.5">
          {POLLUTANTS.map(opt => {
            const checked = selected.includes(opt)
            return (
              <label
                key={opt}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-[--color-text-body]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter(s => s !== opt)
                      : [...selected, opt]
                    setVal(p.name, next.join(','))
                  }}
                  className="cursor-pointer accent-[--color-accent]"
                />
                <span className="font-mono text-xs uppercase">{opt}</span>
              </label>
            )
          })}
        </div>
      )
    }

    // Two-option enums (Y/N, Yes/No, true/false) → segmented pill, not a select.
    // NN/g: clearer than a toggle inside a submit-form, shows both labels.
    if (p.enum && p.enum.length === 2) {
      const current = values[p.name] ?? ''
      return (
        <div
          role="radiogroup"
          className="inline-flex rounded-lg overflow-hidden shadow-[0_0_0_1px_var(--color-border-strong)]"
        >
          {p.enum.map((v, i) => {
            const on = current === v
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setVal(p.name, v)}
                className={cn(
                  // fixed equal width so every pill is identical and they align
                  'w-[52px] py-1.5 text-[12.5px] font-medium text-center transition-colors duration-150 cursor-pointer',
                  i > 0 && 'shadow-[inset_1px_0_0_var(--color-border-strong)]',
                  on
                    ? 'bg-[--color-text-primary] text-[--color-bg] dark:bg-[--color-accent] dark:text-white'
                    : 'bg-[--color-surface] text-[--color-text-muted] hover:text-[--color-text-primary]',
                )}
              >
                {v === 'Y' ? 'Yes' : v === 'N' ? 'No' : v}
              </button>
            )
          })}
        </div>
      )
    }

    if (p.enum) {
      return (
        <select
          value={values[p.name] ?? ''}
          onChange={e => setVal(p.name, e.target.value)}
          className={cn(SELECT_CLS, 'w-full')}
          aria-required={p.required}
        >
          <option value="">— select —</option>
          {p.enum.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )
    }

    const placeholder = p.placeholder ?? (p.example !== undefined ? String(p.example) : '')
    const showErr = (touched[p.name] || submitted) && !!errors[p.name]
    return (
      <input
        type="text"
        value={values[p.name] ?? ''}
        onChange={e => setVal(p.name, p.uppercase ? e.target.value.toUpperCase() : e.target.value)}
        onBlur={() => setTouched(t => ({ ...t, [p.name]: true }))}
        placeholder={placeholder}
        aria-required={p.required}
        aria-invalid={showErr}
        className={cn(
          'w-full px-3 py-[7px] rounded border text-sm font-mono',
          'bg-[--color-surface-2] text-[--color-text-body]',
          'placeholder:text-[--color-text-xmuted]',
          'focus:outline-none transition-colors duration-150',
          showErr
            ? 'border-[--color-error] focus:border-[--color-error]'
            : 'border-[--color-border] focus:border-[--color-accent]',
          p.uppercase && 'uppercase placeholder:normal-case',
        )}
      />
    )
  }

  async function handleSend() {
    setSubmitted(true)
    // Block the request if any documented validation fails — reveal all errors.
    if (hasErrors) {
      setTouched(Object.fromEntries(activeQueryParams.map(p => [p.name, true])))
      return
    }
    setLoading(true); setResult(null)
    setResponseOpen(true)   // auto-expand the Response section on every send
    const t0 = Date.now()
    try {
      const url = new URL(apiPath(api.path), window.location.origin)
      // Query params always go on the URL.
      for (const p of activeQueryParams) {
        if (p.in === 'query' && values[p.name]) url.searchParams.set(p.name, values[p.name])
      }

      const headers: Record<string, string> = { 'x-api-key': apiKey }
      let body: string | undefined

      // Body params (POST/PUT) go in a JSON body.
      const activeBodyParams = activeQueryParams.filter(p => p.in === 'body')
      if (activeBodyParams.length > 0) {
        const payload: Record<string, string> = {}
        for (const p of activeBodyParams) {
          if (values[p.name] !== '') payload[p.name] = values[p.name]
        }
        body = JSON.stringify(payload)
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch(url.toString(), {
        method: api.method,
        headers,
        body,
      })
      const latency = Date.now() - t0
      const text = await res.text()
      let resBody = text
      try { resBody = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { resHeaders[k] = v })
      setResult({ status: res.status, latency, body: resBody, headers: resHeaders })
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setResult({ status: 0, latency: Date.now() - t0, body: `Network error: ${String(err)}`, headers: {} })
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } finally {
      setLoading(false)
    }
  }

  const headersCode = result
    ? Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n')
    : ''

  return (
    <div className="px-8 py-6">

      {/* Request form — 3-column grid, full width */}
      <CollapsibleSection title="Request" defaultOpen>
        <div className="px-5 py-5 border-t border-[--color-border] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
          {api.modeGroup === 'pincode-or-latlon' && (
            <div className="col-span-full flex border-b border-[--color-border] w-fit -mb-1">
              {(['pincode', 'latlon'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  className={cn(
                    'px-3 py-1.5 text-xs border-b-2 -mb-px cursor-pointer transition-colors duration-150',
                    inputMode === mode
                      ? 'font-semibold text-[--color-accent] border-[--color-accent]'
                      : 'font-normal text-[--color-text-muted] border-transparent hover:text-[--color-text-body]'
                  )}
                >
                  {mode === 'pincode' ? 'Pincode' : 'Lat / Lon'}
                </button>
              ))}
            </div>
          )}
          {/* Text inputs first, then Yes/No flags (Consent last) — every field
              renders label-above-control so the toggles share the inputs' exact
              vertical rhythm; a hairline divides the two zones. */}
          {(() => {
            const isToggle = (p: typeof activeQueryParams[number]) => !!p.enum && p.enum.length === 2
            const inputs  = activeQueryParams.filter(p => !isToggle(p))
            // Toggles, with "consent" forced to the end (it's the required gate).
            const toggles = activeQueryParams.filter(isToggle)
              .sort((a, b) => (a.name === 'consent' ? 1 : 0) - (b.name === 'consent' ? 1 : 0))
            const grouped = toggles.length > 0 && inputs.length > 0

            // Inputs fill the 3-column grid (text boxes earn the width).
            const renderInputField = (p: typeof activeQueryParams[number]) => {
              const isFullWidth = p.inputType === 'pollutant-select'
              const showErr = (touched[p.name] || submitted) && !!errors[p.name]
              return (
                <div key={p.name} className={isFullWidth ? 'col-span-full' : 'col-span-1'}>
                  <FieldLabel name={p.name} label={p.label} required={p.required} description={p.description} />
                  {renderInput(p)}
                  {showErr && (
                    <p className="mt-1 text-[11.5px] text-[--color-error]">{errors[p.name]}</p>
                  )}
                </div>
              )
            }

            // Toggles DON'T earn a wide grid column — a 120px pill stranded in a
            // 500px cell is 70% dead space. Instead they pack into a self-sizing
            // flex-wrap strip: label + pill hug each other, tiles sit close
            // together and wrap naturally. No stranded controls, no empty columns.
            const renderToggleTile = (p: typeof activeQueryParams[number]) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <FieldLabel name={p.name} label={p.label} required={p.required} description={p.description} noMargin />
                {renderInput(p)}
              </div>
            )

            return (
              <>
                {inputs.map(renderInputField)}
                {toggles.length > 0 && (
                  <div className="col-span-full">
                    {grouped && <div className="h-px bg-[--color-border] mb-4" aria-hidden />}
                    {/* Denser grid sized for compact toggles — 2/3/4 per row with
                        real spacing: grouped and aligned, but breathable (not one
                        crammed line, not stranded in wide input columns). */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                      {toggles.map(renderToggleTile)}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          <div className="col-span-full pt-1">
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg',
                'text-[13px] font-medium tracking-[0.01em]',
                'bg-[--color-text-primary] text-[--color-bg] dark:bg-[--color-accent] dark:text-white',
                'transition-opacity duration-150 active:translate-y-px',
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer',
              )}
            >
              {loading
                ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                : <><Send size={13} /> Send</>}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Response */}
      <div ref={responseRef}>
        <CollapsibleSection
          title="Response"
          open={responseOpen}
          onOpenChange={setResponseOpen}
          rightSlot={result ? <StatusBadge status={result.status} latency={result.latency} /> : undefined}
        >
          {result ? (
            <>
              <SubTabBar
                tabs={['Data Preview', 'Body', 'Headers']}
                active={resTab}
                onChange={setResTab}
              />

              {resTab === 'Body' && (
                <CodeBlock code={result.body} lang="json" />
              )}

              {resTab === 'Data Preview' && (
                <div className="border-t border-[--color-border] overflow-hidden">
                  {(() => {
                    try {
                      const rows = buildPreviewRows(JSON.parse(result.body))
                      return (
                        <table className="w-full border-collapse text-sm table-fixed">
                          <colgroup>
                            <col className="w-[42%]" />
                            <col />
                          </colgroup>
                          <tbody>
                            {rows.map(r => {
                              const empty = r.value === '' || r.value === null || r.value === undefined
                              return (
                                <tr
                                  key={r.key}
                                  className={cn(
                                    'border-b border-[--color-border] last:border-b-0',
                                    r.isParent && 'bg-[--color-surface-2]',
                                  )}
                                >
                                  {/* Label — indented by depth; container rows bolder ink */}
                                  <td
                                    className={cn(
                                      'py-2.5 pr-5 align-top break-words',
                                      r.isParent
                                        ? 'text-[13px] font-medium text-[--color-text-primary]'
                                        : 'text-[13px] text-[--color-text-muted]',
                                    )}
                                    style={{ paddingLeft: `${20 + r.depth * 20}px` }}
                                  >
                                    {r.label}
                                  </td>
                                  <td className="px-5 py-2.5 font-mono text-[12.5px] text-[--color-text-primary] whitespace-pre-wrap break-words align-top">
                                    {r.isParent
                                      ? <span className="text-[--color-text-xmuted]">{'{ }'}</span>
                                      : r.arrayLen !== undefined
                                        ? <span className="text-[--color-text-muted]">[{r.arrayLen} items]</span>
                                        : empty
                                          ? <span className="text-[--color-text-xmuted]">—</span>
                                          : String(r.value)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    } catch {
                      return (
                        <pre className="m-0 px-5 py-4 text-[12.5px] font-mono text-[--color-text-body] whitespace-pre-wrap">
                          {result.body}
                        </pre>
                      )
                    }
                  })()}
                </div>
              )}

              {resTab === 'Headers' && (
                <CodeBlock code={headersCode} lang="http" />
              )}
            </>
          ) : (
            <div className="px-4 py-10 text-center border-t border-[--color-border]">
              <p className="text-sm text-[--color-text-muted]">
                Click Send to execute the request and see the response here.
              </p>
            </div>
          )}
        </CollapsibleSection>
      </div>

    </div>
  )
}
