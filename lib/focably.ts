import { createClient } from "@supabase/supabase-js";
import { getRangeStart, type ChurnRange } from "@/lib/utils";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_FOCABLY_URL;
  const supabaseKey = process.env.SUPABASE_FOCABLY_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_FOCABLY_URL and SUPABASE_FOCABLY_SERVICE_KEY are required"
    );
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return supabase;
}

export interface FocablyMetrics {
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  paidChurnInPeriod: number;
  unpaidChurnInPeriod: number;
  totalChurnInPeriod: number;
  churnRate: number;
  winBackCandidates: number;
  currentMonthMRR: number;
  currentMonthARR: number;
}

export async function getFocablySubscriptionMetrics(
  range: ChurnRange = "month"
): Promise<FocablyMetrics> {
  const now = new Date();
  const rangeStart = getRangeStart(range, now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const sb = getSupabaseClient();

  try {
    // Total users
    const { count: totalUsers } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Paid users (subscription_status = 'pro')
    const { count: paidUsers } = await sb
      .from("families")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "pro");

    // Freemium users (subscription_status = 'free')
    const { count: freemiumUsers } = await sb
      .from("families")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free");

    // Non-active users (last_active_at < 30 days ago)
    const { count: nonActiveUsers } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .lt("last_active_at", thirtyDaysAgo.toISOString());

    // Paid churn in period
    let paidChurnQuery = sb
      .from("churn_events")
      .select("*", { count: "exact" })
      .eq("was_ever_paid", true);
    if (rangeStart) {
      paidChurnQuery = paidChurnQuery.gte("created_at", rangeStart.toISOString());
    }
    const { data: paidChurnData } = await paidChurnQuery;

    // Unpaid churn in period (excluding teachers)
    let unpaidChurnQuery = sb
      .from("churn_events")
      .select("*", { count: "exact" })
      .eq("was_ever_paid", false)
      .neq("role", "teacher");
    if (rangeStart) {
      unpaidChurnQuery = unpaidChurnQuery.gte("created_at", rangeStart.toISOString());
    }
    const { data: unpaidChurnData } = await unpaidChurnQuery;

    // Win-back candidates (churned but still on free tier)
    const { count: winBackCandidates } = await sb
      .from("families")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .not("first_paid_at", "is", null);

    const paidChurnInPeriod = paidChurnData?.length || 0;
    const unpaidChurnInPeriod = unpaidChurnData?.length || 0;
    const totalChurnInPeriod = paidChurnInPeriod + unpaidChurnInPeriod;

    // Calculate churn rate (paid churn only, simplified)
    // For accuracy, you'd need to calculate: churners ÷ families_paying_at_month_start
    const churnRate = (paidUsers || 0) > 0 ? (paidChurnInPeriod / (paidUsers || 1)) * 100 : 0;

    // TODO: Calculate MRR and ARR from subscription pricing data
    // Need to query: families with subscription_status='pro' and their subscription amounts
    const currentMonthMRR = 0;
    const currentMonthARR = currentMonthMRR * 12;

    return {
      totalUsers: totalUsers || 0,
      paidUsers: paidUsers || 0,
      freemiumUsers: freemiumUsers || 0,
      nonActiveUsers: nonActiveUsers || 0,
      paidChurnInPeriod,
      unpaidChurnInPeriod,
      totalChurnInPeriod,
      churnRate: Math.round(churnRate * 100) / 100,
      winBackCandidates: winBackCandidates || 0,
      currentMonthMRR,
      currentMonthARR,
    };
  } catch (error) {
    console.error("Error fetching Focably metrics:", error);
    throw error;
  }
}
