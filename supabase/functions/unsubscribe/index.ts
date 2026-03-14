/**
 * unsubscribe - Handle email unsubscribe requests for commandeici
 *
 * GET ?token=xxx -> returns current preferences as JSON
 * POST { token, marketing_emails, subscription_emails, referral_emails, unsubscribe_all } -> updates preferences
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeToken(token: string): { uid: string } | null {
  try {
    const decoded = JSON.parse(atob(token));
    return decoded?.uid ? { uid: decoded.uid } : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const decoded = decodeToken(token);
      if (!decoded) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: prefs } = await supabase
        .from("user_email_preferences")
        .select("*")
        .eq("user_id", decoded.uid)
        .maybeSingle();

      return new Response(JSON.stringify({
        marketing_emails: prefs?.marketing_emails ?? true,
        subscription_emails: prefs?.subscription_emails ?? true,
        referral_emails: prefs?.referral_emails ?? true,
        unsubscribed: !!prefs?.unsubscribed_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { token, marketing_emails, subscription_emails, referral_emails, unsubscribe_all } = body;

      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const decoded = decodeToken(token);
      if (!decoded) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, any> = {
        user_id: decoded.uid,
        updated_at: new Date().toISOString(),
      };

      if (unsubscribe_all) {
        updates.marketing_emails = false;
        updates.subscription_emails = false;
        updates.referral_emails = false;
        updates.unsubscribed_at = new Date().toISOString();
      } else {
        if (marketing_emails !== undefined) updates.marketing_emails = marketing_emails;
        if (subscription_emails !== undefined) updates.subscription_emails = subscription_emails;
        if (referral_emails !== undefined) updates.referral_emails = referral_emails;
        if (marketing_emails || subscription_emails || referral_emails) {
          updates.unsubscribed_at = null;
        }
      }

      const { error } = await supabase
        .from("user_email_preferences")
        .upsert(updates, { onConflict: "user_id" });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[unsubscribe] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
