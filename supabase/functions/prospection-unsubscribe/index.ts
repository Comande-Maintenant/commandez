import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    return htmlResponse(
      "Desinscription confirmee",
      `L'adresse <strong>${email}</strong> a ete retiree de notre liste. Vous ne recevrez plus d'emails de prospection de commandeici.`
    );
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return htmlResponse("Erreur", "Une erreur est survenue. Veuillez reessayer.", 500);
  }
});
