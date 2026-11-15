import type { NextConfig } from "next";

// Pragmatic, not maximally strict: script-src/style-src need 'unsafe-inline'
// because Next.js's own hydration bootstrap script is inline (no nonce
// wiring set up here) and this app's UI is built almost entirely on inline
// `style={{...}}` props. connect-src allows Supabase's own domain because
// app/reset-password/page.tsx talks to Supabase Auth directly from the
// browser (anon key), bypassing this app's API routes for that one flow.
// Still meaningfully raises the floor over having nothing at all --
// frame-ancestors/X-Frame-Options block clickjacking, nosniff stops MIME
// sniffing, and HSTS forces HTTPS on repeat visits.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
