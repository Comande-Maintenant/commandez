import { supabase } from "@/integrations/supabase/client";

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  referee_email: string | null;
  status: string;
  bonus_weeks_granted: number;
  created_at: string;
  completed_at: string | null;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  totalBonusWeeks: number;
  referralCode: string;
}

/**
 * Get the referral code and stats for the current restaurant
 */
export async function getReferralStats(restaurantId: string): Promise<ReferralStats | null> {
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("referral_code, bonus_weeks")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.referral_code) return null;

  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", restaurantId);

  const completed = referrals?.filter((r: any) => r.status === "completed") || [];

  return {
    totalReferrals: referrals?.length || 0,
    completedReferrals: completed.length,
    totalBonusWeeks: restaurant.bonus_weeks || 0,
    referralCode: restaurant.referral_code,
  };
}

/**
 * Get all referrals for a restaurant
 */
export async function getReferrals(restaurantId: string): Promise<Referral[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Referral[];
}

/**
 * Process a referral code during signup.
 * Finds the referrer restaurant, creates a referral entry,
 * gives +4 weeks to the referrer, and sets 8 weeks trial for the referee.
 */
export async function processReferral(refereeRestaurantId: string, refCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("process_referral_code", {
      p_referee_restaurant_id: refereeRestaurantId,
      p_ref_code: refCode,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
