'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/docs/navbar'
import { Sidebar } from '@/components/docs/sidebar'
import { MethodBadge } from '@/components/docs/method-badge'
import { DocTab } from '@/components/docs/doc-tab'
import { TryoutTab } from '@/components/docs/tryout-tab'
import { AboutTab } from '@/components/docs/about-tab'
import { IntroPage } from '@/components/docs/intro-content'
import { API_DEFINITIONS } from './_data/api-definitions'
import { BASE_URL } from './_data/introduction'
import type { ActiveView } from './_data/types'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EnvironmentalDocsPage() {
  const [view, setView] = useState<ActiveView>({ kind: 'intro', sectionId: 'abstract' })
  const [docTab, setDocTab] = useState<'Documentation' | 'Tryout' | 'About'>('Documentation')
  const [apiKey, setApiKey] = useState('')
  const [userName, setUserName] = useState('Developer')
  const [urlCopied, setUrlCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Read credentials injected by the server layout into a hidden DOM element
  useEffect(() => {
    const el = document.getElementById('__docs_env') as HTMLDivElement | null
    if (el) {
      setApiKey(el.dataset.apiKey ?? '')
      setUserName(el.dataset.userName ?? 'Developer')
    }
  }, [])

  // Deep-link: ?api=<id> opens straight to that API (shareable/bookmarkable).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('api')
    if (id && API_DEFINITIONS.some(a => a.id === id)) {
      setView({ kind: 'api', apiId: id })
      setDocTab('Documentation')
    }
  }, [])

  function handleSetView(v: ActiveView) {
    setView(v)
    // Reflect selection in the URL so any API is shareable/bookmarkable.
    const url = new URL(window.location.href)
    if (v.kind === 'api') url.searchParams.set('api', v.apiId)
    else url.searchParams.delete('api')
    window.history.replaceState(null, '', url)
    if (v.kind === 'api') {
      setDocTab('Documentation')
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 0)
    } else {
      setTimeout(() => {
        document.getElementById(v.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  const activeApi = view.kind === 'api'
    ? (API_DEFINITIONS.find(a => a.id === view.apiId) ?? API_DEFINITIONS[0])
    : null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[--color-bg]">

      <Navbar userName={userName} apiKey={apiKey} />

      <div className="flex flex-1 overflow-hidden">

        <Sidebar view={view} setView={handleSetView} />

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[--color-bg]">

          {view.kind === 'intro' ? (
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <IntroPage />
            </div>
          ) : activeApi ? (
            <>
              {/* Tab content — header is a card inside the scroll column so it
                  matches the Request/Response cards below (same surface, radius,
                  hairline, gutter). Top and bottom now read as one system. */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col">
                <div className="flex-1">

                  {/* API header card */}
                  <div className="px-8 pt-6">
                    <div className="bg-[--color-surface] rounded-xl overflow-hidden shadow-[0_0_0_1px_var(--color-border)]">
                      <div className="px-6 pt-6 pb-0">
                        {/* Serif title */}
                        <h1 className="font-[family-name:var(--font-serif)] text-[28px] font-semibold text-[--color-text-primary] tracking-tight leading-tight mb-2">
                          {activeApi.label}
                        </h1>

                        {/* Short description — single line, truncates if too long */}
                        <p className="text-[15px] text-[--color-text-muted] leading-relaxed mb-4 truncate">
                          {activeApi.shortDescription}
                        </p>

                        {/* Method + URL chip — quiet inset field */}
                        <div className="flex items-center gap-3 mb-5 bg-[--color-surface-2] rounded-lg px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-border)] max-w-[720px]">
                          <MethodBadge method={activeApi.method} />
                          <code className="flex-1 text-[12.5px] font-mono text-[--color-text-body] break-all">
                            {BASE_URL}{activeApi.path}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyUrl(`${BASE_URL}${activeApi.path}`)}
                            aria-label="Copy URL"
                            title="Copy URL"
                            className="flex-shrink-0 text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors duration-150"
                          >
                            {urlCopied
                              ? <Check size={14} className="text-[--color-success]" />
                              : <Copy size={14} />}
                          </button>
                        </div>

                        {/* Tab bar — ink underline active (not cold indigo) */}
                        <div className="flex gap-7 shadow-[inset_0_-1px_0_var(--color-border)]">
                          {(activeApi.about
                            ? ['About', 'Documentation', 'Tryout'] as const
                            : ['Documentation', 'Tryout'] as const
                          ).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDocTab(t)}
                              className={cn(
                                'text-sm py-3 -mb-px cursor-pointer transition-colors duration-150 border-b-2 tracking-tight',
                                docTab === t
                                  ? 'font-semibold text-[--color-text-primary] border-[--color-text-primary]'
                                  : 'font-medium text-[--color-text-body] border-transparent hover:text-[--color-text-primary]'
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {docTab === 'Documentation' && <DocTab api={activeApi} />}
                  {docTab === 'Tryout'        && <TryoutTab key={activeApi.id} api={activeApi} apiKey={apiKey} />}
                  {docTab === 'About' && activeApi.about && <AboutTab blocks={activeApi.about.blocks} source={activeApi.about.source} />}
                </div>
                <footer className="mt-8 px-8 py-5 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-[--color-text-xmuted] border-t border-[--color-border]">
                  © 2026 Perfios Software Solutions Private Limited
                </footer>
              </div>
            </>
          ) : null}

        </main>
      </div>
    </div>
  )
}
