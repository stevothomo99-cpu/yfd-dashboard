import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { fetchXpmClientAllocationReport, isXpmConfigured } from "@/lib/xpm";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Admin audit report (not linked from nav) -- every active client in XPM
// with its Account Manager (our "Partner") and Job Manager (our "Manager"),
// as currently set at the source, so allocation gaps can be found and fixed
// in XPM rather than discovered one at a time when something silently fails
// to sync.
//
// Reads live from XPM rather than our own customers table on purpose: the
// gaps this is meant to find are exactly the rows that never made it into
// that table, so querying it would hide them.
//
// Three sections, in the order they need acting on:
//  1. Your clients with no Job Manager -- they sync, but land with nobody
//     to filter them by on /clients.
//  2. Clients with no Account Manager at all -- these don't sync at all,
//     and are indistinguishable from a deliberate exclusion in our data.
//  3. Your clients, fully allocated -- the healthy set, for reference.
//
// ?partner=<name> overrides which Account Manager counts as "yours";
// defaults to the Partner configured in Settings.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!isXpmConfigured()) {
    return NextResponse.json({ error: "XPM is not configured." }, { status: 400 });
  }

  try {
    const settings = await getSettings();
    const partner = (request.nextUrl.searchParams.get("partner") ?? settings.partnerName).trim();

    const clients = await fetchXpmClientAllocationReport();

    const noAccountManager = clients.filter((c) => !c.accountManagerName);
    const mine = partner
      ? clients.filter((c) => c.accountManagerName === partner)
      : [];
    const mineNoManager = mine.filter((c) => !c.jobManagerName);
    const mineAllocated = mine.filter((c) => c.jobManagerName);
    const otherPartners = clients.filter(
      (c) => c.accountManagerName && c.accountManagerName !== partner,
    );

    // Every distinct Account Manager with a count, so it's obvious whether
    // `partner` was spelled the way XPM has it -- a mismatch otherwise just
    // shows an empty report with no explanation.
    const byAccountManager = new Map<string, number>();
    for (const c of clients) {
      if (!c.accountManagerName) continue;
      byAccountManager.set(c.accountManagerName, (byAccountManager.get(c.accountManagerName) ?? 0) + 1);
    }

    const row = (c: (typeof clients)[number], flag?: "no-am" | "no-jm") => `
      <tr class="${flag ?? ""}">
        <td>${escapeHtml(c.name)}</td>
        <td>${c.accountManagerName ? escapeHtml(c.accountManagerName) : "<em>None set</em>"}</td>
        <td>${c.jobManagerName ? escapeHtml(c.jobManagerName) : "<em>None set</em>"}</td>
      </tr>`;

    const table = (
      rows: string,
      caption: string,
    ) => `
      <table>
        <caption>${caption}</caption>
        <thead><tr><th>Client</th><th>Account Manager (Partner)</th><th>Job Manager (Manager)</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3"><em>None.</em></td></tr>`}</tbody>
      </table>`;

    const partnerLinks = Array.from(byAccountManager.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([name, count]) =>
          `<a href="?partner=${encodeURIComponent(name)}"${name === partner ? ' class="on"' : ""}>${escapeHtml(name)} (${count})</a>`,
      )
      .join(" ");

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>XPM Client Allocations</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 980px; margin: 40px auto; padding: 0 20px 60px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 8px; }
  .partners { margin: 14px 0 28px; font-size: 12px; }
  .partners a { display: inline-block; margin: 0 8px 6px 0; padding: 4px 10px; border-radius: 999px; border: 1px solid #e1e0d9; color: #444; text-decoration: none; }
  .partners a.on { background: #111; color: #fff; border-color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 34px; }
  caption { text-align: left; font-size: 13px; font-weight: 600; padding: 0 0 8px; }
  th { text-align: left; padding: 8px 10px; background: #f5f4f0; border-bottom: 1px solid #e1e0d9; font-weight: 500; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  tr.no-am { background: #FCEBEB; }
  tr.no-am td:nth-child(2) { color: #A32D2D; font-weight: 600; }
  tr.no-jm { background: #FAEEDA; }
  tr.no-jm td:nth-child(3) { color: #633806; font-weight: 600; }
  em { color: #888; font-style: normal; }
  .count { display: inline-block; margin-right: 16px; font-size: 13px; }
  .note { font-size: 12px; color: #666; background: #f5f4f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 28px; line-height: 1.5; }
</style>
</head><body>
  <h1>XPM Client Allocations</h1>
  <div class="sub">
    <span class="count"><strong>${clients.length}</strong> active clients in XPM</span>
    <span class="count"><strong>${mine.length}</strong> with Account Manager = ${partner ? escapeHtml(partner) : "<em>none selected</em>"}</span>
    <span class="count"><strong style="color:#633806">${mineNoManager.length}</strong> of those with no Job Manager</span>
    <span class="count"><strong style="color:#A32D2D">${noAccountManager.length}</strong> with no Account Manager at all</span>
  </div>
  <div class="partners">Account Manager: ${partnerLinks || "<em>none found</em>"}</div>

  <div class="note">
    Archived and deleted clients are already excluded. <strong>Account Manager</strong> is what this
    dashboard calls the Partner and is what scopes the whole sync; <strong>Job Manager</strong> is what
    it calls the Manager, and is what a client tile shows and filters by on Clients.
    Both are set on the client record in XPM — fix them there, then resync from Settings.
  </div>

  ${table(
    mineNoManager.map((c) => row(c, "no-jm")).join(""),
    `1 · Your clients with no Job Manager — ${mineNoManager.length}. These sync, but arrive with no Manager to filter by.`,
  )}

  ${table(
    noAccountManager.map((c) => row(c, "no-am")).join(""),
    `2 · Clients with no Account Manager at all — ${noAccountManager.length}. These do not sync into the dashboard at all, and are indistinguishable from a deliberate exclusion.`,
  )}

  ${table(
    mineAllocated.map((c) => row(c)).join(""),
    `3 · Your clients, fully allocated — ${mineAllocated.length}.`,
  )}

  ${table(
    otherPartners.map((c) => row(c)).join(""),
    `4 · Clients allocated to another Account Manager — ${otherPartners.length}. Excluded from your sync by design.`,
  )}
</body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
