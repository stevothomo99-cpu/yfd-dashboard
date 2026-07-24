import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchXpmClientAllocationReport, isXpmConfigured } from "@/lib/xpm";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// One-off admin report (not linked from nav) -- every active client in
// XPM with its Account Manager (Partner) and Job Manager (Staff) as
// currently set, so allocation gaps/mistakes can be found and fixed at the
// source in XPM. Clients missing an Account Manager are sorted to the top
// and highlighted -- those are exactly the ones that silently fail to sync
// into the dashboard at all (see lib/xpm.ts's fetchActiveXpmClientsForPartner).
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!isXpmConfigured()) {
    return NextResponse.json({ error: "XPM is not configured." }, { status: 400 });
  }

  try {
    const clients = await fetchXpmClientAllocationReport();
    const missing = clients.filter((c) => !c.accountManagerName);
    const allocated = clients.filter((c) => c.accountManagerName);

    const row = (c: (typeof clients)[number]) => `
      <tr class="${c.accountManagerName ? "" : "missing"}">
        <td>${escapeHtml(c.name)}</td>
        <td>${c.accountManagerName ? escapeHtml(c.accountManagerName) : "<em>None set</em>"}</td>
        <td>${c.jobManagerName ? escapeHtml(c.jobManagerName) : "<em>None set</em>"}</td>
      </tr>`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>XPM Client Allocations</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; background: #f5f4f0; border-bottom: 1px solid #e1e0d9; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  tr.missing { background: #FCEBEB; }
  tr.missing td:nth-child(2) { color: #A32D2D; font-weight: 600; }
  em { color: #888; font-style: normal; }
  .count { display: inline-block; margin-right: 16px; font-size: 13px; }
</style>
</head><body>
  <h1>XPM Client Allocations</h1>
  <div class="sub">
    <span class="count"><strong>${clients.length}</strong> active clients</span>
    <span class="count"><strong style="color:#A32D2D">${missing.length}</strong> missing an Account Manager</span>
  </div>
  <table>
    <thead><tr><th>Client</th><th>Account Manager (Partner)</th><th>Job Manager (Staff)</th></tr></thead>
    <tbody>
      ${missing.map(row).join("")}
      ${allocated.map(row).join("")}
    </tbody>
  </table>
</body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
