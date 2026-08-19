# Claude Code — Project Rules

This file is loaded automatically in every session. Follow these rules without being asked.

---

## What this project is

B2B API documentation portal. Users are backend engineers and actuaries. Read `PRODUCT.md` for full context. Read `DESIGN.md` for design tokens, component specs, and anti-patterns.

**Adding external (vendor) APIs:** the user uploads a vendor PDF into `External API/` and we build that API (Documentation + Tryout + proxy route) matching the **PAN Profile** implementation exactly. The full step-by-step process — every file to touch, field-by-field, plus the bugs to avoid — is in **`External API/CLAUDE.md`**. Read that playbook before onboarding any new API. Do NOT change the UI while doing so; the design is final, this is data + wiring only. Vendor is mostly **Karza/TKYC**; base URL is env-var driven (TEST by default, PDF shows PROD which is display-only).

---

## Stack

- **Next.js 14** App Router, TypeScript
- **Tailwind CSS** with `dark:` class strategy (next-themes drives the class)
- **next-themes** — theme toggle + localStorage persistence
- **shadcn/ui** — form controls (Select, Checkbox, Tabs, Collapsible, Calendar)
- **Shiki** — syntax highlighting, dual themes: `github-light` / `github-dark-dimmed`
- **JetBrains Mono** — all code/monospace
- **Inter** — all UI text
- **Neon (serverless)** + **Drizzle ORM** — database
- **jose** — JWT auth (custom, not NextAuth)

---

## Design rules — enforced every session

### Colours
- Use CSS custom property tokens (`--color-bg`, `--color-accent`, etc.) — never hardcode hex values in components
- One accent colour: blue (`--color-accent`). No purple, teal, or orange as decorative accent.
- No gradients anywhere. Not on navbar, not on sidebar, not on code block headers.
- See `DESIGN.md` for full token list and light/dark values.

### Shape
- `rounded-full` — FORBIDDEN on all UI elements except the avatar circle
- `rounded-xl`, `rounded-2xl`, `rounded-3xl` — FORBIDDEN
- Maximum border-radius on data elements: `rounded-sm` (2px) for badges, `rounded` (4px) for inputs/buttons
- Login card: `rounded-lg` (8px) is the only exception

### Elevation
- `shadow-md`, `shadow-lg`, `shadow-xl` — FORBIDDEN on panels, tables, code blocks, sidebar
- `shadow-sm` — permitted on dropdown menus only
- Structure is created by `border`, not `shadow`

### Motion
- `hover:scale-*` — FORBIDDEN
- `hover:translate-*` — FORBIDDEN
- `animate-pulse` — FORBIDDEN (use opacity fade for loading states)
- Stagger delays on list items — FORBIDDEN
- Spring animations on collapsibles — FORBIDDEN (use instant toggle)
- Permitted: `transition-colors duration-150` on theme toggle and tab underlines

### Active states
- Sidebar active item: `border-l-2 border-[--color-accent] bg-[--color-accent-tint]` — NOT a rounded pill
- Tabs: `border-b-2 border-[--color-accent] text-[--color-accent]` — NOT a filled background tab

### Layout
- Sidebar: 260px fixed, `bg-[--color-surface] border-r border-[--color-border]`
- Navbar: 52px, `bg-[--color-surface] border-b border-[--color-border]`
- Content area: takes remaining width, `bg-[--color-bg]`, scrollable

---

## Component generation rules

When generating or editing any UI component:

1. **Read DESIGN.md first** — check the component spec before writing any JSX
2. **Use tokens not hex** — `text-[--color-text-primary]` not `text-slate-900`
3. **Use shadcn** for: Select, Checkbox, Calendar, Tabs, Collapsible, Dialog, DropdownMenu
4. **Use Shiki** for all code blocks — no `<pre>` with hardcoded background colours
5. **Use `dark:` variants** on every element — test mental model in both modes before finishing

---

## AI-slop self-check — run before finishing any component

Before declaring a component done, check for these patterns and remove them:

- `rounded-full` on badges, pills, active states
- `shadow-md+` on any container
- `hover:scale-*` on buttons or cards
- Gradient backgrounds (`bg-gradient-*`)
- Stagger animation delays on lists
- `animate-pulse` on skeletons
- Decorative icon tiles before heading text
- `backdrop-blur` anywhere
- Tables wrapped in shadow cards instead of bordered containers
- Coloured or gradient heading text

---

## File structure — src/

```
src/
  app/
    docs/
      (protected)/
        environmental/
          page.tsx        ← main docs page (revamp target)
          _data/          ← API definitions, intro content
      login/
        page.tsx
      layout.tsx
    api/
      environmental/      ← backend API routes (do not touch during UI revamp)
      docs/auth/          ← login/logout routes (do not touch)
  lib/
    db/                   ← Drizzle schema + client
    shiki.ts              ← Shiki highlighter singleton (create this)
  styles/
    globals.css           ← CSS custom property tokens + base styles
```

---

## Audit checklist — run in both light and dark mode before any PR

**Accessibility**
- [ ] All interactive elements reachable by keyboard (Tab, Enter, Space, Escape)
- [ ] All custom dropdowns/selects have `role`, `aria-expanded`, `aria-haspopup`
- [ ] Colour contrast WCAG AA: body text 4.5:1, large text 3:1

**Visual**
- [ ] No hardcoded hex colours in JSX (use tokens)
- [ ] No AI-slop patterns (full list in DESIGN.md)
- [ ] Code blocks render correctly in both themes
- [ ] Active sidebar item has border-left, not pill background
- [ ] Theme toggle in navbar visible and functional

**Functional**
- [ ] Sidebar search actually filters API list
- [ ] Tryout panel state/district cascade works
- [ ] SEND button shows loading state, then response
- [ ] Copy buttons work in both code block and curl/snippet views
- [ ] Profile dropdown shows masked API key + logout
