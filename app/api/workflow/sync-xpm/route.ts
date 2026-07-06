import { NextResponse } from "next/server";
import { syncFromXpm, isWorkflowConfigured } from "@/lib/workflow";
import { isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { getSettings } from "@/lib/settings";

export async function POST() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  if (!isXpmConfigured()) {
    return NextResponse.json(
      { message: "XPM env vars are not set (XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, XPM_TENANT_ID)." },
      { status: 503 },
    );
  }
  const settings = await getSettings();
  try {
    const result = await syncFromXpm(settings.partnerName);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({ message: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
