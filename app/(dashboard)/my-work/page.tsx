import { auth } from "@/auth";
import MyWorkPageClient from "./MyWorkPageClient";
import { getStaffByEmail, getTasksForStaff, listStaff } from "@/lib/workflow";

// Server entry point for the per-user Work Item board. In production this
// will resolve strictly from the logged-in session (session.user.email ->
// staff row); for this prototype phase, if no staff row matches the
// session's email, a "viewing as" selector is offered so the shape of the
// per-user board can be trialled for any staff member without every
// dashboard_users row needing a matching staff row yet.
export default async function MyWorkPage() {
  const session = await auth();
  const allStaff = await listStaff();

  const sessionStaff = session?.user?.email ? await getStaffByEmail(session.user.email) : null;
  const defaultStaff = sessionStaff ?? allStaff[0] ?? null;

  const tasks = defaultStaff ? await getTasksForStaff(defaultStaff.id) : [];

  return (
    <MyWorkPageClient
      allStaff={allStaff}
      defaultStaffId={defaultStaff?.id ?? null}
      isSessionMatch={Boolean(sessionStaff)}
      initialTasks={tasks}
    />
  );
}
