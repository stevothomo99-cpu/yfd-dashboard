import { createClient } from "@supabase/supabase-js";

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
  paidChurnThisMonth: number;
  unpaidChurnThisMonth: number;
  totalChurnThisMonth: number;
  churnRate: number;
  winBackCandidates: number;
}

export async function getFocablySubscriptionMetrics(): Promise<FocablyMetrics> {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
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

    // Paid churn this month
    const { data: paidChurnData } = await sb
      .from("churn_events")
      .select("*", { count: "exact" })
      .eq("was_ever_paid", true)
      .gte("created_at", monthAgo.toISOString());

    // Unpaid churn this month (excluding teachers)
    const { data: unpaidChurnData } = await sb
      .from("churn_events")
      .select("*", { count: "exact" })
      .eq("was_ever_paid", false)
      .neq("role", "teacher")
      .gte("created_at", monthAgo.toISOString());

    // Win-back candidates (churned but still on free tier)
    const { count: winBackCandidates } = await sb
      .from("families")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "free")
      .not("first_paid_at", "is", null);

    const paidChurnThisMonth = paidChurnData?.length || 0;
    const unpaidChurnThisMonth = unpaidChurnData?.length || 0;
    const totalChurnThisMonth = paidChurnThisMonth + unpaidChurnThisMonth;

    // Calculate churn rate (paid churn only, simplified)
    // For accuracy, you'd need to calculate: churners ÷ families_paying_at_month_start
    const churnRate = (paidUsers || 0) > 0 ? (paidChurnThisMonth / (paidUsers || 1)) * 100 : 0;

    return {
      totalUsers: totalUsers || 0,
      paidUsers: paidUsers || 0,
      freemiumUsers: freemiumUsers || 0,
      nonActiveUsers: nonActiveUsers || 0,
      paidChurnThisMonth,
      unpaidChurnThisMonth,
      totalChurnThisMonth,
      churnRate: Math.round(churnRate * 100) / 100,
      winBackCandidates: winBackCandidates || 0,
    };
  } catch (error) {
    console.error("Error fetching Focably metrics:", error);
    throw error;
  }
}
