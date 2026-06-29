"use client";

import StaffAvatar from "@/components/dashboard/StaffAvatar";
import type { StaffMember } from "@/types/dashboard";

interface StaffSlicerProps {
  staff: StaffMember[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export default function StaffSlicer({ staff, selectedId, onChange }: StaffSlicerProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        padding: "12px 0 18px",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          fontSize: "12px",
          fontWeight: 500,
          padding: "6px 12px",
          borderRadius: "999px",
          background: selectedId === null ? "#111111" : "white",
          color: selectedId === null ? "white" : "#444441",
          border: "0.5px solid " + (selectedId === null ? "#111111" : "#e1e0d9"),
          cursor: "pointer",
        }}
      >
        All staff
      </button>

      {staff.map((s) => {
        const isActive = selectedId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            title={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px 4px 4px",
              borderRadius: "999px",
              background: isActive ? "#E6F1FB" : "white",
              border: "0.5px solid " + (isActive ? "#2a78d6" : "#e1e0d9"),
              cursor: "pointer",
            }}
          >
            <StaffAvatar
              initials={s.initials}
              size={26}
              bg={isActive ? "#2a78d6" : "#f5f4f0"}
              txt={isActive ? "white" : "#444441"}
            />
            <span style={{ fontSize: "12px", color: "#111111", fontWeight: 500 }}>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
