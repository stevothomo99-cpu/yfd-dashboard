import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { diagnoseXpmTimesheetsForPartner, isXpmConfigured } from "@/lib/xpm";

// Walks the same call path as the real timesheet fetch, so it needs the
// same headroom.
export const maxDuration = 300;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hrs(n: number): string {
  return `${n.toFixed(1)}h`;
}

// Admin report explaining why a staff member reads as zero (or unexpectedly
// low) hours on /timesheets. Three very different causes look identical
// there, and this separates them:
//
//  - "logged nothing"    -- XPM returned no time entries for them at all.
//  - "time.api failed"   -- their per-staff call errored; the real fetch
//                           catches this per person so one failure doesn't
//                           sink the whole load, which means it otherwise
//                           presents as a genuine zero.
//  - "all discarded"     -- they logged time, but against jobs outside the
//                           Partner's job list, so fetchXpmTimesheetsForPartner
//                           dropped every entry. That happens when the job's
//                           client is allocated to another Account Manager,
//                           has none set at all, or is archived.
//
// The last case is the interesting one: the hours exist in XPM and are
// invisible here, and the fix is an allocation change in XPM (see
// /api/xpm/client-allocations).
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
    if (!partner) {
      return NextResponse.json(
        { error: "No Partner configured in Settings, and no ?partner= given." },
        { status: 400 },
      );
    }

    const rows = await diagnoseXpmTimesheetsForPartner(partner);

    const verdict = (r: (typeof rows)[number]) => {
      if (r.fetchFailed) return { label: "time.api call FAILED", cls: "bad" };
      if (r.rawEntries === 0) return { label: "No time logged in XPM", cls: "muted" };
      if (r.keptEntries === 0) return { label: "All entries discarded", cls: "warn" };
      if (r.droppedEntries > 0) return { label: "Some entries discarded", cls: "warn" };
      return { label: "OK", cls: "ok" };
    };

    // Anyone with something worth explaining first; healthy rows after.
    const interesting = rows.filter((r) => verdict(r).cls !== "ok");
    const healthy = rows.filter((r) => verdict(r).cls === "ok");

    const row = (r: (typeof rows)[number]) => {
      const v = verdict(r);
      return `
      <tr class="${v.cls}">
        <td>${escapeHtml(r.staffName)}</td>
        <td class="v">${v.label}</td>
        <td class="n">${r.rawEntries}</td>
        <td class="n">${hrs(r.keptHours)}</td>
        <td class="n">${r.droppedEntries ? hrs(r.droppedHours) : "—"}</td>
        <td>${
          r.droppedJobs.length
            ? r.droppedJobs
                .slice(0, 8)
                .map((j) => `${escapeHtml(j.name)} <span class="dim">(${hrs(j.hours)})</span>`)
                .join("<br>") +
              (r.droppedJobs.length > 8 ? `<br><span class="dim">+${r.droppedJobs.length - 8} more</span>` : "")
            : `<span class="dim">—</span>`
        }</td>
      </tr>`;
    };

    const totalDropped = rows.reduce((a, r) => a + r.droppedHours, 0);

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Timesheet gaps</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 40px auto; padding: 0 20px 60px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
  .count { display: inline-block; margin-right: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px; }
  caption { text-align: left; font-size: 13px; font-weight: 600; padding: 0 0 8px; }
  th { text-align: left; padding: 8px 10px; background: #f5f4f0; border-bottom: 1px solid #e1e0d9; font-weight: 500; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; }
  td.v { white-space: nowrap; font-weight: 500; }
  tr.bad { background: #FCEBEB; } tr.bad td.v { color: #A32D2D; }
  tr.warn { background: #FAEEDA; } tr.warn td.v { color: #633806; }
  tr.muted td.v { color: #888; font-weight: 400; }
  tr.ok td.v { color: #0d6b47; }
  .dim { color: #999; }
  .note { font-size: 12px; color: #666; background: #f5f4f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 26px; line-height: 1.55; }
</style>
</head><body>
  <h1>Timesheet gaps — why someone reads as zero hours</h1>
  <div class="sub">
    <span class="count">Partner: <strong>${escapeHtml(partner)}</strong></span>
    <span class="count"><strong>${rows.length}</strong> staff in XPM</span>
    <span class="count"><strong style="color:#633806">${hrs(totalDropped)}</strong> logged but discarded</span>
  </div>

  <div class="note">
    <strong>Discarded</strong> means the person logged time in XPM against a job that isn't in this
    Partner's job list, so <code>fetchXpmTimesheetsForPartner</code> dropped it. That happens when the
    job's client is allocated to a different Account Manager, has none set at all, or is archived — the
    hours are real and simply invisible here. Fix the allocation in XPM
    (see <a href="/api/xpm/client-allocations">client allocations</a>), then resync.
    Figures cover the same rolling window the live timesheet fetch uses, and are not cached.
  </div>

  <table>
    <caption>Needs attention — ${interesting.length}</caption>
    <thead><tr>
      <th>Staff</th><th>Verdict</th><th>Raw entries</th><th>Counted</th><th>Discarded</th><th>Jobs whose time was discarded</th>
    </tr></thead>
    <tbody>${interesting.map(row).join("") || `<tr><td colspan="6"><span class="dim">Nothing to flag.</span></td></tr>`}</tbody>
  </table>

  <table>
    <caption>Healthy — ${healthy.length}</caption>
    <thead><tr>
      <th>Staff</th><th>Verdict</th><th>Raw entries</th><th>Counted</th><th>Discarded</th><th>Jobs whose time was discarded</th>
    </tr></thead>
    <tbody>${healthy.map(row).join("") || `<tr><td colspan="6"><span class="dim">None.</span></td></tr>`}</tbody>
  </table>
</body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
