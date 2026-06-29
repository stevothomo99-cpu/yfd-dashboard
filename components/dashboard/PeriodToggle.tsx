"use client";

import type { PeriodFilter } from "@/types/dashboard";

interface PeriodToggleProps {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}

const OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "ytd", label: "YTD" },
];

export default function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "#f5f4f0",
        border: "0.5px solid #e1e0d9",
        borderRadius: "8px",
        padding: "3px",
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: "5px 14px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              background: active ? "white" : "transparent",
              color: active ? "#111111" : "#888780",
              border: "none",
              cursor: "pointer",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
