import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Configurable: switch to Resend, SendGrid, etc. when the domain is live
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = "Commande Maintenant <contact@commandemaintenant.com>";
const BASE_URL = "https://commandez.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Generate QR code PNG as base64 using the qrcode API
// Uses error correction level H (30% redundancy) for future logo overlay
async function generateQRCodeBase64(url: string, size = 400): Promise<string> {
  // Use a public QR code API as a simple server-side approach
  // When moving to production, replace with a proper QR library
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&ecc=H&margin=8`;
  const response = await fetch(qrApiUrl);
  if (!response.ok) throw new Error("Failed to generate QR code");
  const buffer = new Uint8Array(await response.arrayBuffer());
  return base64Encode(buffer);
}

function renderWelcomeEmailHtml(params: {
  restaurantName: string;
  publicUrl: string;
  adminUrl: string;
  email: string;
  qrCid: string;
}): string {
  const { restaurantName, publicUrl, adminUrl, email, qrCid } = params;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenue sur Commande Maintenant</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background-color:#FF6B00;padding:28px 32px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Commande Maintenant</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 28px;">

  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Bonjour ${restaurantName},</p>
  <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
    Votre page de commande en ligne est prete !<br>
    Voici tout ce dont vous avez besoin pour commencer.
  </p>

  <!-- Public URL -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF5EE;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:20px 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#FF6B00;text-transform:uppercase;letter-spacing:0.5px;">Votre page de commande</p>
    <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.5;">
      C'est ce lien que vos clients utilisent pour commander.<br>
      Partagez-le partout : reseaux sociaux, WhatsApp, SMS, et surtout sur votre fiche Google.
    </p>
    <a href="${publicUrl}" style="display:inline-block;word-break:break-all;font-size:14px;color:#FF6B00;font-weight:600;text-decoration:underline;">${publicUrl}</a>
    <br><br>
    <a href="${publicUrl}" style="display:inline-block;background-color:#FF6B00;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Voir ma page</a>
  </td></tr>
  </table>

  <!-- Admin URL -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:20px 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;">Votre espace administrateur</p>
    <p style="margin:0 0 4px;font-size:14px;color:#555;">Email : <strong>${email}</strong></p>
    <p style="margin:0 0 12px;font-size:14px;color:#555;">Mot de passe : celui que vous avez choisi a l'inscription</p>
    <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.5;">
      Depuis votre espace, vous pouvez :<br>
      &bull; Voir et gerer les commandes en temps reel<br>
      &bull; Modifier votre carte et vos prix<br>
      &bull; Personnaliser votre page<br>
      &bull; Telecharger vos QR codes
    </p>
    <a href="${adminUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Acceder a mon espace</a>
  </td></tr>
  </table>

  <!-- Google tip -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fefce8;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:20px 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a16207;text-transform:uppercase;letter-spacing:0.5px;">Astuce : ajoutez le lien a votre fiche Google</p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Sur votre fiche Google Maps, vous pouvez ajouter un bouton "Commander en ligne" qui pointe vers votre page.<br><br>
      Comment faire :<br>
      1. Allez sur business.google.com<br>
      2. Ouvrez votre fiche<br>
      3. Dans "Liens", ajoutez votre lien de commande comme "lien de commande" ou "site web"<br>
      4. Vos clients verront un bouton directement sur Google Maps
    </p>
  </td></tr>
  </table>

  <!-- QR Code -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:20px 24px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#333;text-transform:uppercase;letter-spacing:0.5px;">Vos QR Codes</p>
    <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;">
      Imprimez-les et placez-les sur vos tables, au comptoir, sur vos emballages et en vitrine.<br>
      Plus il y a de QR codes visibles, plus vous recevez de commandes.
    </p>
    <img src="cid:${qrCid}" alt="QR Code ${restaurantName}" width="200" height="200" style="display:block;margin:0 auto;border-radius:8px;" />
    <p style="margin:8px 0 0;font-size:12px;color:#999;">${restaurantName}</p>
    <p style="margin:2px 0 0;font-size:11px;color:#bbb;">${publicUrl}</p>
  </td></tr>
  </table>

  <!-- Contact -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1px solid #e5e5e5;margin-bottom:8px;">
  <tr><td style="padding:20px 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#333;text-transform:uppercase;letter-spacing:0.5px;">Besoin d'aide ?</p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">
      Repondez directement a cet email ou contactez-nous :<br>
      <a href="mailto:contact@commandemaintenant.com" style="color:#FF6B00;text-decoration:underline;">contact@commandemaintenant.com</a>
    </p>
  </td></tr>
  </table>

  <p style="margin:24px 0 0;font-size:14px;color:#555;line-height:1.5;">
    Bonne continuation et bonnes commandes !<br>
    <strong>L'equipe Commande Maintenant</strong>
  </p>

</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 28px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#999;">
    Commande Maintenant &bull; contact@commandemaintenant.com
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { restaurantName, slug, email } = await req.json();

    if (!restaurantName || !slug || !email) {
      return new Response(
        JSON.stringify({ error: "restaurantName, slug, and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const publicUrl = `${BASE_URL}/${slug}`;
    const adminUrl = `${BASE_URL}/admin/${slug}`;
    const qrCid = "qrcode-attachment";

    // Generate QR code
    const qrBase64 = await generateQRCodeBase64(publicUrl, 400);

    // Render HTML
    const html = renderWelcomeEmailHtml({
      restaurantName,
      publicUrl,
      adminUrl,
      email,
      qrCid,
    });

    // Send via Resend API (configurable)
    // If RESEND_API_KEY is not set, log and return success (dry run)
    if (!RESEND_API_KEY) {
      console.log("[send-welcome-email] No RESEND_API_KEY set, dry run mode.");
      console.log(`Would send to: ${email}, subject: Bienvenue sur Commande Maintenant !`);
      return new Response(
        JSON.stringify({ success: true, dryRun: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: "Bienvenue sur Commande Maintenant ! Votre page est en ligne",
        html,
        attachments: [
          {
            filename: `qrcode-${slug}.png`,
            content: qrBase64,
            content_type: "image/png",
          },
        ],
      }),
    });

    if (!sendResponse.ok) {
      const errText = await sendResponse.text();
      console.error("[send-welcome-email] Resend API error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-welcome-email] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
