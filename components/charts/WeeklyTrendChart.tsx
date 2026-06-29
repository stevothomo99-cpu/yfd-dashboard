"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const data = [
  { week: "Wk 20", billable: 74, nonBillable: 26, available: 120 },
  { week: "Wk 21", billable: 78, nonBillable: 22, available: 120 },
  { week: "Wk 22", billable: 82, nonBillable: 18, available: 120 },
  { week: "Wk 23", billable: 71, nonBillable: 24, available: 120 },
  { week: "Wk 24", billable: 85, nonBillable: 15, available: 120 },
  { week: "Wk 25", billable: 88, nonBillable: 12, available: 120 },
  { week: "Wk 26", billable: 84, nonBillable: 16, available: 120 },
  { week: "Wk 27", billable: 91.5, nonBillable: 18.5, available: 120 },
];

export default function WeeklyTrendChart() {
  return (
    <div style={{
      background: "white",
      border: "0.5px solid #e1e0d9",
      borderRadius: "14px",
      padding: "1.1rem 1.2rem",
    }}>
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "#111111" }}>
          📊 Weekly trend — hrs vs available
        </div>
      </div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "10px", flexWrap: "wrap" }}>
        {[
          { color: "#2a78d6", label: "Billable" },
          { color: "#1baf7a", label: "Non-billable" },
          { color: "#b4b2a9", label: "Available" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: l.color }} />
            <span style={{ fontSize: "11px", color: "#444441" }}>{l.label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 140]} />
          <Bar dataKey="billable" stackId="a" fill="#2a78d6" />
          <Bar dataKey="nonBillable" stackId="a" fill="#1baf7a" radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="available"
            stroke="#b4b2a9"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}