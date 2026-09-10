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
//
// `query` is null whenever the list is closed -- the input then shows
// whatever client selectedClientId currently resolves to (or blank), and
// picking a row or clicking away both return it to null. This used to be a
// single `search` string with the list always rendered underneath, which
// read as "frozen": selecting a row only ever changed which row was
// highlighted -- the input text and the full list stayed exactly as they
// were, with nothing visibly closing.
export default function ClientPicker({ clients, selectedClientId, onSelectClient }: ClientPickerProps) {
  const [query, setQuery] = useState<string | null>(null);
  const selected = clients.find((c) => c.id === selectedClientId) ?? null;
  const isOpen = query !== null;

  const filteredClients = isOpen && query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "6px" }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setQuery(null);
        }
      }}
    >
      <span style={labelStyle}>Client</span>
      <input
        type="search"
        value={isOpen ? query : selected?.name ?? ""}
        onFocus={() => setQuery("")}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        style={inputStyle}
      />
      {isOpen ? (
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
                  onClick={() => {
                    onSelectClient(c.id);
                    setQuery(null);
                  }}
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
      ) : null}
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
