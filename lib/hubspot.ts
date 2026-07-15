const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getAccessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is not set");
  }
  return token;
}

async function hubspotFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = HUBSPOT_BASE_URL + path;
  const token = getAccessToken();

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot ${path} failed: ${res.status} ${body}`);
  }

  return (await res.json()) as T;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    closedate?: string;
    hs_lastmodifieddate?: string;
  };
}

interface HubSpotDealsResponse {
  results: HubSpotDeal[];
  paging?: {
    next?: { after: string };
  };
}

interface HubSpotPipelinesResponse {
  results: Array<{
    id: string;
    label: string;
  }>;
}

export async function getHubSpotPipelines(): Promise<
  Array<{ id: string; label: string }>
> {
  const res = await hubspotFetch<HubSpotPipelinesResponse>(
    "/crm/v3/pipelines/deals"
  );
  return res.results;
}

export async function getHubSpotDealsByPipeline(
  pipelineId: string,
  limit = 100
): Promise<HubSpotDeal[]> {
  const res = await hubspotFetch<HubSpotDealsResponse>(
    `/crm/v3/objects/deals?properties=dealname,dealstage,amount,closedate,hs_lastmodifieddate&limit=${limit}&associations=pipelines`,
    {
      method: "GET",
    }
  );

  // Filter by pipeline
  // Note: may need adjustment based on actual API response structure
  return res.results;
}

export async function getHubSpotDeals(limit = 100): Promise<HubSpotDeal[]> {
  const res = await hubspotFetch<HubSpotDealsResponse>(
    `/crm/v3/objects/deals?properties=dealname,dealstage,amount,closedate,hs_lastmodifieddate&limit=${limit}`,
    {
      method: "GET",
    }
  );
  return res.results;
}
