import ClientsPageClient from "./ClientsPageClient";
import { getClientSummaries, listStaff } from "@/lib/workflow";

// Server entry point for the Clients tile grid -- sourced from the real
// customers/jobs/tasks tables (see lib/workflow.ts's getClientSummaries),
// replacing the old Karbon-derived CLIENT_TILES mock data. Staff list is
// for the manager filter dropdown -- ClientSummary only carries manager
// ids, not names, so the client needs its own id->name lookup.
export default async function ClientsPage() {
  const [tiles, staff] = await Promise.all([getClientSummaries(), listStaff()]);
  const staffOptions = staff
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <ClientsPageClient tiles={tiles} staffOptions={staffOptions} />;
}
