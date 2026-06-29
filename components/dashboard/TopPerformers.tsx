import React from "react";

const performers = [
  {
    initials: "MS",
    name: "Maria Santos",
    pct: "88% billable",
    score: 91,
    color: "#2a78d6",
    bg: "#E6F1FB",
    txt: "#0C447C",
    medal: "🥇",
  },
  {
    initials: "JR",
    name: "Jay Reyes",
    pct: "81% billable",
    score: 85,
    color: "#1baf7a",
    bg: "#E1F5EE",
    txt: "#085041",
    medal: "🥈",
  },
  {
    initials: "AC",
    name: "Ana Cruz",
    pct: "77% billable",
    score: 79,
    color: "#eda100",
    bg: "#FAEEDA",
    txt: "#633806",
    medal: "🥉",
  },
];

export default function TopPerformers(): JSX.Element {
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
          🏆 Top performers this week
        </div>
        <span style={{ fontSize: "11px", color: "#0C447C", cursor: "pointer" }}>
          See all →
        </span>
      </div>

      {performers.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 6px",
            borderBottom: i < performers.length - 1 ? "0.5px solid #e1e0d9" : "none",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{p.medal}</div>

          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: p.bg,
              color: p.txt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
            }}
          >
            {p.initials}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>{p.name}</div>
            <div style={{ fontSize: "12px", color: "#6b6b6b", marginTop: 2 }}>{p.pct}</div>
          </div>

          <div style={{ marginLeft: "8px" }}>
            <div
              style={{
                background: p.color,
                color: "white",
                padding: "6px 8px",
                borderRadius: 8,
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              {p.score}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
