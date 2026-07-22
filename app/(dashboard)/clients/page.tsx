import ClientsPageClient from "./ClientsPageClient";
import { getClientSummaries } from "@/lib/workflow";

// Server entry point for the Clients tile grid -- sourced from the real
// customers/jobs/tasks tables (see lib/workflow.ts's getClientSummaries),
// replacing the old Karbon-derived CLIENT_TILES mock data.
export default async function ClientsPage() {
  const tiles = await getClientSummaries();
  return <ClientsPageClient tiles={tiles} />;
}
