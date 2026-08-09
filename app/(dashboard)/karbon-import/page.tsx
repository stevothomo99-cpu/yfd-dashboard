import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import KarbonImportPageClient from "./KarbonImportPageClient";

// Nav-gated only, same convention as the rest of ADMIN_ONLY_ITEMS
// (Business KPIs/Team/Leaderboard) -- no server-side redirect exists for
// those either, so this doesn't add a new pattern. The API route this page
// calls (/api/karbon/import-preview) does check session.user.role itself.
export default async function KarbonImportPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Karbon Import" />
        <div style={{ fontSize: "13px", color: "#888780" }}>Admins only.</div>
      </div>
    );
  }

  return <KarbonImportPageClient />;
}
