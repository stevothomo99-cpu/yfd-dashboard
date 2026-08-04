# YFD Dashboard — Project Context Document

**Version:** 4.0
**Last updated:** 4 August 2026
**Owner:** CEO (Steve Thomas), Your Finance Department (YFD)
**Purpose:** Full context for any developer or AI coding assistant picking up this project. Describes what is **actually built and deployed**, not a spec or plan.

v3.0 described the XPM-native practice-management system replacing Karbon. v4.0 keeps that architecture and records a large round of correctness work on top of it: the timesheet figures were wrong in three independent ways (§4.1, §6.1), a client's Manager was being inferred rather than read (§6), and the XPM client silently dropped data under rate limiting (§4.1). Those are documented in detail because each was expensive to find and none of them looked like a bug from the UI — they looked like plausible numbers.

---

## 1. Project Overview

Two things live in one Next.js app:

1. **An internal practice-management tool** (`/my-work`, `/clients`, `/timesheets`, `/dashboard`) — replaces Karbon. Real staff/customers/jobs synced from Xero Practice Manager (XPM); tasks, notes, files, and task templates are native to this app. Role-based scoping (Partner/Manager/Staff) governs who can see and edit what. Multiple real users log in (not just the CEO) via a proper account system with password reset and admin user management.
2. **Business KPIs** (`/personal`, admin-only) — the original CEO-facing page: HubSpot pipeline, Xero Accounting revenue, Google Search Console/GA4 web metrics, FocablyED/SiteMargin churn. Still mostly Tailwind-styled (legacy), unlike the rest of the app.

Repo: `stevothomo99-cpu/yfd-dashboard`. Deploys to Vercel on every push to `main`.

---

## 2. Tech Stack (as built)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript |
| Styling | **Inline `style={{...}}` is the convention everywhere except `/personal`**, which stays Tailwind (legacy, never migrated). Don't introduce Tailwind classes into workflow pages or vice versa. |
| Middleware | This Next.js version renamed `middleware.ts` → **`proxy.ts`** (see `node_modules/next/dist/docs/`) — that's where the NextAuth `authorized` callback is actually wired up, not a top-level `middleware.ts`. |
| Auth | NextAuth v5 beta, Credentials provider (`auth.ts`) backed entirely by `dashboard_users` (Supabase Auth for password storage) — see §7. |
| Database | Supabase Postgres, project **`yfd-workflow`** (id `xbjxrvqydcbwldnrexqu`) — dashboard_users, staff, customers, jobs, tasks, and everything else in §6. RLS enabled with no policies on every table; all access goes through the service-role client (`lib/supabase.ts`'s `getSupabaseAdmin()`). Separate Supabase projects exist per-product for FocablyED/SiteMargin metrics (§4.5/4.6) — don't conflate them. |
| Cache | Redis via `ioredis` (`REDIS_URL`, e.g. Upstash attached in Vercel's Storage tab). In-memory `Map` fallback in dev if unset. **Cache only** — nothing is stored solely in Redis any more (see §6.2). Supports stale-while-revalidate (`cachedSWR`/`cachedEncryptedSWR`), which serves an expired value and refreshes after the response via `next/server`'s `after()`. |
| Outbound email | Resend — two separate integrations: Supabase Auth's own SMTP relay (password reset emails) and `lib/resend.ts` (our own backend's transactional emails, e.g. to-do notifications). Same API key, genuinely separate wiring — see §7 and §4.8. |
| Inbound email | Resend's Inbound feature (webhook-based) — see §4.8. |
| Hosting | Vercel — repo push = deploy |

---

## 3. Current Routes

| Route | Who sees it | Purpose |
|---|---|---|
| `/login` | public | Credentials login (username or email + password, optional TOTP step) |
| `/forgot-password` → `/reset-password` | public | Self-service password reset via Supabase Auth's recovery email |
| `/change-password` | any logged-in user | Voluntary password change; also where a forced first-login change lands (see §7) |
| `/dashboard` | everyone | Personal "Work overview" — BAS status, overdue work items, billable utilisation tile, and **two To-Do tiles** side by side at 2:1 — confirmed items (Complete/Edit/Discard, sortable columns) and a to-confirm triage queue (see §4.8) |
| `/my-work` | everyone | Karbon-style flat task table, scoped by Partner/Manager/Staff hierarchy (own tasks for Staff, team's for Manager, practice-wide for Partner); admin gets a "viewing as" staff-switcher others don't |
| `/clients` | everyone | Tile grid — one tile per client, hours logged + revenue for a This Week/Month/Quarter/FY **or custom From/To** slicer, summary bar (Clients/Hours/Revenue/$-per-hr). Click a tile to open the Client drawer (jobs, tasks, notes, files, copy-task, save/apply template) |
| `/timesheets` | everyone | Utilisation by period (fixed buttons **or custom From/To**), collapsible practice-wide "Time by client" list, and a **By employee** table — each row expandable to that person's own client breakdown. Two percentages side by side on purpose — see §6.1 |
| `/personal` | admin only | Business KPIs — see §5, mostly unchanged from v2.0 |
| `/team`, `/leaderboard` | admin only | Legacy, largely unchanged from v2.0 |
| `/tasks`, `/bas` | nobody (unlinked) | Old Karbon-only pages, deliberately not removed but not in nav either ("quarantined") |
| `/settings` | admin only, **now server-enforced on every sub-route** | Staff & Sync (Partner dropdown + "Save & resync", legacy Karbon roster refresh), Dashboard Users (create/list/**pause**/**remove**), My Security (MFA) |

Nav itself (`components/layout/TopNav.tsx`) computes `isAdmin` once in `app/(dashboard)/layout.tsx` and conditionally includes Business KPIs/Team/Leaderboard/Settings — Dashboard/My Work/Clients/Timesheets are always shown.

---

## 4. API Routes & Data Sources

### 4.1 XPM (Xero Practice Manager) — `lib/xpm.ts`
OAuth 2.0, auto-refreshed. `XpmNotConfiguredError` thrown/caught throughout so pages degrade gracefully rather than crash. **Must be v3.1** (`XPM_BASE_URL=https://api.xero.com/practicemanager/3.1`) — v3.0 only returns XML.

Two undocumented-until-tested API quirks, both handled by paging across rolling ~360-day windows (`rollingWindowBounds`, shared helper):
- `job.api/list` requires `from`/`to` (yyyyMMdd), span < 1 year.
- `invoice.api/list` has the exact same constraint — this was missing entirely at one point and 400'd in production before being fixed.

**Rate limiting is the single most damaging failure mode in this integration, because it loses data silently rather than erroring.** Xero allows ~5 concurrent requests per tenant. Three separate places fanned out past that — 8 job-list windows in one `Promise.all`, one `time.api` call per staff member in another, plus invoice windows — and the surplus came back `429`. Since `fetchXpmTimesheetsForPartner` catches per staff member (correctly: one person's failure shouldn't sink the whole load), a throttled call became *"that person logged no hours"*. Joshua Manzano's 153 logged hours — the most in the practice — read as 0.0, and the practice total was ~35% short. Which staff lost the race was arbitrary, so the output looked plausible.

Now enforced structurally rather than per call site:
- **`xpmFetch` holds a global concurrency gate** (4 concurrent, module-level semaphore) in front of *every* XPM request. Throttling individual call sites doesn't work — the fan-outs sit at different levels and their totals still collide. New call sites are covered automatically.
- **`xpmFetch` retries 429/5xx** with backoff, honouring `Retry-After` **capped at 2s**. Uncapped it caused the opposite failure: Xero can request thousands of seconds on a daily-limit breach, and sleeping that long inside a request overruns the function timeout, which presents as the sync hanging forever.
- **`fetchAllInProgressXpmJobs` stops paging early**, after two consecutive empty windows instead of always issuing 8. It was reaching back to 2018 for a practice whose oldest open job is mid-2024 — mostly guaranteed-empty calls spending rate-limit budget and making the useful ones fail.
- The four heavy XPM routes declare `maxDuration`, since throttled requests can no longer overlap their way under the default timeout.

**Client roster has no date dependency at all** (`client.api/list`, no date params) — only jobs/invoices are windowed. A client is "ours" if `isArchived !== "Yes" && isDeleted !== "Yes" && accountManager?.name === <Partner name in Settings>`. **Account Manager is a validated dropdown in XPM but is only *required* at the job level, not the client level** — a client can exist with no Account Manager set at all, and it will be silently invisible to this app's sync (indistinguishable from a real exclusion). `GET /api/xpm/client-allocations` (admin-only, unlinked) is a standing audit tool for exactly this: lists every active XPM client with its Account Manager/Job Manager, sorted so unallocated ones surface first.

Real XPM Tax Returns / Activity Statement lodgment status (Draft/To Sign/Filed/etc., shown in XPM's own Tax > Returns screen) is **not exposed by any public XPM API** — confirmed via Xero's own Developer Ideas forum, where getting this is still an open feature request. Don't attempt to build against it; there's nothing to call.

| Endpoint | Fetches |
|---|---|
| `POST /api/xpm/sync-workflow` | Full-replace sync of staff/customers/jobs from XPM into Supabase (`lib/xpmSync.ts`) — admin-gated, triggered manually from Settings → Staff & Sync |
| `GET /api/xpm/timesheets` | Raw time entries for the configured Partner's staff |
| `GET /api/xpm/client-allocations` | Admin audit report, Partner-scoped and gap-first: your clients with no Job Manager, then clients with no Account Manager at all, then healthy ones, then other Partners'. `?partner=` overrides; Account Manager chips show client counts so a name that doesn't match XPM's spelling is obvious. Reads live from XPM deliberately — the gaps it exists to find are the rows that never reached `customers` |
| `GET /api/xpm/timesheet-gaps` | Admin report explaining why someone reads as zero hours. Separates the three causes that look identical on `/timesheets`: logged nothing / `time.api` call failed / logged time discarded because its job isn't in the Partner's job list. Reports raw entry count, hours counted, hours discarded, and which jobs the discarded time was on |
| `GET /api/xpm/diagnose` | Debug endpoint, raw API response samples |

### 4.2 Xero Accounting (revenue) — `lib/xeroAccounting.ts`
A completely separate Xero product/connection from Practice Manager — connects to YFD's own Xero Accounting organisation (real invoicing), not the Practice Manager tenant. One-time OAuth bootstrap: `/api/xero-accounting/authorize` (admin-gated) → `/api/xero-accounting/callback`.

- Scopes: `offline_access accounting.contacts.read accounting.invoices.read`. **`accounting.transactions.read` (the old bundle scope) does not exist in this app's granted scope catalog** — Xero replaced it with granular per-resource scopes; using the old one produces `invalid_scope`.
- **`where` + `summaryOnly=true` together on `/Invoices` returns a 400** ("filter unavailable with summaryOnly flag") once the `where` clause includes a Date range/Status condition — confirmed live. Full invoice bodies are fetched instead, paged at Xero's default 100/page (`fetchAllInvoicesInRange`).
- Revenue = `SubTotal` (ex-GST) on ACCREC invoices in AUTHORISED/PAID status, matched to XPM clients by **exact contact name** (no stored link between the two systems).
- **FY means the Australian financial year (1 Jul–30 Jun)** everywhere in this app except one place that was wrong: the `/personal` Sales tile's "YTD" used to mean calendar-year-to-date, which didn't match anything else and has been fixed/relabelled to "FY".

| Endpoint | Fetches |
|---|---|
| `GET/POST /api/xero-accounting/sales` | `/personal` "YFD — Sales" tile: Month + FY revenue, Month + FY billable hours (from XPM timesheets, practice-wide), and the derived $/hr for each |
| `GET /api/xero-accounting/diagnose` | Admin debug — supports `?tenantIds=a,b` to compare multiple candidate Xero orgs directly (org name + invoice count) when it's unclear which one is the real invoicing file |

`fetchRevenueByClientName`/`getRevenueByClientName` (15-min cached, stale-while-revalidate) feed `/clients`' per-tile and summary-bar revenue figures, prefetched server-side for all four period buttons at once — which is why that slicer feels instant. A **custom** range can't be prefetched, so `/clients` fetches it from `GET /api/xero-accounting/revenue-by-client?from=&to=` on demand, through the same cached loader. The response is keyed by its range and only read when the key matches the current selection, so a slow reply for a range the user has moved on from can't be mistaken for the current one.

### 4.3 Karbon — `lib/karbon.ts`
Bearer token. Legacy — `/tasks` and `/bas` (unlinked pages) are the only remaining consumers.

### 4.4 HubSpot — `lib/hubspot.ts`
Unchanged from v2.0 — `GET/POST /api/hubspot/deals`, feeds `/personal` Sales Pipeline.

### 4.5 Google Search Console + GA4 — `lib/google.ts`
Unchanged from v2.0 — hand-rolled JWT service-account auth, feeds `/personal` Web Metrics.

### 4.6 FocablyED / 4.7 SiteMargin
Unchanged from v2.0 — own Supabase projects, `lib/focably.ts`/`lib/sitemargin.ts`.

### 4.8 Resend — `lib/resend.ts`, `app/api/email/inbound/route.ts`
Two independent integration points, both now on the **same dedicated Resend account** for `dashboard.yourfinancedept.com.au` (a prior version of this used a second Resend account tied to SiteMargin for outbound only — since replaced, don't reintroduce that split without reason):

1. **Outbound, our own backend** (`lib/resend.ts`) — used for To-Do notification emails. Needs `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (`noreply@dashboard.yourfinancedept.com.au`). **This is separate from Supabase's SMTP settings** (§7) — configuring one does nothing for the other. This same API key is also what's entered as Supabase Auth's SMTP password (§7), with the same sender address.
2. **Inbound webhook** (`/api/email/inbound`) — powers the "email-to-todo" feature. Needs `RESEND_INBOUND_API_KEY` — a separate env var from `RESEND_API_KEY` above for historical reasons (kept as two names in case outbound and inbound ever need to split across accounts again), but currently the **same account's key** as `RESEND_API_KEY`. Forward an email to `TODO_INBOUND_EMAIL` — `todo@dashboard.yourfinancedept.com.au`, a dedicated **subdomain**, not the bare domain, so Resend's inbound MX records don't override `yourfinancedept.com.au`'s real Microsoft 365 mail — and it creates a lightweight **To-Do item** (`todo_items` table — see §6) shown on `/dashboard`.
   - **Owner resolution**: if the shared address is in the email's **To** field, the owner is whoever sent it (self to-do). If it's only in **Cc** (someone Cc's the shared address while emailing a colleague directly), the owner is whoever's in **To** instead (delegated to-do) — lets Steve forward work to someone else without it landing on his own dashboard. Multiple To recipients that match staff each get their own item.
   - The webhook payload (`email.received` event) carries metadata (from/to/cc/subject) but **not the body** — the full text is fetched separately via `resend.emails.receiving.get(email_id)`.
   - **Signature verification uses `resend.webhooks.verify()`**, which needs the raw (unparsed) request body and the three `svix-id`/`svix-timestamp`/`svix-signature` headers passed as a plain `{id, timestamp, signature}` object — the SDK's `Headers` type here is its own interface, **not** the Fetch API `Headers` object; passing `request.headers` directly is a type error.
   - A to-do stays lightweight (client + due date) if the owner sets it as one-off; if they set a recurrence, it's promoted into a real Task instead (auto-picks the job like New Task's client-first flow does) since recurring work needs the full Task machinery.
   - **Renaming**: `todo_items.title` (migration 013) overrides the display name; null means never renamed and falls back to `subject`. Deliberately a separate column — `subject` is the forwarded email's actual Subject header and remains the record of where the item came from. Always read the name through `todoDisplayName()` in `lib/utils.ts`, including when converting to a Task (that path hardcoded `todo.subject` and would otherwise silently revert a rename). Search matches both, so a renamed item is still findable by its original subject.
   - **Editing is a distinct API intent from populating** (`{intent: "edit"}` → `updateTodoItemDetails`): it changes client/due date while preserving status, so editing a completed item doesn't silently reopen it. `populateTodoItem` forces status back to `todo`, which is right when triaging and wrong when editing. The Edit modal omits recurrence — converting an existing to-do into a Task from a button labelled "Edit" would be a surprising thing for that button to do.
   - Needs manual setup once deployed: Resend Inbound enabled (MX records) on the `dashboard.yourfinancedept.com.au` subdomain, a webhook registered pointing at `/api/email/inbound` for the `email.received` event, and `RESEND_WEBHOOK_SECRET` set from that.
   - `/api/email/inbound` is a public webhook (Resend can't authenticate as a logged-in user) verified via signature instead of a session — it must stay excluded from `proxy.ts`'s auth matcher alongside `api/auth`, or every delivery gets redirected to `/login` before the route ever runs (this shipped broken once already — see §9).

---

## 5. `/personal` Dashboard — Current Layout

Unchanged from v2.0 except the YFD Sales tile (§4.2): Sales Pipeline (3-col: FocablyED/SiteMargin HubSpot KPIs + YFD Xero Accounting tile with Month/FY revenue, hours, $/hr), Web Metrics (SiteMargin + FocablyED, 24h/week/month selector), User & Churn Metrics, manual Refresh button.

---

## 6. Workflow System — staff/customers/jobs/tasks

The Karbon-replacement data model, all in the `yfd-workflow` Supabase project, all accessed via `lib/workflow.ts` (the single data-access layer for this section) unless noted.

**Two separate role systems — do not conflate them:**
1. `dashboard_users.role`: `"admin" | "user"` — a login-level flag, gates nav and gives full bypass everywhere (task permissions, To-Do visibility, etc.).
2. `staff.role`: `"Partner" | "Manager" | "Staff"` — XPM-derived work hierarchy. **`jobs.manager_id` is actually populated by "Staff"-role people's ids**, not "Manager" — confirmed directly against the practice; the schema's "Manager" tier is effectively vestigial. A Staff-role person's own board = `getInProgressJobsForManager(staff.id)`.

**Client allocations**: a client carries **both** of its XPM allocations on its own row — `customers.partner_id` (XPM `accountManager`) and `customers.manager_id` (XPM `jobManager`). `/clients` reads the Manager from `customers.manager_id`, *not* by aggregating its jobs' managers: doing that showed "Multiple" for any client whose work is legitimately split across service lines (a bookkeeper on the BAS jobs, an advisor on the CFO job), and let stale legacy jobs keep listing managers who no longer look after the client. `jobs.manager_id` still exists and still drives each person's own work board — a job's own manager, falling back to its client's.

**Tables**: `staff`, `customers`, `jobs`, `tasks`, `statuses`, `task_types`, `customer_notes`, `customer_files`, `task_templates` + `task_template_items`, `todo_items` (§4.8). Only staff/customers/jobs are XPM-synced (full-replace, `lib/xpmSync.ts`); everything else is native to this app.

**Task permissions** (`getJobsInScopeForStaff`, `canModifyTask` in `lib/workflow.ts`):
- Non-admin create: only on jobs in scope (their own managed jobs for Staff/Manager, whole roll-up for Partner).
- Non-admin edit/delete/reassign: only tasks already on their own board (`getWorkBoardForStaff`); reassigning to a different job re-checks scope.
- Admin: unrestricted everywhere.

**New Task creation is client-first**, not job-first — the modal groups the caller's already-scoped job list by client, auto-selecting the job if there's only one, only showing a job sub-picker when a client has several (avoids exposing a flat "Client — Job Name" list where multi-year recurring jobs made the same client show up many times).

**Notes** (`customer_notes`) support an optional `title` and a `pinned` boolean (pinned sort first, then newest-first).

**Copy task / templates**: a task can be copied onto another client/job (fresh due date, unassigned, default open status). A client's current tasks can be saved as a named, reusable template (title/type/recurrence only — not dates/assignee/status) and bulk-applied to any job.

**To-Do items** (`todo_items`, §4.8): distinct from Tasks — no job/status/type, just owner/client/due-date/title, created from forwarded emails. `status`: `pending_triage` (needs client+due date) → `todo`/`done` (populated one-off) or `converted` (became a real Task).

**Note**: the `tasks` table is currently **empty**. Everything task-related — `/my-work`, To-Do→Task conversion, templates, copy-task — is built but carrying no data yet.

---

## 6.1 Timesheet & utilisation definitions

Getting these wrong produced three separate rounds of "the dashboard is broken" when it was mostly measuring something other than what was assumed. All of it lives in `lib/workOverview.ts`.

**Utilisation is everything except idle, against a 7.6hr day** (38hr/5). The internal client's time is not one lump: alongside `YFD - Idle` it carries `YFD - General Admin`, `YFD - Team Meeting - Paid` and leave — all paid time nobody can be marked down for. Bucketing everything internal-and-not-leave as idle wrote off 54 of 71 internal hours in Jul–Aug 2026 and understated the practice by 12 points. Idle is now identified **on its own** (`isIdleTask`, task name containing "idle") rather than by elimination, so a renamed variant can't quietly start counting as productive; everything else internal lands in `internalOtherHours` and counts.

**Capacity is counted to today, never to the end of the period.** Logged hours are to-date, so measuring them against a whole period's capacity compares to-date effort with a not-yet-elapsed denominator — on 27 Jul the FY tile divided ~4 weeks of work by a full year (261 weekdays × 7.6 × 4 staff = 7934.4 std hrs) and reported 2% instead of 34%.

**Two percentages are shown side by side, on purpose.** They have different denominators and will never agree:
| Tile | Denominator | Answers |
|---|---|---|
| Capacity used | available capacity to date | is the team's time accounted for (falls on under-logging or spare capacity) |
| Billable share | time actually logged | **this is the figure XPM's own Staff Time Summary Report calls %**, and the same basis as the per-employee column |

For 6 Jul – 2 Aug those read 65% and 81% off identical data. Comparing the wrong one against XPM's report wastes an afternoon.

**Partners are excluded from practice-wide figures** (`staff.role !== "Partner"`, decided in `timesheets/page.tsx`) — both their hours and their capacity, so time they do log can't inflate it either. A Partner carries no delivery workload; one in a team of four dragged the practice percentage down by a quarter. They still appear in the By employee table. Note neither pre-existing mechanism could do this: **`staff.included` is hardcoded `true` by the sync** (effectively a dead column) and **`settings.excludedStaffIds` is only read by the legacy Karbon routes** — neither reaches `/timesheets`.

**Custom date ranges**: `DateRange`/`PeriodSelection` — the compute functions take either a period key or an explicit range, so existing callers are unaffected. Bounds are inclusive; a range extending past today still counts capacity only to today; reversed dates are swapped; a half-filled range falls back rather than measuring an open-ended window; a range with no weekdays yields 0% not `NaN`.

**`XpmTimesheet.billable` is never read.** "Billable" throughout means *client-coded* (not against the internal client). The two coincide in current data, so figures reconcile with XPM — but they are different fields and could diverge.

---

## 6.2 Settings storage

`app_settings` (migration 015, single row, `id = 1`) is the **source of truth**; Redis is a cache in front of it with a 5-minute TTL and write-through on update.

This was previously Redis-only with no TTL and nothing behind it. That holds until the cache doesn't: an eviction, a flush or swapping the Upstash instance silently blanked `partnerName` — and since that value scopes which clients, jobs and staff the entire app can see, losing it empties the practice while presenting as "Set a Partner name in Settings", indistinguishable from a genuine first run.

`updateSettings` reads straight from Postgres before merging, bypassing both the request memo and the cache, so a read-modify-write can't drop a concurrent change to the other field. A database read error is **thrown, not defaulted** — returning an empty Partner would look exactly like "not configured yet".

---

## 7. Auth

Single NextAuth `Credentials` provider (`auth.ts`), entirely backed by the `dashboard_users` table — **there is no separate CEO env-var login anymore** (that was v2.0; removed in favour of dashboard_users covering everyone, including the CEO).

- **Password storage**: real passwords live in **Supabase Auth** (`auth.users`), not a column on `dashboard_users`. `verifyDashboardUserPassword` looks up the profile row (by username, falling back to email) then calls `supabase.auth.signInWithPassword`. Creating/updating a user's password goes through `supabaseAdmin.auth.admin.createUser`/`updateUserById`.
- **MFA**: optional TOTP, `lib/mfa.ts` + `getMfaSecret`/`enableMfa`/`disableMfa` in `lib/supabase.ts`. Login is a two-step flow (`/api/auth/mfa-check` pre-validates credentials and reports whether a code is needed, before ever calling NextAuth's `signIn`).
- **Forced first-login password change**: `dashboard_users.must_change_password` is set `true` whenever an admin creates a user (they picked the initial password). `auth.config.ts`'s `authorized` callback redirects to `/change-password` whenever this flag is true, except for `/change-password` itself and its API route (else redirect-loop). Cleared once the user sets their own password.
- **Self-service forgot/reset password**: `/forgot-password` triggers Supabase Auth's own recovery email (`resetPasswordForEmail`) — **this depends on Supabase's SMTP being configured** (Authentication → Emails → SMTP Settings; the built-in default email service is rate-limited and not meant for production). `/reset-password` uses a **separate, fresh browser Supabase client** (not `lib/supabase.ts`'s shared one, which sets `persistSession: false` and would break session detection) to pick up the recovery session — handles both PKCE (`?code=`) and implicit (`#access_token=`) flows since it wasn't obvious which one Supabase would use until tested. Also clears `must_change_password` if it was set.
- **Pause/remove users**: Settings → Dashboard Users has per-row **Pause** (sets `dashboard_users.suspended`, checked in `verifyDashboardUserPassword` before even touching Supabase Auth — fully reversible via Resume) and **Remove** (deletes both the `dashboard_users` row and the underlying Supabase Auth account — irreversible). Both block an admin from acting on their own account, both confirm before executing.
- **Type augmentation** (`types/next-auth.d.ts`): `role` and `mustChangePassword` on `User`/`Session`/`JWT`. Must augment `@auth/core/jwt`, not `next-auth/jwt` (the latter is just a re-export; TS module augmentation doesn't follow re-exports — augmenting the wrong one compiles fine but silently no-ops).

**To add a new user**: Settings → Dashboard Users → Add New User → email, username, a temporary password (they'll be forced to change it), role. To remove a user's access: Pause (reversible) or Remove (permanent) from the same table.

---

## 8. Environment Variables (current, full list)

See `.env.example` for the authoritative list with comments. Summary of what's new/changed since v2.0 — full XPM/HubSpot/Google/product-Supabase blocks are unchanged:

```bash
# XPM token encryption (shared by XPM and Xero Accounting token caches)
XPM_TOKEN_ENCRYPTION_KEY=          # openssl rand -base64 32

# Xero Accounting (separate connection from XPM — see §4.2)
XERO_ACCOUNTING_CLIENT_ID=
XERO_ACCOUNTING_CLIENT_SECRET=
XERO_ACCOUNTING_REFRESH_TOKEN=
XERO_ACCOUNTING_TENANT_ID=

# Resend — outbound (transactional email — see §4.8)
RESEND_API_KEY=
RESEND_FROM_EMAIL=                 # e.g. "YFD Dashboard <noreply@dashboard.yourfinancedept.com.au>"

# Resend — inbound (email-to-todo — see §4.8). Same account/key as
# RESEND_API_KEY above -- kept as a separate env var name in case outbound
# and inbound ever need to split across accounts again.
RESEND_INBOUND_API_KEY=
RESEND_WEBHOOK_SECRET=             # from the inbound webhook's Resend dashboard config
TODO_INBOUND_EMAIL=                # todo@dashboard.yourfinancedept.com.au (subdomain, not the bare domain)
```

All live in Vercel → Project Settings → Environment Variables. Redeploy required after changing any. No new variables were added in v4.0 — the Partner filter moved from Redis to Postgres (§6.2), not to an env var.

---

## 9. Gotchas / Lessons Learned

- **`middleware.ts` is `proxy.ts` in this Next.js version.** If route-protection behaviour seems wrong, check `proxy.ts` first — there is no top-level `middleware.ts` file at all.
- **XPM date-windowed endpoints** (`job.api/list`, `invoice.api/list`) both need `from`/`to` under a year apart, discovered one 400 at a time. **The client roster (`client.api/list`) has no date dependency** — don't assume a client-sync gap is a date-window issue; check its Account Manager/archived flags instead.
- **A client can have no Account Manager set in XPM at all** (only required at the job level) — this silently excludes the client from the whole sync, indistinguishable in our data from a deliberate exclusion. Use `/api/xpm/client-allocations` to audit.
- **XPM Tax Returns/Activity Statement status has no public API** — don't build against it, there's nothing to call (confirmed via Xero's own Developer Ideas forum).
- **Xero Accounting**: `where` + `summaryOnly=true` together 400s once the filter includes Date/Status conditions. `accounting.transactions.read` doesn't exist in the granted scope catalog — use the granular `accounting.invoices.read`/`accounting.contacts.read` instead.
- **FY = 1 Jul–30 Jun everywhere** in this app. A tile/route that says "YTD" and means calendar-year is a bug, not a valid alternate convention — this exact mistake shipped once and had to be fixed.
- **Google JWT auth / Turbopack build errors / NextAuth JWT module augmentation** — see v2.0 notes, still accurate, unchanged.
- **Resend webhook verification** needs the RAW request body (parsing as JSON first breaks the signature) and its own `{id, timestamp, signature}` header shape — not the Fetch API `Headers` object despite the SDK naming a type `Headers`.
- **Supabase's SMTP settings only affect Supabase Auth's own emails** (password reset, etc.) — sending email from our own backend code (e.g. To-Do notifications) requires a second, separate integration via the Resend SDK directly (`lib/resend.ts`), same API key or not.
- A reset-password page needs its **own** browser Supabase client instance (not the shared server-oriented one with `persistSession: false`), or session/recovery-token detection silently doesn't work.
- **`lib/supabase.ts` must never throw at import time** — `auth.ts` imports it on every request. Always lazy-init. **`lib/google.ts` violated this** and was fixed in v4.0: it built credentials in a module-level `const`, so importing it threw when `GOOGLE_PRIVATE_KEY_BASE64` was unset and took down `next build` at page-data collection rather than failing the one route that needed Google.
- **XPM rate limiting loses data silently, it does not error.** See §4.1. Never add an unthrottled `Promise.all` over XPM calls — `xpmFetch` gates concurrency globally, so just call it. And never honour `Retry-After` uncapped inside a request.
- **A per-item `catch` that returns an empty array converts a failure into believable missing data.** This is why a whole staff member's timesheet vanished without a trace. The catch was right; the silence wasn't. Log it.
- **The workflow sync does not refresh everything XPM-derived.** It rebuilds `staff`/`customers`/`jobs` in Postgres, but timesheets are served from the `xpm:timesheets:<partner>` cache. It now invalidates that cache explicitly — without it, a sync left stale (possibly rate-limit-truncated) hours in place, which reads as "I synced and the numbers are still wrong".
- **Categories defined by elimination are a trap.** Idle was "internal and not leave", which swallowed paid admin and meeting time (§6.1). `getClientSummaries`'s "Multiple" manager was inferred from a client's jobs rather than read from the client (§6). Both looked like data problems and were definition problems.
- **Two buttons whose labels both mean "sync from XPM" cost real debugging time.** `/api/xpm/staff` refreshes only the legacy Karbon-linking roster; `/api/xpm/sync-workflow` is the real one. Now labelled "Refresh staff roster" vs "Save & resync clients, jobs, staff", with the real one beside the Partner field. The resync also **saves the Partner first** — previously only the roster button persisted that field, so changing the Partner and pressing resync rebuilt everything against the *old* Partner with no indication anything had been ignored.
- **Vercel deploys lag your testing.** Several rounds of "still wrong" were the previous deployment still serving. Check the retry/backoff numbers or `dep=` in the runtime logs before re-diagnosing.

---

## 10. Future / Not Yet Built

- FocablyED Search Console + GA4 (needs domain verification + GA4 property ID) — unchanged from v2.0.
- Full role-based read-only access — `dashboard_users.role` still only gates nav + a handful of specific checks (task permissions, To-Do visibility, user pause/remove), not a general read-only mode.
- Mobile responsive layout — not yet tested/optimized.
- Sync failure alerts (email an admin if a scheduled XPM/Karbon/Google sync errors silently) — no XPM dependency, not yet built.
- Weekly performance summary / overdue-task digest emails — would reuse the `lib/resend.ts` outbound integration built for To-Do notifications, not yet built.
- **Per-person exclusion from practice figures.** Only Partners are excluded today (§6.1). Excluding a non-Partner needs a real toggle *and* `lib/xpmSync.ts` to stop hardcoding `included: true`, which would otherwise wipe the setting on every sync.
- **Job-level manager gaps in XPM**: ~120 of 493 jobs have no Job Manager (concentrated in a handful of clients). Doesn't affect client tiles, which read the client record, but does affect each person's work board. Fix in XPM, then resync.
- **`/leaderboard` and `/team`** are still Karbon-derived legacy, as are the quarantined `/tasks` and `/bas`.
- **Dependabot backlog**: several open PRs, of which TypeScript 5.9→7.0 and ESLint 9→10 are major versions needing a build check.
- **Three pre-existing lint errors** remain (`settings/users/page.tsx`, `api/hubspot/deals/route.ts`, `lib/hubspot.ts`) — unrelated to v4.0 work, verified as pre-existing.

*Closed in v4.0*: `/api/settings` PATCH and `/api/xpm/staff` now enforce admin server-side; `partnerName` is durably stored (§6.2); `lib/google.ts` no longer throws at import; `getClientSummaries` no longer walks the tasks table per customer.

---

*Keep this file at repo root as `CONTEXT.md`, update it whenever a new chat picks up meaningful work.*
