import { NextResponse } from "next/server";

export async function GET() {
  const diagnostics: Record<string, string> = {};

  // Check if base64 key exists
  const keyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  diagnostics["key_exists"] = keyBase64 ? "✓ Yes" : "✗ No";
  diagnostics["key_length"] = keyBase64 ? `${keyBase64.length} chars` : "N/A";

  if (keyBase64) {
    // Check if it's valid base64
    try {
      const decoded = Buffer.from(keyBase64, "base64").toString("utf-8");
      diagnostics["base64_valid"] = "✓ Yes";
      diagnostics["decoded_length"] = `${decoded.length} chars`;

      // Check PEM format
      if (decoded.startsWith("-----BEGIN")) {
        diagnostics["pem_format"] = "✓ Valid (starts with -----BEGIN)";
      } else {
        diagnostics["pem_format"] = "✗ Invalid (missing -----BEGIN)";
      }

      if (decoded.endsWith("-----\n") || decoded.endsWith("-----")) {
        diagnostics["pem_ending"] = "✓ Valid (ends with -----)";
      } else {
        diagnostics["pem_ending"] = "✗ Invalid (missing -----)";
      }

      // Show preview
      diagnostics["decoded_preview"] = decoded.substring(0, 80) + "...";
      diagnostics["decoded_end"] = "..." + decoded.substring(decoded.length - 80);
    } catch (err) {
      diagnostics["base64_valid"] = `✗ No (${err instanceof Error ? err.message : "Unknown error"})`;
    }
  }

  // Check other Google environment variables
  diagnostics["project_id"] = process.env.GOOGLE_PROJECT_ID || "✗ Not set";
  diagnostics["client_email"] = process.env.GOOGLE_CLIENT_EMAIL || "✗ Not set";
  diagnostics["ga4_property"] = process.env.SITEMARGIN_GA4_PROPERTY_ID || "✗ Not set";

  return NextResponse.json(diagnostics);
}
