function colorFor(score: number): string {
  if (score >= 85) return "#1baf7a";
  if (score >= 70) return "#2a78d6";
  if (score >= 55) return "#eda100";
  return "#e24b4a";
}

export default function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      style={{
        background: colorFor(score),
        color: "white",
        padding: "5px 9px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 700,
        minWidth: "32px",
        textAlign: "center",
      }}
    >
      {score}
    </div>
  );
}
