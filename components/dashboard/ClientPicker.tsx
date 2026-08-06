"use client";

import { useState } from "react";

interface ClientOption {
  id: string;
  name: string;
}

interface ClientPickerProps {
  clients: ClientOption[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
}

// Destination-client picker shared by the "Copy task" and "Apply template"
// modals, and the to-do populate/edit form. Tasks are client-scoped
// (migration 017) -- this used to also resolve a destination job
// (ClientJobPicker), which existed only because a task had to attach to one.
// A searchable list over the already-loaded client tiles (same
// search-then-click pattern ClientsPageClient.tsx uses for its own tile
// grid, rather than inventing a new autocomplete widget) -- no extra fetch
// needed since callers already have the full client list in memory.
export default function ClientPicker({ clients, selectedClientId, onSelectClient }: ClientPickerProps) {
  const [search, setSearch] = useState("");

  const filteredClients = search.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : clients;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={labelStyle}>Client</span>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clients…"
        style={inputStyle}
      />
      <div
        style={{
          maxHeight: "160px",
          overflowY: "auto",
          border: "0.5px solid #e1e0d9",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {filteredClients.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "10px 12px" }}>No clients match.</div>
        ) : (
          filteredClients.map((c) => {
            const active = c.id === selectedClientId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClient(c.id)}
                style={{
                  textAlign: "left",
                  fontSize: "13px",
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: "0.5px solid #e1e0d9",
                  background: active ? "#111111" : "white",
                  color: active ? "white" : "#111111",
                  cursor: "pointer",
                }}
              >
                {c.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#888780",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};
