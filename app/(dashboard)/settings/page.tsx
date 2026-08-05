import SettingsPageClient from "./SettingsPageClient";
import { getSettings } from "@/lib/settings";
import { listStaff } from "@/lib/workflow";
import { listDashboardUsers } from "@/lib/supabase";
import { getXpmPartnerOptions, isXpmConfigured, type XpmPartnerOption } from "@/lib/xpm";

export interface RosterEntry {
  // The dashboard login account -- this list is keyed on who can sign in.
  userId: string;
  email: string;
  username: string;
  isAdmin: boolean;
  suspended: boolean;
  // The XPM staff row matched by email, if there is one. Null means this
  // login has no XPM counterpart, so there are no hours to include or
  // exclude and the toggle is not offered.
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  included: boolean;
}

export interface SettingsSnapshot {
  partnerName: string;
  // Empty when XPM isn't configured or the lookup failed -- the client then
  // falls back to a free-text field so the setting stays editable.
  partnerOptions: XpmPartnerOption[];
  roster: RosterEntry[];
  // The Partner is shown as context rather than as a toggleable row.
  partnerRoster: RosterEntry[];
  // XPM staff with no dashboard login at all. They can't appear in the list
  // above, so they'd otherwise be silently un-excludable.
  unmatchedStaffNames: string[];
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
  const [settings, users, staff, partnerOptions] = await Promise.all([
    getSettings(),
    listDashboardUsers(),
    listStaff(),
    loadPartnerOptions(),
  ]);

  // Email is the join, lowercased on both sides -- the login and the XPM
  // staff record are created by different people at different times, so
  // case is not reliable. Same convention as getStaffByEmail's ilike.
  const staffByEmail = new Map(
    staff.filter((s) => s.email).map((s) => [s.email.toLowerCase(), s]),
  );

  const entries: RosterEntry[] = users.map((u) => {
    const match = staffByEmail.get(u.email.toLowerCase()) ?? null;
    return {
      userId: u.id,
      email: u.email,
      username: u.username,
      isAdmin: u.role === "admin",
      suspended: u.suspended,
      staffId: match?.id ?? null,
      staffName: match?.name ?? null,
      staffRole: match?.role ?? null,
      // Unmatched logins have no hours either way; `true` just keeps the
      // toggle visually neutral in the row that explains why it's absent.
      included: match ? match.included : true,
    };
  });

  // The Partner is split out, not hidden: they're set by the field above and
  // already excluded from practice-wide figures by role, so a toggle next to
  // their name would imply a control that doesn't apply. Dropping the row
  // entirely would just look like someone missing from the roster.
  const roster = entries.filter((e) => e.staffRole !== "Partner");
  const partnerRoster = entries.filter((e) => e.staffRole === "Partner");

  const matchedStaffIds = new Set(entries.map((e) => e.staffId).filter(Boolean));
  const unmatchedStaffNames = staff
    .filter((s) => !matchedStaffIds.has(s.id))
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));

  return (
    <SettingsPageClient
      initial={{
        partnerName: settings.partnerName,
        partnerOptions,
        roster,
        partnerRoster,
        unmatchedStaffNames,
        rosterMessage:
          staff.length === 0
            ? settings.partnerName
              ? "No XPM staff synced yet — press Save & resync above."
              : "Select a Partner and press Save & resync to load staff from XPM."
            : undefined,
      }}
    />
  );
}
