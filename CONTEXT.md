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

## 7. Known Gap — Multi-user auth is NOT fully wired yet

**This is the most important thing for the next session to know.**

The real dashboard login (`/login` → NextAuth `Credentials` provider in `auth.ts`) still only checks a **single** hardcoded pair: `process.env.AUTH_USERNAME` / `AUTH_PASSWORD`, compared with a constant-time hash check. It does not query Supabase at all.

Separately, we built a **parallel, not-yet-connected** system:
- `lib/supabase.ts` — client using `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (pointed at the existing **`yfd-workflow`** Supabase project, id `xbjxrvqydcbwldnrexqu` — chosen specifically to avoid paying for a second Supabase project)
- `dashboard_users` table (migration in `migrations/001_create_dashboard_users.sql`) — `id`, `email`, `username`, `role` (`admin`|`user`), RLS enabled, already created in that project
- `POST/GET /api/admin/users` — creates a Supabase Auth user + a `dashboard_users` row
- `POST /api/auth/login` — a **separate, unused** login endpoint that calls `supabaseClient.auth.signInWithPassword` and sets its own `auth-token` cookie
- `/settings/users` UI page — lets the CEO add users with a role, backed by the above

**The disconnect:** creating a user via `/settings/users` puts them in Supabase and the `dashboard_users` table, but the actual `/login` page has no idea Supabase exists — it will still reject anyone who isn't `AUTH_USERNAME`/`AUTH_PASSWORD`. So adding Kim (kim@focablyed.com) via the settings UI does **not** currently let her sign into the dashboard.

**What's needed to finish this** (pick up here next):
1. Either (a) add a second `Credentials` provider entry / rewrite `auth.ts`'s `authorize()` to check `dashboard_users` + Supabase Auth instead of/in addition to the env-var pair, or (b) replace NextAuth entirely with Supabase Auth session handling.
2. Decide what should happen to the existing `AUTH_USERNAME`/`AUTH_PASSWORD` CEO login — keep as a fallback, or migrate the CEO into `dashboard_users` too so there's one source of truth.
3. The root `/` redirect logic (`app/(dashboard)/page.tsx`) currently does `session.user.name === process.env.AUTH_USERNAME` to decide CEO vs team landing page — this will need to check `role === 'admin'` from `dashboard_users` instead once unified.
4. Once wired, actually create Kim's user (email `kim@focablyed.com`, role `admin`) and confirm she can log in end to end.

---

## 8. Environment Variables (current, full list)

See `.env.example` in repo root for the authoritative list with comments. Summary:

```bash
# Auth (NextAuth — currently the only login that actually works)
AUTH_SECRET=
AUTH_USERNAME=
AUTH_PASSWORD=

# Supabase (dashboard user management — see §7, not yet wired to real login)
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

---

## 10. Future / Not Yet Built

- Finish wiring multi-user auth into the real login flow (§7 — top priority).
- FocablyED Search Console + GA4 (needs domain verification + GA4 property ID).
- Role-based read-only access (currently "full access" is the only tier discussed).
- Mobile responsive layout — not yet tested/optimized.
- Email/Slack daily digest.

---

*Keep this file at repo root as `CONTEXT.md`, update it whenever a new chat picks up meaningful work — especially closing out §7 once multi-user login actually works end to end.*
