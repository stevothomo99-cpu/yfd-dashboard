# YFD Dashboard — Project Context Document

**Version:** 2.0
**Last updated:** 18 July 2026
**Owner:** CEO (Steve), Your Financial Direction (YFD)
**Purpose:** Full context for any developer or AI coding assistant picking up this project. This replaces the original v1.0 pre-build plan — the sections below describe what is **actually built and deployed**, not the original spec.

---

## 1. Project Overview

A private, CEO-facing business intelligence dashboard built in Next.js 16 (App Router, Turbopack) and deployed to Vercel.

It gives the YFD CEO a single view across:
- **Overseas bookkeeping team performance** (Karbon tasks + XPM timesheets/invoices)
- **Business KPIs across three companies**: YFD (accounting practice), SiteMargin, FocablyED
- **Web traffic/SEO** for SiteMargin and FocablyED (Google Search Console + GA4)

Repo: `stevothomo99-cpu/yfd-dashboard`. Deploys to Vercel on every push to `main`.

---

## 2. Tech Stack (as built)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn-style primitives (`components/ui/`) |
| Charts | Recharts |
| Auth (dashboard login) | NextAuth v5 beta, Credentials provider, single CEO account via `AUTH_USERNAME`/`AUTH_PASSWORD` env vars |
| Auth (secondary, WIP) | Supabase Auth — `dashboard_users` table, see §7 "Known gap" |
| Cache | Redis via `ioredis` (`REDIS_URL` env var — e.g. Upstash attached in Vercel). Falls back to an in-memory `Map` if unset (dev only) |
| Hosting | Vercel — repo push = deploy |

---

## 3. Current Routes

| Route | Purpose |
|---|---|
| `/login` | NextAuth credentials login form |
| `/` | Redirects: CEO (`AUTH_USERNAME` match) → `/personal`, everyone else → `/team` |
| `/personal` | **Main CEO dashboard.** Business KPIs (3-column: FocablyED, SiteMargin, YFD), Web Metrics (SiteMargin + FocablyED side by side, with 24h/7d/30d period selector), User & Churn metrics (FocablyED subscriptions, SiteMargin trials) |
| `/team` | Team-facing dashboard (non-CEO landing page) |
| `/leaderboard` | Staff performance ranking (Karbon/XPM derived) |
| `/timesheets` | Billable/non-billable hours, staff slicer |
| `/tasks` | Karbon tasks — overdue/due today/due this week |
| `/bas` | BAS obligation status |
| `/clients` | Client tile grid (YTD invoiced, task/BAS status) |
| `/staff/[id]` | Individual staff drill-down |
| `/settings` | Two tabs: **Staff & Sync** (XPM partner name, Karbon/XPM staff roster toggle) and **Dashboard Users** (multi-user admin — see §7 known gap) |
| `/settings/users` | User management: list/create users with role admin/user (Supabase-backed) |

---

## 4. API Routes & Data Sources

### 4.1 XPM (Xero Practice Manager) — `lib/xpm.ts`
OAuth 2.0 (Xero Developer portal), auto-refreshed from `XPM_REFRESH_TOKEN`. `XpmNotConfiguredError` is thrown/caught throughout when env vars are missing, so pages degrade to a "not configured" message instead of crashing.

| Endpoint | Fetches |
|---|---|
| `GET/POST /api/xpm/staff` | Staff filtered to Partner = CEO name (Manager role on Partner's jobs) |
| `GET /api/xpm/timesheets` | Billable/non-billable hours, week/month/YTD |
| `GET /api/xpm/invoices` | YTD invoiced per client |
| `GET/POST /api/xpm/sales` | **YFD business tile data.** Sums XPM invoices into `monthTotal` (1st of month → today) and `ytdTotal` (Jan 1 → today, calendar year). POST forces a cache refresh. |

Note: `XPM_BASE_URL` must point at API **v3.1** (`https://api.xero.com/practicemanager/3.1`) — v3.0 only returns XML, and `lib/xpm.ts` expects JSON.

### 4.2 Karbon — `lib/karbon.ts`
Bearer token (`KARBON_API_KEY`). `/api/karbon/tasks`, `/api/karbon/work`, `/api/karbon/users`. `KARBON_BAS_WORK_TYPE` filters `/WorkItems` by the exact label configured in Karbon → Settings → Work Types.

### 4.3 HubSpot — `lib/hubspot.ts`
`GET/POST /api/hubspot/deals` — deal pipeline KPIs (new leads, active deal count/value, won this month, avg days to close) split three ways: `focablyED`, `siteMargin`, `yfd`. Cursor-paginated. Uses `HUBSPOT_ACCESS_TOKEN` / `HUBSPOT_PORTAL_ID`.

### 4.4 Google Search Console + GA4 — `lib/google.ts`
JWT (RS256) service-account auth, custom-built (no `googleapis` package — hand-rolled `jsonwebtoken` signing against `oauth2.googleapis.com/token`). Scopes: `webmasters.readonly`, `analytics.readonly`.

- `getSearchConsoleMetrics(siteUrl, { days })` — clicks, impressions, CTR, avg position, top 10 queries. `siteUrl` uses the `sc-domain:` prefix for domain properties (e.g. `sc-domain:sitemargin.com.au`).
- `getAnalyticsMetrics(propertyId, { days })` — sessions, users, pageviews, bounce rate via GA4 Data API `runReport`.
- Both accept an optional `days` param (defaults to 30) — powers the 24h/7d/30d selector on `/personal`.

Routes: `GET /api/google/search-console?days=N`, `GET /api/google/analytics?days=N`. Both currently only return **SiteMargin** data — FocablyED is wired in the response shape (`focablyED: null`) but not yet live; needs `FOCABLYED_GA4_PROPERTY_ID` and a verified FocablyED Search Console property.

`GET /api/google/diagnose` — debug endpoint, dumps base64 key validity/PEM format checks. Keep for troubleshooting auth issues (this took a while to get right — see §8).

Env vars: `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY_BASE64` (base64-encode the full PEM: `cat private-key.txt | base64 -w 0`), `SITEMARGIN_GA4_PROPERTY_ID`, `FOCABLYED_GA4_PROPERTY_ID`.

### 4.5 FocablyED — `lib/focably.ts`
Own Supabase project (separate from the `yfd-workflow` project — see §7). Env vars: `SUPABASE_FOCABLY_URL`, `SUPABASE_FOCABLY_SERVICE_KEY`. `GET /api/focably/metrics` returns total/paid/freemium/non-active users, churn (paid/unpaid/total this month), churn rate, win-back candidates.

### 4.6 SiteMargin — `lib/sitemargin.ts`
Also its own Supabase project. Env vars: `SUPABASE_SITEMARGIN_URL`, `SUPABASE_SITEMARGIN_SERVICE_KEY`. `GET /api/sitemargin/metrics` returns organizations/trials/subscriptions/churn.

---

## 5. `/personal` Dashboard — Current Layout

1. **Sales Pipeline** (3-col grid): `BusinessKpiTile` for FocablyED and SiteMargin (HubSpot deal data), plus a YFD tile showing Xero month/YTD sales totals (`xeroSales` state, from `/api/xpm/sales`).
2. **Web Metrics** (2-col grid, heading shows current period e.g. "Web Metrics (24h)"): `WebMetricsTile` × 2 (SiteMargin, FocablyED). Each tile has its own 24h/week/month button row (raised/shadowed button style) that re-fetches both Search Console and Analytics data for that product at the selected period via `handleWebMetricsPeriodChange(days)`, which hits both Google endpoints with a `?days=` query param.
3. **User & Churn Metrics**: `SubscriptionMetricsTile` (FocablyED) and `SiteMarginMetricsTile` (SiteMargin).
4. Manual **Refresh** button — re-fetches all 6 data sources (HubSpot POST, XPM sales POST, Focably, SiteMargin, Search Console, Analytics).

Key components: `components/dashboard/WebMetricsTile.tsx` (unified Search Console + Analytics side-by-side, replaced the earlier separate `SearchConsoleMetricsTile`/`AnalyticsMetricsTile`, which are still in the tree but unused), `components/dashboard/BusinessKpiTile.tsx`, `components/ui/skeleton.tsx` (loading placeholder — required by `WebMetricsTile`, was missing and broke the Turbopack build once).

---

## 6. Design Notes

- Card style: `rounded-lg border bg-card p-6`, Tailwind utility classes (the dashboard has drifted from the original inline-`style` prototype pattern seen in `TopNav.tsx`/`login/page.tsx` toward Tailwind classes in newer pages like `/personal`).
- Period-selector buttons (Web Metrics): active = `bg-blue-600 text-white shadow-lg shadow-blue-600/30`; inactive = `bg-white ... border ... shadow-md hover:shadow-lg`.
- No dark mode.

---

## 7. Multi-user auth — now wired end to end

The dashboard supports two authentication paths through a single NextAuth `Credentials` provider (`auth.ts`), both landing on the same session shape:

1. **CEO env-based login** (original setup) — `process.env.AUTH_USERNAME` / `AUTH_PASSWORD`, constant-time compared. Returns `{ id: "ceo", name, role: "admin" }`.
2. **Supabase-backed users** — any row in the `dashboard_users` table (in the **`yfd-workflow`** Supabase project, id `xbjxrvqydcbwldnrexqu` — reused deliberately to avoid paying for a second project). `authorize()` looks the submitted value up by `username` then by `email` (via `getSupabaseAdmin()`, which uses the service role key and bypasses RLS for this internal lookup), then verifies the password with `supabaseClient.auth.signInWithPassword`. Returns `{ id, name: username, email, role }` from the `dashboard_users` row.

Both paths flow through the same `jwt`/`session` callbacks in `auth.config.ts`, which carry `role` (`"admin" | "user"`) onto the session (see `types/next-auth.d.ts` for the module augmentation — note the `JWT` interface has to be augmented against `@auth/core/jwt`, not `next-auth/jwt`, since that's where next-auth's re-export actually originates; augmenting the wrong module silently no-ops and `token.role` falls back to `unknown` via the `Record<string, unknown>` base the real interface extends).

`app/(dashboard)/page.tsx`'s root redirect now checks `session.user.role === "admin"` (not an exact username match), so **any** admin `dashboard_users` row lands on `/personal` exactly like the CEO account does.

Key implementation detail: `lib/supabase.ts` lazily constructs its Supabase clients (`getSupabaseClient()`, `getSupabaseAdmin()`) instead of throwing at module import time. `auth.ts` imports this module on every request via the Credentials provider, so if it threw eagerly on a missing env var, it would take down the *entire* login flow — including the CEO's env-var path — not just the Supabase path. `isSupabaseConfigured()` + try/catch in `verifyDashboardUserPassword` mean a misconfigured/absent Supabase env simply makes path 2 a no-op; path 1 (CEO) is unaffected.

The old `POST /api/auth/login` endpoint (a separate, disconnected Supabase-only login that nothing in the UI called) has been deleted — it predated this fix and would have been confusing to leave alongside the real flow.

**To add a new admin user (e.g. Kim):** go to `/settings` → **Dashboard Users** tab (or `/settings/users` directly) → **Add New User** → email `kim@focablyed.com`, username `kim`, set a password, role **Admin**. She can then sign in at `/login` with that username (or her email) and password, and will land on `/personal` with full access, same as the CEO.

**Not yet done:** no UI for deleting/editing existing `dashboard_users` rows or resetting a forgotten password — only create + list exist today (`app/api/admin/users/route.ts`).

---

## 8. Environment Variables (current, full list)

See `.env.example` in repo root for the authoritative list with comments. Summary:

```bash
# Auth (NextAuth — currently the only login that actually works)
AUTH_SECRET=
AUTH_USERNAME=
AUTH_PASSWORD=

# Supabase (dashboard user management — see §7, wired into the real login)
NEXT_PUBLIC_SUPABASE_URL=          # yfd-workflow project: https://xbjxrvqydcbwldnrexqu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# XPM / Xero (practicemanager API v3.1 — v3.0 is XML-only, breaks lib/xpm.ts)
XPM_CLIENT_ID=
XPM_CLIENT_SECRET=
XPM_REFRESH_TOKEN=
XPM_TENANT_ID=
XPM_BASE_URL=https://api.xero.com/practicemanager/3.1

# Karbon
KARBON_API_KEY=
KARBON_ACCESS_KEY=                 # only needed for Karbon v3
KARBON_BASE_URL=https://api.karbonhq.com/v3
KARBON_BAS_WORK_TYPE=              # exact label from Karbon → Settings → Work Types

# Redis (attach an Upstash integration in Vercel's Storage tab — auto-populates this)
REDIS_URL=

# HubSpot
HUBSPOT_ACCESS_TOKEN=
HUBSPOT_PORTAL_ID=

# Google Cloud (Search Console + GA4) — service account JWT, hand-rolled (not the googleapis SDK)
GOOGLE_PROJECT_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY_BASE64=         # cat private-key.txt | base64 -w 0
SITEMARGIN_GA4_PROPERTY_ID=
FOCABLYED_GA4_PROPERTY_ID=         # not yet set — FocablyED web metrics show "Not yet configured"

# Product Supabase projects (separate from yfd-workflow, one per product)
SUPABASE_FOCABLY_URL=
SUPABASE_FOCABLY_SERVICE_KEY=
SUPABASE_SITEMARGIN_URL=
SUPABASE_SITEMARGIN_SERVICE_KEY=
```

All of these live in Vercel → Project Settings → Environment Variables. Redeploy required after changing any.

---

## 9. Gotchas / Lessons Learned

- **Google JWT auth**: `secretOrPrivateKey must be an asymmetric key when using RS256` almost always means the base64-encoded key is wrong/corrupted, not a code bug. Verify with `/api/google/diagnose` first. A 403 `PERMISSION_DENIED` from the Analytics/Search Console API (as opposed to a 400 on the token exchange) means auth succeeded but the service account (`yfd-dashboard@yfd-dashbaord.iam.gserviceaccount.com` — note the org's own typo, "dashbaord", is baked into the real account, don't "fix" it) needs to be granted access inside Google Analytics/Search Console property permissions, not a code fix.
- **Turbopack build errors** surface immediately on `next build` for any missing local import (e.g. missing `components/ui/skeleton.tsx`) — check `components/ui/` has every primitive a component imports before assuming an env/config issue.
- **XPM API version**: must be v3.1 for JSON responses.
- Two *separate* Supabase concerns exist in this codebase — don't conflate them: (1) product data stores for FocablyED/SiteMargin metrics (`lib/focably.ts`, `lib/sitemargin.ts`), and (2) the `yfd-workflow` project used for dashboard user management (`lib/supabase.ts`). They use different env var names and different projects.
- **NextAuth `JWT` module augmentation** must target `@auth/core/jwt`, not `next-auth/jwt` — the latter is just a re-export (`export * from "@auth/core/jwt"`), and TypeScript module augmentation doesn't follow re-exports. Augmenting the wrong specifier compiles with no error but silently does nothing; the symptom is a custom token field typing as `unknown` (falling back to the `Record<string, unknown>` index signature the real `JWT` interface extends) instead of your declared type.
- `lib/supabase.ts` must never throw at import time — it's imported by `auth.ts`, which runs on every request. A module-level `if (!url) throw` here would take down the CEO's env-var login path too, not just the Supabase path. Always lazy-init (function-based getters) for anything imported by the auth module.

---

## 10. Future / Not Yet Built

- FocablyED Search Console + GA4 (needs domain verification + GA4 property ID).
- Role-based read-only access (currently "full access" is the only tier discussed; `dashboard_users.role` already supports a `"user"` value but nothing in the app treats it differently from `"admin"` yet).
- UI for deleting/editing `dashboard_users` rows or resetting a password (only create + list exist).
- Mobile responsive layout — not yet tested/optimized.
- Email/Slack daily digest.

---

*Keep this file at repo root as `CONTEXT.md`, update it whenever a new chat picks up meaningful work.*
