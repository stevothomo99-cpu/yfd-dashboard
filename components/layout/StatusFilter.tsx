"use client";

import { useEffect, useRef, useState } from "react";

export type StatusFilterMode = "include" | "exclude";

export interface StatusFilterValue {
  selected: string[];
  mode: StatusFilterMode;
}

interface StatusFilterProps {
  options: string[];
  value: StatusFilterValue;
  onChange: (next: StatusFilterValue) => void;
}

export function applyStatusFilter<T extends { rawStatus: string }>(
  items: T[],
  filter: StatusFilterValue,
): T[] {
  if (filter.selected.length === 0) return items;
  return items.filter((item) => {
    const inSet = filter.selected.includes(item.rawStatus);
    return filter.mode === "include" ? inSet : !inSet;
  });
}

export default function StatusFilter({ options, value, onChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleStatus(status: string) {
    const selected = value.selected.includes(status)
      ? value.selected.filter((s) => s !== status)
      : [...value.selected, status];
    onChange({ selected, mode: value.mode });
  }

  const summary =
    value.selected.length === 0
      ? "All statuses"
      : `${value.mode === "exclude" ? "Excluding" : "Only"}: ${value.selected.join(", ")}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: "12px",
          fontWeight: 500,
          padding: "6px 14px",
          borderRadius: "999px",
          background: value.selected.length > 0 ? "#E6F1FB" : "white",
          color: value.selected.length > 0 ? "#0C447C" : "#444441",
          border: "0.5px solid " + (value.selected.length > 0 ? "#2a78d6" : "#e1e0d9"),
          cursor: "pointer",
          whiteSpace: "nowrap",
          maxWidth: "320px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {summary} ▾
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            background: "white",
            border: "0.5px solid #e1e0d9",
            borderRadius: "10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "10px",
            minWidth: "220px",
          }}
        >
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {(["include", "exclude"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ selected: value.selected, mode: m })}
                style={{
                  flex: 1,
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  background: value.mode === m ? "#111111" : "#f5f4f0",
                  color: value.mode === m ? "white" : "#444441",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m === "include" ? "Show only" : "Hide"}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {options.map((status) => (
              <label
                key={status}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#111111",
                  padding: "5px 6px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={value.selected.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {status}
              </label>
            ))}
          </div>

          {value.selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange({ selected: [], mode: value.mode })}
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: "#888780",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
