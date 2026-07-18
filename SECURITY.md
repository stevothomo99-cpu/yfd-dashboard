# Security Checklist

Working record of security work done on this app, and a shared to-do list
for applying the same patterns to the other two YFD-family products
(SiteMargin, FocablyED) since they share the same author, similar stacks
(Next.js/Vercel + Supabase), and in FocablyED's case, some literal shared
infrastructure decisions.

This started as prep for Xero's API security questionnaire (required for
the XPM/Xero Practice Manager integration) but the findings apply broadly.

## Done — yfd-dashboard

- **OAuth tokens encrypted at rest.** Xero access/refresh tokens are
  AES-256-GCM encrypted before being cached, decrypted on read. See
  `lib/crypto.ts`, wired into `lib/xpm.ts`.
- **Cached business data encrypted at rest.** Extended the same encryption
  to the actual cached practice data (XPM staff/timesheets/invoices, Karbon
  tasks/work items/users) — this is real tax/billing-adjacent business
  data, not just tokens. See `cacheGetEncrypted`/`cacheSetEncrypted` in
  `lib/cache.ts`.
- **No hardcoded credentials.** Removed the `AUTH_USERNAME`/`AUTH_PASSWORD`
  env-var login bypass; all login now goes through Supabase-backed
  `dashboard_users`.
- **API routes actually require authentication.** `proxy.ts` (this Next.js
  version's renamed `middleware.ts`) gates every route except `/login` and
  `/api/auth` behind a valid session. Additionally, `/api/admin/users`
  (list/create dashboard users) has an explicit admin-role check — the
  route-level `proxy.ts` gate only confirms *someone* is logged in, not
  that they're an admin.
- **User-attributed audit logging** on `/api/admin/users` — every
  create/list action logs the acting user's email. Not yet extended to
  other routes (see To-do below).
- **Dependency vulnerability scanning.** `.github/dependabot.yml` added
  (weekly npm version-update PRs). Repo-level "Dependabot alerts" /
  "Dependabot security updates" toggles (Settings → Code security and
  analysis) still need enabling manually — a committed config file alone
  doesn't turn those on.
- **No known OWASP Top 10 gaps found** in a manual pass: no
  `dangerouslySetInnerHTML` anywhere, no raw/string-interpolated SQL (all
  Supabase access goes through the query builder), no secrets committed to
  source control, password verification delegated entirely to Supabase
  Auth rather than implemented in-house.

## Known, accepted gaps (yfd-dashboard)

- **Log retention falls short of one year.** Vercel's own runtime log
  retention caps out at hours-to-days depending on plan tier (even the
  paid Observability Plus add-on only reaches 30 days). Logs are tamper-
  protected (platform-managed, immutable), but reaching a full year of
  retention would require a Log Drain to external long-term storage
  (e.g. a SIEM or object storage) — not currently set up. Fix if this
  becomes a hard requirement, not urgent otherwise.
- **No automated vulnerability scanning tool has been run** (Snyk, Burp,
  Nessus, etc.) — what's been done so far is a manual code-level security
  review, not a scanner/pentest. Dependabot covers dependency CVEs going
  forward, but that's narrower than a full app scan.
- **MFA/SSO not implemented.** Login is username/password only. Flagged as
  a real gap on the Xero questionnaire; not yet built (bigger piece of
  work — TOTP or an SSO provider).
- **Data residency is Singapore (`ap-southeast-1`), not Sydney.** All three
  Supabase projects — this dashboard's own `dashboard_users`, plus
  SiteMargin's and FocablyED's — are in Singapore. Vercel compute region
  is `iad1` (US East) and does **not** affect where data is stored; moving
  either would require new infra + migration, not a settings toggle. Not
  actioned — answered "Singapore" honestly on the questionnaire instead.
- **User-attributed logging is partial**, only on `/api/admin/users`. Other
  routes (Karbon, XPM, Google, HubSpot, Focably/SiteMargin metrics) don't
  tag logs with an acting user — mostly fine since those are background
  data-sync calls, not user actions, but worth revisiting if audit trail
  requirements tighten.
- **Redis provider's own at-rest encryption is unconfirmed** — the app-level
  encryption above makes this moot for the data that matters, but worth
  checking anyway.

## To-do — apply to SiteMargin and FocablyED (app + landing repos)

Neither of the other two apps has been audited yet — this is a checklist
to run through when there's time, not a confirmed list of their gaps:

- [ ] Check for a hardcoded credential bypass equivalent to what
      yfd-dashboard had (`AUTH_USERNAME`/`AUTH_PASSWORD`-style env-var
      login shortcuts are an easy thing to leave in from early scaffolding).
- [ ] Confirm API routes actually require authentication — check for a
      `proxy.ts`/`middleware.ts` (naming depends on Next.js version) gating
      routes, not just relying on client-side redirects.
- [ ] Audit any admin-only or bulk-data endpoints (user management,
      exports, anything that lists/modifies other users' data) for an
      explicit role check, not just "logged in as *someone*."
- [ ] Check whether any OAuth/API tokens or long-lived secrets are cached
      in Redis/KV in plaintext — same pattern as XPM tokens here.
- [ ] Check whether cached/stored business or PII data (subscriber info,
      billing data, student/parent data for FocablyED) is encrypted at
      rest beyond whatever the hosting platform provides by default.
- [ ] Add Dependabot (or equivalent) for dependency vulnerability scanning
      if not already present, and confirm the GitHub repo-level security
      toggles are actually on (not just the config file).
- [ ] Quick manual OWASP Top 10 pass: `dangerouslySetInnerHTML` usage, raw
      SQL/string-interpolated queries, secrets in source control, any
      sensitive value logged or passed via URL query params.
- [ ] MFA/SSO status — same gap as yfd-dashboard, likely also absent.
- [ ] Data residency — same Singapore (`ap-southeast-1`) Supabase region
      applies to both; decide once (not per-app) whether that's acceptable
      or worth migrating.

## Where this doc lives

This file lives in `yfd-dashboard` since that's where the audit started.
FocablyED's own `CLAUDE_CONTEXT.md` has a pointer to this checklist under
its own to-do section. SiteMargin doesn't have a session-accessible repo
yet — add the same pointer there once it does.
