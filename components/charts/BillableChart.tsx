"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { name: "MS", billable: 22, nonBillable: 3 },
  { name: "JR", billable: 19.5, nonBillable: 4.5 },
  { name: "AC", billable: 17, nonBillable: 5 },
  { name: "BT", billable: 15, nonBillable: 6 },
  { name: "LG", billable: 13, nonBillable: 7 },
];

export default function BillableChart() {
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
          🕐 Billable vs non-billable (week)
        </div>
      </div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "10px" }}>
        {[
          { color: "#2a78d6", label: "Billable" },
          { color: "#888780", label: "Non-billable" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: l.color }} />
            <span style={{ fontSize: "11px", color: "#444441" }}>{l.label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={20}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Bar dataKey="billable" stackId="a" fill="#2a78d6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="nonBillable" stackId="a" fill="#888780" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}