import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardHomepage() {
  const session = await auth();

  // Admins (the CEO's env-based account, or any Supabase dashboard_users
  // row with role "admin") land on the full Business KPIs view; everyone
  // else gets the team-facing dashboard.
  const isAdmin = session?.user?.role === "admin";

  if (isAdmin) {
    redirect("/personal");
  } else {
    redirect("/team");
  }
}
