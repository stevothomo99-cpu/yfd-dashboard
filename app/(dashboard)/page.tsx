import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardHomepage() {
  const session = await auth();

  // Check if user is the CEO (CEO username is in AUTH_USERNAME)
  const ceoUsername = process.env.AUTH_USERNAME;
  const isCeo = session?.user?.name === ceoUsername;

  // Redirect to personal dashboard if CEO, team dashboard otherwise
  if (isCeo) {
    redirect("/personal");
  } else {
    redirect("/team");
  }
}
