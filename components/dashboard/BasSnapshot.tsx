import BasStatusBadge from "@/components/dashboard/BasStatusBadge";
import type { BasStatus } from "@/types/dashboard";
import type { KarbonWorkItem, KarbonWorkStatus } from "@/types/karbon";

const WORK_STATUS_TO_BAS: Record<KarbonWorkStatus, BasStatus> = {
  notStarted: "not-started",
  inProgress: "in-progress",
  complete: "lodged",
};

function formatDue(d: string): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function BasSnapshot({ workItems }: { workItems: KarbonWorkItem[] }) {
  const items = workItems.slice(0, 6);

  return (
    <div style={{
      background: "white",
      border: "0.5px solid #e1e0d9",
      borderRadius: "14px",
      padding: "1.1rem 1.2rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "14px",
      }}>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "#111111" }}>
          🧾 BAS status
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>No work items found.</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}>
          {items.map((w) => (
            <div key={w.id} style={{
              border: "0.5px solid #e1e0d9",
              borderRadius: "10px",
              padding: "10px 12px",
            }}>
              <div style={{
                fontSize: "12px",
                fontWeight: "500",
                color: "#111111",
                marginBottom: "5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {w.clientName}
              </div>
              <div style={{ marginBottom: "4px" }}>
                <BasStatusBadge status={WORK_STATUS_TO_BAS[w.status]} />
              </div>
              <div style={{ fontSize: "11px", color: "#888780" }}>
                Due {formatDue(w.dueDate)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
