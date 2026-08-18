'use client'

import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  lang?: string
  showHeader?: boolean
  showCopy?: boolean   // floating copy button when the header is hidden
  className?: string
}

export function CodeBlock({ code, lang = 'json', showHeader = true, showCopy = false, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('@/lib/shiki').then(({ highlight }) =>
      highlight(code, lang).then(result => {
        if (!cancelled) setHtml(result)
      })
    ).catch(() => {})
    return () => { cancelled = true }
  }, [code, lang])

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('rounded-lg overflow-hidden shadow-[0_0_0_1px_var(--color-border)]', className)}>
      {showHeader && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-[--color-surface-2] shadow-[inset_0_-1px_0_var(--color-border)]">
          <span className="text-[10.5px] font-mono uppercase tracking-wider text-[--color-text-xmuted] select-none">
            {lang}
          </span>
          <button
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="flex items-center gap-1.5 text-[11px] text-[--color-text-muted] hover:text-[--color-text-body] transition-colors duration-150"
          >
            {copied
              ? <Check size={12} className="text-[--color-success]" />
              : <Copy size={12} />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      <div className="relative overflow-x-auto">
        {/* Floating copy button when there's no header bar to hold one */}
        {!showHeader && showCopy && (
          <button
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 ring-1 ring-inset ring-white/15 text-[11px] text-white/75 hover:text-white hover:bg-white/20 transition-colors duration-150"
          >
            {copied
              ? <Check size={12} className="text-[--color-success]" />
              : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
        {html
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : (
            <pre className="m-0 px-4 py-3.5 bg-[--color-code-bg] overflow-x-auto whitespace-pre">
              <code className="text-[12.5px] font-mono leading-relaxed text-[--color-text-body]">
                {code}
              </code>
            </pre>
          )}
      </div>
    </div>
  )
}
