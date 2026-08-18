# Vendor Proxy Design — TKYC · KSCAN · DigiLocker

**Status:** Draft for review
**Author:** Engineering
**Date:** 2026-08-17

This document describes how the Insuretech portal will expose third-party KYC /
verification APIs (TKYC, KSCAN, DigiLocker) to portal users. Each user calls with
**one vendor-agnostic platform key**; the portal calls the vendors on their behalf
using **per-tenant vendor credentials** (a tenant = an org like HDFC, which owns
its vendor keys and can have many users).

> **Nothing in this doc is built yet.** It defines the structure so that vendor
> specs (Postman collections) can be slotted in without re-architecting. Review
> and approve before implementation.

---

## 1. What changes, and why

### Today
Every existing endpoint (`/api/environmental/*`) is a **read-only lookup of data
we own** in Neon. Auth is a **single shared key**:

```ts
// repeated in every route today
function isValidApiKey(key: string): boolean {
  const envKey = process.env.INTERNAL_ENV_API_KEY
  return !!envKey && key === envKey
}
```

There is **one** key for the whole portal. It does **not** identify which user or
tenant is calling.

### What the vendor APIs need
- The portal must **call out** to TKYC / KSCAN / DigiLocker (proxy), not read
  local data.
- Each call must use **the calling user's tenant's vendor credentials**.
- Some vendor calls are **POST with a JSON body** (e.g. verify a PAN), not GET.
- Vendors differ in **auth scheme** (static key header, OAuth2 bearer, HMAC…).

### The three architectural changes this forces
1. **Auth must identify the user (and their tenant).** Switch route auth from
   "match the one env key" to "look up `x-api-key` in `docs_users` → get the user
   id and their tenant id". The `docs_users.api_key` column already exists and is
   unique — we just start using it for API auth, not only for the docs UI.
2. **Per-tenant vendor credentials need a store.** Decision: a **secrets file on
   the SSH server**, outside the repo (see §2). The app reads it at startup and
   maps `tenant + vendor → keys`. Adding a tenant means editing the file and
   restarting the app.
3. **The docs + Tryout UI must support POST bodies and grouped endpoints.** The
   `ApiDefinition` type and the Tryout panel currently assume GET + query string.

---

## 2. Key management — the core of your question

> "For each platform API key will differ — how to manage that?"

**Answer: two-level tenancy. A *tenant* (e.g. HDFC) owns the vendor credentials;
its *users* each have ONE portal login + ONE platform key. A user's key resolves
to their user → their tenant → the tenant's vendor credentials, held encrypted in
the DB.** The user never sees or holds a vendor key, and there is **no per-vendor
key at the user level** — one key per user, period.

### Two levels of identity

- **Tenant** = the organisation. Example: **HDFC**. Owns the vendor credentials
  for each vendor (HDFC's TKYC creds, HDFC's KSCAN creds, HDFC's DigiLocker creds).
  This is the "client" level; **tenant = client = HDFC**.
- **User** = a person inside that tenant. HDFC can have many users. Each user has
  their **own portal login and their own single platform key**. That one key is
  vendor-agnostic — it is **not** a TKYC key or a KSCAN key; it's a portal key.
  All of a tenant's users resolve to the same tenant vendor creds.

### How one key reaches the right vendor — routing is by PATH

The user's key names no vendor. **The endpoint the user calls determines the
vendor internally** — a route→vendor mapping on our side. The user never types
"TKYC"; the path does the mapping.

```
   platform key: usr_HDFC_analyst1     POST /api/verify/pan   (path ⇒ TKYC)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Portal                                                      │
│  1. api_key ─► docs_users ─► user  (user_id)                 │
│  2. user ─► tenant                 (tenant_id = HDFC)        │
│  3. path ─► vendor                 (/verify/pan ⇒ tkyc)      │
│  4. tenant.slug + vendor ─► secrets file lookup             │
│  5. read HDFC's vendor key from the file                    │
│  6. call vendor with HDFC's creds                            │
│  7. log call with BOTH user_id AND tenant_id (ok + error)    │
│  8. return                                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HDFC's own vendor creds
                            ▼
              TKYC / KSCAN / DigiLocker
```

This gives usage reporting at **both** levels for free: filter logs by `user_id`
for one analyst, or aggregate by `tenant_id` for all of HDFC.

### Where the keys live — a secrets file on the SSH server (decided)

The tenant→vendor-credential mapping lives in a **JSON secrets file on the
server**, not in the app's `.env` and not in the git repo. The app loads it at
startup and holds the map in memory.

**File shape** — keyed by tenant slug, then vendor slug:

```json
{
  "hdfc": {
    "tkyc":       { "api_key": "hdfc-tkyc-key-..." },
    "kscan":      { "client_id": "...", "client_secret": "..." },
    "digilocker": { "api_key": "hdfc-digilocker-key-..." }
  },
  "icici": {
    "tkyc": { "api_key": "icici-tkyc-key-..." }
  }
}
```

The per-vendor value is an **object**, so it fits any auth scheme (single key, or
client_id+secret, or username+password).

**Rules that make this safe (must-do, not optional):**

| Rule | Why |
|---|---|
| File lives **outside the repo** — e.g. `/etc/insuretech/vendor-keys.json` | Can never be committed to git by accident |
| Path set via one env var, e.g. `VENDOR_KEYS_FILE=/etc/insuretech/vendor-keys.json` | App knows where to read; the file itself is not in env |
| Permissions **`chmod 600`**, owned by the app's service user | Only the app can read it |
| Not world-readable, not in any deploy artifact | Limits who can see all tenants' keys |
| Add to `.gitignore` explicitly | Belt-and-suspenders against commits |

**The trade-offs you accepted by choosing a file (documented so it's a known
choice, not a surprise):**
- **Onboarding a tenant** = SSH in, edit the file, **restart the app** to reload.
  Fine if onboarding is infrequent.
- **All tenants' keys sit in one plaintext file** — anyone who can read that file
  sees every key. The permissions above are what contain that risk.
- **No built-in change history** — rely on server access/audit logs.

> If onboarding ever becomes frequent or the plaintext-in-one-file risk becomes a
> concern, the migration path is: move the same `tenant + vendor → keys` map into
> the DB (encrypted). The lookup code doesn't change — only the source. Noted as a
> future option, not built now.

---

## 3. Data model (new + changed tables)

Vendor **keys** are **not** in the DB — they're in the server secrets file (§2).
The DB changes are only about identity and logging.

**New:** `tenants` (+ `vendors` catalogue, optional).
**Changed:** `docs_users` gains a `tenant_id` FK; `api_call_logs` gains
`tenant_id`, `user_id`, `vendor`, `success`, `error_code`, `error_message`.

### `tenants` — the organisation (new) — "tenant" = "client" = HDFC
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | "HDFC", "ICICI", … |
| `slug` | text unique | `hdfc`, `icici` — **this slug is the key into the secrets file** |
| `is_active` | boolean | disable a whole org |
| `created_at` / `updated_at` | timestamptz | |

The `slug` is the join between the DB and the secrets file: a user resolves to a
tenant, and the tenant's `slug` (e.g. `hdfc`) is looked up in the secrets file.

### `docs_users` — CHANGED (add `tenant_id`)
Add one column: `tenant_id uuid NOT NULL REFERENCES tenants(id)`. Every user
belongs to exactly one tenant. Existing columns (`email`, `api_key`, `role`,
`is_active`) stay as-is. The per-user `api_key` is the **single, vendor-agnostic**
platform key we authenticate API calls with — there is no per-vendor user key.

### `vendors` — static catalogue (optional; 3 rows: tkyc, kscan, digilocker)
Nice-to-have for storing each vendor's non-secret shape. **Not required** — the
same info can live in the endpoint config in code.
| Column | Type | Notes |
|---|---|---|
| `slug` | text unique | `tkyc` \| `kscan` \| `digilocker` — matches the secrets-file vendor key |
| `display_name` | text | "TKYC", "KScan", "DigiLocker" |
| `base_url` | text | vendor API root (from Postman) |
| `auth_scheme` | text | `static_header` \| `oauth2` \| `hmac` \| `basic` |
| `auth_config` | jsonb | scheme-specific, non-secret shape (e.g. header name, token URL) |

Secrets are **never** stored here — only the *shape* of how auth works.

### Vendor keys — in the secrets file, NOT the DB
See §2. The map `tenant slug + vendor slug → { credential object }` lives in the
JSON secrets file on the server, loaded at startup. There is no credentials table.

---

## 4. Request flow (per proxied call)

1. **Auth / identify** — read `x-api-key`, look up `docs_users` → `{ userId,
   tenantId }`. (New shared helper `resolveUser(req)` replaces the copy-pasted
   `isValidApiKey`. It can also keep accepting `INTERNAL_ENV_API_KEY` as an
   internal/admin fallback during migration.)
2. **Path → vendor** — the endpoint config maps this route to its vendor
   (`/api/verify/pan` ⇒ `tkyc`). The user's key does not name a vendor.
3. **Load credential** — look up `secretsFile[tenant.slug][vendor.slug]` → cred
   object. 403 if the tenant has no key for that vendor.
4. **Build vendor request** — the **vendor adapter** attaches auth the vendor's
   way and shapes the request (GET query vs POST body). The vendor **base URL**
   (e.g. `https://testapi.karza.in` for TKYC/Karza test) is internal config,
   switched per environment — the user never sees it.
5. **Call vendor** — `fetch` the internal vendor URL with timeout; map vendor
   errors to our envelope.
6. **Log** — write to `api_call_logs` with **both** `user_id` and `tenant_id`,
   `vendor`, endpoint, `success` (true/false), status, `error_code` +
   `error_message` on failure, latency. **This happens on both success AND
   failure** — the log write is in a `finally`, so a vendor error or timeout is
   still recorded.
7. **Return** — normalize into the existing `{ success, data }` envelope.

---

## 4a. Usage tracking (per-user AND per-tenant)

Every proxied call is recorded — **success and failure both** — at the user level,
with the tenant attached so it rolls up. `api_call_logs` is extended:

| Column | New? | Notes |
|---|---|---|
| `user_id` | **new** | FK → `docs_users.id` — who made the call |
| `tenant_id` | **new** | FK → `tenants.id` — which org (HDFC) — enables rollup |
| `vendor` | **new** | `tkyc` \| `kscan` \| `digilocker` \| `environmental` |
| `endpoint` | exists | e.g. `/api/verify/pan` |
| `method` | exists | GET / POST |
| `success` | **new** | boolean — true even for a 200 from vendor, false on any error |
| `status_code` | exists | HTTP status we returned to the user |
| `error_code` | **new** | our code (`VENDOR_TIMEOUT`, `CRED_MISSING`, `VENDOR_4XX`…) |
| `error_message` | **new** | short, **PII-redacted** message |
| `latency_ms` | exists | round-trip incl. vendor |
| `query_params` | exists | **redacted** — never store raw PAN/Aadhaar |
| `created_at` | exists | timestamp |

**Reporting this enables:**
- Per user: `WHERE user_id = ?` → one HDFC analyst's call history + success rate.
- Per tenant: `WHERE tenant_id = ?` → all of HDFC, groupable by vendor/endpoint.
- Billing / quota: `COUNT(*) ... GROUP BY tenant_id, vendor`.

**PII rule:** request bodies for KYC carry PAN/Aadhaar. We store endpoint + status
+ redacted summary only — **never** the raw body or raw vendor response. Redaction
happens before the log write (mask all but last 4 chars of any id-looking field).

---

## 5. Vendor adapters (how per-vendor differences are isolated)

Each vendor gets one small module implementing a shared interface. This is the
**only** place a vendor's quirks live — the proxy route stays generic.

```ts
// src/lib/vendors/types.ts
export interface VendorAdapter {
  slug: 'tkyc' | 'kscan' | 'digilocker'
  /** Attach this vendor's auth to an outgoing request. */
  authorize(
    req: { url: string; headers: Record<string, string>; body?: unknown },
    cred: Record<string, string>,   // read from the secrets file for this tenant+vendor
  ): Promise<{ url: string; headers: Record<string, string>; body?: unknown }>
  /** Map a raw vendor response into our envelope. */
  normalize(status: number, raw: unknown): { success: boolean; data?: unknown; error?: string }
}
```

- **static_header** adapter: `headers[cfg.headerName] = cred.api_key`. Trivial.
- **oauth2** adapter: POST `client_id/secret` to token URL, **cache** the bearer
  (in-memory or a `vendor_tokens` table) until expiry, attach `Authorization:
  Bearer`. DigiLocker is the likely candidate.
- **hmac** adapter: sign `payload + timestamp` with the secret per the vendor's
  rule.

**This is why "not sure of the auth scheme yet" is fine** — the adapter interface
is fixed; each vendor's `authorize()` is filled in once its Postman collection /
auth docs arrive.

---

## 6. Route surface

Public paths are named by **capability**, not by vendor — the user's key doesn't
name a vendor, and the vendor is an internal detail that could even change per
tenant later. Grouped under a `verify` namespace, separate from owned-data
endpoints:

```
src/app/api/verify/
  pan/route.ts          → internally maps to a vendor (e.g. tkyc)
  face-match/route.ts   → internally maps to a vendor (e.g. kscan)
  aadhaar/route.ts      → internally maps to a vendor (e.g. digilocker)
  ...                   (one route per capability, from the Postman collections)
```

Each route file is thin — parse/validate input (zod), then delegate to a generic
`proxyToVendor(req, { endpointConfig })`. The **endpoint config** holds the
route→vendor mapping plus (vendor path, method, body schema), generated from the
Postman collections. Only our internal config knows `pan ⇒ tkyc`; the URL does
not leak it.

---

## 7. Docs portal + Tryout changes

To document these on the portal (following all `DESIGN.md` / `CLAUDE.md` rules):

### `ApiDefinition` type — extend for POST bodies + capability grouping
- `method` already allows `POST` — good.
- Add `bodySchema?: Param[]` (params with `in: 'body'`) so the Tryout can render
  a JSON body form; today `exampleRequest.body` exists but the Tryout only builds
  query strings.
- Add a sidebar **group** so the API list is sectioned: *Environmental* (existing)
  vs *Verification (KYC)* (new). The vendor behind each capability is internal —
  it does **not** need to appear in the user-facing docs unless you want it to.

### Tryout panel
- When `method === 'POST'`, render a body editor (from `bodySchema`) and **send a
  JSON body** instead of a query string. `x-api-key` header stays identical.
- cURL / JS / Python snippet generators: add the POST-with-body variants.

### The "curl will work?" answer
Yes. From the user's side it stays exactly like today — one header, one call:

```bash
# POST example — PAN Profile (backed by TKYC/Karza internally)
curl -X POST https://<portal>/api/verify/pan \
  -H "x-api-key: <their one platform key>" \
  -H "Content-Type: application/json" \
  -d '{"pan":"ABCDE1234F","consent":"Y"}'
```

Compare to what the portal does internally (the user never sees this):

```bash
# internal — portal → vendor, with the tenant's Karza key injected
curl -X POST https://testapi.karza.in/v3/pan-profile \
  -H "x-karza-key: <this tenant's Karza key from the secrets file>" \
  -H "Content-Type: application/json" \
  -d '{"pan":"ABCDE1234F","consent":"Y"}'
```

Note the user's URL names the **capability** (`/verify/pan`), not the vendor, and
uses **your** host — not `karza.in`. The vendor key and vendor host are injected
server-side and never leave your backend.

---

## 8. Admin: onboarding a tenant + its vendor keys

Onboarding a tenant is two steps:
- **Create tenant + users (DB):** insert a `tenants` row (HDFC, slug `hdfc`), then
  `docs_users` rows (each with a generated platform `api_key`) linked by
  `tenant_id`. Can be an admin-only route (gated by `docs_users.role = 'admin'`).
- **Add vendor keys (secrets file):** SSH into the server, add the tenant's block
  to the secrets file, and **restart the app** so it reloads:
  ```json
  "hdfc": { "tkyc": { "api_key": "hdfc-karza-key-..." } }
  ```
  The tenant `slug` in the DB must match the key in the file (`hdfc`).

> Because the file is read at startup, **key changes require an app restart**.
> This is the main operational cost of the file approach — acceptable for
> infrequent onboarding.

---

## 9. Security notes

- Secrets file: lives **outside the repo** (e.g. `/etc/insuretech/vendor-keys.json`),
  `chmod 600`, owned by the app's service user, in `.gitignore`, never in a deploy
  artifact. Path via `VENDOR_KEYS_FILE` env var.
- Vendor keys are read into memory at startup, **never logged**, never sent to the
  browser.
- Vendor **base URLs** are internal config, per-environment (test vs prod). The
  user's URL is always your portal — the vendor host (e.g. `testapi.karza.in`) is
  never exposed.
- `api_call_logs.query_params`: **must not** capture request bodies containing
  PII (PAN/Aadhaar/DOB/name/address). Log endpoint + status + latency only, or a
  redacted summary.
- Rate limiting / quota per **tenant** (and optionally per user) is worth adding
  — the `tenant_id` on every log row makes this straightforward (out of scope here).

---

## 10. Vendor specs

Provide the exported **Postman collection (v2.1 JSON)** per capability/vendor.
Save under `External API/` (or `docs/vendor-specs/`).

### Vendors so far
- **TKYC** is powered by **Karza** (`*.karza.in`). "PAN Profile" is one capability
  under TKYC. Other TKYC/KSCAN/DigiLocker capabilities will be more collections.

### Worked example — the PAN Profile collection you provided
From `External API/PAN Profile (Detailed) collection.json`:

| Field | Value |
|---|---|
| Capability (public route) | `POST /api/verify/pan` |
| Vendor (internal) | `tkyc` (Karza) |
| Vendor base URL (internal, test) | `https://testapi.karza.in` |
| Vendor path | `/v3/pan-profile` |
| Auth scheme | **static header** — `x-karza-key: <tenant's Karza key>` |
| Method | POST, JSON body |
| Body (full) | `pan, aadhaarLastFour, dob, name, address, getContactDetails, PANStatus, isSalaried, isDirector, isSoleProp, consent` |
| Body (lite) | `pan, lite:"Y", consent:"Y"` |
| **PII to redact in logs** | `pan`, `aadhaarLastFour`, `dob`, `name`, `address` |

So for this endpoint: adapter = `static_header` with header `x-karza-key`; the
secrets file holds each tenant's Karza key under `"<tenant>": { "tkyc": { "api_key": "..." } }`.

### For each new collection, confirm:
| # | Question | Why it matters |
|---|---|---|
| 1 | **Base URL** — test + prod (internal) | vendor call target, per environment |
| 2 | **Auth scheme** — static header / OAuth2 / HMAC / basic? | picks the adapter |
| 3 | If static: **which header name** (here: `x-karza-key`) | adapter config |
| 4 | If OAuth2: **token endpoint** + token lifetime | token caching |
| 5 | Each endpoint: **method** + **request body shape** | route + Tryout body form |
| 6 | Each endpoint: an **example success + error response** | docs + `normalize()` |
| 7 | Which fields are **PII** | logging redaction |

Items 1–6 are usually in the Postman export; 2/7 sometimes need a word from you.

---

## 11. Proposed build order (once specs arrive)

1. `tenants` table (+ optional `vendors`); add `tenant_id` to `docs_users`;
   extend `api_call_logs` (user_id, tenant_id, vendor, success, error_code,
   error_message) — one Drizzle migration.
2. Secrets-file loader: read `VENDOR_KEYS_FILE` at startup → in-memory map;
   `getVendorCred(tenantSlug, vendorSlug)` helper.
3. `resolveUser(req)` shared auth helper (api_key → { userId, tenantId, tenantSlug }).
4. Logging helper that writes success + failure with both ids (called in `finally`).
5. Admin route to create tenant + users (keys added to the file manually).
6. Endpoint-config registry (route→vendor mapping) + vendor adapter interface;
   wire **one** capability end-to-end (simplest auth first).
7. Generic `proxyToVendor` + that capability's route.
8. `ApiDefinition` + Tryout POST-body support; add that capability's docs entry.
9. Replicate for the remaining capabilities across the other vendors.

---

## Open decisions for you

- **A.** Confirm DB-backed key store (not env) — implied by your 20+ tenants.
- **B.** Any vendor endpoints that should stay **docs-only** (user calls vendor
  directly), or is **everything** proxied? (You said everything is a PAI →
  assuming all proxied.)
- **C.** Sandbox vs production vendor environments — one set of creds or both?
