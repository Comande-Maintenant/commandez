import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

function decodeEmail(t: string): string | null {
  try {
    // URL-safe base64 decode
    const base64 = t.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    if (!decoded.includes("@")) return null;
    return decoded.toLowerCase().trim();
  } catch {
    return null;
  }
}

function htmlResponse(title: string, message: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#f8f9fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { background:#fff; border-radius:12px; padding:40px 32px; max-width:440px; width:90%; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  h1 { font-size:22px; color:#0f172a; margin:0 0 16px 0; }
  p { font-size:16px; color:#64748b; line-height:1.6; margin:0; }
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <p>${message}</p>
</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function sendFarewellEmail(email: string) {
  if (!RESEND_API_KEY) return;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">

<p style="font-size:28px;margin:0 0 20px 0;">Ohhh... vraiment ?</p>

<p style="font-size:15px;line-height:1.7;color:#1a1a1a;">
D'accord, pas de souci. Promis, ceci est le tout dernier email.
</p>

<p style="font-size:15px;line-height:1.7;color:#1a1a1a;">
Les prochaines fois que vous entendrez parler de commandeici, c'est parce que <strong>vos clients</strong> l'utiliseront. Vos collegues restaurateurs vont vous en parler a longueur de journee : <em>"Tu connais commandeici ? Mes clients commandent direct sur tablette, plus besoin de telephone. 19 euros par mois, zero commission."</em>
</p>

<p style="font-size:15px;line-height:1.7;color:#1a1a1a;">
Si vous etes en accord avec le fait de continuer a perdre des commandes au telephone et a payer des commissions aux plateformes, alors pas de souci. On se quitte en bons termes.
</p>

<p style="font-size:15px;line-height:1.7;color:#1a1a1a;">
Et on se retrouvera. Par obligation :)
</p>

<p style="font-size:15px;line-height:1.7;color:#1a1a1a;margin-top:24px;">
A bientot (ou pas),<br>
<strong>Sarah</strong><br>
<span style="color:#64748b;">commandeici</span>
</p>

<p style="font-size:12px;color:#9ca3af;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
Ceci etait vraiment le dernier email. Promis jure.
</p>

</div>
</body>
</html>`;

  const text = `Ohhh... vraiment ?

D'accord, pas de souci. Promis, ceci est le tout dernier email.

Les prochaines fois que vous entendrez parler de commandeici, c'est parce que VOS CLIENTS l'utiliseront. Vos collegues restaurateurs vont vous en parler a longueur de journee : "Tu connais commandeici ? Mes clients commandent direct sur tablette, plus besoin de telephone. 19 euros par mois, zero commission."

Si vous etes en accord avec le fait de continuer a perdre des commandes au telephone et a payer des commissions aux plateformes, alors pas de souci. On se quitte en bons termes.

Et on se retrouvera. Par obligation :)

A bientot (ou pas),
Sarah - commandeici

Ceci etait vraiment le dernier email. Promis jure.`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sarah de commandeici <sarah@commandeici.com>",
      to: email,
      subject: "Ohhh... vraiment ? 😢",
      html,
      text,
    }),
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const t = url.searchParams.get("t");

  if (!t) {
    return htmlResponse("Lien invalide", "Le lien de desinscription est invalide ou expire.", 400);
  }

  const email = decodeEmail(t);
  if (!email) {
    return htmlResponse("Lien invalide", "Le lien de desinscription est invalide ou expire.", 400);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from("prospection_unsubscribed")
      .upsert({ email, source: "link" }, { onConflict: "email" });

    if (error) {
      console.error("Upsert error:", error);
      return htmlResponse("Erreur", "Une erreur est survenue. Veuillez reessayer.", 500);
    }

    // Send farewell email (non-blocking)
    try {
      await sendFarewellEmail(email);
    } catch (e) {
      console.error("Farewell email error (non-blocking):", e);
    }

    return htmlResponse(
      "Desinscription confirmee",
      `L'adresse <strong>${email}</strong> a ete retiree de notre liste. Vous ne recevrez plus d'emails de prospection de commandeici.<br><br>On vous a envoye un petit dernier, promis c'est le tout dernier :)`
    );
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return htmlResponse("Erreur", "Une erreur est survenue. Veuillez reessayer.", 500);
  }
});
