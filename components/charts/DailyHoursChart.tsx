"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  daily: number[];
  dailyTarget?: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function DailyHoursChart({ daily, dailyTarget = 4.8 }: Props) {
  const data = DAYS.map((d, i) => ({ day: d, hours: daily[i] ?? 0 }));

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "14px" }}>
        Daily hours (Mon–Fri)
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 8]} />
          <ReferenceLine
            y={dailyTarget}
            stroke="#b4b2a9"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Bar dataKey="hours" fill="#2a78d6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: "11px", color: "#888780", marginTop: "8px" }}>
        Dashed line · {dailyTarget}h daily target
      </div>
    </div>
  );
}
