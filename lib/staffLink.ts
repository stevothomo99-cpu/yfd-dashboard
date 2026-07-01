import type { KarbonUser } from "@/types/karbon";
import type { XpmStaff } from "@/types/xpm";

export interface LinkedStaff {
  karbonId: string;
  name: string;
  email: string;
  xpmId: string | null;
  xpmName: string | null;
}

// Karbon is the live, working identity source; XPM staff (once available)
// gets attached by matching on email — same person, same email, in both
// systems. Unmatched Karbon users just get xpmId/xpmName: null.
export function linkKarbonToXpmByEmail(
  karbonUsers: KarbonUser[],
  xpmStaff: XpmStaff[],
): LinkedStaff[] {
  const xpmByEmail = new Map(
    xpmStaff.filter((s) => s.email).map((s) => [s.email.toLowerCase(), s]),
  );

  return karbonUsers.map((u) => {
    const match = u.email ? xpmByEmail.get(u.email.toLowerCase()) : undefined;
    return {
      karbonId: u.id,
      name: u.name,
      email: u.email,
      xpmId: match?.id ?? null,
      xpmName: match?.name ?? null,
    };
  });
}
