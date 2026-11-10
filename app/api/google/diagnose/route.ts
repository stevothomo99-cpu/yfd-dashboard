import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Admin-only debug endpoint -- same purpose/convention as /api/xpm/diagnose
// and the other */diagnose routes. Previously had no auth check at all
// (every sibling diagnose route requires admin; this one didn't) and
// returned the first/last 80 decoded characters of GOOGLE_PRIVATE_KEY_BASE64
// -- real base64-encoded private-key bytes, not just the PEM header/footer.
// Booleans are enough to confirm the key is configured correctly; nothing
// derived from the actual key material is returned.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const diagnostics: Record<string, string> = {};

  const keyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  diagnostics["key_exists"] = keyBase64 ? "✓ Yes" : "✗ No";
  diagnostics["key_length"] = keyBase64 ? `${keyBase64.length} chars` : "N/A";

  if (keyBase64) {
    try {
      const decoded = Buffer.from(keyBase64, "base64").toString("utf-8");
      diagnostics["base64_valid"] = "✓ Yes";
      diagnostics["decoded_length"] = `${decoded.length} chars`;

      diagnostics["pem_format"] = decoded.startsWith("-----BEGIN")
        ? "✓ Valid (starts with -----BEGIN)"
        : "✗ Invalid (missing -----BEGIN)";

      diagnostics["pem_ending"] =
        decoded.endsWith("-----\n") || decoded.endsWith("-----")
          ? "✓ Valid (ends with -----)"
          : "✗ Invalid (missing -----)";
    } catch (err) {
      diagnostics["base64_valid"] = `✗ No (${err instanceof Error ? err.message : "Unknown error"})`;
    }
  }

  diagnostics["project_id"] = process.env.GOOGLE_PROJECT_ID ? "✓ Set" : "✗ Not set";
  diagnostics["client_email"] = process.env.GOOGLE_CLIENT_EMAIL ? "✓ Set" : "✗ Not set";
  diagnostics["ga4_property"] = process.env.SITEMARGIN_GA4_PROPERTY_ID ? "✓ Set" : "✗ Not set";

  return NextResponse.json(diagnostics);
}
