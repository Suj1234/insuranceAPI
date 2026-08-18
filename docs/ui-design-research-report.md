# UI Design Research & System Proposal — Insuretech Data Platform

> **Status:** Research + proposal only. **No code changed.** Read, discuss, decide — then we build.
> **Brief given:** Rebuild the API docs portal UI from scratch. Must look **premium / expensive**, not cheap. Direction chosen: **Restrained enterprise (Stripe-like)**. Priority: **shell + per-API detail page, equal depth.** Old DESIGN.md is reference only — research leads, deviations flagged.

---

## Part 0 — What the product actually is (the objective, unbiased)

Stripped of the current UI, here is what the design system has to serve:

- **Audience:** backend engineers + actuaries. They arrive with a task (read a param, test an endpoint, copy a snippet). They do **not** browse and are **not** being marketed to.
- **Structure:** a left **nav tree** (Introduction group + 3 API groups: Environmental, Flood & Hydrology, Verification/KYC), a **navbar** (logo, "Documentation", theme toggle, profile with masked API key), and a **content area** that is either an intro page or a **per-API page**.
- **Each API page carries:** title, method + full URL (copyable), short description, and **3 tabs** — About / Documentation / Tryout.
  - **Documentation:** params table, response-schema table, code examples (cURL / JS / Python).
  - **Tryout:** a request **form** (text, enum `<select>`, state→district cascading search-select, month picker, pollutant checkboxes, pincode-or-lat/lon mode switch) → **Send** → a **response** block with 3 sub-tabs: Data Preview (flattened key/value table), Body (JSON), Headers.
- **Data is dense and nested** (e.g. `data.air_quality.pm25.trend_direction`). The design must make deep, typed, nullable data legible — this is the whole product.

**Design implication:** this is a **reference tool, not a website.** Premium here = *density done with precision and air*, like a financial terminal or Stripe's API reference — not decoration.

---

## Part 1 — Market research: how the best portals do it

### The 2026 landscape (who to study)

| Portal | Why it's the reference | What to take |
|---|---|---|
| **stripe.com/docs/api** | The gold standard for dense-but-calm reference. Near-monochrome, one accent, zero shadows, depth from background-tint shifts. | Type restraint, spacing rhythm, the 2-column "prose left / code right" reference layout. |
| **Scalar** (scalar.dev) | Cleanest modern OpenAPI renderer, MIT-licensed. Best *default* look of any OSS tool in 2026. | Try-it panel structure, request/response layout, method-color language. |
| **Mintlify** | What Anthropic / Cursor / Perplexity ship. "Stripe-level docs quality" as a product. | Navigation IA, search, content hierarchy. |
| **Redoc / Stoplight Elements** | Battle-tested 3-panel reference renderers. | Param/schema table conventions, nested-object disclosure. |

**Key 2026 shift:** *beautiful UI is now table stakes.* Differentiators are **information density that stays calm**, **speed**, and **machine-readability**. Decoration actively signals "cheap" to this audience.

### What "premium / expensive" concretely means (from the Stripe token teardown)

The research on Stripe's system is unambiguous about where premium comes from:

- **Confident restraint in type:** a single family, used at *light* weights (300–400) even at large sizes; letter-spacing *tightens* as size grows. No bold shouting.
- **Near-monochrome canvas:** cool white → subtle tint steps (`#ffffff → #f8fafd → #e5edf5`), deep navy text (`#061b31`), **one** vivid accent that earns every use.
- **No shadows.** Depth = background-tint shifts, not elevation. (Stripe *has* shadow tokens but uses them almost nowhere in the reference.)
- **Purposeful whitespace** on a strict 4px scale (4/8/12/16/20/24/32). Every gap is deliberate.
- **Few radii, small.** 4px inputs, 8px cards.

This maps **exactly** onto the direction you chose. Our current DESIGN.md already knew most of this — the failure was in **execution**, which Part 3 diagnoses.

**Sources:** [Stripe design tokens teardown](https://designmd.cc/benchmarks/stripe) · [Stripe design system breakdown](https://www.designsystems.one/design-systems/stripe-design) · [API portals 2026 (Mintlify)](https://www.mintlify.com/library/api-developer-portals-for-enterprise) · [Scalar vs Redoc vs RapiDoc 2026](https://www.pistack.xyz/posts/2026-05-01-self-hosted-api-documentation-scalar-redoc-rapiddoc-openapi-guide/) · [Best API doc tools 2026](https://www.digitalapi.ai/blogs/best-api-documentation-tools-and-platform) · [Monospace/coding fonts 2026](https://madegooddesigns.com/best-monospace-fonts-2026/)

---

## Part 2 — Why the current UI looks cheap (diagnosis, from the real code)

Not guesses — these are in the files:

1. **Two fighting token systems in one CSS file.** `src/app/globals.css` has the good hand-authored tokens (lines 8–47) **and then** a full shadcn default set (lines 97–178): generic oklch grays, `--radius: 0.625rem` (**10px**), a **purple** `--sidebar-primary` in dark, and a global `* { border-color: var(--border) }`. This second system silently overrides shape and color everywhere → the "generic shadcn default" look. **This alone explains a lot of the cheapness.**
2. **Card-in-card nesting.** The API header wraps a `--surface` card inside a `--surface-2` main, inside a bordered header, with the URL bar as a *third* nested box. Boxes inside boxes inside boxes reads as busy, not premium.
3. **Weight everywhere = no hierarchy.** `body { font-weight: 500 }` globally, plus `font-semibold`/`font-bold` on titles, tabs, badges. When everything is heavy, nothing is emphasized. Stripe's premium comes from *light* defaults with rare weight.
4. **Radius drift.** Spec says max `rounded` (4px), but the shadcn layer injects 10px, profile uses `rounded-full` avatar (fine) but also `rounded-md` menu + the leaked radius → inconsistent corners.
5. **Ad-hoc sizes.** `text-[15px]`, `py-[7px]`, `text-[12.5px]`, `text-[11px]` scattered around — no enforced scale, so vertical rhythm never locks in. Premium UIs feel like a grid; this feels hand-nudged.
6. **The response Data Preview** flattens to a 2-column mono table with 45%/55% split and `/40` alpha row striping — functional but visually noisy, no typed treatment.

**Conclusion:** the concept was right; the system was never *enforced* and a second design system was left bleeding through. The rebuild is mostly **subtraction + enforcement**, not reinvention.

---

## Part 3 — Proposed design system

Values are concrete so we can argue about numbers, not adjectives. Where I deviate from old DESIGN.md, it's flagged **[CHANGE]**.

### 3.1 Foundations

**Grid & density**
- Base unit **4px**. Spacing scale (only these): `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- **[CHANGE]** Kill all arbitrary spacings (`py-[7px]`, `mt-[22px]`). If a step feels wrong, fix the layout, not the number.

**Border radius** (fewer, smaller)
- `2px` — badges, method chips, inline code
- `4px` — inputs, buttons, tables, code blocks (**default for everything structural**)
- `8px` — the login card only
- **[CHANGE / CRITICAL]** Delete the leaked shadcn `--radius: 0.625rem`. `rounded-full` allowed **only** on the avatar. Nothing else round.

**Elevation**
- **No shadows** on panels/tables/cards/sidebar/code. One `shadow-sm` permitted on the profile dropdown only (it floats over content — the single legitimate case).
- Structure = **borders + background-tint steps**, never elevation.

### 3.2 Color

Keep the existing token *architecture* (it's good), refine values toward the Stripe register. Presented as tokens — **never hardcode hex in components.**

**Light**
```
--bg              #f7f8fa   /* was #f8fafc — a hair cooler/calmer canvas */
--surface         #ffffff
--surface-2       #f1f4f8   /* input bg, table header, code header */
--surface-3       #e7ecf3   /* [NEW] active tint step / deeper fill, replaces shadow */
--border          #e4e8ee
--border-strong   #cbd3de
--text-primary    #0b1b2b   /* deep navy, not pure black — Stripe register */
--text-body       #33445a
--text-muted      #64748b
--text-xmuted     #94a3b8
--accent          #2563eb   /* one blue. keep. */
--accent-hover    #1d4ed8
--accent-tint     #eef4ff   /* active nav bg */
--accent-border   #bfd3f5
--success         #15803d   /* 2xx */
--warning         #b45309   /* 4xx */
--error           #b91c1c   /* 5xx, required */
```

**Dark** (true dark, not the washed shadcn oklch grays)
```
--bg              #0b1220
--surface         #121a2b
--surface-2       #1b2436
--surface-3       #232f45
--border          #2a3549
--border-strong   #3a4864
--text-primary    #eef2f8
--text-body       #c3cedd
--text-muted      #8a99ae
--text-xmuted     #5f6d82
--accent          #4c8dff
--accent-hover    #6ba0ff
--accent-tint     #16233c
--accent-border   #2f4a78
--success         #35c268
--warning         #e0a13a
--error           #ef6b6b
```

**Rules**
- **One accent.** Blue only. No purple/teal/orange decoration. (Delete the purple `--sidebar-primary` from the shadcn layer.)
- Semantic colors (green/amber/red) **only** for status/validation, never decorative.
- **Typed values get one muted color** in tables — not a rainbow. (See 3.5.)
- No gradients. No colored headings. No colored group labels.

### 3.3 Typography

**Families**
- **UI:** Inter (already installed) — safe, correct. **[Option to discuss]** upgrade to **Geist** for a slightly more "engineered/expensive" register at zero licensing cost. Söhne (Stripe's actual face) is paid — not recommended unless budget exists.
- **Mono:** JetBrains Mono (installed) is the right free default. Berkeley Mono / MonoLisa are the paid "premium" upgrades — nice-to-have, not needed.

**Type scale** — **[CHANGE]** fewer, cleaner steps; kill the `[15px]`/`[12.5px]` one-offs:
```
12px / 1.5   — badges, table sub-labels, timestamps      (xs)
13px / 1.5   — table body, sidebar items, form labels     (sm)
14px / 1.6   — body copy, descriptions, code              (base)
16px / 1.5   — sub-section titles                          (lg)
18px / 1.4   — section titles (Documentation, Request)     (xl)
24px / 1.25  — API page title (District Risk)              (2xl)
```

**Weight — the premium lever. [CHANGE — most important type fix]**
- **[CHANGE]** Drop the global `body { font-weight: 500 }`. Body defaults to **400**.
- Section/page titles: **500–600 max.** Never 700/800.
- Labels: 500. Code: 400 always.
- Emphasis comes from **color + size + space**, not weight. This single change moves the whole UI from "cheap heavy" to "premium calm."
- Letter-spacing: `-0.01em` on titles ≥18px; normal elsewhere.

### 3.4 The shell (navbar + sidebar)

**Navbar — 52px**, `--surface`, 1px bottom border.
- Logo: keep the small accent-square mark + wordmark, but wordmark at **weight 500**, product name muted. No gradient text.
- **[CHANGE]** Drop the standalone "Documentation" filled pill — it's the only section, so a filled tab is noise. If kept, make it a plain underline-active tab, not a filled box.
- Right: theme toggle (icon only) + profile.
- Profile: 30px avatar (the one `rounded-full`), name at 13/500, role muted. Dropdown = the one place `shadow-sm` is allowed.

**Sidebar — 260px fixed**, `--surface`, 1px right border.
- Search on top (functional, `--surface-2` fill, 4px radius).
- Group headers: `12px / 600 / uppercase / tracking-wide / --text-muted`. Collapsible with a small chevron. **Not blue.**
- Nav items: `13px / --text-body`, hover `--surface-2`.
- **Active item:** `bg --accent-tint` + `text --accent` (weight 500) + `border-l-2 --accent`. **Never a pill.** ✅ (current code already does this — keep it.)
- Method badge on the right of each item: `10px mono, flat 2px-radius rectangle`, method-colored (GET green, POST blue…). No pill.
- **[CHANGE]** Drop the `border-b` between every nav item — it makes the tree look like a table. Use spacing + the active border-left for separation instead.

### 3.5 The per-API page (the core surface)

**[CHANGE — biggest structural fix] Flatten the header.** Remove the card-in-card. The page header sits directly on `--bg`:

```
District Risk                                    ← 24px / 600 / --text-primary
[GET]  https://…/api/environmental/district  [copy]   ← method chip + mono URL + copy, one 1px-bordered bar, --surface-2 fill
Air quality, disasters, heat stress & composite risk  ← 14px / --text-muted, no box

── About ─── Documentation ─── Tryout ──        ← underline tabs, active = --accent + border-b-2
```
No wrapping card around the title. The URL bar is the *only* boxed element in the header. This removes two nested boxes and instantly reads calmer.

**Documentation tab**
- **Params table:** direct `border + 4px radius` wrapper (no shadow card). Header row `--surface-2`, `12px/600/uppercase/--text-muted`. Body rows: **no zebra stripe** — 1px row dividers only (zebra + borders is the noisy combo now). Field name in **mono, --text-primary** (not accent — accent-everywhere dilutes it). Type + `in`(query/path/header) as **flat 2px chips**, one muted style each, colored only by `in`.
- **Response schema:** same table style. For nested paths (`data.air_quality.pm25.mean_5yr`), render the dotted path in mono with the leaf segment at `--text-primary` and the ancestor path at `--text-muted` — makes depth scannable without a tree widget.
- **Code examples:** Shiki, dual theme (`github-light` / `github-dark-dimmed`), `border + 4px radius`, header bar `--surface-2` with language label (mono, muted) + copy (text button, color-change feedback only). **No gradient header, no glow.** cURL / JS / Python as underline sub-tabs.

**Tryout tab**
- **Request** section: bordered panel, header `Request` at 18/600 with a left accent rule when open. Form on a **2-column grid, 16px gaps**.
- Inputs: `--surface` fill, 1px border, 4px radius, focus = `border --accent` (no ring glow). Labels above, 13/500. `Required` as a small flat error-tinted chip; type as muted `(string)` — ✅ current pattern is fine, just normalize sizes.
- Cascading state→district: keep the searchable-select. Month picker: two selects. Pollutants: checkboxes with `accent-[--color-accent]`. Pincode/Lat-Lon: underline mode-switch. ✅ all fine.
- **Send:** solid `--accent`, white, 13/600, 4px radius. No shadow, no scale, no glow. Loading = inline spinner, no size change.
- **Response** section: bordered panel; header shows `Status: 200` (green/red) `· 142ms` on the right. Sub-tabs: **Data Preview / Body / Headers.**
  - **[CHANGE] Data Preview:** replace the 45/55 mono zebra table with a clean key/value list — key in `mono 13 --text-muted`, value in `mono 13 --text-primary`, right-aligned type hint chip when the value is null/number/bool. 1px dividers, no alpha-stripe. This is where "premium data" is won or lost.
  - **Body:** Shiki JSON.
  - **Headers:** Shiki HTTP.
- **Empty state:** plain one-line muted text ("Click Send to execute…"). No illustration, no big heading. ✅ current is correct.

### 3.6 Motion

Default: **none.** Permitted only: `transition-colors 150ms` on theme toggle, tab underline, hover states; `opacity` fade for dropdown + loading. **Forbidden:** `hover:scale/translate`, `animate-pulse`, stagger delays, spring on collapsibles, page/scroll animations. (Old rules were right — keep.)

### 3.7 Anti-slop checklist (run before any PR)

`rounded-full` (except avatar) · `shadow-md+` on any panel · gradients anywhere · `hover:scale/translate` · `animate-pulse` · stagger delays · icon tiles before headings · `backdrop-blur` · colored/gradient heading text · tables in shadow cards · pill active-state without border-left · >1 decorative accent · gradient code headers · illustrated empty states · **any leaked shadcn oklch token or `--radius > 4px`.**

---

## Part 4 — GitHub repos / libraries to use

Split into **keep** (already installed, correct), **add** (worth pulling), and **avoid**.

### Keep — already in the stack, all correct choices
| Lib | Role | Verdict |
|---|---|---|
| **Next.js 14 (App Router)** | framework | keep |
| **Tailwind CSS** | styling | keep — but drive it from *our* tokens, not shadcn's |
| **next-themes** | light/dark toggle | keep |
| **Shiki** | syntax highlighting (dual theme) | keep — the premium code-block choice |
| **shadcn/ui** | Select, Checkbox, Tabs, Collapsible, etc. | keep the *primitives* — but **rip out the default `globals.css` token block** (Part 2, #1). Use shadcn as unstyled Radix wrappers, themed by our tokens. |
| **lucide-react** | icons | keep — consistent, thin, non-decorative |
| **JetBrains Mono + Inter** | fonts | keep (Geist = optional upgrade) |

### Add — only if they earn their place (ponytail: don't add what a few lines do)
| Lib | Why | Priority |
|---|---|---|
| **Radix UI primitives** (`@radix-ui/react-*`) | shadcn already sits on these; use directly for the searchable-select / dropdown a11y (`role`, `aria-expanded`, focus trap) instead of hand-rolling. | **Recommended** — a11y is a trust boundary, don't hand-roll it. |
| **cmdk** | if we want a ⌘K command-palette search over the API tree (very "premium developer tool" signal). | Optional / nice-to-have |
| **Geist font** (`geist` npm) | drop-in premium UI type upgrade over Inter, free. | Optional — decide in Part 3.3 |

### Avoid — do **not** adopt (they'd fight the from-scratch system)
- **Scalar / Redoc / Stoplight Elements / RapiDoc / Swagger UI** — these are *full renderers* with their own opinionated design. We studied them for *ideas*; adopting one means inheriting their look and losing the bespoke premium system. Our API set is small and hand-authored (`api-definitions.ts`), so a generated renderer buys us nothing and costs us control. **Build the components; borrow the patterns.**
- **Any component/animation library** (Framer Motion, MUI, Chakra, Mantine) — against the whole restraint thesis.
- The **shadcn default theme tokens** currently in `globals.css` — actively harmful (Part 2). Remove.

---

## Part 5 — What to discuss / decide next (no work started)

1. **Font:** stay on **Inter**, or upgrade UI to **Geist** (free, slightly more premium)? Mono stays JetBrains unless you want to pay for Berkeley Mono/MonoLisa.
2. **Accent:** keep **`#2563eb` blue**, or shift to a deeper indigo (closer to Stripe's `#533afd`) for a more "expensive" register? (I lean: keep blue — it's yours and it's disciplined.)
3. **⌘K command palette** for API search — in scope, or later?
4. **Sign-off on the token overhaul:** the single highest-impact fix is deleting the leaked shadcn token block and dropping global `font-weight: 500`. Confirm and it's the first thing we do.

Once you pick 1–4, I'll turn this into the new `DESIGN.md` + token file and we build component by component against the checklist.
