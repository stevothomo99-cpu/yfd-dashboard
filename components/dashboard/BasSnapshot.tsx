const basItems = [
  { client: "Smith & Co", status: "lodged", due: "28 Jun" },
  { client: "Taylor Plumbing", status: "in-progress", due: "28 Jun" },
  { client: "Nguyen Retail", status: "lodged", due: "28 Jun" },
  { client: "Lee Constructions", status: "not-started", due: "28 Jun" },
  { client: "Patel Medical", status: "lodged", due: "28 Jun" },
  { client: "Harris Cafe", status: "lodged", due: "28 Jun" },
];

const statusStyle: Record<string, { bg: string; txt: string; label: string }> = {
  lodged: { bg: "#EAF3DE", txt: "#27500A", label: "Lodged" },
  "in-progress": { bg: "#FAEEDA", txt: "#633806", label: "In progress" },
  "not-started": { bg: "#FCEBEB", txt: "#501313", label: "Not started" },
};

export default function BasSnapshot() {
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
        <span style={{ fontSize: "11px", color: "#0C447C", cursor: "pointer" }}>
          View all →
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
      }}>
        {basItems.map((b, i) => {
          const s = statusStyle[b.status];
          return (
            <div key={i} style={{
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
                {b.client}
              </div>
              <div style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "8px",
                fontWeight: "500",
                display: "inline-block",
                background: s.bg,
                color: s.txt,
                marginBottom: "4px",
              }}>
                {s.label}
              </div>
              <div style={{ fontSize: "11px", color: "#888780" }}>
                Due {b.due}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
