export const metadata = {
  title: "Privacy Policy — YFD Dashboard",
};

export default function PrivacyPolicyPage() {
  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "3rem 1.5rem",
        lineHeight: 1.6,
        color: "#1f2933",
      }}
    >
      <h1 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "0.25rem" }}>
        Privacy Policy
      </h1>
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "2rem" }}>
        Last updated: 2026-07-18
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "0.5rem" }}>
          What this is
        </h2>
        <p>
          The YFD Dashboard is a private, internal operations tool built for
          Your Finance Dept (YFD), an Australian bookkeeping/accounting
          practice. It is used only by YFD&apos;s own staff to view
          productivity and revenue data about YFD&apos;s own team and
          clients. It is not a public product and does not have external
          customers or end users beyond YFD staff.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "0.5rem" }}>
          Data we process
        </h2>
        <p>The dashboard reads and displays:</p>
        <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>
            Staff, timesheet, and invoice data from Xero Practice Manager
            (XPM), scoped to YFD&apos;s own practice.
          </li>
          <li>Task and work-item data from Karbon, scoped to YFD&apos;s own team.</li>
          <li>
            Sales pipeline data from HubSpot, and web traffic data from
            Google Analytics/Search Console, for YFD&apos;s own related
            businesses.
          </li>
          <li>
            Dashboard login accounts (name, email, role) for YFD staff who
            use the dashboard itself.
          </li>
        </ul>
        <p style={{ marginTop: "0.5rem" }}>
          All of the above is read-only reporting data. The dashboard does
          not collect data from, or about, members of the public.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "0.5rem" }}>
          Third parties with access to this data
        </h2>
        <p>
          The dashboard is built on standard cloud infrastructure providers,
          which act as sub-processors necessary to host and run the
          application. No data is sold, shared for marketing purposes, or
          processed by any AI/ML service. The providers involved are:
        </p>
        <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>
            <strong>Vercel</strong> — application hosting and compute.
          </li>
          <li>
            <strong>Redis Cloud (Redis Inc.)</strong> — a temporary caching
            layer for data pulled from Xero/XPM and Karbon. Cached business
            data is encrypted (AES-256-GCM) before being stored here.
          </li>
          <li>
            <strong>Supabase</strong> — stores dashboard login accounts.
            Encrypted at rest by default (AES-256).
          </li>
          <li>
            <strong>Xero, Karbon, Google, HubSpot</strong> — the source
            systems this dashboard reads data from via their APIs. Data
            flows from these systems into the dashboard, not the other way.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "0.5rem" }}>
          How data is protected
        </h2>
        <ul style={{ paddingLeft: "1.5rem" }}>
          <li>All connections use TLS 1.2 or later.</li>
          <li>
            OAuth tokens and cached business data are encrypted at rest
            (AES-256-GCM) at the application layer, in addition to the
            hosting providers&apos; own storage-level encryption.
          </li>
          <li>
            Access to the dashboard requires an authenticated account, and
            two-factor authentication is available for all accounts.
          </li>
          <li>
            Dashboard user data is stored in Singapore
            (Supabase, ap-southeast-1 region).
          </li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "0.5rem" }}>
          Contact
        </h2>
        <p>
          Questions about this policy or the data it describes can be
          directed to{" "}
          <a href="mailto:steve@yourfinancedept.com.au">
            steve@yourfinancedept.com.au
          </a>
          .
        </p>
      </section>
    </div>
  );
}
