// Placeholder shapes for loading.tsx route fallbacks. Without these (and
// the loading.tsx files that use them) an App Router navigation shows the
// *previous* page untouched until the whole server render resolves --
// including the XPM/Xero round trips -- so a click reads as "nothing
// happened". These exist to make that wait legible, not decorative.

export function Skeleton({
  width = "100%",
  height = 12,
  radius = 6,
  style,
}: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="yfd-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        background: "#e8e7e1",
        animation: "yfd-skeleton-pulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

// Mirrors PageHeader's title/subtitle block so the header doesn't jump when
// the real content swaps in.
export function PageHeaderSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <Skeleton width={180} height={20} />
      {subtitle ? <Skeleton width={260} height={12} style={{ marginTop: "8px" }} /> : null}
    </div>
  );
}

// The standard white card used across the workflow pages.
export function CardSkeleton({
  lines = 3,
  height,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
        minHeight: height,
      }}
    >
      <Skeleton width={90} height={10} />
      <Skeleton width={60} height={26} style={{ marginTop: "12px" }} />
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height={11} width={i === lines - 1 ? "70%" : "100%"} />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 3,
  columns = 3,
  lines = 3,
}: {
  count?: number;
  columns?: number;
  lines?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "14px",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}

// Table-shaped placeholder for the flat task/timesheet listings.
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
      }}
    >
      <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
        {[160, 120, 100, 90].map((w, i) => (
          <Skeleton key={i} width={w} height={10} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height={13} />
        ))}
      </div>
    </div>
  );
}
