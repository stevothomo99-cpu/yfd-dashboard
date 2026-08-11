import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";

// Nav-gated only, same convention as Karbon Import -- no server-side
// redirect exists for the other settings sub-routes either, so this
// doesn't add a new pattern. Purely informational (static notes on the
// automated email schedule, §6.4/§6.8 in CONTEXT.md) -- there's nothing
// here that mutates state, so no API route to separately gate.
export default async function EmailSchedulePage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Email Schedule" />
        <div style={{ fontSize: "13px", color: "#888780" }}>Admins only.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Email Schedule"
        subtitle="Notes on the dashboard's automated weekly emails — what fires when, to whom, and why"
      />

      <div
        style={{
          fontSize: "12px",
          color: "#633806",
          background: "#FAEEDA",
          border: "0.5px solid #f0d9a8",
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "14px",
          lineHeight: 1.6,
        }}
      >
        None of this sends real mail yet — every entry below is gated behind Resend being configured
        (<code>RESEND_API_KEY</code>/<code>RESEND_FROM_EMAIL</code>) and degrades to logging instead of
        crashing when it isn&rsquo;t. Each cron also needs <code>CRON_SECRET</code> set in Vercel — Vercel
        Cron sends it as the request&rsquo;s bearer token automatically once the env var exists, and every
        route below rejects the request outright if it&rsquo;s missing. Five cron jobs also need to fit
        this project&rsquo;s Vercel plan limits — check those if fewer emails run than the table below
        expects.
      </div>

      <ScheduleTable />

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.2rem 1.4rem",
          marginTop: "14px",
        }}
      >
        <SectionHeading>Why two timesheet nudges before midday?</SectionHeading>
        <Note>
          Timesheet Reminder #1 (8am) is a plain ask with no hours data — everyone gets it, whether
          they&rsquo;re on track or not. Timesheet Reminder #2 (10am) only goes to whoever&rsquo;s still
          short of last week&rsquo;s standard hours by then, so someone who submitted first thing doesn&rsquo;t
          get a second, unnecessary email.
        </Note>
        <SectionHeading style={{ marginTop: "14px" }}>Why does the Timesheet Overview (midday) exist alongside Reminder #2?</SectionHeading>
        <Note>
          Reminder #2 only looks at last week. A gap from six weeks ago that never got backfilled would
          otherwise never be mentioned again once that week&rsquo;s nudge stops firing. The midday Timesheet
          Overview instead walks every completed week since the start of the current FY and lists every one
          that&rsquo;s still short, plus the person&rsquo;s own YTD billable % and logged %, so the whole open
          backlog stays visible — not just the most recent gap. Someone short this week can receive both
          Reminder #2 and the Timesheet Overview in the same morning; they answer different questions.
        </Note>
        <SectionHeading style={{ marginTop: "14px" }}>Why does the Overdue Summary fire Sunday night, not Monday morning?</SectionHeading>
        <Note>
          It&rsquo;s Partner-facing and deliberately a night ahead of the Workflow Update everyone else
          gets Monday morning, so whoever&rsquo;s reading it sees where the firm stands before the week
          starts, not at the same moment as everyone else&rsquo;s own report.
        </Note>
      </div>
    </div>
  );
}

interface ScheduleRow {
  order: number;
  name: string;
  audience: string;
  time: string;
  route: string;
  content: string;
}

const SCHEDULE: ScheduleRow[] = [
  {
    order: 1,
    name: "Overdue Summary",
    audience: "Partner",
    time: "Sun 8:00pm AEST",
    route: "/api/reports/overdue-summary",
    content: "Firm-wide overdue tasks across all staff, top overdue clients, per-staff mini-summary, prior-week/FYTD hours.",
  },
  {
    order: 2,
    name: "Workflow Update",
    audience: "Each employee",
    time: "Mon 7:00am AEST",
    route: "/api/reports/monday-report",
    content: "Their own overdue / due this week / due later tasks, plus BAS/IAS and Payroll deadline tiles.",
  },
  {
    order: 3,
    name: "Timesheet Reminder #1",
    audience: "Each employee",
    time: "Mon 8:00am AEST",
    route: "/api/reports/timesheet-reminder",
    content: "Plain “please submit last week's timesheet” ask — no hours data, sent regardless of status.",
  },
  {
    order: 4,
    name: "Timesheet Reminder #2",
    audience: "Employees still short",
    time: "Mon 10:00am AEST",
    route: "/api/reports/timesheet-reminder-2",
    content: "Last week's hours logged vs. standard 38hr week, for whoever hasn't caught up since Reminder #1.",
  },
  {
    order: 5,
    name: "Timesheet Summary",
    audience: "Partner",
    time: "Mon 12:00pm AEST",
    route: "/api/reports/timesheet-followup",
    content: "Who's still incomplete for last week, plus a YTD billable-against-capacity overview (Partners excluded).",
  },
  {
    order: 6,
    name: "Timesheet Overview",
    audience: "Employees still short",
    time: "Mon 12:00pm AEST",
    route: "/api/reports/timesheet-followup",
    content: "Every incomplete week this FY (not just last week), running total, and their own YTD billable %/logged %.",
  },
];

function ScheduleTable() {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1.1fr 1.1fr 130px 1.6fr",
          padding: "12px 16px",
          background: "#fafaf8",
          borderBottom: "0.5px solid #e1e0d9",
          fontSize: "11px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <div>#</div>
        <div>Email</div>
        <div>Audience</div>
        <div>When (AEST)</div>
        <div>What it contains</div>
      </div>

      {SCHEDULE.map((row, i) => (
        <div
          key={row.order}
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1.1fr 1.1fr 130px 1.6fr",
            padding: "12px 16px",
            borderBottom: i < SCHEDULE.length - 1 ? "0.5px solid #e1e0d9" : "none",
            fontSize: "12.5px",
            color: "#111111",
          }}
        >
          <div style={{ color: "#888780", fontWeight: 500 }}>{row.order}</div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ color: "#444441" }}>{row.audience}</div>
          <div style={{ color: "#444441", whiteSpace: "nowrap" }}>{row.time}</div>
          <div style={{ color: "#6b6860", lineHeight: 1.5 }}>{row.content}</div>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111", marginBottom: "6px", ...style }}>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "12.5px", color: "#6b6860", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
