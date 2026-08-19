'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INTRO_ITEMS } from '@/app/docs/(protected)/environmental/_data/introduction'
import { API_DEFINITIONS } from '@/app/docs/(protected)/environmental/_data/api-definitions'
import type { ActiveView } from '@/app/docs/(protected)/environmental/_data/types'
import type { IntroSectionId } from '@/app/docs/(protected)/environmental/_data/introduction'

// Legacy APIs (no explicit `group`): first 4 are Environmental, rest Flood & Hydrology.
// APIs with an explicit `group` (KYC/Banking/Asset/Employment/Digital subcategories) are grouped by that field.
const UNGROUPED = API_DEFINITIONS.filter(a => !a.group)
const ENV_API_IDS = new Set(UNGROUPED.slice(0, 4).map(a => a.id))

interface SidebarProps {
  view: ActiveView
  setView: (v: ActiveView) => void
}

interface ApiGroupProps {
  label: string
  apis: typeof API_DEFINITIONS
  open: boolean
  onToggle: () => void
  isApiActive: (id: string) => boolean
  setView: (v: ActiveView) => void
  searching: boolean
}

function ApiGroup({ label, apis, open, onToggle, isApiActive, setView, searching }: ApiGroupProps) {
  if (apis.length === 0) return null
  const expanded = searching ? true : open

  return (
    <div>
      <button
        onClick={() => { if (!searching) onToggle() }}
        className={cn(
          'group/hdr w-full flex items-center justify-between px-3 py-2 text-left rounded transition-colors duration-150',
          searching ? 'cursor-default' : 'cursor-pointer hover:bg-[--color-surface-2]'
        )}
        aria-expanded={expanded}
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[--color-text-primary] select-none">
          {label}
        </span>
        {expanded
          ? <ChevronDown size={12} className="text-[--color-text-xmuted] group-hover/hdr:text-[--color-text-body] flex-shrink-0 transition-colors duration-150" />
          : <ChevronRight size={12} className="text-[--color-text-xmuted] group-hover/hdr:text-[--color-text-body] flex-shrink-0 transition-colors duration-150" />}
      </button>

      {expanded && (
        <ul role="list" className="px-2 py-0.5">
          {apis.map(api => {
            const active = isApiActive(api.id)
            return (
              <li key={api.id}>
                <button
                  onClick={() => setView({ kind: 'api', apiId: api.id })}
                  aria-current={active ? 'page' : undefined}
                  title={api.label}
                  className={cn(
                    'w-full flex items-center pl-5 pr-2.5 py-[7px] my-0.5 text-left',
                    'border-l-2 transition-colors duration-150',
                    active
                      ? 'border-[--color-text-primary] bg-[--color-surface-2]'
                      : 'border-transparent hover:bg-[--color-surface-2]'
                  )}
                >
                  <span className={cn(
                    'text-sm leading-snug truncate',
                    active ? 'text-[--color-text-primary] font-medium' : 'text-[--color-text-body]'
                  )}>
                    {api.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Sidebar({ view, setView }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [introOpen, setIntroOpen] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const [floodOpen, setFloodOpen] = useState(false)
  const [kycRetailOpen, setKycRetailOpen] = useState(false)
  const [kycCommercialOpen, setKycCommercialOpen] = useState(false)
  const [employmentOpen, setEmploymentOpen] = useState(false)
  const [assetVehicleOpen, setAssetVehicleOpen] = useState(false)
  const [bankingOpen, setBankingOpen] = useState(false)
  const [digitalOpen, setDigitalOpen] = useState(false)

  const q = search.trim().toLowerCase()

  const filteredIntro = q
    ? INTRO_ITEMS.filter(item => item.label.toLowerCase().includes(q))
    : INTRO_ITEMS

  const filteredApis = q
    ? API_DEFINITIONS.filter(api =>
        api.label.toLowerCase().includes(q) ||
        api.shortDescription.toLowerCase().includes(q) ||
        api.path.toLowerCase().includes(q)
      )
    : API_DEFINITIONS

  const envApis            = filteredApis.filter(a => !a.group &&  ENV_API_IDS.has(a.id))
  const floodApis          = filteredApis.filter(a => !a.group && !ENV_API_IDS.has(a.id))
  const kycRetailApis      = filteredApis.filter(a => a.group === 'KYC Authentication - Retail')
  const kycCommercialApis  = filteredApis.filter(a => a.group === 'KYC Authentication - Commercial')
  const employmentApis     = filteredApis.filter(a => a.group === 'Employment & Income')
  const assetVehicleApis   = filteredApis.filter(a => a.group === 'Asset & Vehicle')
  const bankingApis        = filteredApis.filter(a => a.group === 'Banking & Payments')
  const digitalApis        = filteredApis.filter(a => a.group === 'Digital Essentials')

  const showIntroGroup         = filteredIntro.length > 0
  const showEnvGroup           = envApis.length > 0
  const showFloodGroup         = floodApis.length > 0
  const showKycRetailGroup     = kycRetailApis.length > 0
  const showKycCommercialGroup = kycCommercialApis.length > 0
  const showEmploymentGroup    = employmentApis.length > 0
  const showAssetVehicleGroup  = assetVehicleApis.length > 0
  const showBankingGroup       = bankingApis.length > 0
  const showDigitalGroup       = digitalApis.length > 0
  const hasResults =
    showIntroGroup || showEnvGroup || showFloodGroup ||
    showKycRetailGroup || showKycCommercialGroup || showEmploymentGroup ||
    showAssetVehicleGroup || showBankingGroup || showDigitalGroup

  function isIntroActive(id: string) {
    return view.kind === 'intro' && view.sectionId === id
  }
  function isApiActive(id: string) {
    return view.kind === 'api' && view.apiId === id
  }

  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col bg-[--color-surface] border-r border-[--color-border] overflow-hidden">

      {/* Search */}
      <div className="px-3 pt-3 pb-2.5 border-b border-[--color-border]">
        <div className="flex items-center gap-2 bg-[--color-surface-2] border border-[--color-border] rounded px-2.5 py-[7px] focus-within:border-[--color-accent] transition-colors duration-150">
          <Search size={12} className="text-[--color-text-xmuted] flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search APIs…"
            aria-label="Search APIs"
            className={cn(
              'flex-1 bg-transparent border-none outline-none min-w-0',
              'text-xs text-[--color-text-body] placeholder:text-[--color-text-xmuted]',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-[--color-text-xmuted] hover:text-[--color-text-muted] transition-colors duration-150 flex-shrink-0"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Nav tree */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Documentation navigation">

        {/* ── Introduction group ── */}
        {showIntroGroup && (
          <div className="mb-1">
            <button
              onClick={() => { if (!q) setIntroOpen(v => !v) }}
              className={cn(
                'group/hdr w-full flex items-center justify-between px-3 py-2 text-left rounded transition-colors duration-150',
                q ? 'cursor-default' : 'cursor-pointer hover:bg-[--color-surface-2]'
              )}
              aria-expanded={q ? showIntroGroup : introOpen}
            >
              <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[--color-text-primary] select-none">
                Introduction
              </span>
              {(q ? showIntroGroup : introOpen)
                ? <ChevronDown size={12} className="text-[--color-text-xmuted] group-hover/hdr:text-[--color-text-body] flex-shrink-0 transition-colors duration-150" />
                : <ChevronRight size={12} className="text-[--color-text-xmuted] group-hover/hdr:text-[--color-text-body] flex-shrink-0 transition-colors duration-150" />}
            </button>

            {(q ? showIntroGroup : introOpen) && (
              <ul role="list" className="px-2 py-0.5">
                {filteredIntro.map(item => {
                  const active = isIntroActive(item.id)
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setView({ kind: 'intro', sectionId: item.id as IntroSectionId })}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'w-full flex items-center pl-5 pr-2.5 py-[7px] my-0.5 text-left',
                          'border-l-2 transition-colors duration-150',
                          active
                            ? 'border-[--color-text-primary] bg-[--color-surface-2] text-[--color-text-primary] font-medium'
                            : 'border-transparent text-[--color-text-body] hover:bg-[--color-surface-2] hover:text-[--color-text-primary]'
                        )}
                      >
                        <span className="text-[13px] leading-snug">{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── Environmental group ── */}
        {showEnvGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Environmental"
              apis={envApis}
              open={envOpen}
              onToggle={() => setEnvOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── Flood & Hydrology group ── */}
        {showFloodGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Flood & Hydrology"
              apis={floodApis}
              open={floodOpen}
              onToggle={() => setFloodOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── KYC Authentication - Retail group ── */}
        {showKycRetailGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="KYC Authentication - Retail"
              apis={kycRetailApis}
              open={kycRetailOpen}
              onToggle={() => setKycRetailOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── KYC Authentication - Commercial group ── */}
        {showKycCommercialGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="KYC Authentication - Commercial"
              apis={kycCommercialApis}
              open={kycCommercialOpen}
              onToggle={() => setKycCommercialOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── Employment & Income group ── */}
        {showEmploymentGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Employment & Income"
              apis={employmentApis}
              open={employmentOpen}
              onToggle={() => setEmploymentOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── Asset & Vehicle group ── */}
        {showAssetVehicleGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Asset & Vehicle"
              apis={assetVehicleApis}
              open={assetVehicleOpen}
              onToggle={() => setAssetVehicleOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── Banking & Payments group ── */}
        {showBankingGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Banking & Payments"
              apis={bankingApis}
              open={bankingOpen}
              onToggle={() => setBankingOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* ── Digital Essentials group ── */}
        {showDigitalGroup && (
          <>
            <div className="mx-3 my-2 border-t border-[--color-border]" />
            <ApiGroup
              label="Digital Essentials"
              apis={digitalApis}
              open={digitalOpen}
              onToggle={() => setDigitalOpen(v => !v)}
              isApiActive={isApiActive}
              setView={setView}
              searching={!!q}
            />
          </>
        )}

        {/* Empty state */}
        {!hasResults && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[--color-text-muted]">No results for &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </nav>

      {/* Footer anchor — resolves the pane at the bottom instead of trailing off */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[--color-border] flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[--color-text-xmuted] select-none">
          Production
        </span>
        <span className="font-mono text-[10px] text-[--color-text-xmuted] select-none">
          v1
        </span>
      </div>
    </aside>
  )
}
