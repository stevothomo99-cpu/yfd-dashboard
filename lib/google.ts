import jwt from "jsonwebtoken";

function getPrivateKey(): string {
  const keyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;

  if (!keyBase64) {
    throw new Error("GOOGLE_PRIVATE_KEY_BASE64 environment variable is not set");
  }

  if (typeof Buffer === "undefined") {
    throw new Error("Buffer is not available in this context");
  }

  try {
    return Buffer.from(keyBase64, "base64").toString("utf-8");
  } catch (err) {
    throw new Error(
      `Failed to decode GOOGLE_PRIVATE_KEY_BASE64: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

const GOOGLE_CREDS = {
  project_id: process.env.GOOGLE_PROJECT_ID || "yfd-dashbaord",
  private_key: getPrivateKey(),
  client_email:
    process.env.GOOGLE_CLIENT_EMAIL ||
    "yfd-dashboard@yfd-dashbaord.iam.gserviceaccount.com",
};

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

async function getAccessToken(): Promise<string> {
  if (!GOOGLE_CREDS.private_key) {
    throw new Error("GOOGLE_PRIVATE_KEY is not set");
  }

  const now = Math.floor(Date.now() / 1000);
  let token: string;
  try {
    token = jwt.sign(
      {
        iss: GOOGLE_CREDS.client_email,
        scope: SCOPES.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      },
      GOOGLE_CREDS.private_key,
      { algorithm: "RS256" }
    );
  } catch (err) {
    const keyPreview = GOOGLE_CREDS.private_key.substring(0, 100);
    throw new Error(
      `Failed to sign JWT: ${err instanceof Error ? err.message : String(err)}. Key preview: ${keyPreview}...`
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    }).toString(),
  });

  if (!res.ok) {
    let errorDetails = "";
    try {
      const errorData = await res.json();
      errorDetails = JSON.stringify(errorData);
    } catch {
      errorDetails = await res.text();
    }
    throw new Error(
      `Failed to get access token: ${res.status}. Response: ${errorDetails}`
    );
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface SearchConsoleMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number }>;
}

export async function getSearchConsoleMetrics(
  siteUrl: string,
  options?: { days?: number }
): Promise<SearchConsoleMetrics> {
  const accessToken = await getAccessToken();
  const days = options?.days ?? 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const res = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites/" +
      encodeURIComponent(siteUrl) +
      "/searchAnalytics/query",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        dimensions: ["query"],
        rowLimit: 10,
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Search Console API failed: ${res.status} ${error}`);
  }

  const data = (await res.json()) as {
    rows?: Array<{
      keys: [string];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };

  let totalClicks = 0;
  let totalImpressions = 0;
  let totalCtr = 0;
  let totalPosition = 0;
  let queryCount = 0;
  const topQueries: Array<{ query: string; clicks: number; impressions: number }> = [];

  if (data.rows) {
    for (const row of data.rows) {
      totalClicks += row.clicks;
      totalImpressions += row.impressions;
      totalCtr += row.ctr;
      totalPosition += row.position;
      queryCount++;
      topQueries.push({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
      });
    }
  }

  const avgCtr = queryCount > 0 ? totalCtr / queryCount : 0;
  const avgPos = queryCount > 0 ? totalPosition / queryCount : 0;

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr: Math.round(avgCtr * 10000) / 10000,
    avgPosition: Math.round(avgPos * 100) / 100,
    topQueries,
  };
}

export interface AnalyticsMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
}

export async function getAnalyticsMetrics(
  propertyId: string,
  options?: { days?: number }
): Promise<AnalyticsMetrics> {
  const accessToken = await getAccessToken();
  const days = options?.days ?? 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const res = await fetch(
    "https://analyticsdata.googleapis.com/v1beta/properties/" +
      propertyId +
      ":runReport",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [
          {
            startDate: startDate.toISOString().split("T")[0],
            endDate: new Date().toISOString().split("T")[0],
          },
        ],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
        ],
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Analytics API failed: ${res.status} ${error}`);
  }

  const data = (await res.json()) as {
    rows?: Array<{
      metricValues: Array<{ value: string }>;
    }>;
  };

  if (!data.rows || data.rows.length === 0) {
    return {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
    };
  }

  const row = data.rows[0];
  return {
    sessions: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
    pageviews: parseInt(row.metricValues[2].value) || 0,
    bounceRate: parseFloat(row.metricValues[3].value) || 0,
  };
}
