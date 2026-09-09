import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import { listStaff } from "@/lib/workflow";
import { NOTIFICATION_DEFINITIONS } from "@/lib/notificationRegistry";
import NotificationsPageClient from "./NotificationsPageClient";

// Nav-gated only, same convention as Karbon Import / Email Schedule -- no
// server-side redirect exists for the other settings sub-routes either.
// Supersedes the old static Email Schedule notes page: same schedule
// information, now interactive (a real "View template" preview per
// notification, plus a draft recipients checklist) rather than a plain
// table + prose.
export default async function NotificationsSettingsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <div style={{ fontSize: "13px", color: "#888780" }}>Admins only.</div>
      </div>
    );
  }

  const staff = (await listStaff()).map((s) => ({ id: s.id, name: s.name, role: s.role }));

  // Only what the client component actually needs -- the render functions
  // themselves (and the live data they touch) stay server-side.
  const definitions = NOTIFICATION_DEFINITIONS.map((d) => ({
    key: d.key,
    name: d.name,
    category: d.category,
    audienceLabel: d.audienceLabel,
    scheduleLabel: d.scheduleLabel,
    route: d.route,
    status: d.status,
  }));

  return <NotificationsPageClient definitions={definitions} staff={staff} />;
}
