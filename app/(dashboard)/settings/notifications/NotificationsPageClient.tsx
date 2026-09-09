"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";

interface DefinitionSummary {
  key: string;
  name: string;
  category: "staff" | "partner" | "client";
  audienceLabel: string;
  scheduleLabel: string;
  route: string | null;
  status: "live" | "draft";
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

interface NotificationsPageClientProps {
  definitions: DefinitionSummary[];
  staff: StaffOption[];
}

const CATEGORY_LABEL: Record<DefinitionSummary["category"], string> = {
  staff: "Staff",
  partner: "Partner",
  client: "Client",
};

const CATEGORY_COLOR: Record<DefinitionSummary["category"], { bg: string; text: string }> = {
  staff: { bg: "#E6F1FB", text: "#0C447C" },
  partner: { bg: "#F0E9FB", text: "#5B2D91" },
  client: { bg: "#FAEEDA", text: "#633806" },
};

// Draft admin UI for the practice's notification catalog -- lists every
// automated email (lib/notificationRegistry.ts is the single source of
// truth this reads from), links to a real rendered preview of each, and a
// per-notification recipients checklist. The checklist is NOT wired to any
// backend yet -- there's no per-notification recipient-override storage in
// the data model, so every checkbox here starts checked (mirroring today's
// real "every included staff/Partner" behaviour) and toggling one is purely
// local state, clearly labelled as a draft so it can't be mistaken for a
// saved change.
export default function NotificationsPageClient({ definitions, staff }: NotificationsPageClientProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [recipientState, setRecipientState] = useState<Record<string, Set<string>>>({});
  const [savedNote, setSavedNote] = useState<Record<string, string>>({});

  const partners = staff.filter((s) => s.role === "Partner");

  function candidatesFor(def: DefinitionSummary): StaffOption[] {
    if (def.category === "partner") return partners;
    if (def.category === "client") return [];
    return staff;
  }

  function isChecked(def: DefinitionSummary, staffId: string): boolean {
    const set = recipientState[def.key];
    // Undefined means "not yet touched" -- default to everyone, mirroring
    // real current behaviour (no override exists to say otherwise).
    return set ? set.has(staffId) : true;
  }

  function toggle(def: DefinitionSummary, staffId: string) {
    setRecipientState((prev) => {
      const current = prev[def.key] ?? new Set(candidatesFor(def).map((s) => s.id));
      const next = new Set(current);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return { ...prev, [def.key]: next };
    });
  }

  function handleSaveDraft(key: string) {
    setSavedNote((prev) => ({ ...prev, [key]: "Not saved -- recipient overrides aren't wired to the backend yet. This only previews the interaction." }));
    window.setTimeout(() => {
      setSavedNote((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 4000);
  }

  const staffPartnerDefs = definitions.filter((d) => d.category !== "client");
  const clientDefs = definitions.filter((d) => d.category === "client");

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Every automated email this dashboard sends — what fires when, to whom, and a real preview of each"
      />

      <div
        style={{
          fontSize: "12px",
          color: "#633806",
          background: "#FAEEDA",
          border: "0.5px solid #f0d9a8",
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "14px",
          lineHeight: 1.6,
        }}
      >
        <strong>This page is a draft.</strong> &ldquo;View template&rdquo; opens a real rendered preview (built from
        today&rsquo;s live data). The <strong>Recipients</strong> checklist is UI only for now — there&rsquo;s no
        per-notification recipient-override storage yet, so nothing you toggle here is actually saved. It exists so the interaction
        can be reviewed before that gets built.
      </div>

      <SectionHeading>Staff & Partner Notifications</SectionHeading>
      <NotificationTable
        definitions={staffPartnerDefs}
        candidatesFor={candidatesFor}
        isChecked={isChecked}
        toggle={toggle}
        expandedKey={expandedKey}
        setExpandedKey={setExpandedKey}
        savedNote={savedNote}
        onSaveDraft={handleSaveDraft}
      />

      <div style={{ marginTop: "24px" }}>
        <SectionHeading>Client Notifications</SectionHeading>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "10px", lineHeight: 1.6 }}>
          Sent to the client themselves, not to staff or Partners. New — starting with BAS Workflow. These need a
          client contact email field (not yet in the data model — <code>customers</code> only carries internal
          staff allocations today) and a schedule engine for the per-task trigger before any of this can actually
          send. See the &ldquo;Notify client&rdquo; option on the task edit modal for BAS/IAS tasks (also a draft).
        </div>
        <NotificationTable
          definitions={clientDefs}
          candidatesFor={candidatesFor}
          isChecked={isChecked}
          toggle={toggle}
          expandedKey={expandedKey}
          setExpandedKey={setExpandedKey}
          savedNote={savedNote}
          onSaveDraft={handleSaveDraft}
        />
      </div>
    </div>
  );
}

function NotificationTable({
  definitions,
  candidatesFor,
  isChecked,
  toggle,
  expandedKey,
  setExpandedKey,
  savedNote,
  onSaveDraft,
}: {
  definitions: DefinitionSummary[];
  candidatesFor: (def: DefinitionSummary) => StaffOption[];
  isChecked: (def: DefinitionSummary, staffId: string) => boolean;
  toggle: (def: DefinitionSummary, staffId: string) => void;
  expandedKey: string | null;
  setExpandedKey: (key: string | null) => void;
  savedNote: Record<string, string>;
  onSaveDraft: (key: string) => void;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 90px 1.1fr 1.5fr 130px 110px",
          padding: "12px 16px",
          background: "#fafaf8",
          borderBottom: "0.5px solid #e1e0d9",
          fontSize: "11px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <div>Name</div>
        <div>Category</div>
        <div>Audience</div>
        <div>Schedule</div>
        <div>Template</div>
        <div>Recipients</div>
      </div>

      {definitions.length === 0 ? (
        <div style={{ padding: "24px 16px", fontSize: "12px", color: "#888780" }}>Nothing here yet.</div>
      ) : (
        definitions.map((def, i) => {
          const candidates = candidatesFor(def);
          const expanded = expandedKey === def.key;
          const color = CATEGORY_COLOR[def.category];
          return (
            <div key={def.key} style={{ borderBottom: i < definitions.length - 1 ? "0.5px solid #e1e0d9" : "none" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 90px 1.1fr 1.5fr 130px 110px",
                  padding: "12px 16px",
                  alignItems: "center",
                  fontSize: "12.5px",
                  color: "#111111",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600 }}>{def.name}</span>
                  {def.status === "draft" ? (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#633806",
                        background: "#FAEEDA",
                        borderRadius: "999px",
                        padding: "2px 7px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      Draft
                    </span>
                  ) : null}
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: color.text,
                      background: color.bg,
                      borderRadius: "999px",
                      padding: "3px 8px",
                    }}
                  >
                    {CATEGORY_LABEL[def.category]}
                  </span>
                </div>
                <div style={{ color: "#444441" }}>{def.audienceLabel}</div>
                <div style={{ color: "#6b6860" }}>{def.scheduleLabel}</div>
                <div>
                  <a
                    href={`/api/admin/notifications/${def.key}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "12px", fontWeight: 500, color: "#2a78d6", textDecoration: "none" }}
                  >
                    View template ↗
                  </a>
                </div>
                <div>
                  {def.category === "client" ? (
                    <span style={{ fontSize: "12px", color: "#888780" }}>—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expanded ? null : def.key)}
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#444441",
                        background: "white",
                        border: "0.5px solid #e1e0d9",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        cursor: "pointer",
                      }}
                    >
                      {expanded ? "Hide" : `${candidates.length}`}
                    </button>
                  )}
                </div>
              </div>

              {expanded ? (
                <div style={{ padding: "4px 16px 16px 16px", background: "#fafaf8" }}>
                  {candidates.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#888780" }}>No candidates.</div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                          gap: "6px",
                          marginBottom: "10px",
                        }}
                      >
                        {candidates.map((s) => (
                          <label
                            key={s.id}
                            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#111111" }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked(def, s.id)}
                              onChange={() => toggle(def, s.id)}
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSaveDraft(def.key)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "white",
                          background: "#111111",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      {savedNote[def.key] ? (
                        <div style={{ fontSize: "11px", color: "#888780", marginTop: "8px" }}>{savedNote[def.key]}</div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111", marginBottom: "10px" }}>{children}</div>
  );
}
