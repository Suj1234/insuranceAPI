# External API Onboarding Playbook

This file is the **step-by-step process for adding a new external (vendor) API**
to the docs portal, matching exactly how **PAN Profile** was built. Follow it
literally for every new API. Do NOT change the UI — the design is final; this is
a data-entry + wiring process, not a redesign.

**Workflow:** the user drops a vendor PDF in this `External API/` folder, names
the API, and Claude builds that ONE API end-to-end following this checklist. One
API at a time, reviewed, then repeat. ~40–50 APIs total, mostly the **Karza /
TotalKYC (TKYC)** vendor.

---

## STATUS TRACKER — update after every API

**How each chat works:**
1. **Sync the table with the folder first.** List the PDFs actually in
   `External API/` (`*.pdf`). For any PDF NOT already a row in the table below,
   **append a new row** as `TODO` (derive a `verify-<slug>` id from the name).
   This is how new APIs added later get picked up automatically — the folder is
   the source of truth, this table just tracks status. Never assume the list is
   complete; always re-scan.
2. Pick the FIRST row still marked `TODO`.
3. Build that API following the checklist below → test it.
4. Mark it `DONE ✅` with the date → tell the user it's done and name the next TODO.

One API per session (or continue in the same chat if the user says so). **More
PDFs will be added over time** — that's expected; step 1 absorbs them.

**Status values:** `TODO` (not started) · `WIP` (in progress) · `DONE ✅` ·
`BLOCKED` (note why).

| # | API (PDF file) | id / slug | Status | Notes |
|---|----------------|-----------|--------|-------|
| 0 | PAN Profile (Detailed) | verify-pan | DONE ✅ | reference implementation |
| 1 | PAN Status | verify-pan-status | DONE ✅ | 2026-08-19 · single scenario; nested clientData |
| 2 | PAN DOB Status | verify-pan-dob-status | DONE ✅ | 2026-08-19 · single scenario; no name/dob validation fields (unlike PAN Status) |
| 3 | PAN Link Status (with unique Aadhaar) | verify-pan-link-unique-consent, verify-pan-link-unique-check | DONE ✅ | 2026-08-19 · 2-step vendor flow (consent → accessKey → link check), split into 2 sidebar entries/routes since Tryout is one-call-per-definition; user copies accessKey from step 1 into step 2 |
| 4 | PAN Link Status (with any Aadhaar) | verify-pan-link-any | DONE ✅ | 2026-08-19 · single scenario; PAN-only input |
| 5 | Bank AC Verification Advanced | verify-bank-ac-advanced | DONE ✅ | 2026-08-19 · deep nested response (source[], comparisionData); either accountHolderName or multiNameList required (not enforced in Zod — vendor-side) |
| 6 | Silent Bank Account Verification | verify-bank-ac-silent | DONE ✅ | 2026-08-19 · non-penny variant of #5; single-name comparisonData (not multiNameList) |
| 7 | Driver's License Authentication | verify-dl | DONE ✅ | 2026-08-19 · single scenario; rich response (covDetails[], address[], statusDetails, endorsement) |
| 8 | Driver's License Authentication Advanced | verify-dl-advanced | BLOCKED | 2026-08-19 · Async API — HTTP response is just "Request Submitted Successfully"; real comparison/OCR result delivered via webhook/email, not the Tryout Send response. Needs webhook receiver + session-correlated live push (real infra, not data+wiring) before this can be built properly — user decided to defer. Revisit once async/webhook API pattern is designed. |
| 9 | Passport Verification | verify-passport | DONE ✅ | 2026-08-19 · single scenario; all body fields optional per PDF (fileNo+dob OR passportNo+doi+name combos) |
| 10 | Passport Verification Advanced | verify-passport-advanced | BLOCKED | 2026-08-19 · Same async/kyc-advanced-plus/OCR-image pattern as #8 (DL Advanced) — HTTP response is just an ack, real result via webhook/email. Same blocker: needs webhook receiver + session-correlated live push. Deferred with #8. |
| 11 | Vehicle RC Authentication - Advanced | verify-rc-advanced | DONE ✅ | 2026-08-19 · single scenario; ~50 flat response fields |
| 12 | GST Authentication | verify-gst | DONE ✅ | 2026-08-19 · 2 scenarios (additionalData true/false) as variants[] |
| 13 | GST Advanced | verify-gst-advanced | DONE ✅ | 2026-08-19 · 2 scenarios (liabilityDetails true/false); result[] array of GSTIN entries with nested profile+filingStatus, shared field-tree helper (gstinEntryFields) to avoid duplicating ~50 nested paths |
| 14 | GST Search Basis PAN | verify-gst-by-pan | DONE ✅ | 2026-08-19 · single scenario; lightweight GSTIN-lookup counterpart to GST Advanced |
| 15 | MCA Signatories | verify-mca-signatories | DONE ✅ | 2026-08-19 · single scenario; response uses status-code/request_id (snake-case) not statusCode/requestId |
| 16 | Udyog Aadhar Number | verify-udyog-aadhaar | DONE ✅ | 2026-08-19 · single scenario; flat response, snake-case status-code/request_id |
| 17 | Employment Verification Advanced (PAN Flow) | verify-employment-advanced | DONE ✅ | 2026-08-19 · single scenario but deep nesting (email/nameLookup/uan/personalInfo/summary); Sync but 290s timeout (not the usual 30s) — route.ts VENDOR_TIMEOUT_MS raised accordingly; shared field-tree helper like GST Advanced |
| 18 | Digital FootPrint (Mobile) | verify-footprint-mobile | DONE ✅ | 2026-08-19 · single scenario; risk score + digital presence + network details |
| 19 | Digital Foot Print (Email) | verify-footprint-email | TODO | |
| 20 | Email Fraud Check | verify-email-fraud | TODO | |
| 21 | Mobile to Form Prefill | verify-mobile-prefill | TODO | |

> New PDFs added later are picked up automatically via step 1 (re-scan the
> folder, append missing ones as `TODO`). The `slug` is a suggestion; confirm
> against the PDF's actual endpoint if it differs.

---

## Golden rules (read before every API)

1. **No UI changes.** Never edit component files to change look/layout. You only
   add data + a proxy route. The components already render everything.
2. **Copy the PDF verbatim.** Field names, types, descriptions, validations,
   example bodies — transcribe exactly. This is KYC data; a wrong regex or
   mis-nested field is a production bug. Do not paraphrase descriptions.
3. **Define fields in BOTH places** (this is the known dual-source setup — the
   user chose to keep it):
   - `params` + `responseFields` on the API definition → **Tryout tab** reads these.
   - `variants[]` → **Documentation tab** reads these.
   If a field is in one but not the other, it silently breaks (this is exactly
   how the `fatherName` bug happened). **After building, diff the two.**
4. **Base URL = env var, TEST by default.** The PDF shows the PROD url
   (`api.karza.in`); we call TEST (`testapi.karza.in`). Never hardcode prod in
   the call path. Prod is switched via env in deployment.
5. **Proxy route Zod schema must list EVERY request field.** Zod strips unknown
   keys — any field missing from the schema is silently dropped before it
   reaches the vendor (this is the OTHER half of the `fatherName` bug — it was
   missing from `route.ts`). Every request param the tryout can send MUST be in
   the schema.
6. **Redact PII in logs.** Add every PII field (PAN, Aadhaar, DOB, name, address,
   phone, email, account numbers, etc.) to the vendor's PII list.
7. **Verify, don't assume.** Typecheck (`npx tsc --noEmit`), and for any
   non-trivial parsing/validation add a throwaway self-check under scratchpad.

---

## Anatomy of one API (the files you touch)

| # | File | What you add |
|---|------|--------------|
| 1 | `src/app/docs/(protected)/environmental/_data/api-definitions.ts` | The API definition object (top-level fields + `params` + `responseFields` for the **Tryout**), and its `group`. |
| 2 | `src/app/docs/(protected)/environmental/_data/<api>-variants.ts` | The `ApiVariant[]` for the **Documentation** tab (one per PDF scenario). Import it into the definition's `variants`. |
| 3 | `src/app/api/verify/<api>/route.ts` | The **proxy route**: Zod schema, vendor call, PII redaction, error normalization. Copy PAN's route and adapt. |
| 4 | `src/lib/vendors/karza.ts` | Add the vendor **path** constant (e.g. `KARZA_<API>_PATH`) and extend the PII field list if this API has new PII fields. (Only add a new `vendors/<name>.ts` file if it's a NEW vendor — rare; most are Karza.) |
| 5 | `src/app/docs/(protected)/environmental/_data/api-definitions.ts` → `ApiGroupName` | If the API belongs to a new sidebar group, add the group name to the `ApiGroupName` union AND to the sidebar's group filter (see “Sidebar grouping” below). |

Nothing else. No component edits, no new UI.

---

## The API definition object (Tryout source) — every field explained

Add this object to the `API_DEFINITIONS` array in `api-definitions.ts`:

```ts
{
  id: 'verify-<slug>',                 // unique, kebab-case, stable (used in URLs/state)
  label: '<Human Name>',               // sidebar + header title, e.g. 'Voter ID'
  group: 'Verification (KYC)',         // sidebar group — see ApiGroupName
  method: 'POST',                      // from the PDF (KYC is usually POST)
  path: '/api/verify/<slug>',          // OUR proxy path (not the vendor's)
  shortDescription: '<one line>',      // the PDF's one-line summary (single line, truncates)
  description: '<full paragraph>',     // longer intro (from the PDF abstract)
  authNote: 'Pass your API key as the `x-api-key` request header. The vendor key is injected server-side.',

  // ── Tryout form fields (request) ──
  params: [
    // header auth (always present, first):
    { name: 'x-api-key', in: 'header', required: true, type: 'string',
      description: 'Your platform API key' },

    // body params — transcribe each from the PDF Request → Schema table:
    { name: 'consent', in: 'body', required: true, type: 'string',
      description: 'Consent is required to make the API request.',
      enum: ['Y', 'N'] },                         // 2-option enum → renders as Yes/No toggle

    { name: '<field>', in: 'body', required: <bool>, type: 'string',
      label: '<Friendly Label>',                  // optional: overrides humanized name
      placeholder: '<format hint>',               // optional: e.g. 'YYYY-MM-DD' (also makes the field start empty)
      uppercase: true,                            // optional: force UPPER-case as typed (e.g. PAN)
      description: '<exact PDF description>',
      validation: {                               // optional: from the PDF “Validations” column
        minLength: 10, maxLength: 10,
        pattern: '^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$', // regex SOURCE (double-backslash in TS strings!)
        hint: '5 letters, 4 digits, 1 letter',    // human message shown on failure
      },
    },

    // nested body params use dotted names → render indented in the tables:
    { name: 'clientData', in: 'body', required: false, type: 'object',
      description: 'Data of the user sharing consent' },
    { name: 'clientData.caseId', in: 'body', required: false, type: 'string',
      description: 'Unique case id/lead id of the user sharing consent' },
  ],

  // ── Tryout response schema (flat list; nesting via dotted paths) ──
  // Paths encode hierarchy: 'result.address.city'. Container rows (result,
  // address) may be listed explicitly OR are auto-synthesized. Arrays use '[]':
  // 'result.profileMatch[].parameter'.
  responseFields: [
    { field: 'statusCode', type: 'integer', description: '...', required: true },
    { field: 'result', type: 'object', description: '...', required: true },
    { field: 'result.<leaf>', type: 'string', description: '...', required: false },
    { field: 'result.address', type: 'object', description: '...', required: false },
    { field: 'result.address.city', type: 'string|null', description: '...', required: false },
    // ...
  ],

  exampleRequest: { body: JSON.stringify({ /* minimal happy-path body */ }, null, 2) },
  exampleResponse: JSON.stringify({ /* the PDF's example response */ }, null, 2),

  variants: <API>_VARIANTS,   // import from <api>-variants.ts (Documentation source)
},
```

### Field-by-field notes
- **`enum: ['Y', 'N']`** on a body param → the Tryout auto-renders it as a **Yes/No
  toggle** (grouped with other toggles). Any 2-item enum works.
- **`validation`** drives the Tryout's inline errors AND (via the same object)
  is the single source of truth for validation. Rules: `minLength`, `maxLength`,
  `pattern` (regex source string — remember `\\d` in TS), `hint` (shown on fail).
  Required-but-empty always errors regardless of `validation`.
- **`uppercase: true`** forces the input UPPER-case as typed and in the sent value.
- **`placeholder`** shows a grey hint AND makes the field initialise **empty**
  (params without a placeholder prefill from `example`). Use for formats/examples
  you do NOT want pre-filled (PAN, DOB).
- **`label`** overrides the auto-humanized name (`dob` → “Date of Birth”).
- **Dotted `name`** (`clientData.caseId`) → indented tree row in the table.

---

## The variants file (Documentation source)

The PDF usually documents **multiple scenarios** — e.g. PAN had *Full profile*,
*Basic (lite)*, *With father name*, each its own Request→Response pair. Create
`<api>-variants.ts` exporting `ApiVariant[]`:

```ts
import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY  = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const FULL: ApiVariant = {
  label: 'Full profile',                    // name a scenario by what the RESPONSE returns, not the raw flag
  request:  { params: [ /* Request→Schema rows, exact */ ], body: '<JSON>', headers: HEADERS_WITH_KEY },
  response: { fields: [ /* Response→Schema rows, exact, dotted paths */ ], body: '<JSON>', headers: HEADERS_JSON_ONLY },
}
// ...more scenarios...
export const <API>_VARIANTS: ApiVariant[] = [FULL, /* ... */]
```

- **Scenario labels** describe the RESULT (“Full profile”, “Basic profile (lite)”,
  “Full profile with father name”) — NOT the request flag. The Documentation tab
  shows these as a “Response type” tab strip.
- **Response `fields`** use the same dotted-path tree as `responseFields`.
- If the PDF has only ONE scenario, make a single-item array — the tab strip
  hides itself when there's one variant.
- Helper functions (like `addressFields(parent)`) are encouraged to avoid
  repeating shared subtrees across scenarios.

---

## The proxy route

Copy `src/app/api/verify/pan/route.ts` to `src/app/api/verify/<slug>/route.ts`
and change:

1. **Imports** — the vendor path constant for this API (add it to `karza.ts`).
2. **`BodySchema`** — list **every** request body field (Zod strips unknowns →
   dropped silently). Mirror the `params` exactly:
   ```ts
   const BodySchema = z.object({
     <field>: z.string().regex(/<same pattern>/, '<msg>'),
     consent: z.enum(['Y','N']).default('Y'),
     <flag>:  z.enum(['Y','N']).optional(),
     // ...one line per body param...
   })
   ```
3. **Vendor call** — `fetch(\`${KARZA_BASE_URL}${KARZA_<API>_PATH}\`, ...)` with
   `[KARZA_AUTH_HEADER]: karzaKey`.
4. **PII redaction** — `redactPii` uses the vendor PII list; make sure this API's
   PII fields are in it (extend `karza.ts`).
5. Keep the auth check, timeout, error normalization, and `logApiCall` as-is.

**The response is passed through as `{ success: true, data: vendorBody }`** — do
NOT filter the vendor response; the Data Preview renders whatever comes back.

---

## Vendor config (`src/lib/vendors/karza.ts`)

- Add the path: `export const KARZA_<API>_PATH = '/v3/<vendor-endpoint>'`
- Base URL stays `process.env.KARZA_BASE_URL ?? 'https://testapi.karza.in'`
  (test default; prod via env). Auth header stays `x-karza-key`.
- Extend the PII field list with any new PII this API sends/receives.
- Only create a new `vendors/<name>.ts` for a genuinely different vendor (base
  URL / auth header / response envelope). Most APIs are Karza — reuse it.

---

## Sidebar grouping

The nav groups APIs by the `group` field. Existing groups: `Environmental`,
`Flood & Hydrology`, `Verification (KYC)`. To use an existing group, set
`group: 'Verification (KYC)'` and you're done.

To add a NEW group:
1. Add the name to the `ApiGroupName` union in `api-definitions.ts`.
2. Add a filter + `<ApiGroup>` block in `src/components/docs/sidebar.tsx`
   (mirror the existing `verifyApis` block). This is the ONE allowed sidebar
   edit — it's wiring a data group, not changing the design.

---

## Test vs Prod URL

- **Docs display** the PROD url from the PDF (e.g. `https://api.karza.in/v3/...`)
  — this is just text in the header/variants. Fine to show prod.
- **The Tryout actually calls** our proxy (`/api/verify/<slug>`), which calls the
  vendor **TEST** base (`testapi.karza.in`) via `KARZA_BASE_URL`.
- **Production deploy** sets `KARZA_BASE_URL=https://api.karza.in`. No code change.
- So: PDF prod URL → goes in docs text only. Never in the fetch path.

---

## Per-API checklist (run every time)

- [ ] Read the PDF fully (all scenarios, all tables, PII fields).
- [ ] `api-definitions.ts`: definition object + `params` + `responseFields` + `group`.
- [ ] `<api>-variants.ts`: one `ApiVariant` per PDF scenario, exact transcription.
- [ ] Wire `variants: <API>_VARIANTS` into the definition.
- [ ] `karza.ts`: add `KARZA_<API>_PATH`; extend PII list.
- [ ] `route.ts`: copy PAN's, update path + Zod schema (**every** body field) + PII.
- [ ] **Diff check:** every request field in `params` is also in the Zod schema
      AND (if documented per-scenario) in the variant. No field in one, missing
      in another.
- [ ] Validations transcribed from the PDF “Validations” column into `validation`.
- [ ] `npx tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] Self-check any non-trivial nesting/validation (scratchpad throwaway).
- [ ] Confirm in the browser: Documentation tabs (Schema/Body/Headers, scenarios),
      Tryout (fields grouped, toggles, validation, Send → response auto-expands,
      Data Preview shows the nested tree).
- [ ] **Update the STATUS TRACKER** at the top of this file: set the API's row to
      `DONE ✅` with today's date. Then tell the user it's done and name the next
      `TODO` row.

---

## Common bugs (learned from PAN — don't repeat)

- **Field in docs but not tryout (or vice-versa):** the dual-source trap. Always
  add to BOTH `params`/`responseFields` and `variants`.
- **Flag dropped at the proxy:** field missing from the Zod `BodySchema` → Zod
  strips it → vendor never sees it → not in response. List every field.
- **Regex escaping:** in TS string patterns use `\\d`, `\\.` etc. (double
  backslash). Test the pattern against a known-good value.
- **Prefilled junk:** don't put validation hints in `example` and expect a clean
  field — use `placeholder` (which also empties the field).
- **Prod URL in the call path:** only `KARZA_BASE_URL` decides test/prod. PDF's
  prod url is display text.
- **Missing PII redaction:** every new PII field must go in the vendor PII list
  or it leaks into logs.
