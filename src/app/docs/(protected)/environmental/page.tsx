'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { API_DEFINITIONS } from './_data/api-definitions'
import type { ApiDefinition } from './_data/api-definitions'
import {
  INTRO_ITEMS, HTTP_STATUS_CODES, ERROR_CODES, BASE_URL_TABLE, BASE_URL,
} from './_data/introduction'
import type { IntroSectionId } from './_data/introduction'

// ─── tiny helpers ────────────────────────────────────────────────────────────

function maskKey(k: string) {
  if (!k || k.length <= 6) return '••••••••••••••••'
  return k.slice(0, 6) + '••••••••••••••••'
}

const METHOD_STYLE: Record<string, { color: string; bg: string }> = {
  GET:    { color: '#fff', bg: '#2d7d46' },
  POST:   { color: '#fff', bg: '#374151' },
  PUT:    { color: '#fff', bg: '#b45309' },
  DELETE: { color: '#fff', bg: '#b91c1c' },
}

// ─── CodeBlock ───────────────────────────────────────────────────────────────

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ position: 'relative', background: '#1e2330', borderRadius: '0 0 6px 6px', border: '1px solid #2d3348', borderTop: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', borderBottom: '1px solid #2d3348' }}>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: copied ? '#34d399' : '#6b7fa3', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          {copied
            ? <><Ico d="M20 6 9 17 4 12" s={12} /> Copied</>
            : <><Ico d="M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" s={12} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Ico({ d, s = 14, stroke = 'currentColor', fill = 'none' }: { d: string; s?: number; stroke?: string; fill?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', color: copied ? '#34d399' : '#6b7fa3', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>
      {copied
        ? <><Ico d="M20 6 9 17 4 12" s={12} stroke="#34d399" /> Copied</>
        : <><Ico d="M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" s={12} /> Copy</>}
    </button>
  )
}

// ─── SchemaTable ─────────────────────────────────────────────────────────────

function SchemaTable({ fields }: { fields: Array<{ field: string; type: string; description: string }> }) {
  return (
    <div style={{ borderRadius: '0 0 6px 6px', overflow: 'hidden', border: '1px solid #e5e7eb', borderTop: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Field', 'Type', 'Description'].map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.field} style={{ borderBottom: i < fields.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '7px 14px', fontFamily: 'Consolas, monospace', fontSize: '11.5px', color: '#1d4ed8' }}>{f.field}</td>
              <td style={{ padding: '7px 14px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ede9fe', padding: '1px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>{f.type}</span>
              </td>
              <td style={{ padding: '7px 14px', color: '#4b5563', lineHeight: 1.5 }}>{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── ParamsTable ─────────────────────────────────────────────────────────────

function ParamsTable({ params }: { params: ApiDefinition['params'] }) {
  const IN: Record<string, { c: string; bg: string; border: string }> = {
    header: { c: '#6d28d9', bg: '#f5f3ff', border: '#ede9fe' },
    query:  { c: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    path:   { c: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  }
  return (
    <div style={{ borderRadius: '0 0 6px 6px', overflow: 'hidden', border: '1px solid #e5e7eb', borderTop: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Name', 'In', 'Type', 'Required', 'Description'].map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '12px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => {
            const ins = IN[p.in] ?? IN.query
            return (
              <tr key={`${p.in}-${p.name}`} style={{ borderBottom: i < params.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '7px 14px', fontFamily: 'Consolas, monospace', fontSize: '11.5px', color: '#1d4ed8' }}>{p.name}</td>
                <td style={{ padding: '7px 14px' }}><span style={{ fontFamily: 'monospace', fontSize: '11px', color: ins.c, background: ins.bg, border: `1px solid ${ins.border}`, padding: '1px 6px', borderRadius: '3px' }}>{p.in}</span></td>
                <td style={{ padding: '7px 14px' }}><span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ede9fe', padding: '1px 6px', borderRadius: '3px' }}>{p.type}</span></td>
                <td style={{ padding: '7px 14px', fontSize: '12px' }}>{p.required ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#9ca3af' }}>No</span>}</td>
                <td style={{ padding: '7px 14px', color: '#4b5563', lineHeight: 1.5 }}>
                  {p.description}
                  {p.enum && <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{p.enum.map(v => <code key={v} style={{ fontSize: '11px', background: '#f3f4f6', padding: '1px 5px', borderRadius: 3, border: '1px solid #e5e7eb' }}>{v}</code>)}</div>}
                  {p.example !== undefined && <div style={{ marginTop: 3, color: '#9ca3af', fontSize: '11.5px' }}>e.g. <code style={{ color: '#374151' }}>{String(p.example)}</code></div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── SubTabBar ────────────────────────────────────────────────────────────────

function SubTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '0 14px' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '8px 14px', fontSize: '13px', border: 'none', cursor: 'pointer', background: 'none',
          fontWeight: active === t ? 600 : 400,
          color: active === t ? '#1d4ed8' : '#6b7280',
          borderBottom: active === t ? '2px solid #1d4ed8' : '2px solid transparent',
          marginBottom: '-1px',
        }}>{t}</button>
      ))}
    </div>
  )
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({
  title, defaultOpen = true, rightLabel, children,
}: {
  title: string; defaultOpen?: boolean; rightLabel?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#fff', cursor: 'pointer', userSelect: 'none', borderLeft: '3px solid #1d4ed8' }}
      >
        <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {rightLabel}
          <span style={{ fontSize: '18px', color: '#6b7280', lineHeight: 1, fontWeight: 300 }}>{open ? '−' : '+'}</span>
        </div>
      </div>
      {open && children}
    </div>
  )
}

// ─── Codegen ─────────────────────────────────────────────────────────────────

const LANGS = ['cURL', 'JavaScript', 'Python', 'Node.js'] as const
type Lang = typeof LANGS[number]

function buildUrl(api: ApiDefinition) {
  const qs = api.exampleRequest.queryString ? `?${api.exampleRequest.queryString}` : ''
  return `${BASE_URL}${api.path}${qs}`
}

const GENS: Record<Lang, (api: ApiDefinition) => string> = {
  'cURL':       api => `curl -X ${api.method} \\\n  "${buildUrl(api)}" \\\n  -H "x-api-key: YOUR_API_KEY"`,
  'JavaScript': api => `const res = await fetch(\n  "${buildUrl(api)}",\n  { method: "${api.method}", headers: { "x-api-key": "YOUR_API_KEY" } }\n);\nconst data = await res.json();\nconsole.log(data);`,
  'Python':     api => `import requests\nresp = requests.${api.method.toLowerCase()}(\n    "${buildUrl(api)}",\n    headers={"x-api-key": "YOUR_API_KEY"},\n)\nprint(resp.json())`,
  'Node.js':    api => `fetch("${buildUrl(api)}", {\n  method: "${api.method}",\n  headers: { "x-api-key": "YOUR_API_KEY" },\n}).then(r => r.json()).then(console.log);`,
}

function CodegenSection({ api }: { api: ApiDefinition }) {
  const [lang, setLang] = useState<Lang>('cURL')
  return (
    <CollapsibleSection title="Codegen" defaultOpen={false}>
      <div style={{ padding: '14px 16px', background: '#fafafa', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 10, background: '#f3f4f6', borderRadius: 7, padding: 3, width: 'fit-content' }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 12px', borderRadius: 5, border: 'none', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              background: lang === l ? '#fff' : 'transparent',
              color: lang === l ? '#1d4ed8' : '#6b7280',
              boxShadow: lang === l ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #2d3348' }}>
          <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>
              {lang === 'Python' ? 'python' : 'javascript'}
            </span>
          </div>
          <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, overflow: 'auto', whiteSpace: 'pre' }}>
            <code>{GENS[lang](api)}</code>
          </pre>
        </div>
      </div>
    </CollapsibleSection>
  )
}

// ─── Documentation Tab ────────────────────────────────────────────────────────

function DocumentationTab({ api }: { api: ApiDefinition }) {
  const [reqTab, setReqTab] = useState('Schema')
  const [resTab, setResTab] = useState('Schema')

  const requestUrl = api.exampleRequest.queryString
    ? `${api.path}?${api.exampleRequest.queryString}`
    : api.path

  const reqHeaders = api.params.filter(p => p.in === 'header')
  const reqHeadersCode = reqHeaders.map(p => `${p.name}: YOUR_${p.name.toUpperCase().replace(/-/g, '_')}`).join('\n') || `x-api-key: YOUR_API_KEY\nContent-Type: application/json`

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Request */}
      <CollapsibleSection title="Request">
        <SubTabBar tabs={['Schema', 'Body', 'Headers']} active={reqTab} onChange={setReqTab} />
        {reqTab === 'Schema' && <ParamsTable params={api.params} />}
        {reqTab === 'Body' && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>http</span>
              <CopyButton text={`${api.method} ${requestUrl}\nHost: ${BASE_URL.replace(/^https?:\/\//, '')}\nx-api-key: YOUR_API_KEY`} />
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre' }}>
              <code>{`${api.method} ${requestUrl}\nHost: ${BASE_URL.replace(/^https?:\/\//, '')}\nx-api-key: YOUR_API_KEY`}</code>
            </pre>
          </div>
        )}
        {reqTab === 'Headers' && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>headers</span>
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre' }}>
              <code>{reqHeadersCode}</code>
            </pre>
          </div>
        )}
      </CollapsibleSection>

      {/* Response */}
      <CollapsibleSection title="Response">
        <SubTabBar tabs={['Schema', 'Body', 'Headers']} active={resTab} onChange={setResTab} />
        {resTab === 'Schema' && <SchemaTable fields={api.responseFields} />}
        {resTab === 'Body' && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>json</span>
              <CopyButton text={api.exampleResponse} />
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre' }}>
              <code>{api.exampleResponse}</code>
            </pre>
          </div>
        )}
        {resTab === 'Headers' && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>headers</span>
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, whiteSpace: 'pre' }}>
              <code>{`content-type: application/json\ncache-control: no-store\nx-response-time: 42ms`}</code>
            </pre>
          </div>
        )}
      </CollapsibleSection>

      {/* Codegen */}
      <CodegenSection api={api} />
    </div>
  )
}

// ─── Tryout Tab ───────────────────────────────────────────────────────────────

function TryoutTab({ api, apiKey }: { api: ApiDefinition; apiKey: string }) {
  const queryParams = api.params.filter(p => p.in === 'query')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of queryParams) init[p.name] = p.example !== undefined ? String(p.example) : ''
    return init
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: number; latency: number; body: string; headers: Record<string, string> } | null>(null)
  const [resTab, setResTab] = useState('Body')

  async function handleSend() {
    setLoading(true); setResult(null)
    const t0 = Date.now()
    try {
      const url = new URL(api.path, window.location.origin)
      for (const p of queryParams) { if (values[p.name]) url.searchParams.set(p.name, values[p.name]) }
      const res = await fetch(url.toString(), { method: api.method, headers: { 'x-api-key': apiKey } })
      const latency = Date.now() - t0
      const text = await res.text()
      let body = text
      try { body = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      const headers: Record<string, string> = {}
      res.headers.forEach((v, k) => { headers[k] = v })
      setResult({ status: res.status, latency, body, headers })
    } catch (err) {
      setResult({ status: 0, latency: Date.now() - t0, body: `Network error: ${String(err)}`, headers: {} })
    } finally {
      setLoading(false)
    }
  }

  const statusColor = !result ? '#374151'
    : result.status >= 200 && result.status < 300 ? '#16a34a'
    : '#dc2626'

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Request */}
      <CollapsibleSection title="Request">
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {queryParams.map(p => (
            <div key={p.name}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d4ed8" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" stroke="white" strokeWidth="2" fill="none"/></svg>
                <span>{p.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                {p.required && <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span>}
              </label>
              {p.enum ? (
                <select value={values[p.name] ?? ''} onChange={e => setValues(v => ({ ...v, [p.name]: e.target.value }))}
                  style={{ width: '380px', maxWidth: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '13px', color: '#111827', background: '#fff', outline: 'none' }}>
                  <option value="">— select —</option>
                  {p.enum.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input type="text" value={values[p.name] ?? ''} onChange={e => setValues(v => ({ ...v, [p.name]: e.target.value }))}
                  placeholder={p.example !== undefined ? String(p.example) : ''}
                  style={{ width: '380px', maxWidth: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '13px', fontFamily: 'monospace', color: '#111827', background: '#f9fafb', outline: 'none' }} />
              )}
            </div>
          ))}
          <div style={{ paddingTop: 4 }}>
            <button onClick={handleSend} disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: loading ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading
                ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #fff3', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Sending…</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SEND</>}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Response */}
      <CollapsibleSection
        title="Response"
        defaultOpen={true}
        rightLabel={result ? (
          <span style={{ fontSize: '13px', color: '#374151' }}>
            Status: <strong style={{ color: statusColor }}>{result.status}</strong>
            {' '}| Latency: <strong style={{ color: '#1d4ed8' }}>{result.latency}ms</strong>
          </span>
        ) : undefined}
      >
        {result ? (
          <>
            <SubTabBar tabs={['Data Preview', 'Body', 'Headers']} active={resTab} onChange={setResTab} />
            {resTab === 'Data Preview' && (
              <div style={{ borderTop: 'none', border: '1px solid #e5e7eb', borderRadius: '0 0 6px 6px', padding: '12px 16px', background: '#fff' }}>
                {(() => {
                  try {
                    const parsed = JSON.parse(result.body)
                    const flat = flattenObj(parsed)
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                          {Object.entries(flat).slice(0, 20).map(([k, v], i) => (
                            <tr key={k} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ padding: '6px 12px', color: '#374151', fontWeight: 500, width: '45%' }}>{k}</td>
                              <td style={{ padding: '6px 12px', color: '#1d4ed8', fontFamily: 'monospace', fontSize: '12px' }}>{String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  } catch {
                    return <pre style={{ fontSize: '12.5px', color: '#374151', margin: 0 }}>{result.body}</pre>
                  }
                })()}
              </div>
            )}
            {resTab === 'Body' && (
              <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                <div style={{ background: '#252b3b', padding: '6px 12px', borderBottom: '1px solid #2d3348', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>json</span>
                  <CopyButton text={result.body} />
                </div>
                <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre' }}>
                  <code>{result.body}</code>
                </pre>
              </div>
            )}
            {resTab === 'Headers' && (
              <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                <pre style={{ margin: 0, padding: '14px 16px', background: '#1e2330', fontSize: '12.5px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre' }}>
                  <code>{Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</code>
                </pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', borderTop: '1px solid #e5e7eb' }}>
            Click SEND to execute the request and see the response here.
          </div>
        )}
      </CollapsibleSection>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

function flattenObj(obj: unknown, prefix = '', result: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    result[prefix] = obj; return result
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      flattenObj(v, key, result)
    } else {
      result[key] = Array.isArray(v) ? `[${(v as unknown[]).length} items]` : v
    }
  }
  return result
}

// ─── Introduction Content ─────────────────────────────────────────────────────

function IntroContent({ sectionId }: { sectionId: IntroSectionId }) {
  const cell = (content: React.ReactNode, i: number, shade: boolean) => (
    <td key={i} style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '13px', color: '#374151', background: shade ? '#fafafa' : '#fff' }}>{content}</td>
  )

  if (sectionId === 'abstract') return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: 12 }}>Abstract</h1>
      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, marginBottom: 16 }}>
        The Insuretech Data Platform provides structured, enriched alternate data for Indian geographies — identified by PIN code or state name. It is designed for integration into health insurance underwriting pipelines.
      </p>
      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, marginBottom: 16 }}>
        The <strong>Environmental API</strong> covers air quality (CPCB/CAMS/SEDAC), heat stress (ERA5), natural disasters (EM-DAT), population health burden (NFHS-5), and ground water contamination (CGWB).
      </p>
      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7 }}>
        All APIs are read-only GET endpoints. Authentication is via a static API key passed as a request header.
      </p>
    </div>
  )

  if (sectionId === 'authentication') return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: 12 }}>Authentication</h1>
      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, marginBottom: 20 }}>
        All API endpoints require authentication via an API key. Pass your key in the <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: '13px' }}>x-api-key</code> request header on every request.
      </p>
      <div style={{ background: '#1e2330', borderRadius: 7, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ background: '#252b3b', padding: '7px 14px', borderBottom: '1px solid #2d3348' }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7fa3', textTransform: 'uppercase' }}>http</span>
        </div>
        <pre style={{ margin: 0, padding: '14px 16px', fontSize: '13px', fontFamily: 'Consolas, Monaco, monospace', color: '#c9d1d9', lineHeight: 1.6 }}>
          <code>{`GET /api/environmental/district?pincode=110001\nHost: ${BASE_URL.replace(/^https?:\/\//, '')}\nx-api-key: YOUR_API_KEY`}</code>
        </pre>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
        Your API key is displayed in the profile menu (top-right corner). Keep it confidential — do not expose it in client-side code.
      </p>
    </div>
  )

  if (sectionId === 'end-points') return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: 20 }}>End Points</h1>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Environment', 'Base URL', 'Status'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {BASE_URL_TABLE.map((r, i) => (
              <tr key={r.environment}>
                {[r.environment, <code key="url" style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{r.url}</code>, <span key="status" style={{ color: '#16a34a', fontWeight: 600 }}>● {r.status}</span>].map((c, j) => cell(c, j, i % 2 !== 0))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>All endpoints use HTTPS. HTTP requests are not supported.</p>
    </div>
  )

  if (sectionId === 'http-status-codes') return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: 20 }}>HTTP Status Codes</h1>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Code', 'Label', 'Meaning'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {HTTP_STATUS_CODES.map((r, i) => (
              <tr key={r.code} style={{ borderBottom: i < HTTP_STATUS_CODES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                {[
                  <code key="code" style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(r.code) < 300 ? '#16a34a' : Number(r.code) < 500 ? '#d97706' : '#dc2626' }}>{r.code}</code>,
                  r.label,
                  r.meaning,
                ].map((c, j) => cell(c, j, i % 2 !== 0))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (sectionId === 'error-codes') return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: 8 }}>Error Codes</h1>
      <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: 20, lineHeight: 1.6 }}>
        All error responses follow the shape: <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: '13px' }}>{`{ "success": false, "error": "...", "code": "..." }`}</code>
      </p>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {['Code', 'HTTP', 'Meaning'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {ERROR_CODES.map((r, i) => (
              <tr key={r.code} style={{ borderBottom: i < ERROR_CODES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                {[
                  <code key="code" style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#dc2626', background: '#fef2f2', padding: '1px 7px', borderRadius: 3, border: '1px solid #fecaca' }}>{r.code}</code>,
                  <code key="http" style={{ fontFamily: 'monospace', fontWeight: 700, color: r.httpStatus < 500 ? '#d97706' : '#dc2626' }}>{r.httpStatus}</code>,
                  r.meaning,
                ].map((c, j) => cell(c, j, i % 2 !== 0))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return null
}

// ─── ApiContentArea ───────────────────────────────────────────────────────────

type ActiveView =
  | { kind: 'intro'; sectionId: IntroSectionId }
  | { kind: 'api';   apiId: string }

function ApiContentArea({ view, apiKey }: { view: ActiveView; apiKey: string }) {
  const [docTab, setDocTab] = useState<'Documentation' | 'Tryout'>('Documentation')

  if (view.kind === 'intro') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        <IntroContent sectionId={view.sectionId} />
      </div>
    )
  }

  const api = API_DEFINITIONS.find(a => a.id === view.apiId) ?? API_DEFINITIONS[0]
  const ms = METHOD_STYLE[api.method] ?? METHOD_STYLE.GET

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
      {/* API header */}
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{api.label}</h1>
        </div>

        {/* Method + URL bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 14px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 4, fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: ms.color, background: ms.bg, flexShrink: 0 }}>
            {api.method}
          </span>
          <code style={{ fontSize: '13px', color: '#374151', fontFamily: 'Consolas, monospace', wordBreak: 'break-all' }}>
            {`${BASE_URL}${api.path}`}
          </code>
        </div>

        <p style={{ fontSize: '13.5px', color: '#4b5563', lineHeight: 1.6, marginBottom: 14 }}>{api.shortDescription}</p>

        {/* Doc / Tryout tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['Documentation', 'Tryout'] as const).map(t => (
            <button key={t} onClick={() => setDocTab(t)} style={{
              padding: '9px 18px', fontSize: '13.5px', border: '1px solid #e5e7eb', cursor: 'pointer', background: docTab === t ? '#fff' : '#f8fafc',
              fontWeight: docTab === t ? 600 : 400, color: docTab === t ? '#111827' : '#6b7280',
              borderBottom: docTab === t ? '1px solid #fff' : '1px solid #e5e7eb',
              marginBottom: '-1px', borderRadius: '5px 5px 0 0',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {docTab === 'Documentation'
        ? <DocumentationTab api={api} />
        : <TryoutTab api={api} apiKey={apiKey} />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnvironmentalDocsPage() {
  const router = useRouter()
  const [view, setView] = useState<ActiveView>({ kind: 'intro', sectionId: 'abstract' })
  const [introOpen, setIntroOpen] = useState(true)
  const [envOpen, setEnvOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const envEl = typeof window !== 'undefined'
    ? (document.getElementById('__docs_env') as HTMLDivElement | null)
    : null
  const rawKey  = envEl?.dataset.apiKey  ?? ''
  const userName = envEl?.dataset.userName ?? 'Developer'

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/docs/auth/logout', { method: 'POST' })
    router.push('/docs/login')
  }

  async function copyKey() {
    await navigator.clipboard.writeText(rawKey)
    setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000)
  }

  const isIntroActive = (id: IntroSectionId) => view.kind === 'intro' && view.sectionId === id
  const isApiActive   = (id: string)          => view.kind === 'api'   && view.apiId === id

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: 'hidden' }}>

      {/* ── Top Navbar ── */}
      <nav style={{ height: 52, background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, background: '#1d4ed8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Insuretech</span>
            <span style={{ color: '#64748b', fontSize: '15px' }}>|</span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Data Platform</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ padding: '5px 12px', background: '#2d3448', color: '#e2e8f0', border: 'none', borderRadius: 5, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Documentation</button>
          </div>
        </div>

        {/* Profile */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}
          >
            <div style={{ width: 30, height: 30, background: '#1d4ed8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>{initials}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>{userName}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Developer</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {profileOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', width: 260, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{userName}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>Developer</div>
              </div>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>API Key</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px' }}>
                  <code style={{ fontSize: '12px', fontFamily: 'Consolas, monospace', color: '#374151' }}>{maskKey(rawKey)}</code>
                  <button onClick={copyKey} style={{ background: 'none', border: 'none', cursor: 'pointer', color: keyCopied ? '#16a34a' : '#6b7280', display: 'flex', padding: 0, marginLeft: 8 }}>
                    {keyCopied
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                  </button>
                </div>
              </div>
              <div style={{ padding: '6px 8px' }}>
                <button onClick={handleLogout} disabled={loggingOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: 260, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search by API name" style={{ border: 'none', background: 'none', outline: 'none', fontSize: '12.5px', color: '#374151', width: '100%' }} />
            </div>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
            {/* Introduction */}
            <div style={{ marginBottom: 4 }}>
              <button
                onClick={() => setIntroOpen(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Introduction</span>
                </div>
                <span style={{ fontSize: '16px', color: '#9ca3af', fontWeight: 300 }}>{introOpen ? '−' : '+'}</span>
              </button>

              {introOpen && (
                <div style={{ paddingLeft: 8 }}>
                  {INTRO_ITEMS.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setView({ kind: 'intro', sectionId: item.id })}
                      style={{
                        width: '100%', display: 'block', textAlign: 'left', padding: '6px 10px',
                        background: isIntroActive(item.id) ? '#eff6ff' : 'none',
                        border: 'none', borderRadius: 5, cursor: 'pointer',
                        fontSize: '13px', color: isIntroActive(item.id) ? '#1d4ed8' : '#374151',
                        fontWeight: isIntroActive(item.id) ? 500 : 400, marginBottom: 1,
                      }}
                    >{item.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Environmental APIs */}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setEnvOpen(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Environmental APIs</span>
                </div>
                <span style={{ fontSize: '16px', color: '#9ca3af', fontWeight: 300 }}>{envOpen ? '−' : '+'}</span>
              </button>

              {envOpen && (
                <div style={{ paddingLeft: 8 }}>
                  {API_DEFINITIONS.map(api => {
                    const ms = METHOD_STYLE[api.method] ?? METHOD_STYLE.GET
                    const active = isApiActive(api.id)
                    return (
                      <button
                        key={api.id}
                        onClick={() => setView({ kind: 'api', apiId: api.id })}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', background: active ? '#eff6ff' : 'none',
                          border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 1,
                        }}
                      >
                        <span style={{ fontSize: '13px', color: active ? '#1d4ed8' : '#374151', fontWeight: active ? 500 : 400, textAlign: 'left' }}>{api.label}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: ms.color, background: ms.bg, padding: '1px 6px', borderRadius: 3, flexShrink: 0, marginLeft: 6 }}>{api.method}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <ApiContentArea view={view} apiKey={rawKey} />
      </div>

      <style>{`* { box-sizing: border-box; } body { margin: 0; } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
