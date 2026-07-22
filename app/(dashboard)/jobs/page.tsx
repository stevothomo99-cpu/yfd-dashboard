import JobsPageClient from "./JobsPageClient";
import { getPartners, getInProgressJobsForPartner, listStaff } from "@/lib/workflow";

// Server entry point for the Jobs list -- the XPM-native replacement for
// Karbon's "Attached" job view. Loads everything up front (dataset is small
// -- single-digit partners/managers/jobs today) and lets the client filter
// in-memory, same pattern as /clients.
export default async function JobsPage() {
  const partners = await getPartners();
  const defaultPartner = partners[0] ?? null;

  const [managers, jobs] = defaultPartner
    ? await Promise.all([
        listStaff("Manager"),
        getInProgressJobsForPartner(defaultPartner.id),
      ])
    : [[], []];

  return (
    <JobsPageClient
      partners={partners}
      defaultPartnerId={defaultPartner?.id ?? null}
      managers={managers}
      jobs={jobs}
    />
  );
}
