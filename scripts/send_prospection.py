#!/usr/bin/env python3
"""
Send B2B prospection emails to restaurants for commandeici.

Usage:
    export RESEND_API_KEY="re_xxx"
    python3 scripts/send_prospection.py --batch-size 38

Features:
    - Reads from prospection/restaurants_with_emails.csv
    - Tracks sent emails in prospection/sent_log.json (no duplicates)
    - Personalized email with restaurant name + city
    - Resend API for delivery
    - Dry-run mode for testing
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

# ─── Config ──────────────────────────────────────────────────────────────────────

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "Sarah de commandeici <sarah@commandeici.com>"
REPLY_TO = "augustin.foucheres@gmail.com"

# Priority cities: these contacts are sent first (in order)
PRIORITY_CITIES = ["Dijon"]

SUPABASE_URL = "https://rbqgsxhkccbhqdmdtxwr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWdzeGhrY2NiaHFkbWR0eHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIxNTEwOCwiZXhwIjoyMDg3NzkxMTA4fQ.XICYwfF3oEYFG5M-32ltu-D8QI3NlSPwLxBcsl_64No")

# Reject emails that are clearly not real contacts
JUNK_PATTERNS = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js",  # file extensions
    "@sentry", "@wixpress", "@cloudflare", "@jsdelivr", "@webflow",  # platform spam
    "@2x", "@3x",  # image filenames
    "sentry.io", "sentry-next", "wixpress.com",
]

# Domains that are platforms/agencies, not restaurant owners
JUNK_DOMAINS = {
    "ionos.fr", "ionos.com", "webador.fr", "partoo.fr", "centralapp.com",
    "telerama.fr", "menuchic.com", "udevweb.co", "agilibri.fr",
    "etmerci.co", "dorrparis.fr", "cimeragency.com", "grow360.fr",
    "deliveroo.fr", "deliveroo.com", "ubereats.com", "justeat.fr",
    "launchgiftcards.com", "coverpr.co", "example.fr", "example.com",
    "monsite.com", "domaine.com", "domain.com",
}

# Placeholder/fake email patterns
PLACEHOLDER_PATTERNS = [
    "exemple@", "example@", "test@", "utilisateur@", "monemail@",
    "nom@domain", "user@domain", "email@domain", "votre@", "your@",
    "adresse@",
]

VALID_TLDS = {"com", "fr", "net", "org", "eu", "io", "co", "info", "biz", "dev", "me", "be", "ch", "de", "it", "es", "nl", "lu", "at", "pt", "uk"}


def is_clean_email(email: str) -> bool:
    """Filter out junk emails that slipped through scraping."""
    e = email.lower().strip()
    if any(p in e for p in JUNK_PATTERNS):
        return False
    if any(p in e for p in PLACEHOLDER_PATTERNS):
        return False
    # Must have valid format
    if "@" not in e:
        return False
    local, domain = e.rsplit("@", 1)
    # Reject known platform/agency domains
    if domain in JUNK_DOMAINS:
        return False
    # Must end with valid TLD
    tld = domain.split(".")[-1]
    if tld not in VALID_TLDS:
        return False
    # Reject if local part looks like a filename
    if "." in local and local.rsplit(".", 1)[1] in {"png", "jpg", "svg", "gif", "webp", "css", "js"}:
        return False
    return True

GOOGLE_SHEETS_WEBHOOK = os.environ.get("GOOGLE_SHEETS_WEBHOOK", "")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROSPECTION_DIR = os.path.join(SCRIPT_DIR, "..", "prospection")
CSV_PATH = os.path.join(PROSPECTION_DIR, "restaurants_with_emails.csv")
SENT_LOG_PATH = os.path.join(PROSPECTION_DIR, "sent_log.json")
STATS_PATH = os.path.join(PROSPECTION_DIR, "send_stats.json")


# ─── Email template ──────────────────────────────────────────────────────────────


def build_subject(name: str) -> str:
    """Personalized, curiosity-driven subject line."""
    return f"Bon service \u00e0 l'\u00e9quipe de {name} \U0001F44A"


def build_html(name: str, city: str) -> str:
    """Conversion-focused email. Long, visual, multiple CTAs."""
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">

<p style="font-size:17px;line-height:1.6;color:#1a1a1a;margin:0 0 16px 0;">
Bon courage pour le rush de ce midi \U0001F525
</p>

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 16px 0;">
Je m'appelle Sarah et je vous \u00e9cris parce que j'ai vu <strong>{name}</strong> sur Google. {city}, c'est un coin que je connais bien.
</p>

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 16px 0;">
Il y a quelques mois, on \u00e9tait encore derri\u00e8re le comptoir avec notre \u00e9quipe. Les kebabs qui s'empilent, le t\u00e9l\u00e9phone qui sonne en plein rush, les commandes mal not\u00e9es, les clients qui attendent. On conna\u00eet tout \u00e7a par coeur.
</p>

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 20px 0;">
C'est pour \u00e7a qu'on a cr\u00e9\u00e9 <strong>commandeici</strong>.
</p>

<!-- CTA 1 -->
<p style="margin:0 0 24px 0;text-align:center;">
<a href="https://app.commandeici.com/inscription" style="display:inline-block;padding:16px 32px;background:#10B981;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;border-radius:10px;">
Essayer gratuitement \u2192
</a>
</p>

<!-- Stats block -->
<div style="background:#f0fdf4;border-radius:12px;padding:24px;margin:0 0 24px 0;">
<p style="font-size:15px;font-weight:600;color:#1a1a1a;margin:0 0 16px 0;text-align:center;">Ce que voient les restos qui l'utilisent :</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="33%" align="center" style="padding:8px 4px;">
<div style="font-size:32px;font-weight:800;color:#059669;">+30%</div>
<div style="font-size:13px;color:#6b7280;margin-top:4px;">de commandes</div>
</td>
<td width="33%" align="center" style="padding:8px 4px;">
<div style="font-size:32px;font-weight:800;color:#059669;">0\u20ac</div>
<div style="font-size:13px;color:#6b7280;margin-top:4px;">de commission</div>
</td>
<td width="33%" align="center" style="padding:8px 4px;">
<div style="font-size:32px;font-weight:800;color:#059669;">+30%</div>
<div style="font-size:13px;color:#6b7280;margin-top:4px;">de CA</div>
</td>
</tr>
</table>
</div>

<!-- Pain points section -->
<p style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 16px 0;">
On sait ce que c'est, le quotidien d'un resto :
</p>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
<tr>
<td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="36" valign="top" style="font-size:20px;">\u260E\uFE0F</td>
<td style="font-size:15px;color:#1a1a1a;line-height:1.5;">
<strong>Le t\u00e9l\u00e9phone qui sonne en plein service</strong><br>
<span style="color:#6b7280;">Avec commandeici, les clients commandent en ligne. Vous ne d\u00e9crochez plus.</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="36" valign="top" style="font-size:20px;">\u270D\uFE0F</td>
<td style="font-size:15px;color:#1a1a1a;line-height:1.5;">
<strong>Les erreurs de commande</strong><br>
<span style="color:#6b7280;">Le client choisit lui-m\u00eame sur votre carte. Plus de malentendu, plus de litige.</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="36" valign="top" style="font-size:20px;">\U0001F4B8</td>
<td style="font-size:15px;color:#1a1a1a;line-height:1.5;">
<strong>Les plateformes qui prennent 30%</strong><br>
<span style="color:#6b7280;">Uber Eats, Deliveroo... Avec commandeici : z\u00e9ro commission. Vos marges restent vos marges.</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:10px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td width="36" valign="top" style="font-size:20px;">\U0001F465</td>
<td style="font-size:15px;color:#1a1a1a;line-height:1.5;">
<strong>La queue au comptoir qui fait fuir</strong><br>
<span style="color:#6b7280;">Vos clients commandent depuis leur table ou avant d'arriver. Moins d'attente, plus de clients servis.</span>
</td>
</tr>
</table>
</td>
</tr>
</table>

<!-- CTA 2 -->
<p style="margin:0 0 24px 0;text-align:center;">
<a href="https://app.commandeici.com/inscription" style="display:inline-block;padding:16px 32px;background:#10B981;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;border-radius:10px;">
Cr\u00e9er ma page en 5 min \u2192
</a>
</p>

<!-- How it works -->
<div style="background:#f9fafb;border-radius:12px;padding:24px;margin:0 0 24px 0;">
<p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 16px 0;">Comment \u00e7a marche :</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td style="padding:6px 0;">
<span style="display:inline-block;width:28px;height:28px;background:#10B981;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:14px;margin-right:10px;">1</span>
<span style="font-size:15px;color:#1a1a1a;">Vous cr\u00e9ez votre page (carte, prix, photos)</span>
</td>
</tr>
<tr>
<td style="padding:6px 0;">
<span style="display:inline-block;width:28px;height:28px;background:#10B981;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:14px;margin-right:10px;">2</span>
<span style="font-size:15px;color:#1a1a1a;">Vos clients scannent le QR code ou vont sur votre lien</span>
</td>
</tr>
<tr>
<td style="padding:6px 0;">
<span style="display:inline-block;width:28px;height:28px;background:#10B981;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:14px;margin-right:10px;">3</span>
<span style="font-size:15px;color:#1a1a1a;">Ils choisissent, personnalisent, commandent</span>
</td>
</tr>
<tr>
<td style="padding:6px 0;">
<span style="display:inline-block;width:28px;height:28px;background:#10B981;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:14px;margin-right:10px;">4</span>
<span style="font-size:15px;color:#1a1a1a;">Vous recevez la commande en cuisine, c'est tout</span>
</td>
</tr>
</table>
</div>

<!-- Comparison table -->
<p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 12px 0;">commandeici vs les plateformes :</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<tr style="background:#f9fafb;">
<td style="padding:10px 12px;font-size:14px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;"></td>
<td style="padding:10px 12px;font-size:14px;font-weight:700;color:#10B981;border-bottom:1px solid #e5e7eb;text-align:center;">commandeici</td>
<td style="padding:10px 12px;font-size:14px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;text-align:center;">Uber / Deliveroo</td>
</tr>
<tr>
<td style="padding:10px 12px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f3f4f6;">Commission</td>
<td style="padding:10px 12px;font-size:14px;color:#059669;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:center;">0%</td>
<td style="padding:10px 12px;font-size:14px;color:#dc2626;border-bottom:1px solid #f3f4f6;text-align:center;">25-30%</td>
</tr>
<tr>
<td style="padding:10px 12px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f3f4f6;">Engagement</td>
<td style="padding:10px 12px;font-size:14px;color:#059669;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:center;">Aucun</td>
<td style="padding:10px 12px;font-size:14px;color:#dc2626;border-bottom:1px solid #f3f4f6;text-align:center;">12 mois</td>
</tr>
<tr>
<td style="padding:10px 12px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f3f4f6;">Donn\u00e9es clients</td>
<td style="padding:10px 12px;font-size:14px;color:#059669;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:center;">\u00c0 vous</td>
<td style="padding:10px 12px;font-size:14px;color:#dc2626;border-bottom:1px solid #f3f4f6;text-align:center;">Gard\u00e9es</td>
</tr>
<tr>
<td style="padding:10px 12px;font-size:14px;color:#1a1a1a;">Prix</td>
<td style="padding:10px 12px;font-size:14px;color:#059669;font-weight:700;text-align:center;">19\u20ac/mois</td>
<td style="padding:10px 12px;font-size:14px;color:#dc2626;text-align:center;">~500\u20ac/mois*</td>
</tr>
</table>
<p style="font-size:12px;color:#9ca3af;margin:-16px 0 24px 0;">*estim\u00e9 pour un resto qui fait 1\u202f500\u20ac/mois sur ces plateformes</p>

<!-- CTA 3 -->
<div style="background:#f0fdf4;border-radius:12px;padding:24px;margin:0 0 24px 0;text-align:center;">
<p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 4px 0;">4 semaines gratuites. Pas de CB demand\u00e9e.</p>
<p style="font-size:14px;color:#6b7280;margin:0 0 16px 0;">19\u20ac/mois apr\u00e8s, r\u00e9siliable en un clic.</p>
<a href="https://app.commandeici.com/inscription" style="display:inline-block;padding:16px 32px;background:#10B981;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;border-radius:10px;">
C'est parti \U0001F680
</a>
</div>

<!-- Demo link -->
<p style="font-size:15px;line-height:1.6;color:#1a1a1a;margin:0 0 24px 0;text-align:center;">
\U0001F449 <a href="https://app.commandeici.com/demo" style="color:#10B981;text-decoration:underline;font-weight:600;">Voir la d\u00e9mo en vrai</a>
</p>

<!-- Signature -->
<div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px;">
<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 0 0;">
\u00c0 bient\u00f4t,<br>
<strong>Sarah</strong><br>
<span style="color:#6b7280;font-size:14px;">commandeici.com \u2022 par des restaurateurs, pour des restaurateurs</span>
</p>
</div>

</div>

<div style="max-width:560px;margin:0 auto;padding:16px 20px;border-top:1px solid #e5e7eb;">
<p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">
Vous recevez cet email parce que {name} est r\u00e9f\u00e9renc\u00e9 sur Google.
Si ce n'est pas pertinent, ignorez ce message, vous ne recevrez rien d'autre.
</p>
</div>

</body>
</html>"""


def build_text(name: str, city: str) -> str:
    """Plain text fallback."""
    return f"""Bon courage pour le rush de ce midi !

Je m'appelle Sarah et j'ai vu {name} sur Google. {city}, c'est un coin que je connais bien.

Il y a quelques mois, on \u00e9tait encore derri\u00e8re le comptoir avec notre \u00e9quipe. Les kebabs qui s'empilent, le t\u00e9l\u00e9phone qui sonne, les commandes mal not\u00e9es. On conna\u00eet tout \u00e7a.

C'est pour \u00e7a qu'on a cr\u00e9\u00e9 commandeici.

Ce que voient les restos qui l'utilisent :
- +30% de commandes
- 0% de commission (c'est pas Uber Eats)
- +30% de chiffre d'affaires

On sait ce que c'est, le quotidien d'un resto :
- Le t\u00e9l\u00e9phone qui sonne en plein service -> les clients commandent en ligne
- Les erreurs de commande -> le client choisit lui-m\u00eame
- Les plateformes qui prennent 30% -> z\u00e9ro commission chez nous
- La queue au comptoir -> commande depuis la table ou avant d'arriver

Comment \u00e7a marche :
1. Vous cr\u00e9ez votre page (carte, prix, photos)
2. Vos clients scannent le QR code
3. Ils choisissent, commandent
4. Vous recevez en cuisine, c'est tout

commandeici vs Uber/Deliveroo :
- Commission : 0% vs 25-30%
- Engagement : aucun vs 12 mois
- Donn\u00e9es clients : \u00e0 vous vs gard\u00e9es
- Prix : 19\u20ac/mois vs ~500\u20ac/mois

4 semaines gratuites. Pas de CB demand\u00e9e. 19\u20ac/mois apr\u00e8s.

Essayer : https://app.commandeici.com/inscription
Voir un vrai resto : https://app.commandeici.com/demo

\u00c0 bient\u00f4t,
Sarah
commandeici.com \u2022 par des restaurateurs, pour des restaurateurs

---
Vous recevez cet email parce que {name} est r\u00e9f\u00e9renc\u00e9 sur Google.
Si ce n'est pas pertinent, ignorez ce message, vous ne recevrez rien d'autre."""


# ─── Retarget email templates ─────────────────────────────────────────────────────


RETARGET_VARIANTS = [
    {
        "subject": "Re: {name} - une question rapide",
        "opener": "Je vous avais ecrit il y a quelques jours. Pas de souci si vous n'avez pas eu le temps de regarder, je sais ce que c'est le rush.",
        "cta_text": "Voir ce que ca donne pour {name}",
        "closer": "Si ca ne vous parle pas du tout, pas de probleme, vous ne recevrez plus rien.",
    },
    {
        "subject": "{name} - 2 min pour gagner du temps ?",
        "opener": "Je me permets de vous reecrire parce que plusieurs restos a {city} ont teste commandeici ces derniers jours.",
        "cta_text": "Tester gratuitement",
        "closer": "En tout cas, bon service et bon courage pour la suite.",
    },
    {
        "subject": "Dernier message pour {name}",
        "opener": "C'est mon dernier email, promis. Je voulais juste vous dire qu'on a encore des places pour l'essai gratuit de 4 semaines.",
        "cta_text": "Essayer maintenant (gratuit)",
        "closer": "Apres ca, je ne vous embete plus. Bonne continuation a toute l'equipe.",
    },
]


def build_retarget_subject(name: str, send_count: int) -> str:
    """Pick a subject line based on retarget round."""
    idx = min(send_count - 1, len(RETARGET_VARIANTS) - 1)
    variant = RETARGET_VARIANTS[idx]
    return variant["subject"].format(name=name, city="votre ville")


def build_retarget_html(name: str, city: str, send_count: int) -> str:
    """Short, personal retarget email. Different from the initial long one."""
    idx = min(send_count - 1, len(RETARGET_VARIANTS) - 1)
    v = RETARGET_VARIANTS[idx]
    opener = v["opener"].format(name=name, city=city)
    cta_text = v["cta_text"].format(name=name)
    closer = v["closer"].format(name=name)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 16px 0;">
Bonjour,
</p>

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 16px 0;">
{opener}
</p>

<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0 0 20px 0;">
Pour rappel, <strong>commandeici</strong> c'est simple : vos clients commandent en ligne, vous recevez en cuisine. Zero commission, zero engagement.
</p>

<p style="margin:0 0 24px 0;text-align:center;">
<a href="https://app.commandeici.com/inscription" style="display:inline-block;padding:14px 28px;background:#10B981;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">
{cta_text}
</a>
</p>

<p style="font-size:15px;line-height:1.6;color:#6b7280;margin:0 0 0 0;">
{closer}
</p>

<div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:20px;">
<p style="font-size:16px;line-height:1.6;color:#1a1a1a;margin:0;">
Sarah<br>
<span style="color:#6b7280;font-size:14px;">commandeici.com</span>
</p>
</div>

</div>
</body>
</html>"""


def build_retarget_text(name: str, city: str, send_count: int) -> str:
    """Plain text retarget."""
    idx = min(send_count - 1, len(RETARGET_VARIANTS) - 1)
    v = RETARGET_VARIANTS[idx]
    opener = v["opener"].format(name=name, city=city)
    closer = v["closer"].format(name=name)

    return f"""Bonjour,

{opener}

Pour rappel, commandeici c'est simple : vos clients commandent en ligne, vous recevez en cuisine. Zero commission, zero engagement.

{v["cta_text"].format(name=name)} : https://app.commandeici.com/inscription

{closer}

Sarah
commandeici.com"""


# ─── Resend API ──────────────────────────────────────────────────────────────────


def send_email(to: str, subject: str, html: str, text: str) -> dict:
    """Send one email via Resend API."""
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": FROM_EMAIL,
            "to": [to],
            "reply_to": REPLY_TO,
            "subject": subject,
            "html": html,
            "text": text,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def log_to_supabase(resend_id: str, email: str, name: str, city: str):
    """Log send to email_logs table for dashboard tracking (non-blocking)."""
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/email_logs",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "email_type": "prospection_send",
                "recipient_email": email,
                "resend_id": resend_id,
                "metadata": {"restaurant_name": name, "city": city},
            },
            timeout=5,
        )
    except Exception as e:
        print(f"    [supabase log error: {e}]")


# ─── Tracking ────────────────────────────────────────────────────────────────────


RETARGET_DELAY_DAYS = 15  # Days before retargeting


def load_sent_log() -> dict:
    """Load sent log. Format: {email: {sent_at, last_sent_at, send_count, resend_id, name, city}}"""
    if os.path.exists(SENT_LOG_PATH):
        with open(SENT_LOG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Migrate old format: add send_count and last_sent_at if missing
        for email, info in data.items():
            if "send_count" not in info:
                info["send_count"] = 1
            if "last_sent_at" not in info:
                info["last_sent_at"] = info.get("sent_at", "")
        return data
    return {}


def save_sent_log(log: dict):
    with open(SENT_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def load_stats() -> dict:
    if os.path.exists(STATS_PATH):
        with open(STATS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"total_sent": 0, "total_errors": 0, "runs": []}


def save_stats(stats: dict):
    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


# ─── Google Sheets Tracking ───────────────────────────────────────────────────────


def track_to_sheets(restaurant: dict, resend_id: str, slot: str):
    """Track a sent email to Google Sheets (non-blocking)."""
    if not GOOGLE_SHEETS_WEBHOOK:
        return
    try:
        requests.post(
            GOOGLE_SHEETS_WEBHOOK,
            json={
                "action": "track_send",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
                "restaurant": restaurant.get("name", "").strip(),
                "city": restaurant.get("city", "").strip(),
                "email": restaurant.get("email", "").strip().lower(),
                "type": restaurant.get("type", "").strip(),
                "rating": restaurant.get("rating", ""),
                "reviews": restaurant.get("reviews_count", ""),
                "status": "Envoye",
                "resend_id": resend_id,
                "slot": slot,
            },
            timeout=10,
        )
    except Exception as e:
        print(f"    [sheets tracking error: {e}]")


def sheets_batch_summary():
    """Notify Google Sheets to rebuild dashboard at end of batch."""
    if not GOOGLE_SHEETS_WEBHOOK:
        return
    try:
        requests.post(
            GOOGLE_SHEETS_WEBHOOK,
            json={"action": "batch_summary"},
            timeout=10,
        )
    except Exception as e:
        print(f"    [sheets summary error: {e}]")


# ─── Main ────────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Send prospection emails")
    parser.add_argument("--batch-size", type=int, default=38, help="Number of emails to send (default: 38)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent without sending")
    parser.add_argument("--start-from", type=int, default=0, help="Skip first N unsent emails")
    args = parser.parse_args()

    if not RESEND_API_KEY and not args.dry_run:
        print("ERROR: RESEND_API_KEY not set")
        sys.exit(1)

    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        print("Run collect_restaurants.py first.")
        sys.exit(1)

    # Load CSV
    restaurants = []
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            restaurants.append(row)

    print(f"Total restaurants dans le CSV : {len(restaurants)}")

    # Load sent log
    sent_log = load_sent_log()
    print(f"Deja envoyes : {len(sent_log)}")

    # Deduplicate: 1 email per restaurant (pick best: contact@ > first clean)
    best_per_resto = {}
    for r in restaurants:
        email = r.get("email", "").strip().lower()
        if not email or not is_clean_email(email):
            continue
        name = r.get("name", "").strip()
        if name not in best_per_resto:
            best_per_resto[name] = {**r, "email": email}
        else:
            # Prefer contact@domain or info@domain over random emails
            current = best_per_resto[name]["email"]
            if email.startswith("contact@") and not current.startswith("contact@"):
                best_per_resto[name] = {**r, "email": email}

    # Build two lists: unsent (priority) + retargetable (15+ days old)
    unsent = []
    retargetable = []
    seen_emails = set()
    now = datetime.now(timezone.utc)

    for r in best_per_resto.values():
        email = r["email"]
        if email in seen_emails:
            continue
        seen_emails.add(email)

        if email not in sent_log:
            unsent.append({"restaurant": r, "is_retarget": False, "send_count": 0})
        else:
            entry = sent_log[email]
            send_count = entry.get("send_count", 1)
            # Max 3 retargets (initial + 3 relances = 4 total)
            if send_count >= 4:
                continue
            last_sent = entry.get("last_sent_at", entry.get("sent_at", ""))
            if not last_sent:
                continue
            try:
                last_dt = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
                days_since = (now - last_dt).days
                if days_since >= RETARGET_DELAY_DAYS:
                    retargetable.append({
                        "restaurant": r,
                        "is_retarget": True,
                        "send_count": send_count,
                        "days_since": days_since,
                    })
            except (ValueError, TypeError):
                continue

    # Sort retargetable: oldest first
    retargetable.sort(key=lambda x: x.get("days_since", 0), reverse=True)

    # Sort unsent: priority cities first
    def city_priority(item):
        city = item["restaurant"].get("city", "").strip()
        for i, pc in enumerate(PRIORITY_CITIES):
            if city.lower() == pc.lower():
                return i
        return len(PRIORITY_CITIES)

    unsent.sort(key=city_priority)

    priority_count = sum(1 for u in unsent if city_priority(u) < len(PRIORITY_CITIES))
    print(f"Nouveaux contacts     : {len(unsent)} (dont {priority_count} prioritaires)")
    print(f"Retargetables (15j+)  : {len(retargetable)}")
    if PRIORITY_CITIES:
        print(f"Villes prioritaires   : {', '.join(PRIORITY_CITIES)}")

    # Priority: unsent first (priority cities at top), then retarget to fill the batch
    combined = unsent + retargetable

    if not combined:
        print("Rien a envoyer. Tous les contacts sont a jour.")
        sys.exit(0)

    # Apply start-from offset
    if args.start_from > 0:
        combined = combined[args.start_from:]
        print(f"Apres offset (--start-from {args.start_from}) : {len(combined)}")

    # Take batch
    batch = combined[:args.batch_size]
    new_count = sum(1 for b in batch if not b["is_retarget"])
    retarget_count = sum(1 for b in batch if b["is_retarget"])
    print(f"\nBatch de {len(batch)} emails ({new_count} nouveaux + {retarget_count} relances){'  [DRY RUN]' if args.dry_run else ''}")
    print("=" * 60)

    sent_count = 0
    error_count = 0
    stats = load_stats()

    # Determine slot for Sheets tracking
    hour_utc = datetime.now(timezone.utc).hour
    slot = "matin" if hour_utc < 12 else "aprem"

    for i, item in enumerate(batch):
        r = item["restaurant"]
        is_retarget = item["is_retarget"]
        send_count = item["send_count"]

        email = r["email"].strip().lower()
        name = r["name"].strip()
        city = r["city"].strip()

        if is_retarget:
            subject = build_retarget_subject(name, send_count)
            html = build_retarget_html(name, city, send_count)
            text = build_retarget_text(name, city, send_count)
            tag = f"RELANCE {send_count}"
        else:
            subject = build_subject(name)
            html = build_html(name, city)
            text = build_text(name, city)
            tag = "NOUVEAU"

        print(f"  [{i+1}/{len(batch)}] [{tag}] {name} ({city}) -> {email}", end="", flush=True)

        if args.dry_run:
            print("  [DRY RUN]")
            sent_count += 1
            continue

        try:
            result = send_email(email, subject, html, text)
            resend_id = result.get("id", "")
            now_iso = datetime.now(timezone.utc).isoformat()
            prev = sent_log.get(email, {})
            sent_log[email] = {
                "sent_at": prev.get("sent_at", now_iso),
                "last_sent_at": now_iso,
                "send_count": prev.get("send_count", 0) + 1,
                "resend_id": resend_id,
                "name": name,
                "city": city,
            }
            sent_count += 1
            print(f"  OK ({resend_id})")
            log_to_supabase(resend_id, email, name, city)
            track_to_sheets(r, resend_id, slot)
        except requests.exceptions.HTTPError as e:
            error_count += 1
            status = e.response.status_code if e.response else "?"
            body = e.response.text[:200] if e.response else str(e)
            print(f"  ERROR {status}: {body}")

            # Rate limit: wait and retry once
            if status == 429:
                print("    Rate limited, waiting 60s...")
                time.sleep(60)
                try:
                    result = send_email(email, subject, html, text)
                    resend_id = result.get("id", "")
                    now_iso = datetime.now(timezone.utc).isoformat()
                    prev = sent_log.get(email, {})
                    sent_log[email] = {
                        "sent_at": prev.get("sent_at", now_iso),
                        "last_sent_at": now_iso,
                        "send_count": prev.get("send_count", 0) + 1,
                        "resend_id": resend_id,
                        "name": name,
                        "city": city,
                    }
                    sent_count += 1
                    error_count -= 1
                    print(f"    Retry OK ({resend_id})")
                    log_to_supabase(resend_id, email, name, city)
                    track_to_sheets(r, resend_id, slot)
                except Exception as e2:
                    print(f"    Retry FAILED: {e2}")

            # If too many errors, stop
            if error_count >= 5:
                print("\nTrop d'erreurs, arret du batch.")
                break
        except Exception as e:
            error_count += 1
            print(f"  ERROR: {e}")
            if error_count >= 5:
                print("\nTrop d'erreurs, arret du batch.")
                break

        # Small delay between sends (Resend rate limit: 10/s on free, 100/s on pro)
        time.sleep(1.5)

        # Save every 10
        if (i + 1) % 10 == 0:
            save_sent_log(sent_log)

    # Final save
    save_sent_log(sent_log)

    # Update stats
    run_info = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "batch_size": len(batch),
        "sent": sent_count,
        "errors": error_count,
    }
    stats["total_sent"] += sent_count
    stats["total_errors"] += error_count
    stats["runs"].append(run_info)
    # Keep only last 100 runs
    stats["runs"] = stats["runs"][-100:]
    save_stats(stats)

    # Notify Sheets to rebuild dashboard
    sheets_batch_summary()

    # Summary
    remaining_new = max(len(unsent) - new_count, 0)
    print(f"\n{'=' * 60}")
    print(f"RESULTATS")
    print(f"{'=' * 60}")
    print(f"Envoyes ce batch  : {sent_count} ({new_count} nouveaux + {retarget_count} relances)")
    print(f"Erreurs           : {error_count}")
    print(f"Total envoyes     : {stats['total_sent']}")
    print(f"Nouveaux restants : {remaining_new}")
    print(f"Retargetables     : {len(retargetable)}")
    if remaining_new > 0:
        days_left = remaining_new // 90
        print(f"Jours restants    : ~{days_left} jours (a 90/jour)")


if __name__ == "__main__":
    main()
