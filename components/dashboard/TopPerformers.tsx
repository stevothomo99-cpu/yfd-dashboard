import { initialsOf } from "@/lib/utils";
import type { StaffStats } from "@/lib/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];
const COLORS = [
  { color: "#2a78d6", bg: "#E6F1FB", txt: "#0C447C" },
  { color: "#1baf7a", bg: "#E1F5EE", txt: "#085041" },
  { color: "#eda100", bg: "#FAEEDA", txt: "#633806" },
];

export default function TopPerformers({ staff }: { staff: StaffStats[] }) {
  const top = [...staff].sort((a, b) => b.partialScore - a.partialScore).slice(0, 3);

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
          🏆 Top performers (partial score)
        </div>
      </div>

      {top.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>No staff found.</div>
      ) : (
        top.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 6px",
              borderBottom: i < top.length - 1 ? "0.5px solid #e1e0d9" : "none",
            }}
          >
            <div style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{MEDALS[i]}</div>

            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: COLORS[i].bg,
                color: COLORS[i].txt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
              }}
            >
              {initialsOf(s.name)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>{s.name}</div>
              <div style={{ fontSize: "12px", color: "#6b6b6b", marginTop: 2 }}>
                {s.tasksDone}/{s.totalTasks} tasks done
              </div>
            </div>

            <div style={{ marginLeft: "8px" }}>
              <div
                style={{
                  background: COLORS[i].color,
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 8,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {s.partialScore}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
