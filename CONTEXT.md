# YFD Dashboard — Project Context Document

**Version:** 1.0  
**Date:** June 2026  
**Owner:** CEO, Your Financial Direction (YFD)  
**Purpose:** Full context for any developer or AI coding assistant picking up this project

---

## 1. Project Overview

A private, CEO-facing business intelligence dashboard built in Next.js and deployed to Vercel.

The primary purpose is to give the YFD CEO a **single daily view** of the productivity and efficiency of the overseas bookkeeping team — pulling live data from Karbon (task management) and XPM (timesheets and invoicing), with HubSpot CRM and a multi-business income summary planned for Phase 2.

This is not a public product. It is an internal operations tool for one user (the CEO), secured behind authentication.

---

## 2. Business Context

**Company:** Your Financial Direction (YFD) — Australian accounting/bookkeeping practice  
**Team in scope:** Overseas bookkeeping team (Philippines-based)  
**Financial year:** Australian FY — 1 July to 30 June  
**Shared systems:** XPM is shared across multiple entities. The dashboard must filter data to YFD only.

### Staff hierarchy in XPM
- **CEO = Partner** (the dashboard owner)
- **Overseas bookkeeping staff = Manager** (assigned Manager role on each client job)
- Filter logic: pull all unique staff who appear as **Manager** on any job where the Partner = CEO's name
- This naturally scopes all data to YFD's team, regardless of other entities in the shared XPM

### Staff inclusion/exclusion
- Staff are auto-synced from XPM via the Partner filter
- A **Settings page** allows the CEO to toggle individual staff on/off
- Excluded staff are hidden from all dashboard views, slicers, and KPIs
- Settings persist via Vercel KV (survive deployments)

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes keep keys server-side; native Vercel support |
| Language | TypeScript | Typed API responses prevent bugs as integrations grow |
| Styling | Tailwind CSS + shadcn/ui | Utility-first; shadcn for accessible components |
| Charts | Recharts | React-native, responsive, already prototyped |
| Auth | NextAuth.js | Simple session management; Google or credentials |
| Cache | Vercel KV (Redis) | API response caching; avoids hammering XPM/Karbon |
| Hosting | Vercel | Native Next.js; git push = deploy; env vars managed in dashboard |
| Source control | GitHub | Repo: `yfd-dashboard` |

---

## 4. Folder Structure

```
yfd-dashboard/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Auth check wrapper
│   │   ├── page.tsx                    # Overview — /
│   │   ├── leaderboard/page.tsx        # /leaderboard
│   │   ├── timesheets/page.tsx         # /timesheets
│   │   ├── tasks/page.tsx              # /tasks — Karbon
│   │   ├── bas/page.tsx                # /bas
│   │   ├── clients/page.tsx            # /clients — tile view
│   │   ├── staff/[id]/page.tsx         # /staff/[id] — individual drill-down
│   │   └── settings/page.tsx           # /settings
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── karbon/
│       │   ├── tasks/route.ts
│       │   └── work/route.ts
│       ├── xpm/
│       │   ├── staff/route.ts
│       │   ├── timesheets/route.ts
│       │   └── invoices/route.ts
│       └── hubspot/                    # Phase 2
│           ├── deals/route.ts
│           └── contacts/route.ts
├── components/
│   ├── layout/
│   │   ├── DashboardShell.tsx
│   │   ├── TopNav.tsx
│   │   └── StaffSlicer.tsx
│   ├── dashboard/
│   │   ├── KpiStrip.tsx
│   │   ├── KpiCard.tsx
│   │   ├── LeaderboardRow.tsx
│   │   ├── StaffAvatar.tsx
│   │   ├── TaskRow.tsx
│   │   ├── BasStatusCard.tsx
│   │   ├── ClientTile.tsx
│   │   ├── TileDrawer.tsx
│   │   └── RevenueBar.tsx
│   ├── charts/
│   │   ├── BillableStackedBar.tsx
│   │   ├── WeeklyTrendChart.tsx
│   │   ├── DailyHoursBar.tsx
│   │   └── SparklineSmall.tsx
│   └── ui/                             # shadcn primitives live here
├── lib/
│   ├── karbon.ts                       # Karbon API client
│   ├── xpm.ts                          # XPM API client + OAuth token refresh
│   ├── hubspot.ts                      # HubSpot client (Phase 2)
│   ├── cache.ts                        # Vercel KV read/write helpers
│   └── utils.ts                        # Currency formatting, date helpers, FY logic
├── types/
│   ├── karbon.ts                       # Task, WorkItem, Assignee interfaces
│   ├── xpm.ts                          # Timesheet, Invoice, Staff interfaces
│   └── dashboard.ts                    # KPI, ClientTile, StaffMember interfaces
├── .env.local                          # Never committed to Git
├── .env.example                        # Committed — shows required vars without values
└── vercel.json                         # Cache and revalidation config
```

---

## 5. Pages & Routes

### Phase 1 — Build now

| Route | Page | Description |
|---|---|---|
| `/` | Overview | 3-column layout. Row 1: Leaderboard snapshot, Billable vs non-billable chart, Weekly trend chart. Row 2: Overdue tasks, BAS status, YTD revenue by client. KPI strip across top. |
| `/leaderboard` | Leaderboard | Full team ranking. Score, billable %, tasks done/overdue. Week/month/YTD toggle. Click row → staff detail. Staff slicer bar. |
| `/timesheets` | Timesheets | Week/month/YTD KPI cards. 8-week trend chart (billable + non-billable vs available). Per-staff progress bars. Staff slicer. |
| `/tasks` | Karbon Tasks | Overdue tasks, due today, due this week. Tasks by staff member. Client tile view with expandable drawers. Staff slicer. |
| `/bas` | BAS Status | All BAS obligations. Lodged / in progress / not started. Due dates and assigned staff. Staff slicer. |
| `/clients` | Client tiles | 2 rows × 3 columns of expandable client cards. Each shows: YTD invoiced, % of FY target, task summary badges, BAS status, expandable task list + revenue breakdown. |
| `/staff/[id]` | Staff detail | Individual drill-down. Billable hrs, tasks done, tasks overdue, BAS overdue count. Hours breakdown bars. Daily hours chart. Task list. BAS obligations. |
| `/settings` | Settings | XPM Partner name field + Sync button. Staff toggle list (on/off per person). Persisted to Vercel KV. |

### Phase 2 — Future

| Route | Page | Description |
|---|---|---|
| `/income` | Income summary | Multi-entity P&L across all businesses. Xero + XPM combined. |
| `/hubspot` | HubSpot CRM | Pipeline, deal stages, forecast, contact activity. |

---

## 6. API Routes & Data Sources

### 6.1 XPM (Xero Practice Manager)

Authentication: OAuth 2.0 via Xero Developer portal. Tokens stored in environment variables. Auto-refresh via `lib/xpm.ts`.

| Endpoint | Fetches | Cache TTL |
|---|---|---|
| `POST /api/xpm/staff` | All staff where Partner = CEO name. Returns name, role, XPM ID. | 24 hours |
| `GET /api/xpm/timesheets` | Billable and non-billable hours per staff member. Week/month/YTD. | 15 minutes |
| `GET /api/xpm/invoices` | YTD invoiced per client. FY = 1 Jul → 30 Jun. Revenue by service type. | 1 hour |

**Key XPM logic:**
- Partner name is set by the CEO in `/settings` and stored in Vercel KV
- All XPM queries are scoped to jobs where Partner = that name
- Staff returned are those with Manager role on those jobs
- FY date logic must always use Australian financial year (1 July start)

### 6.2 Karbon

Authentication: Bearer token (API key from Karbon Settings → Integrations → API).

| Endpoint | Fetches | Cache TTL |
|---|---|---|
| `GET /api/karbon/tasks` | All tasks assigned to included staff. Overdue, due today, due this week, completed. Includes client name, category, assignee. | 5 minutes |
| `GET /api/karbon/work` | Active work items per client. BAS work item status. Job completion %. | 10 minutes |

**Key Karbon logic:**
- Tasks are filtered to staff on the active inclusion list (from settings)
- Overdue = due date < today and status != complete
- BAS status is derived from work item type = BAS in Karbon

### 6.3 HubSpot (Phase 2)

Authentication: Private app access token from HubSpot portal.

| Endpoint | Fetches | Cache TTL |
|---|---|---|
| `GET /api/hubspot/deals` | Deal pipeline, stages, values, forecast | 30 minutes |
| `GET /api/hubspot/contacts` | Contact activity, recent interactions | 1 hour |

---

## 7. Key UI Patterns

### Staff Slicer
- Appears below the tab bar on every page (except Overview and Settings)
- Shows avatar chips for each included staff member
- Selecting a staff member filters ALL data on that page to that person only
- Selecting again (or "All staff") resets
- State is local to the page — not persisted across navigation

### Client Tiles (2 × 3 grid)
- Fixed layout: 2 rows, 3 columns — designed for desktop
- Sorted automatically: overdue clients first, then in-progress, then all clear
- Top border colour: red = has overdue tasks, amber = in-progress only, green = all clear
- Each tile shows: client name, manager, YTD invoiced, % of FY target, progress bar, task badges, BAS status
- Tap/click to expand drawer: overdue tasks → in-progress tasks → completed this week → YTD revenue breakdown by service type
- Filter bar: All / Overdue / In progress / All clear / Search

### Overview Layout
- KPI strip: 4 metrics across the top with dividers (Billable hrs today, Tasks overdue, BAS lodged, Team utilisation)
- Row 1 (3 equal columns): Top performers leaderboard | Billable vs non-billable bar chart | Weekly trend chart
- Row 2 (3 equal columns): Overdue tasks list | BAS status grid | YTD revenue by client
- All columns must be strictly equal width using `grid-template-columns: repeat(3, minmax(0, 1fr))`

### Performance Score (Leaderboard)
Weighted composite score per staff member:
- 50% — billable hours ratio (actual vs target)
- 30% — task completion rate (done vs total assigned)
- 20% — BAS on-time rate (lodged before due date)

Score is calculated server-side and cached. Displayed as a number out of 100.

### Staff Drill-down (/staff/[id])
- Accessible by clicking any staff row in any view
- URL-based (`/staff/maria-santos`) — bookmarkable
- Shows: performance score, billable hrs, tasks done, tasks overdue, BAS overdue
- Hours breakdown: billable / non-billable / utilisation vs 24h weekly target
- Daily hours bar chart (Mon–Fri)
- Full task list with status
- Full BAS obligation list

---

## 8. Environment Variables

Store all of these in Vercel dashboard → Project Settings → Environment Variables. Never commit to Git.

```bash
# Karbon
KARBON_API_KEY=                    # Bearer token from Karbon settings
KARBON_BASE_URL=https://app.karbon.com/api/v1

# XPM / Xero OAuth
XPM_CLIENT_ID=                     # From Xero Developer portal
XPM_CLIENT_SECRET=                 # OAuth 2.0 client secret
XPM_REFRESH_TOKEN=                 # Long-lived refresh token — auto-renewed by lib/xpm.ts
XPM_BASE_URL=https://api.xero.com/practicemanager/3.0

# NextAuth
NEXTAUTH_SECRET=                   # Random 32+ char string — signs JWT sessions
NEXTAUTH_URL=                      # Your Vercel domain e.g. https://yfd-dashboard.vercel.app

# Vercel KV (auto-populated when KV store is attached in Vercel dashboard)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# HubSpot (Phase 2)
HUBSPOT_ACCESS_TOKEN=
HUBSPOT_PORTAL_ID=
```

---

## 9. Caching Strategy

All API calls are cached in Vercel KV to avoid hammering external APIs and to keep the dashboard fast.

| Data | TTL | Reason |
|---|---|---|
| XPM Staff list | 24 hours | Changes rarely |
| XPM Invoices / YTD revenue | 1 hour | Updated when invoices are raised |
| XPM Timesheets | 15 minutes | Updated throughout the day |
| Karbon Work items | 10 minutes | Job status changes occasionally |
| Karbon Tasks | 5 minutes | Near real-time — overdue tasks matter |
| Settings (partner name, exclusions) | Permanent | User-controlled, stored directly in KV |

Manual refresh: each page should have a refresh button that busts the cache for that page's data set and re-fetches.

---

## 10. Build Phases

### Phase 1 — Foundation & core dashboard (Weeks 1–3)

**Week 1 — Scaffold**
- Next.js 14 project initialised with TypeScript
- Tailwind CSS and shadcn/ui configured
- NextAuth login page (credentials or Google)
- Dashboard shell: top nav, tab bar, protected route layout
- Deployed to Vercel — live URL established

**Week 2 — XPM integration**
- Xero OAuth 2.0 flow implemented in `lib/xpm.ts`
- `/api/xpm/staff` route — Partner filter logic
- `/api/xpm/timesheets` route — week/month/YTD
- `/api/xpm/invoices` route — YTD revenue, FY date logic
- Vercel KV caching layer
- Timesheets page live with real data

**Week 3 — Karbon integration**
- Karbon API client in `lib/karbon.ts`
- `/api/karbon/tasks` route — overdue, due today/week
- `/api/karbon/work` route — BAS status
- Tasks page and Client tiles page live with real data
- Staff drill-down pages
- Settings page — partner name + staff toggles

### Phase 2 — Expansion (future)

- HubSpot CRM view (`/hubspot`) — pipeline, deals, contacts
- Multi-business income summary (`/income`) — Xero P&L across entities
- Mobile responsive layout
- Email or Slack daily digest (summary of overdue tasks + key KPIs)
- Role-based access (if team members need read-only access)

---

## 11. Data Model (TypeScript interfaces)

```typescript
// types/xpm.ts
interface XpmStaff {
  id: string
  name: string
  email: string
  role: 'Manager' | 'Partner' | 'Staff'
  included: boolean          // from settings exclusion list
}

interface XpmTimesheet {
  staffId: string
  date: string               // ISO date
  hours: number
  billable: boolean
  clientId: string
  jobId: string
}

interface XpmInvoice {
  id: string
  clientId: string
  clientName: string
  amount: number
  date: string               // ISO date
  serviceType: string        // Bookkeeping | Tax | Payroll | BAS | Advisory
  fyYear: number             // e.g. 2025 for FY25
}

// types/karbon.ts
interface KarbonTask {
  id: string
  title: string
  assigneeId: string
  assigneeName: string
  clientId: string
  clientName: string
  category: string
  dueDate: string            // ISO date
  status: 'todo' | 'inProgress' | 'complete'
  isOverdue: boolean
}

interface KarbonWorkItem {
  id: string
  clientId: string
  clientName: string
  type: string               // includes 'BAS'
  status: 'notStarted' | 'inProgress' | 'complete'
  dueDate: string
  assigneeId: string
}

// types/dashboard.ts
interface StaffMember {
  id: string
  name: string
  initials: string
  xpmRole: string
  score: number              // 0–100 composite score
  billableHours: number
  nonBillableHours: number
  billablePct: number
  tasksDone: number
  tasksOverdue: number
  basOverdue: number
  dailyHours: number[]       // [Mon, Tue, Wed, Thu, Fri]
  included: boolean
}

interface ClientTile {
  id: string
  name: string
  managerId: string
  managerName: string
  ytdInvoiced: number
  ytdTarget: number
  overdueTasks: KarbonTask[]
  inProgressTasks: KarbonTask[]
  completedTasks: KarbonTask[]
  basStatus: 'lodged' | 'in-progress' | 'not-started'
  revenueBreakdown: { label: string; value: number }[]
}

interface KpiData {
  billableHoursToday: number
  tasksOverdue: number
  basLodged: number
  basTotal: number
  teamUtilisation: number     // percentage
}
```

---

## 12. Design Rules

- **Layout:** Desktop-first. Overview uses `grid-template-columns: repeat(3, minmax(0, 1fr))` — all columns strictly equal width.
- **Colours:** Green `#1baf7a` = good/on track. Amber `#eda100` = warning. Red `#e24b4a` = overdue/critical.
- **Typography:** Tailwind defaults. KPI values at 32px weight 500. Card titles at 13px weight 500.
- **Cards:** `border-radius: 14px`, `0.5px solid border`, `background: surface-2`.
- **Charts:** Recharts. Billable = `#2a78d6` (blue). Non-billable = `#888780` (grey). Available line = `#b4b2a9` dashed.
- **No dark mode required** for Phase 1 — single light theme.
- **Performance scores** are always calculated server-side, never in the browser.

---

## 13. What to Ask the CEO Before Building

Before starting each phase, confirm:

1. **Karbon API key** — available in Karbon → Settings → Integrations → API
2. **XPM Partner name** — exact string as it appears in XPM (used as filter)
3. **Xero Developer app** — Client ID and Secret from developer.xero.com
4. **Vercel account** — connected to GitHub repo `yfd-dashboard`
5. **FY target per client** — where does the target revenue figure come from? XPM job budget, or manually set?
6. **Auth method** — Google login (easier) or username/password?
7. **How many staff** are currently on the overseas team? (To validate mock data used in prototype)

---

## 14. Prototype Reference

A full interactive prototype was built in Claude before this project started. It demonstrates:
- The complete UI layout and all interactions
- Mock data matching real data structures
- All 6 dashboard tabs functioning
- Staff slicer filtering all views
- Employee drill-down with BAS and tasks
- Settings page with staff toggle list
- Client tile view with expandable drawers and YTD revenue

The prototype serves as the **visual specification** for Phase 1. Build to match it.

---

*This document should be kept at the root of the repo as `CONTEXT.md` and updated as the project evolves.*
