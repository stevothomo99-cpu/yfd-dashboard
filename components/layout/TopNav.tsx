"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Leaderboard", href: "/dashboard/leaderboard" },
  { label: "Timesheets", href: "/dashboard/timesheets" },
  { label: "Karbon Tasks", href: "/dashboard/tasks" },
  { label: "BAS Status", href: "/dashboard/bas" },
  { label: "Clients", href: "/dashboard/clients" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <div style={{
      background: "white",
      borderBottom: "0.5px solid #e1e0d9",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "0 1rem",
      }}>
        {/* Header row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0 10px",
          borderBottom: "0.5px solid #e1e0d9",
        }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "500", color: "#111111" }}>
              YFD Operations Dashboard
            </div>
            <div style={{ fontSize: "12px", color: "#888780", marginTop: "2px" }}>
              Overseas bookkeeping team — daily overview
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              fontSize: "12px",
              color: "#444441",
              background: "#f5f4f0",
              border: "0.5px solid #e1e0d9",
            }}>
            </div>
          </div>
        </div>

        {/* Navigation row */}
        <div style={{
          display: "flex",
          gap: "2rem",
          padding: "0",
          overflow: "auto",
        }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div style={{
                  padding: "12px 0",
                  fontSize: "14px",
                  color: isActive ? "#111111" : "#888780",
                  borderBottom: isActive ? "2px solid #111111" : "none",
                  cursor: "pointer",
                  transition: "color 0.2s",
                  whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
