import { createClient } from "@supabase/supabase-js";
import { getRangeStart, type ChurnRange } from "@/lib/utils";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_SITEMARGIN_URL;
  const supabaseKey = process.env.SUPABASE_SITEMARGIN_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_SITEMARGIN_URL and SUPABASE_SITEMARGIN_SERVICE_KEY are required"
    );
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return supabase;
}

export interface SiteMarginMetrics {
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  paidChurnInPeriod: number;
  untrialChurnInPeriod: number;
  currentMonthMRR: number;
  currentMonthARR: number;
}

export async function getSiteMarginSubscriptionMetrics(
  range: ChurnRange = "month"
): Promise<SiteMarginMetrics> {
  const sb = getSupabaseClient();

  try {
    // Total organizations
    const { count: totalOrganizations } = await sb
      .from("organisations")
      .select("*", { count: "exact", head: true });

    // Active trials (subscription_status = 'trialing')
    const { count: activeTrials } = await sb
      .from("organisations")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "trialing");

    // Active subscriptions (subscription_status = 'active')
    const { count: activeSubscriptions } = await sb
      .from("organisations")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active");

    // Canceled organizations
    const { count: canceledOrganizations } = await sb
      .from("organisations")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "canceled");

    // Past due
    const { count: pastDueOrganizations } = await sb
      .from("organisations")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "past_due");

    // Trial conversion rate
    const { data: subscriptionEventsData } = await sb
      .from("subscription_events")
      .select("event_type") as { data: Array<{ event_type: string }> | null };

    let trialConversionRate = 0;
    if (subscriptionEventsData && subscriptionEventsData.length > 0) {
      const trialsStarted = subscriptionEventsData.filter(
        (e) => e.event_type === "trial_started"
      ).length;
      const subscriptionsStarted = subscriptionEventsData.filter(
        (e) => e.event_type === "subscription_started"
      ).length;

      trialConversionRate =
        trialsStarted > 0 ? (subscriptionsStarted / trialsStarted) * 100 : 0;
      trialConversionRate = Math.round(trialConversionRate * 100) / 100;
    }

    // Paid churn (subscription_canceled events)
    const now = new Date();
    const rangeStart = getRangeStart(range, now);

    let paidChurnQuery = sb
      .from("subscription_events")
      .select("*", { count: "exact" })
      .eq("event_type", "subscription_canceled");
    if (rangeStart) {
      paidChurnQuery = paidChurnQuery.gte("occurred_at", rangeStart.toISOString());
    }
    const { data: paidChurnData } = await paidChurnQuery;

    // Unpaid/trial churn (trial_expired events)
    let untrialChurnQuery = sb
      .from("subscription_events")
      .select("*", { count: "exact" })
      .eq("event_type", "trial_expired");
    if (rangeStart) {
      untrialChurnQuery = untrialChurnQuery.gte("occurred_at", rangeStart.toISOString());
    }
    const { data: untrialChurnData } = await untrialChurnQuery;

    // TODO: Calculate MRR and ARR from subscription pricing data
    // Need to query: organisations with subscription_status='active' and their subscription amounts
    const currentMonthMRR = 0;
    const currentMonthARR = currentMonthMRR * 12;

    return {
      totalOrganizations: totalOrganizations || 0,
      activeTrials: activeTrials || 0,
      activeSubscriptions: activeSubscriptions || 0,
      trialConversionRate,
      canceledOrganizations: canceledOrganizations || 0,
      pastDueOrganizations: pastDueOrganizations || 0,
      paidChurnInPeriod: paidChurnData?.length || 0,
      untrialChurnInPeriod: untrialChurnData?.length || 0,
      currentMonthMRR,
      currentMonthARR,
    };
  } catch (error) {
    console.error("Error fetching SiteMargin metrics:", error);
    throw error;
  }
}
