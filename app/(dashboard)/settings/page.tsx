import SettingsPageClient from "./SettingsPageClient";
import { getSettings } from "@/lib/settings";
import { listStaff } from "@/lib/workflow";
import { getXpmPartnerOptions, isXpmConfigured, type XpmPartnerOption } from "@/lib/xpm";

export interface RosterEntry {
  // Local staff row id, not the XPM uuid -- this is what the toggle writes to.
  id: string;
  name: string;
  email: string;
  role: string;
  included: boolean;
}

export interface SettingsSnapshot {
  partnerName: string;
  // Empty when XPM isn't configured or the lookup failed -- the client then
  // falls back to a free-text field so the setting stays editable.
  partnerOptions: XpmPartnerOption[];
  roster: RosterEntry[];
  // Partners are shown as context rather than as a toggleable row -- see the
  // note in the client.
  partnerRoster: RosterEntry[];
  rosterMessage?: string;
}

// Best-effort: an empty list makes the Partner field fall back to free
// text, which is how it behaved before the dropdown existed.
async function loadPartnerOptions(): Promise<XpmPartnerOption[]> {
  if (!isXpmConfigured()) return [];
  try {
    return await getXpmPartnerOptions();
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const [settings, staff, partnerOptions] = await Promise.all([
    getSettings(),
    // The synced XPM roster, straight from Postgres -- the same rows every
    // XPM-backed page reads. Replaces the old Karbon roster, which had to be
    // email-joined to XPM to be useful and dragged along entries like
    // "Karbon Support" that were never people here.
    listStaff(),
    loadPartnerOptions(),
  ]);

  const toEntry = (s: (typeof staff)[number]): RosterEntry => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    included: s.included,
  });

  // The Partner is split out, not hidden: they're set by the field above and
  // already excluded from practice-wide figures by role, so a toggle next to
  // their name would imply a control that doesn't apply. Dropping the row
  // entirely would just look like someone missing from the roster.
  const roster = staff.filter((s) => s.role !== "Partner").map(toEntry);
  const partnerRoster = staff.filter((s) => s.role === "Partner").map(toEntry);

  return (
    <SettingsPageClient
      initial={{
        partnerName: settings.partnerName,
        partnerOptions,
        roster,
        partnerRoster,
        rosterMessage:
          staff.length === 0
            ? settings.partnerName
              ? "No staff synced yet — press Save & resync above."
              : "Select a Partner and press Save & resync to load staff from XPM."
            : undefined,
      }}
    />
  );
}
