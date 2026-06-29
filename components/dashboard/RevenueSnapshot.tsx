const clients = [
  { name: "Smith & Co", ytd: 18400, target: 22000 },
  { name: "Patel Medical", ytd: 16700, target: 16000 },
  { name: "Taylor Plumbing", ytd: 14200, target: 15000 },
  { name: "Mori Imports", ytd: 12300, target: 13500 },
  { name: "Nguyen Retail", ytd: 11800, target: 12000 },
  { name: "ABC Tradie Co", ytd: 10200, target: 11000 },
];

function fmt(v: number) {
  return "$" + (v / 1000).toFixed(1) + "k";
}

export default function RevenueSnapshot() {
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
          💰 YTD revenue — top clients (FY25)
        </div>
        <span style={{ fontSize: "11px", color: "#0C447C", cursor: "pointer" }}>
          All clients →
        </span>
      </div>

      {clients.map((c, i) => {
        const pct = Math.min(Math.round((c.ytd / c.target) * 100), 100);
        const color = pct >= 100 ? "#1baf7a" : pct >= 75 ? "#eda100" : "#e24b4a";
        return (
          <div key={i} style={{ marginBottom: "10px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "3px",
            }}>
              <span style={{
                fontSize: "12px",
                color: "#111111",
                fontWeight: "500",
              }}>
                {c.name}
              </span>
              <span style={{ fontSize: "12px", fontWeight: "500", color }}>
                {fmt(c.ytd)}{" "}
                <span style={{ fontSize: "10px", color: "#888780", fontWeight: "400" }}>
                  {pct}%
                </span>
              </span>
            </div>
            <div style={{
              height: "5px",
              background: "#f5f4f0",
              borderRadius: "4px",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: color,
                borderRadius: "4px",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}