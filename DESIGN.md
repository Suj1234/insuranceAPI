# Design System — Insuretech Data Platform

> Read `PRODUCT.md` first. Every decision here flows from who the user is and what they are doing.
> This file describes the **shipped** system (as built in `src/app/globals.css`, `src/app/layout.tsx`, and `src/app/docs/login/page.tsx`). Values here match the code — if you change a token, change it in both places.

---

## Direction

**Restrained enterprise, warm register.** The reference world is Mercury / Vercel / Stripe docs — the "cleanest developer docs" feel — but executed on a **warm, editorial** palette rather than cold gray. Premium comes from typographic discipline (a serif display + refined grotesk), a warm near-monochrome canvas, one restrained accent, and hairline borders instead of heavy shadows. Not a marketing site, not a dashboard. A reference tool that reads like a well-set document.

**Memorable thing:** *"the cleanest API docs I've used."* Every choice serves developer-experience calm, not decoration.

---

## Theme

**Default: light.** Dark mode via `next-themes` (`attribute="class"`, `defaultTheme="light"`, `enableSystem`). All colors are CSS custom properties on `:root` (light) and `.dark`. Never hardcode hex in components — use the tokens.

---

## Color Tokens

Warm paper + espresso ink + one ink-violet accent. Semantic colors (green/amber/red) are for **status only**, never decoration.

### Light mode
```css
--color-bg:            #faf9f7   /* warm paper — page background */
--color-surface:       #ffffff   /* cards, panels */
--color-surface-2:     #f3f1ec   /* recessed fills, table head, code header */
--color-surface-3:     #e8e4dc   /* deeper recess / active fill */
--color-border:        #ddd8cf   /* hairline borders (deepened for crisper structure) */
--color-border-strong: #cdc7ba   /* stronger dividers */
--color-text-primary:  #221e1a   /* espresso ink (NOT #000) — headings */
--color-text-body:     #47423b   /* body copy, labels */
--color-text-muted:    #6e685f   /* descriptions, placeholders (deepened for contrast) */
--color-text-xmuted:   #9a948a   /* footnotes, footer, secondary */
--color-accent:        #5b4bd6   /* ink-violet — links, focus, active */
--color-accent-hover:  #4d3fc0
--color-accent-tint:   #efeafe   /* focus ring outer, active bg */
--color-accent-border: #d6cdf7
--color-success:       #3f8f5b   /* 2xx / low risk */
--color-warning:       #b5871f   /* 4xx / moderate */
--color-error:         #c0392f   /* 5xx / required / high */
--color-error-bg:      #f8e9e6
--color-error-border:  #eec2ba
--color-code-bg:       #1c1a17   /* dark code panels on the light page */
```

### Dark mode (`.dark`)
```css
--color-bg:            #161310
--color-surface:       #1e1a16
--color-surface-2:     #262119
--color-surface-3:     #312a20
--color-border:        #332d24
--color-border-strong: #443c30
--color-text-primary:  #f2ede4
--color-text-body:     #cbc3b6
--color-text-muted:    #948b7e
--color-text-xmuted:   #655d51
--color-accent:        #9184ff
--color-accent-hover:  #a79bff
--color-accent-tint:   #221d3a
--color-accent-border: #3b3470
--color-success:       #5cc17e
--color-warning:       #dcae4a
--color-error:         #e87a6f
--color-error-bg:      #2c1613
--color-error-border:  #4d211c
--color-code-bg:       #100e0b
```

### Color rules
- **One accent.** Ink-violet (`--color-accent`). No blue, teal, orange, or a second decorative accent.
- **Warm neutrals only.** All grays are warm (stone/espresso family). Never mix in a cool gray.
- **No AI purple/blue gradient.** No gradient backgrounds anywhere.
- **Semantic = status only.** Green/amber/red appear on status, validation, and the risk ramp — never as decoration.
- **Text is espresso `#26221e`, not `#000`.** Pure black reads cheap; the warm off-black is deliberate.

---

## Typography

Loaded via `next/font/google` in `src/app/layout.tsx` (self-hosted, no CDN, CSP-safe).

```
--font-serif : Fraunces        (weights 400/500/600) — display / page & card titles
--font-sans  : Hanken Grotesk  (weights 400/500/600) — all UI text (free Söhne alternative)
--font-mono  : JetBrains Mono                         — code, URLs, all numerals
```

### Rules
- **Titles use the serif (Fraunces).** Page titles, card headings, the hero risk number. This is the "expensive" voice — use it with restraint, not on body text.
- **UI uses Hanken Grotesk** at weight **400 by default.** Body is 400, labels/buttons 500, section titles 500–600. **Never `font-weight: 700+`** — emphasis comes from color + size + serif, not heavy weight. (The old global `font-weight: 500` was a premium-killer; body is now 400.)
- **Numerals are mono + tabular.** All data/numbers use JetBrains Mono with `font-variant-numeric: tabular-nums`.
- **Negative tracking on display type** (`letter-spacing: -0.01em` on the serif titles). Small uppercase labels get *positive* tracking (`0.06em`).
- **`text-wrap: balance`** on multi-line headings to avoid ragged breaks.

### Type scale (shipped)
```
11px  — footer, uppercase micro-labels (tracked +0.06em)
12.5–13px — form labels, table body, sidebar items
14px  — body, inputs
15px  — sub-section titles / logo wordmark
18px  — section titles
24–29px — page / card titles (serif)
32–40px — API page hero title (serif, tight tracking)
```

---

## Shape (border-radius)

Warmer/softer than the old spec, but still restrained.
```
4–5px  — chips, badges, method labels
8–9px  — inputs, buttons
9px    — code sub-panels
12–14px — panels, cards, code blocks
16px   — the login card (largest)
```
- `rounded-full` — **only** on the avatar circle and status dots. Nothing else.
- No single uniform bubbly radius on everything — containers softer, inner elements tighter.

---

## Elevation & borders

**Border-first.** Structure comes from hairline borders, not heavy shadows.
- Borders use the `box-shadow: 0 0 0 1px var(--color-border)` technique (crisp 1px line) or a real 1px border. Both fine.
- **Shadows are warm-tinted and soft**, never generic black. The premium card shadow:
  ```css
  box-shadow:
    0 0 0 1px var(--color-border),
    inset 0 1px 0 rgba(255,255,255,0.6),        /* inner edge highlight */
    0 12px 40px -8px rgba(74,58,42,0.16),        /* warm-tinted ambient */
    0 4px 12px -4px rgba(74,58,42,0.1);
  ```
- No `shadow-md`+ on panels, tables, sidebar, code blocks. The one place elevation is allowed: floating surfaces (login card, dropdown menus).

---

## Motion

Default: **minimal.** Permitted: `transition: box-shadow/opacity/color 0.15s` on interactive elements; button press `transform: translateY(1px)` on `:active` (GPU-friendly). Always wrap motion in a `@media (prefers-reduced-motion: reduce)` guard that removes transitions.

**Forbidden:** `hover:scale`, stagger delays, `animate-pulse` skeletons (use opacity fade), spring on collapsibles, scroll/page-transition animations, animating layout props (`width`/`top`/`left` — use `transform`/`opacity`).

---

## Focus & accessibility (non-negotiable)

- Every input focus: `box-shadow: 0 0 0 1px var(--color-accent), 0 0 0 4px var(--color-accent-tint)` (ring, never `outline: none` alone).
- Touch targets ≥ 44px (inputs padded to ~45px; icon buttons get a 40px+ hit area even with a 16px icon).
- Visible labels above inputs (never placeholder-as-label).
- Error state: inline, tinted box (`--color-error-bg` / `--color-error-border`), `role="alert"` — never `window.alert()`.
- Semantic elements: `<form>`, `<footer>`, `<main>`, `<nav>`.

---

## Component patterns

### Login page (`src/app/docs/login/page.tsx`) — reference implementation
- **Centered card**, `max-width: 460px`, `border-radius: 16px`, warm-tinted premium shadow, on a warm-paper page with a faint contour-grid backdrop (masked radial, `opacity: 0.5`).
- Card **dead-centered** in the viewport (flex `align-items/justify-content: center`, `min-height: 100dvh`).
- **Footer** pinned to the bottom (`position: absolute; bottom: 0`), out of the centering flow — 11px uppercase tracked, `--color-text-xmuted`: `© {year} Perfios Software Solutions Private Limited`.
- Serif `<h1>` (29px), text wordmark logo (`Insuretech / API Platform`), Email + Password fields, ink-black primary button (`--color-text-primary` bg; violet in dark), password show/hide with a 40px hit area.
- No tagline, no keyhint, no trust badges (removed — kept lean).

### Buttons (primary)
- `background: var(--color-text-primary)` (ink), `color: var(--color-bg)`, `border-radius: 9px`, weight 500, ~13.5px, slight `letter-spacing: 0.01em`. Dark mode flips to `--color-accent` on white.
- Hover: `opacity: 0.9`. Active: `translateY(1px)`. No glow, no scale, no slab-heavy padding.

### Inputs
- `padding: 12px 13px` (≥44px tall), `border-radius: 9px`, border via `box-shadow: 0 0 0 1px var(--color-border-strong)`, focus ring as above.

### Code blocks (docs surfaces)
- **Always dark panels** (`github-dark-dimmed`, single theme) on both light and dark pages — dark code on a light page is the premium docs signature. Shiki forced to the dark theme only (`src/lib/shiki.ts`); `.shiki` background pinned to `#1c1a17`.
- Wrapper `rounded-lg`/`rounded-xl`, hairline via `box-shadow: 0 0 0 1px`, header bar `#252119` (dark) with a method chip + path + language switcher + copy. Strings green `#8fdca8`, no gradient header.

### Params / schema tables (`params-table.tsx`, `schema-table.tsx`)
- **Refined table**, NOT a heavy grid. `table-fixed` with `<colgroup>` so columns never go ragged: Attribute 26% · Location 12% · Description (flex) · Required 10%.
- **Attribute + type stacked** in the first cell (name in mono/primary, type in mono/xmuted below) — tidy left rail.
- Quiet uppercase header (`10.5px`, `tracking-[0.06em]`, `--color-text-xmuted`), 16px row padding, **hairline row dividers only** — no vertical borders, no zebra.
- Location badge tinted to tokens (amber `header`, violet `query`/`path`/`body`). Required = tinted error pill; else muted "Optional". Example values in a `--color-surface-2` code chip.
- Schema table: same style, with the **dotted-path treatment** (ancestors `--color-text-xmuted`, leaf `--color-text-primary`).

### Tryout — request form + Data Preview
- **Full-width**, responsive form grid (`grid-cols-1 md:2 xl:3`). Labels above: name + mono type + tinted `required` pill.
- **Two-option enums (Y/N, Yes/No, true/false) → segmented pill**, NOT a toggle and NOT a select. `[ Yes | No ]`, active segment filled ink (violet in dark), `role="radiogroup"`. (NN/g: toggles are wrong inside a submit-form; a segment shows both labels.)
- **Send** = ink-black button (matches login). **Data Preview** = full-width 2-col table, humanized labels left (`humanizeKey`: `firstName` → "First Name"), mono values right, zebra rows, `—` for empty.

### Doc tab layout
- **Single column, full width.** Request + Response schema tables stacked (roomy), then **two dark code cards side-by-side below** (Example request with language switcher · Example response). NOT prose-left/code-right — the wide flat param lists read better full-width with code beneath. (Considered the side-by-side split; the table was too cramped beside a 440px code card.)

### Footer (all pages)
- Centered, 11px, `font-medium`, `uppercase`, `tracking-[0.06em]`, `--color-text-xmuted`: `© {year} Perfios Software Solutions Private Limited`. Login: pinned bottom. Docs: after content with a top border.

---

## Layout (docs shell — BUILT)

- **Navbar** ~52px: ink logo mark + `Insuretech / API Platform` wordmark (no "Documentation" tab), theme toggle, profile. Hairline bottom border.
- **Left nav** ~288px, `--color-surface`, hairline right border. Group labels 11px uppercase `--color-text-xmuted`. Nav items `rounded-md`, **no per-row borders** (removed — they made the tree look like a table), method badges soft-tinted. Active item: `bg --color-accent-tint` + `text --color-accent`, `rounded-md` (not a hard pill, no left-border rule).
- **Content**: flattened API header on warm paper — serif title (Fraunces 32px), one-line description (`truncate`), single bordered URL chip (method badge + mono URL + copy; NOT wrapped in a bigger card), underline tabs (About / Documentation / Tryout). No eyebrow/category label above the title.

---

## Anti-slop checklist — run before any PR

- [ ] No `rounded-full` except avatar / status dots
- [ ] No `shadow-md`+ on panels/tables/sidebar/code (border-first; only floating surfaces get soft warm shadow)
- [ ] No gradients, no AI purple/blue gradient
- [ ] No `hover:scale` / `hover:translate` (except button `:active` press)
- [ ] No `animate-pulse`, no stagger delays
- [ ] No cold gray mixed into the warm palette
- [ ] No `font-weight: 700+`; body is 400
- [ ] No pure `#000` / pure-white-only surfaces
- [ ] No placeholder-as-label; visible labels present
- [ ] Focus ring present on every interactive element
- [ ] `prefers-reduced-motion` guard on any transition
- [ ] Real fonts loaded (Fraunces/Hanken/JetBrains), not system-ui fallback
- [ ] No leftover shadcn oklch token block / `--radius > 4px` bleeding through in `globals.css`

---

## Status

**Built & migrated to this system:** login page, docs navbar, left nav/sidebar, API header, Documentation tab (params/schema tables, dark code cards), Tryout tab (form + segmented controls + Data Preview), footer, dark code panels (Shiki dark-only), deepened warm tokens.

## Known debt

- **`globals.css` still contains a second shadcn default-token block** (oklch grays, `--radius: 0.625rem`, purple dark sidebar) below the real tokens. It fights this system and should be removed. Not yet done because other components may reference those shadcn vars — remove and test.
- **Tryout does not use the risk-verdict gauge.** An earlier direction proposed a composite-risk gauge + sparklines for the response. It was dropped in favor of matching the production TotalKYC layout (clean full-width Data Preview table). If a richer risk view is wanted later, it would live in the Tryout response, not the docs.
- **About tab** not yet audited against this system.
