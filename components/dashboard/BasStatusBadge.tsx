import type { BasStatus } from "@/types/dashboard";

const STYLES: Record<BasStatus, { bg: string; txt: string; label: string }> = {
  lodged: { bg: "#EAF3DE", txt: "#27500A", label: "Lodged" },
  "in-progress": { bg: "#FAEEDA", txt: "#633806", label: "In progress" },
  "not-started": { bg: "#FCEBEB", txt: "#501313", label: "Not started" },
};

export default function BasStatusBadge({ status }: { status: BasStatus }) {
  const s = STYLES[status];
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "3px 9px",
        borderRadius: "8px",
        fontWeight: 500,
        background: s.bg,
        color: s.txt,
        display: "inline-block",
      }}
    >
      {s.label}
    </span>
  );
}
