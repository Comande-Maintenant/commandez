import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.24.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "*" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!RESEND_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503 });
    }
    const rawBody = await req.text();
    let body: Record<string, any>;
    try {
      body = new Webhook(RESEND_WEBHOOK_SECRET).verify(rawBody, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      }) as Record<string, any>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    // Resend webhook format: { type, created_at, data: { email_id, to, ... } }
    const eventType = body.type; // email.delivered, email.opened, email.clicked, email.bounced, email.complained
    const data = body.data || {};

    if (!eventType || !data.email_id) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { status: 400 });
    }

    // Map Resend event types to our simpler types
    const typeMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivery_delayed": "delayed",
    };

    const mappedType = typeMap[eventType];
    if (!mappedType) {
      // Unknown event type, ignore
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), { status: 200 });
    }

    const recipientEmail = Array.isArray(data.to) ? data.to[0] : (data.to || "");

    await supabase.from("prospection_events").insert({
      resend_id: data.email_id,
      email: recipientEmail,
      event_type: mappedType,
      link_url: data.click?.url || null,
      metadata: {
        subject: data.subject || null,
        timestamp: body.created_at || null,
        raw_type: eventType,
      },
    });

    console.log(`[prospection-webhook] ${mappedType} for ${recipientEmail} (${data.email_id})`);

    return new Response(JSON.stringify({ ok: true, event: mappedType }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[prospection-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
