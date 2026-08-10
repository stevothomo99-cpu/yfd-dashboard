# YFD Dashboard — Project Context Document

**Version:** 5.1
**Last updated:** 10 August 2026
**Owner:** CEO (Steve Thomas), Your Finance Department (YFD)
**Purpose:** Full context for any developer or AI coding assistant picking up this project. Describes what is **actually built and deployed**, not a spec or plan.

v3.0 described the XPM-native practice-management system replacing Karbon. v4.0 keeps that architecture and records a large round of correctness work on top of it: the timesheet figures were wrong in three independent ways (§4.1, §6.1), a client's Manager was being inferred rather than read (§6), and the XPM client silently dropped data under rate limiting (§4.1). v4.1 adds a fourth timesheet correction — a billable-share denominator that omitted a bucket, and unlogged hours that were counted nowhere (§6.1). v4.2 removes the last of Karbon from Settings and makes the Included staff toggles actually take effect (§6.3). v4.3 moves tasks/workflow off jobs and onto clients entirely (§6) — the same job-vs-client confusion already fixed once on Manager allocations, this time in the tasks table's own foreign key. v5.0 is one long session's worth of feature work on top of that foundation: a new BAS approval-pipeline page (§6.5), a weekly Monday Report email (§6.4), a task completion audit trail (§6.6), a `/my-work` and `/timesheets` round of polish, and an in-progress `/team`+`/leaderboard` merge that three earlier attempts had failed to land. **v5.0's own "Pick up here" note is closed out in v5.1**: the `/team`+`/leaderboard` merge is done — see §6.7.

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
| `/my-work` | everyone | Task table, scoped by Partner/Manager/Staff hierarchy. Columns are **drag-reorderable and drag-resizable** (session-only, not persisted); default order is Assigned to/Client/Start/Name/Category/Status/Due/Owner. Row actions (Edit/Move to/Combine/Delete) collapse into a single kebab menu per row instead of four inline links. **Clicking a row itself** opens the task edit modal pre-filled (drill-down) — the kebab menu still works independently (stops propagation). Status filter has a date-derived **"Overdue"** option (start-date-based, matching this page's own convention — see §6.6 for why that's deliberately different from the Monday Report's due-date convention) that combines with real statuses. Displayed dates are `DD-MMM-YYYY` via `formatDate()` in `lib/utils.ts` — applied to every read-only date across the app, never to native `<input type="date">` values |
| `/clients` | everyone | Tile grid — one tile per client, hours logged + revenue for a This Week/Month/Quarter/FY **or custom From/To** slicer, summary bar (Clients/Hours/Revenue/$-per-hr). Click a tile to open the Client drawer: Jobs, **Overdue/In progress/Completed/Recurring** task sections (Recurring is a cross-cutting lens — "what's set to recur against this client at all," a task can appear here and in one of the other three), Notes, Files, copy-task, save/apply template. **Clicking a task row drills into the same edit modal `/my-work` uses** (pre-filled; the Copy… button stops propagation) — required threading `staff`/`statuses`/`taskTypes`/a `WorkflowCustomer`-shaped client list down from `page.tsx` into `TileDrawer` |
| `/timesheets` | everyone | Utilisation by period (fixed buttons, **custom From/To**, or **Last week** — same Monday-Sunday math as "This week" shifted back 7 days), collapsible practice-wide "Time by client" list, and a **By employee** table: Billable / Admin·meetings / Leave / Downtime / Unlogged / **% of logged** / **% of capacity** (relabelled from the ambiguous "% log"/"% cap" — see §6.1), plus a **Total row** summing every column so it can be cross-checked against the KPI tiles above by eye. Each row expandable to that person's own client breakdown. Settings gains a **"Show Partners on Timesheets"** toggle (default on) — separate from Partners already not counting toward practice utilisation; this controls whether they show as a row at all |
| `/bas-status` | admin only (nav-gated; page itself has no additional server-side restriction beyond login — see §6.5) | **New in v5.0.** BAS/IAS approval pipeline: three tiles (Pending / Ready for Approval / Waiting on Customer), bidirectional moves with a collapsible per-card history log, coloured by stage and by overdue, sortable per-column (due date or client name A-Z), searchable by client, click-through to the same task edit modal. See §6.5 |
| `/personal` | admin only | Business KPIs — see §5, mostly unchanged from v2.0 |
| `/team` | admin only | Ranked staff table — real Supabase/XPM data, the full 50/30/20 leaderboard formula. `/leaderboard` is retired, folded into this page — see §6.7 |
| `/tasks`, `/bas` | nobody (unlinked) | Old Karbon-only pages, deliberately not removed but not in nav either ("quarantined") |
| `/settings` | admin only, **now server-enforced on every sub-route** | Staff & Sync (Partner dropdown + "Save & resync", **Included staff** toggles — see §6.3, **Show Partners on Timesheets** toggle), Dashboard Users (create/list/**pause**/**remove**, with **Last login**), My Security (MFA), **Karbon Import** (moved here in v5.0, was previously its own top-level nav item — verify current shape in a new session, this move happened without full visibility into its details) |

Nav itself (`components/layout/TopNav.tsx`) computes `isAdmin` once in `app/(dashboard)/layout.tsx` and conditionally includes Business KPIs/Team/BAS Status/Settings — Dashboard/My Work/Clients/Timesheets are always shown.

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
2. `staff.role`: `"Partner" | "Manager" | "Staff"` — XPM-derived work hierarchy. **`customers.manager_id` is actually populated by "Staff"-role people's ids**, not "Manager" — confirmed directly against the practice (e.g. Andre/Joel/Joshua all carry role "Staff" but manage clients directly); the schema's "Manager" tier is effectively vestigial. A Staff-role person's own board = `getClientsForManager(staff.id)`.

**Client allocations**: a client carries **both** of its XPM allocations on its own row — `customers.partner_id` (XPM `accountManager`) and `customers.manager_id` (XPM `jobManager`). `/clients` reads the Manager from `customers.manager_id`, *not* by aggregating its jobs' managers: doing that showed "Multiple" for any client whose work is legitimately split across service lines (a bookkeeper on the BAS jobs, an advisor on the CFO job), and let stale legacy jobs keep listing managers who no longer look after the client.

**Tasks/workflow belong to the CLIENT, not the job (migration 017).** Confirmed directly with the practice: time is captured against jobs in XPM, and jobs are billed to clients — that's the *only* place jobs are used; workflow and tasks are recorded against clients. `tasks.job_id` used to be `NOT NULL`, forcing every task through a job purely to reach its client — `hydrateTask` did `job → job.customer_id → customer` just to find out which client a task belonged to, and the job carried no other meaning for a task. That's the same job-vs-client confusion already fixed once on `customers.manager_id` above. `tasks.customer_id` is now the direct, only link; `job_id` is gone from the table entirely. Jobs still exist for XPM/billing reference (the Clients drawer's Jobs section, `getJobsForCustomer`) — a Task just never references one.

**Tables**: `staff`, `customers`, `jobs`, `tasks`, `statuses`, `task_types`, `customer_notes`, `customer_files`, `task_templates` + `task_template_items`, `todo_items` (§4.8). Only staff/customers/jobs are XPM-synced (full-replace, `lib/xpmSync.ts`); everything else is native to this app.

**Task permissions** (`getClientsInScopeForStaff`, `canModifyTask` in `lib/workflow.ts`):
- Non-admin create: only on clients in scope (their own managed clients for Staff/Manager, whole roll-up for Partner).
- Non-admin edit/delete/reassign: only tasks already on their own board (`getWorkBoardForStaff`); reassigning to a different client re-checks scope.
- Admin: unrestricted everywhere.

**New Task creation is a flat client picker** — one dropdown, sorted by name. This used to be a client-then-job picker (only showing the job sub-picker when a client had more than one), which existed purely because a task had to attach to a job at all; with tasks client-scoped there is nothing left to disambiguate.

**Notes** (`customer_notes`) support an optional `title` and a `pinned` boolean (pinned sort first, then newest-first).

**Copy task / templates**: a task can be copied onto another client (fresh due date, unassigned, default open status). A client's current tasks can be saved as a named, reusable template (title/type/recurrence only — not dates/assignee/status) and bulk-applied to any client.

**To-Do items** (`todo_items`, §4.8): distinct from Tasks — no status/type, just owner/client/due-date/title, created from forwarded emails. `status`: `pending_triage` (needs client+due date) → `todo`/`done` (populated one-off) or `converted` (became a real Task). Converting a recurring to-do used to have to resolve a destination *job* first — and would refuse to convert at all if the client had more than one — since tasks are client-scoped that whole failure mode is gone.

**`tasks.type_id` was `NOT NULL` on the live table**, contradicting both migration 004 (no `NOT NULL` specified) and the app, which has always treated Category as optional (`NewTaskModal`'s "None" option, `createTask`'s `type_id: input.typeId ?? null`). Found while testing migration 017: an insert with no category failed on this constraint. Since `tasks` had been empty the whole time this was live, "create a task with no category" had likely never actually succeeded end to end. Fixed by dropping the constraint (`type_id` is genuinely optional now, matching the code that was always written as if it were).

**Note**: the `tasks` table is currently **empty**. Everything task-related — `/my-work`, To-Do→Task conversion, templates, copy-task — is built but carrying no data yet. Verified directly against Supabase rather than relying on a clean build: inserted a task with only `customer_id` (no category), reproduced `hydrateTask`'s exact join, reproduced `getClientSummaries`' tally, reproduced a Manager-scoped board query, reproduced `copyTaskToClient`'s insert shape onto a second client — all correct, then deleted the test rows.

---

## 6.1 Timesheet & utilisation definitions

Getting these wrong produced three separate rounds of "the dashboard is broken" when it was mostly measuring something other than what was assumed. All of it lives in `lib/workOverview.ts`.

**Utilisation is everything except idle, against a 7.6hr day** (38hr/5). The internal client's time is not one lump: alongside `YFD - Idle` it carries `YFD - General Admin`, `YFD - Team Meeting - Paid` and leave — all paid time nobody can be marked down for. Bucketing everything internal-and-not-leave as idle wrote off 54 of 71 internal hours in Jul–Aug 2026 and understated the practice by 12 points. Idle is now identified **on its own** (`isIdleTask`, task name containing "idle") rather than by elimination, so a renamed variant can't quietly start counting as productive; everything else internal lands in `internalOtherHours` and counts.

**Capacity is counted to today, never to the end of the period.** Logged hours are to-date, so measuring them against a whole period's capacity compares to-date effort with a not-yet-elapsed denominator — on 27 Jul the FY tile divided ~4 weeks of work by a full year (261 weekdays × 7.6 × 4 staff = 7934.4 std hrs) and reported 2% instead of 34%.

**Three percentages are shown side by side, on purpose.** They have different denominators and will never agree:
| Tile | Denominator | Answers |
|---|---|---|
| Capacity used | available capacity to date | is the team's time accounted for (falls on under-logging or spare capacity) |
| Billable share (logged) | time actually logged | **this is the figure XPM's own Staff Time Summary Report calls %.** Blind to hours nobody entered, so it flatters anyone who logs little but logs it all to clients |
| Billable utilisation | capacity − leave | billable against what was *available*, so unlogged time counts as non-billable. The one to performance-manage on |

For 6 Jul – 2 Aug 2026 those read **77%, 81% and 65%** off identical data. Comparing the wrong one against XPM's report wastes an afternoon.

**All three are derived inside `computeWagesUtilisation`, never at the call site.** They used to be re-summed in `TimesheetsPageClient`, where the tile and the per-employee row each built their own denominator. When `internalOtherHours` was added as a bucket the tile's line wasn't updated, so it divided by `client + leave + idle` = 315.1 and reported **95%** where the same data gave 81% — with the employee rows beside it reading 99/72/75 on the correct basis. One definition, one place.

**Unlogged hours are a first-class figure, not a gap.** `loggedHours` is all four buckets; `unloggedHours` is `standardHours − loggedHours`, **signed** — positive means time never entered, negative means someone logged past their standard week (clamping it would hide genuine overtime). For 6 Jul – 2 Aug that was 456.0 capacity against 369.0 logged: **87.0 hrs that appeared in no tile, no column, and neither percentage.** Joel showed 72% off 114.0 logged hours against a 152.0hr standard month — a quarter of his time was outside the calculation entirely.

**Leave is netted out of the `Billable utilisation` denominator, not counted as non-billable** — confirmed directly. Approved leave is not available capacity, so charging it against someone's billable percentage would mark them down for taking it: a fortnight off would read as a fortnight of nothing billed.

**Partners are excluded from practice-wide figures** (`staff.role !== "Partner"`, decided in `timesheets/page.tsx`) — both their hours and their capacity, so time they do log can't inflate it either. A Partner carries no delivery workload; one in a team of four dragged the practice percentage down by a quarter. They still appear in the By employee table. This is separate from, and takes precedence over, the `staff.included` toggle in §6.3.

**Custom date ranges**: `DateRange`/`PeriodSelection` — the compute functions take either a period key or an explicit range, so existing callers are unaffected. Bounds are inclusive; a range extending past today still counts capacity only to today; reversed dates are swapped; a half-filled range falls back rather than measuring an open-ended window; a range with no weekdays yields 0% not `NaN`.

**`XpmTimesheet.billable` is never read.** "Billable" throughout means *client-coded* (not against the internal client). The two coincide in current data, so figures reconcile with XPM — but they are different fields and could diverge.

---

## 6.2 Settings storage

`app_settings` (migration 015, single row, `id = 1`) is the **source of truth**; Redis is a cache in front of it with a 5-minute TTL and write-through on update.

This was previously Redis-only with no TTL and nothing behind it. That holds until the cache doesn't: an eviction, a flush or swapping the Upstash instance silently blanked `partnerName` — and since that value scopes which clients, jobs and staff the entire app can see, losing it empties the practice while presenting as "Set a Partner name in Settings", indistinguishable from a genuine first run.

`updateSettings` reads straight from Postgres before merging, bypassing both the request memo and the cache, so a read-modify-write can't drop a concurrent change to the other field. A database read error is **thrown, not defaulted** — returning an empty Partner would look exactly like "not configured yet".

---

## 6.3 Included staff & the email join

Settings → **Included staff** is the switch for who the dashboard reports on. It went through two wrong shapes before this one, both worth knowing about.

**It used to be sourced from Karbon.** The roster came from Karbon's user list and had to be email-joined to XPM to mean anything, which is why each row carried a "Linked / Not linked to XPM" badge. It dragged in entries that were never people here (`Karbon Support`, `onboarding@karbonhq.com`) and needed its own *Refresh staff roster* button beside the real resync — two buttons whose labels both read as "sync from XPM". Karbon roster, button, `lib/staffLink.ts` and `/api/xpm/staff` are all removed.

**The toggles used to do nothing.** They wrote `settings.excludedStaffIds`, which is read by the quarantined Karbon pages (`/tasks`, `/bas`, `/team`, `/leaderboard`) and by nothing else — so a control captioned "excluded staff are hidden everywhere" had no effect on Timesheets, Clients or My Work. They now write **`staff.included`**.

**The list is `dashboard_users`, joined to `staff` on `lower(email)`.** Logins are the thing an admin actually manages, so that's what the rows are; the XPM staff record matched by email is what the toggle writes to, because that's what carries the hours. Both sides of a failed join are surfaced rather than left silent:

| Case | Shown as |
|---|---|
| Login matches an XPM staff row | Normal row with a toggle |
| Login with no XPM match (e.g. `kim@focablyED.com.au`) | Row with "No XPM staff with this email" instead of a toggle — nothing to include or exclude |
| XPM staff with no login | Warning listing them: they stay included in every figure and there is no row to switch them off from |

Case matters here only in that it must *not*: the login and the XPM record are created by different people at different times, so both sides are lowercased for the join.

**What excluding actually does**, and where it deliberately stops:
- `/timesheets` — drops the person's hours **and** their 38hr capacity, so the practice percentages read as if they were never on the team. That's the point for someone departed or non-delivery who still exists in XPM.
- `/clients` — drops them from the staff slicer and the hours totals together, so the two agree.
- `/my-work` — drops them from the admin staff switcher, but **not** from the "+ New Task" assignee picker. Excluded from reporting doesn't mean unassignable.

`staff.included` has existed since migration 003 but was dead until now, because the sync wrote `included: true` on every upsert — any toggle would have been flipped back on the next resync. It's out of the upsert payload; new rows still default true via the column default.

---

## 6.4 Monday Report (weekly email) — `lib/mondayReport.ts`, `lib/emailTemplates/mondayReport.ts`

Every `staff.included` staff member gets a personal weekly email; every included Partner additionally gets a combined firm-wide one. Fires **Monday 06:00 AEST** via `vercel.json`'s cron (`0 20 * * 0` = Sunday 20:00 UTC — AEST is UTC+10, no DST assumed since this practice is QLD-based) hitting `GET /api/reports/monday-report`, authenticated via `CRON_SECRET` (the header Vercel Cron sends automatically once that env var is set). **Not yet actually sending mail** — gated by `isResendConfigured()`, degrades to logging rather than crashing, pending a real Resend account/domain + `RESEND_API_KEY`/`RESEND_FROM_EMAIL` for this specific use (distinct from the existing To-Do notification integration, §4.8, which already works).

- **Uses due date, not start date, for "overdue"** — a deliberate, permanent difference from `/my-work`'s own Overdue filter (start-date-based). This report is deadline-focused (BAS/Payroll have hard ATO dates); `/my-work` is operational (when did work actually start). Don't try to reconcile the two into one definition.
- **Per-staff report**: Overdue / Due this week / Due later tiles, plus BAS/IAS-due and Payroll-due deadline tiles, a due-this-week task list, and "Overdue, by client" grouped and sorted by count descending. **Deliberately uncapped** — every overdue task for every client, no "+N more" truncation. The size of the list is meant to be seen ("nobody should have this many items overdue" — Steve's own words), not hidden. One real consequence: a large backlog (one real case, 360 overdue tasks/26 clients) renders to ~250KB of HTML, over Gmail's ~102KB clip threshold — Gmail shows a "view entire message" link partway through; other clients don't clip at that size. Accepted trade-off, not a bug to fix.
- **Combined/Partner report**: firm-wide totals, a **"Top overdue clients"** section (top 10 firm-wide by count, each with the single staff member holding the most of that client's overdue work), a per-staff mini-summary table, and an XPM-sourced timesheet summary (prior calendar week + FY-to-date logged hours per staff, via `computeWagesUtilisation`). Firm-wide totals are deduplicated across all tasks including unassigned ones, so they can be slightly higher than the sum of the per-staff mini-summary rows — intentional, not a bug.
- **Email HTML is table-based with inline styles only** — no CSS grid/flexbox/`@font-face`, since Outlook and many mobile clients strip anything fancier. This is a different, simpler visual language than the rest of the app (which is free to use flexbox etc.) — don't try to share components between the two.
- `getAllTasks()` (`lib/workflow.ts`) — every task in the system, hydrated, unscoped by owner — feeds the combined report's firm-wide aggregation. Added specifically for this; also reused by `/bas-status` and the `/team`+`/leaderboard` rebuild in progress.

## 6.5 BAS Status pipeline — `app/(dashboard)/bas-status/`, migrations 022-023

A three-stage approval workflow for BAS/IAS-typed tasks specifically, layered on top of the existing task system rather than replacing any of it.

**Stages** (`tasks.bas_stage`, nullable text, `NULL`/`'pending'` both mean the same starting state — see migration 023's comment for why `NULL` isn't backfilled): `pending` (default) → `ready_for_approval` → `waiting_on_customer`. Moves are **bidirectional**, one stage at a time (no skipping), via `setBasStage()` in `lib/workflow.ts`.

- **Reassignment is a side effect of the stage, not a separate action**: landing on `ready_for_approval` temporarily reassigns the task to Steve (`tasks.temp_assignee_id` — the *same* mechanism `/my-work`'s existing "Owner" vs "Assigned to" split already uses, not a new concept); landing on `pending` or `waiting_on_customer` reverts to the original owner (clears `temp_assignee_id`). This applies whichever direction the move came from.
- **Email fires only on arrival at `ready_for_approval`**, in either direction (moving back to it from `waiting_on_customer` re-notifies same as the first arrival) — never on moves to the other two stages. Body: that task plus a live-queried snapshot of every other task currently sitting in `ready_for_approval` at that moment (not a stored/batched digest). Same `isResendConfigured()` gating and degrade-gracefully behaviour as the Monday Report (§6.4) — not sending real mail yet either, pending the same Resend setup.
- **`bas_stage_history`** (migration 023): one row per transition — `from_stage` (null for a task's first-ever recorded move), `to_stage`, `changed_by_staff_id` (resolved from the acting session's linked staff row via the same `getStaffByEmail` lookup the PATCH route already used for permission checks — no new auth plumbing; null for an admin login with no linked staff row), `changed_at`. Shown per card as a collapsible "History (n)" toggle, not always-visible — the cards are intentionally compact (see below).
- **Board UI**: three tiles/columns, each with its own accent colour/header tint (Pending amber, Ready for Approval blue, Waiting on Customer purple) so they read as visually distinct groups without reading the header text — separate from, and doesn't compete with, the per-card red/green overdue colour or the per-card client-name colour (blue/dark-orange/green by stage, a third, independent colour signal). Cards are narrow and compact: due date sits directly under the title (above the assignee), Back/Forward buttons and the History toggle cluster top-right. Each column has independent "Due"/"A-Z" sort toggles. A client-name search box sits next to the employee filter. **Clicking a card drills into the same task edit modal `/my-work` and `/clients` use** — the Back/Forward/History controls stop propagation so they still work independently.
- **Return period label**: shown top-right of each card as e.g. "JUN26 BAS" — this is the month **immediately before** the task's start date, not the start date's own month (a task starting 1-Jul-2026 covers the June period, computed and labelled accordingly). Get this backwards and every card is off by one period.
- **`BAS_TASK_TYPE_ID`** is exported from `lib/workOverview.ts` for exactly this page (and reused by the in-progress `/team`+`/leaderboard` rebuild, §0, for its BAS-on-time scoring).

## 6.6 Task completion audit — migration 024

`tasks.completed_at` existed in the schema since early on but **was never actually written by any code path** until v5.0 (confirmed directly: 0 of 806 live rows had it set before this). `updateTask()` (`lib/workflow.ts`) now stamps `completed_at = now()` and the new `completed_by_staff_id` whenever a status-changing PATCH lands the task on an `is_complete` status, and **clears both** if the task is later reopened — this is a live "current completion state" note, not a historical multi-entry log (contrast with `bas_stage_history` above, which *is* a full log — different asks, deliberately different shapes). The acting staff id comes from the PATCH route's existing session→`getStaffByEmail` lookup, same pattern as `bas_stage_history`'s `changed_by_staff_id`. Surfaced in the task edit modal as a small "Completed by X on Y" note, not an editable field.

**This is why the `/team` rebuild (§6.7) can finally compute "BAS on-time" as `completed_at <= due_date`** — it previously had to approximate on-time as "not currently overdue," which isn't the same thing (a late-but-eventually-completed task and a still-open overdue task both would have read as on-time or not depending only on the moment you asked, never on when it actually finished).

---

## 6.7 `/team` — the real leaderboard (retired `/leaderboard`)

The `/team`+`/leaderboard` merge that v5.0's "Pick up here" note left mid-flight (three prior attempts vanished silently) is done. `/leaderboard`, `lib/dashboardData.ts`, and the seven Karbon/mock-only dashboard components it alone imported (`KpiStrip`, `TopPerformers`, `BillableChart`, `WeeklyTrendChart`, `OverdueTasks`, `BasSnapshot`, `RevenueSnapshot`) are deleted outright — confirmed via a repo-wide grep that nothing else referenced them before removing them.

- **`lib/leaderboard.ts`** now implements the real formula: **50% billable-hours-against-capacity, 30% task completion, 20% BAS on-time** — reachable in full now that both inputs exist (`computeWagesUtilisation`'s `billableCapacityPct`, §6.1; `tasks.completed_at`, §6.6), where the old formula could only manage a 60/40 partial score from Karbon.
  - Task/BAS stats come from `getAllTasks()` (already built for the Monday Report, §6.4, and reused as CONTEXT.md itself anticipated), grouped by `assigneeId` — a task's **permanent** owner, not `tempAssigneeId`, so a BAS task briefly parked on Steve via the approval pipeline (§6.5) doesn't count toward his score.
  - **BAS on-time is `completed_at <= due_date`**, judged only over BAS/IAS tasks that are actually complete (open tasks aren't yet either on-time or late — that's what Overdue already covers). A person with zero completed BAS work reads as no data for that component, not a 0%.
  - **Billable % is `billableCapacityPct`** (client hours against capacity net of leave — "the one to performance-manage on", §6.1), not `billableSharePct` (which flatters under-loggers) — computed over the current calendar month via `getXpmTimesheets(settings.partnerName)` + `computeWagesUtilisation(..., "month", today)`, keyed by `xpmStaffId`.
  - **Missing-component reweighting, generalised**: any of the three components with no data for a given person (no XPM link, zero tasks, zero completed BAS work) drops out and the remaining weights renormalise — the same shape the old 60/40 fallback used, now applied per-component per-person instead of as one global all-or-nothing switch on billable data.
- **`/team`** is the only surviving route — a `PageHeader` explaining the formula plus the ranked table `/leaderboard` used to render (Rank/Staff/Tasks done/Overdue/BAS on-time/Billable %/Score), now fed by `listStaff()` + `getAllTasks()` + XPM timesheets instead of `dashboardData.ts`'s Karbon/mock loader. Ranked staff are `included` (§6.3) and not Partners, consistent with Partners being excluded from delivery-workload figures elsewhere (§6.1).
- **Nav**: the separate "Leaderboard" item is removed from `TopNav.tsx`'s admin-only list; "Team" remains.
- Verified with `tsc --noEmit`, `eslint`, and `next build` all clean (three pre-existing lint errors noted in §10/Gotchas are unrelated and unchanged) — not yet checked against real Karbon-free production data since XPM/Supabase aren't reachable from this session's network egress.

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
- **Two buttons whose labels both meant "sync from XPM" cost real debugging time.** `/api/xpm/staff` refreshed only the legacy Karbon-linking roster while `/api/xpm/sync-workflow` was the real one. Both that button and that route are **gone** (§6.3); `sync-workflow` is the only sync now, and it **saves the Partner first** — previously only the roster button persisted that field, so changing the Partner and pressing resync rebuilt everything against the *old* Partner with no indication anything had been ignored.
- **Vercel deploys lag your testing.** Several rounds of "still wrong" were the previous deployment still serving. Check the retry/backoff numbers or `dep=` in the runtime logs before re-diagnosing.
- **A background coding agent without `isolation: "worktree"` shares the same working directory and git checkout as whatever dispatched it.** One agent asked to "search every branch" for context ran `git checkout`/`reset`-style exploration that silently moved the shared branch pointer backward mid-session — later work looked like it had vanished (files/functions "didn't exist") when actually the working copy had just been rolled back under everything else. Nothing on `origin` was ever touched or lost; `git reset --hard origin/main` recovered it instantly once noticed. **Any agent task that might explore or compare branches should run in an isolated worktree**, not the main checkout.
- **This session's container appeared to occasionally restore local git state to an earlier point between turns** (a `git reset --hard origin/main` done in one turn wasn't still in effect at the start of a later turn — a previously-discarded duplicate commit reappeared as "unpushed"). Always re-check `git log`/`git status` against `origin` before pushing or trusting "already handled" state carried over from earlier in a long session — don't assume a prior turn's cleanup is still standing.
- **This repo's PR convention is squash-merge**, which means the feature branch's own commit history diverges from `main`'s the moment a PR lands (the branch still has the pre-squash commits; `main` has one squashed commit covering the same net change). A plain `git rebase origin/main` on the feature branch replays that entire pre-squash history against a base that already contains its squashed equivalent and reliably conflicts. **Fix**: identify exactly which commits on the branch are NOT yet in `main` (`git log --oneline <last-known-merged-sha>..HEAD`), then `git checkout -B <branch> origin/main && git cherry-pick <those-shas>` — rebuilds the branch from a clean base plus only the genuinely new work, and cherry-picks onto identical content apply cleanly.
- **Migration numbering is up to `024` as of v5.0** (`024_tasks_completed_by_staff_id.sql`) — check `migrations/` for the actual latest before adding a new one; this file will lag reality.

---

## 10. Future / Not Yet Built

- FocablyED Search Console + GA4 (needs domain verification + GA4 property ID) — unchanged from v2.0.
- Full role-based read-only access — `dashboard_users.role` still only gates nav + a handful of specific checks (task permissions, To-Do visibility, user pause/remove), not a general read-only mode.
- Mobile responsive layout — not yet tested/optimized.
- Sync failure alerts (email an admin if a scheduled XPM/Karbon/Google sync errors silently) — no XPM dependency, not yet built.
- **Monday Report (§6.4) and BAS Status approval emails (§6.5) are built but not yet actually sending mail** — both gated behind `isResendConfigured()`, pending a real Resend account/domain, `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, and (for the Monday Report's cron) `CRON_SECRET` set in Vercel.
- **Per-person exclusion from practice figures.** Only Partners are excluded from practice-wide *utilisation* today (§6.1) — v5.0 separately added a Settings toggle for whether Partners even show as a *row* on `/timesheets` (§6.3-adjacent), but excluding a non-Partner from the figures entirely still needs a real toggle *and* `lib/xpmSync.ts` to stop hardcoding `included: true`, which would otherwise wipe the setting on every sync.
- **Job-level manager gaps in XPM**: ~120 of 493 jobs have no Job Manager (concentrated in a handful of clients). Doesn't affect client tiles, which read the client record, but does affect each person's work board. Fix in XPM, then resync.
- **Dependabot backlog**: several open PRs, of which TypeScript 5.9→7.0 and ESLint 9→10 are major versions needing a build check.
- **Three pre-existing lint errors** remain (`settings/users/page.tsx`, `api/hubspot/deals/route.ts`, `lib/hubspot.ts`) — unrelated to v4.0 work, verified as pre-existing.
- **The BAS Status page (§6.5) has no server-side access restriction of its own** — only its nav link is admin-gated; any authenticated user hitting `/bas-status` directly can view the whole practice-wide board (though every stage-change action still goes through the same per-task `canModifyTask` permission check as editing that task normally would). Flagged, not yet locked down further.

*Closed in v4.0*: `/api/settings` PATCH and the staff routes now enforce admin server-side; `partnerName` is durably stored (§6.2); `lib/google.ts` no longer throws at import; `getClientSummaries` no longer walks the tasks table per customer.

*Closed in v5.0*: weekly performance summary / overdue-task digest emails (§6.4, built but not yet sending — see above); a task's completion date/actor is finally recorded (§6.6, `completed_at` existed but was dead code before this); `/my-work`'s Status filter gains a date-derived Overdue option; `/clients` and `/bas-status` both drill into the same task edit modal `/my-work` already used.

*Closed in v5.1*: the `/team`+`/leaderboard` merge (§6.7) — real Supabase/XPM data, the full 50/30/20 formula, `/leaderboard` retired.

---

*Keep this file at repo root as `CONTEXT.md`, update it whenever a new chat picks up meaningful work.*
