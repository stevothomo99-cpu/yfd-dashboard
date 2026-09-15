import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

// Landing page for the Reports section (nav-gated to admins, same as
// Business KPIs/Team/BAS Status -- see components/layout/TopNav.tsx). Just a
// list of links today; more reports get added here as they're built, same
// pattern as Settings' sub-page tabs.
const REPORTS = [
  {
    href: "/reports/revenue-by-client",
    title: "Revenue by Client",
    description:
      "Hours logged vs. hours budgeted, average monthly cost, and average hour cost vs. income, per client.",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="More reports will be added here over time." />
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} style={{ textDecoration: "none" }}>
            <div style={reportCardStyle}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#111111" }}>{r.title}</div>
              <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>{r.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const reportCardStyle: React.CSSProperties = {
  background: "white",
  border: "0.5px solid #e1e0d9",
  borderRadius: "14px",
  padding: "1rem 1.2rem",
  cursor: "pointer",
};
