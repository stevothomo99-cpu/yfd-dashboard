"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";

const navItems = [
  { label: "Business KPIs", href: "/personal" },
  { label: "Team", href: "/team" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Timesheets", href: "/timesheets" },
  { label: "Karbon Tasks", href: "/tasks" },
  { label: "BAS Status", href: "/bas" },
  { label: "Clients", href: "/clients" },
  { label: "Settings", href: "/settings" },
];

interface TopNavProps {
  userName: string | null;
}

export default function TopNav({ userName }: TopNavProps) {
  const pathname = usePathname();

  return (
    <div
      style={{
        background: "white",
        borderBottom: "0.5px solid #e1e0d9",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 1rem" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 0 10px",
            borderBottom: "0.5px solid #e1e0d9",
          }}
        >
          <div>
            <div style={{ fontSize: "16px", fontWeight: 500, color: "#111111" }}>
              YFD Operations Dashboard
            </div>
            <div style={{ fontSize: "12px", color: "#888780", marginTop: "2px" }}>
              Overseas bookkeeping team — daily overview
            </div>
          </div>

          {userName ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 10px 4px 4px",
                  background: "#f5f4f0",
                  border: "0.5px solid #e1e0d9",
                  borderRadius: "999px",
                }}
              >
                <StaffAvatar initials={initialsOf(userName)} size={24} />
                <span style={{ fontSize: "12px", color: "#444441", fontWeight: 500 }}>
                  {userName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "white",
                  color: "#444441",
                  border: "0.5px solid #e1e0d9",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        {/* Navigation row */}
        <div
          style={{
            display: "flex",
            gap: "2rem",
            padding: 0,
            overflow: "auto",
          }}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  style={{
                    padding: "12px 0",
                    fontSize: "14px",
                    color: isActive ? "#111111" : "#888780",
                    borderBottom: isActive ? "2px solid #111111" : "none",
                    cursor: "pointer",
                    transition: "color 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
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
