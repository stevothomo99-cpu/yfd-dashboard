"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import type { WorkflowStatus, WorkflowTaskType } from "@/types/workflow";
import type { AdminSnapshot } from "./page";

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
};

const buttonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 12px",
  borderRadius: "999px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
};

const dangerButtonStyle: React.CSSProperties = {
  ...ghostButtonStyle,
  color: "#e24b4a",
  border: "0.5px solid #f0b8b8",
};

interface AdminPageClientProps {
  initial: AdminSnapshot;
}

export default function AdminPageClient({ initial }: AdminPageClientProps) {
  const [statuses, setStatuses] = useState(initial.statuses);
  const [taskTypes, setTaskTypes] = useState(initial.taskTypes);
  const [banner, setBanner] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Manage statuses & types"
        subtitle="Controls what shows up in the Workflow status and type dropdowns"
        action={
          <Link href="/workflow" style={{ textDecoration: "none" }}>
            <span style={ghostButtonStyle}>← Back to Workflow</span>
          </Link>
        }
      />

      {initial.mode === "mock" ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {initial.message}
        </div>
      ) : null}
      {banner ? (
        <div
          style={{
            fontSize: "12px",
            color: "#501313",
            background: "#FCEBEB",
            border: "0.5px solid #f0b8b8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {banner}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <StatusSection statuses={statuses} onChange={setStatuses} onError={setBanner} />
        <TaskTypeSection taskTypes={taskTypes} onChange={setTaskTypes} onError={setBanner} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: 500, color: "#111111", marginBottom: "12px" }}>{title}</div>
      {children}
    </div>
  );
}

function StatusSection({
  statuses,
  onChange,
  onError,
}: {
  statuses: WorkflowStatus[];
  onChange: (statuses: WorkflowStatus[]) => void;
  onError: (message: string | null) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#888780");
  const [newIsComplete, setNewIsComplete] = useState(false);

  async function save(status: WorkflowStatus) {
    const res = await fetch(`/api/workflow/statuses/${status.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: status.name,
        color: status.color,
        sortOrder: status.sortOrder,
        isComplete: status.isComplete,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to save status.");
      return;
    }
    onError(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this status?")) return;
    const res = await fetch(`/api/workflow/statuses/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to delete status.");
      return;
    }
    onChange(statuses.filter((s) => s.id !== id));
  }

  async function add() {
    if (!newName.trim()) return;
    const res = await fetch("/api/workflow/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        color: newColor,
        sortOrder: statuses.length,
        isComplete: newIsComplete,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to add status.");
      return;
    }
    onChange([...statuses, body.status]);
    setNewName("");
    setNewColor("#888780");
    setNewIsComplete(false);
  }

  function update(id: string, patch: Partial<WorkflowStatus>) {
    onChange(statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <Card title="Task statuses">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {statuses
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((status) => (
            <div key={status.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="color"
                value={status.color}
                onChange={(e) => update(status.id, { color: e.target.value })}
                style={{ width: "32px", height: "32px", padding: 0, border: "0.5px solid #e1e0d9", borderRadius: "6px" }}
              />
              <input
                value={status.name}
                onChange={(e) => update(status.id, { name: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number"
                value={status.sortOrder}
                onChange={(e) => update(status.id, { sortOrder: Number(e.target.value) })}
                style={{ ...inputStyle, width: "56px" }}
                title="Sort order"
              />
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#888780" }}>
                <input
                  type="checkbox"
                  checked={status.isComplete}
                  onChange={(e) => update(status.id, { isComplete: e.target.checked })}
                />
                Complete
              </label>
              <button type="button" style={ghostButtonStyle} onClick={() => save(status)}>
                Save
              </button>
              <button type="button" style={dangerButtonStyle} onClick={() => remove(status.id)}>
                Delete
              </button>
            </div>
          ))}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "14px", paddingTop: "14px", borderTop: "0.5px solid #e1e0d9" }}>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ width: "32px", height: "32px", padding: 0, border: "0.5px solid #e1e0d9", borderRadius: "6px" }}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New status name"
          style={{ ...inputStyle, flex: 1 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#888780" }}>
          <input type="checkbox" checked={newIsComplete} onChange={(e) => setNewIsComplete(e.target.checked)} />
          Complete
        </label>
        <button type="button" style={buttonStyle} onClick={add}>
          Add
        </button>
      </div>
    </Card>
  );
}

function TaskTypeSection({
  taskTypes,
  onChange,
  onError,
}: {
  taskTypes: WorkflowTaskType[];
  onChange: (taskTypes: WorkflowTaskType[]) => void;
  onError: (message: string | null) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#888780");

  async function save(type: WorkflowTaskType) {
    const res = await fetch(`/api/workflow/task-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: type.name, color: type.color, sortOrder: type.sortOrder }),
    });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to save type.");
      return;
    }
    onError(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this work type?")) return;
    const res = await fetch(`/api/workflow/task-types/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to delete type.");
      return;
    }
    onChange(taskTypes.filter((t) => t.id !== id));
  }

  async function add() {
    if (!newName.trim()) return;
    const res = await fetch("/api/workflow/task-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor, sortOrder: taskTypes.length }),
    });
    const body = await res.json();
    if (!res.ok) {
      onError(body.message ?? "Failed to add type.");
      return;
    }
    onChange([...taskTypes, body.taskType]);
    setNewName("");
    setNewColor("#888780");
  }

  function update(id: string, patch: Partial<WorkflowTaskType>) {
    onChange(taskTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  return (
    <Card title="Work types">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {taskTypes
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((type) => (
            <div key={type.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="color"
                value={type.color}
                onChange={(e) => update(type.id, { color: e.target.value })}
                style={{ width: "32px", height: "32px", padding: 0, border: "0.5px solid #e1e0d9", borderRadius: "6px" }}
              />
              <input
                value={type.name}
                onChange={(e) => update(type.id, { name: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number"
                value={type.sortOrder}
                onChange={(e) => update(type.id, { sortOrder: Number(e.target.value) })}
                style={{ ...inputStyle, width: "56px" }}
                title="Sort order"
              />
              <button type="button" style={ghostButtonStyle} onClick={() => save(type)}>
                Save
              </button>
              <button type="button" style={dangerButtonStyle} onClick={() => remove(type.id)}>
                Delete
              </button>
            </div>
          ))}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "14px", paddingTop: "14px", borderTop: "0.5px solid #e1e0d9" }}>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ width: "32px", height: "32px", padding: 0, border: "0.5px solid #e1e0d9", borderRadius: "6px" }}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New work type"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" style={buttonStyle} onClick={add}>
          Add
        </button>
      </div>
    </Card>
  );
}
