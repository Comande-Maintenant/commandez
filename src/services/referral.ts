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
    // Find the referrer by code
    const { data: referrer } = await supabase
      .from("restaurants")
      .select("id, bonus_weeks")
      .eq("referral_code", refCode.toUpperCase())
      .single();

    if (!referrer) return false;

    // Don't allow self-referral
    if (referrer.id === refereeRestaurantId) return false;

    // Create referral entry
    await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referee_id: refereeRestaurantId,
      status: "completed",
      bonus_weeks_granted: 4,
      completed_at: new Date().toISOString(),
    });

    // Add +4 weeks to the referrer
    await supabase
      .from("restaurants")
      .update({ bonus_weeks: (referrer.bonus_weeks || 0) + 4 })
      .eq("id", referrer.id);

    // Set the referee's referred_by and extend trial to 8 weeks (4 base + 4 bonus)
    const eightWeeksFromNow = new Date();
    eightWeeksFromNow.setDate(eightWeeksFromNow.getDate() + 56); // 8 weeks
    await supabase
      .from("restaurants")
      .update({
        referred_by: referrer.id,
        trial_end_date: eightWeeksFromNow.toISOString(),
        bonus_weeks: 4,
      })
      .eq("id", refereeRestaurantId);

    return true;
  } catch {
    return false;
  }
}
