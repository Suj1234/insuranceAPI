import { createHighlighter, type Highlighter } from 'shiki'

type Lang = 'json' | 'javascript' | 'typescript' | 'python' | 'bash' | 'http'

let highlighter: Highlighter | null = null

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  highlighter = await createHighlighter({
    themes: ['github-dark-dimmed'],
    langs: ['json', 'javascript', 'typescript', 'python', 'bash', 'http'],
  })
  return highlighter
}

/**
 * Always renders on a dark panel (single dark theme), regardless of page theme —
 * dark code panels on the light page are the "premium docs" signature (DESIGN.md).
 */
export async function highlight(code: string, lang = 'json'): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, {
    lang: lang as Lang,
    theme: 'github-dark-dimmed',
  })
}
