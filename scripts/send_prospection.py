#!/usr/bin/env python3
"""
Send B2B prospection emails to restaurants for commandeici.

4-touch campaign with personalization by restaurant type.
Budget: 95 emails/day. Priority: hot > R3 > R2 > R1 > new.

Usage:
    export RESEND_API_KEY="re_xxx"
    python3 scripts/send_prospection.py --batch-size 95
"""

import argparse
import base64
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

# --- Config -------------------------------------------------------------------

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "Sarah de commandeici <sarah@commandeici.com>"
REPLY_TO = "augustin.foucheres@gmail.com"

PRIORITY_CITIES = ["Dijon"]

SUPABASE_URL = "https://rbqgsxhkccbhqdmdtxwr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWdzeGhrY2NiaHFkbWR0eHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIxNTEwOCwiZXhwIjoyMDg3NzkxMTA4fQ.XICYwfF3oEYFG5M-32ltu-D8QI3NlSPwLxBcsl_64No")

JUNK_PATTERNS = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js",
    "@sentry", "@wixpress", "@cloudflare", "@jsdelivr", "@webflow",
    "@2x", "@3x",
    "sentry.io", "sentry-next", "wixpress.com",
]

JUNK_DOMAINS = {
    "ionos.fr", "ionos.com", "webador.fr", "partoo.fr", "centralapp.com",
    "telerama.fr", "menuchic.com", "udevweb.co", "agilibri.fr",
    "etmerci.co", "dorrparis.fr", "cimeragency.com", "grow360.fr",
    "deliveroo.fr", "deliveroo.com", "ubereats.com", "justeat.fr",
    "launchgiftcards.com", "coverpr.co", "example.fr", "example.com",
    "monsite.com", "domaine.com", "domain.com",
}

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
    if "@" not in e:
        return False
    local, domain = e.rsplit("@", 1)
    if domain in JUNK_DOMAINS:
        return False
    tld = domain.split(".")[-1]
    if tld not in VALID_TLDS:
        return False
    if "." in local and local.rsplit(".", 1)[1] in {"png", "jpg", "svg", "gif", "webp", "css", "js"}:
        return False
    return True


GOOGLE_SHEETS_WEBHOOK = os.environ.get("GOOGLE_SHEETS_WEBHOOK", "")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROSPECTION_DIR = os.path.join(SCRIPT_DIR, "..", "prospection")
CSV_PATH = os.path.join(PROSPECTION_DIR, "restaurants_with_emails.csv")
SENT_LOG_PATH = os.path.join(PROSPECTION_DIR, "sent_log.json")
STATS_PATH = os.path.join(PROSPECTION_DIR, "send_stats.json")

RETARGET_DELAY_DAYS = 15
MAX_TOUCHES = 4


# --- Restaurant type detection ------------------------------------------------

ACCROCHES = {
    "kebab": "Vos clients vous appellent ou passent par Uber Eats pour commander. Dans les deux cas, vous perdez du temps ou de l'argent.",
    "pizzeria": "Entre le telephone qui sonne et les commissions Deliveroo, chaque commande vous coute plus qu'elle ne devrait.",
    "burger": "Un burger a 12EUR sur Uber Eats, c'est 8EUR pour vous. Sur votre propre site de commande, c'est 12EUR.",
    "snack": "Le rush du midi, 50 commandes par telephone, des erreurs, des oublis. Il y a plus simple.",
    "tacos": "Vos clients veulent commander en ligne. Autant que ca passe par VOTRE site, pas par une plateforme qui prend 30%.",
    "food_truck": "Vos clients ne savent pas toujours ou vous trouver. Avec une page de commande, ils commandent a l'avance et recuperent sans attendre.",
    "restaurant": "Les plateformes prennent 25 a 30% sur chaque commande. C'est enorme quand on fait le calcul sur un mois.",
    "default": "Les plateformes de livraison prennent jusqu'a 30% sur chaque commande. Il y a une alternative.",
}


def detect_type(lead: dict) -> str:
    """Detect restaurant type from name or type field."""
    name = (lead.get("name") or "").lower()
    type_field = (lead.get("type") or "").lower()
    for keyword in ["kebab", "pizzeria", "pizza", "burger", "snack", "tacos", "food truck", "food-truck"]:
        if keyword in name or keyword in type_field:
            return keyword.replace("pizza", "pizzeria").replace("food truck", "food_truck").replace("food-truck", "food_truck")
    return "restaurant"


def get_accroche(resto_type: str) -> str:
    """Get the type-specific hook line."""
    return ACCROCHES.get(resto_type, ACCROCHES["default"])


# --- Email templates (4-touch campaign) ---------------------------------------

def _unsub_link(email: str) -> str:
    """Build the unsubscribe URL for a given email."""
    token = base64.urlsafe_b64encode(email.encode()).decode()
    return f"{SUPABASE_URL}/functions/v1/prospection-unsubscribe?t={token}"


def text_to_html(text: str, name: str, email: str = "") -> str:
    """Convert plain text email to simple HTML paragraphs with unsubscribe footer."""
    paragraphs = text.strip().split("\n\n")
    html_parts = []
    for p in paragraphs:
        # Convert single newlines to <br>
        p_html = p.strip().replace("\n", "<br>")
        html_parts.append(f'<p style="font-size:15px;line-height:1.6;color:#1a1a1a;margin:0 0 14px 0;">{p_html}</p>')
    body = "\n".join(html_parts)

    unsub = _unsub_link(email) if email else "#"

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
{body}
</div>
<div style="max-width:560px;margin:0 auto;padding:16px 20px;border-top:1px solid #e5e7eb;">
<p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">
Vous recevez cet email parce que {name} est reference sur Google.
<a href="{unsub}" style="color:#9ca3af;">Se desabonner</a>
</p>
</div>
</body>
</html>"""


def build_touch1(name: str, city: str, resto_type: str, email: str = "") -> dict:
    """Touch 1: personal, type-specific accroche + product pitch + demo link."""
    accroche = get_accroche(resto_type)
    subject = f"{name} - une idee pour vos commandes"
    text = f"""Bonjour,

Je m'appelle Sarah, je travaille chez commandeici.

{accroche}

On a cree un outil simple pour les restos comme {name} : vos clients commandent en ligne sur VOTRE page, vous recevez en cuisine. Pas de commission, pas d'engagement.

Vous pouvez voir a quoi ca ressemble ici : https://app.commandeici.com/demo

19 euros/mois, 4 semaines d'essai gratuit, pas de CB demandee.

Si ca vous parle, repondez juste "oui" a ce mail et je vous aide a configurer votre page.

Sarah - CommandeIci"""

    return {"subject": subject, "text": text, "html": text_to_html(text, name, email)}


def build_touch2(name: str, city: str, resto_type: str, email: str = "") -> dict:
    """Touch 2 (+15 days): chiffres angle."""
    subject = f"Re: {name} - un calcul rapide"
    text = f"""Bonjour,

Je vous avais ecrit il y a quelques jours. Pas de souci si vous n'avez pas eu le temps de regarder.

Un truc qui fait reflechir : si vous faites 50 commandes par semaine sur une plateforme, a 25% de commission, ca fait environ 1000 euros par mois qui partent en commissions.

Sur commandeici, c'est 19 euros/mois. Zero commission. Le reste, c'est pour vous.

Concretement : vos clients commandent sur votre page, vous recevez la commande en cuisine. C'est tout.

Si ca vous interesse pour {name}, repondez a ce mail, je vous montre en 2 minutes.

Sarah - CommandeIci"""

    return {"subject": subject, "text": text, "html": text_to_html(text, name, email)}


def build_touch3(name: str, city: str, resto_type: str, email: str = "") -> dict:
    """Touch 3 (+30 days): social proof."""
    subject = f"{name} - ce que disent les restaurateurs"
    text = f"""Bonjour,

Un retour qu'on a souvent des restaurateurs qui utilisent commandeici :

"Avant, le telephone sonnait 40 fois par service. Maintenant les clients commandent en ligne, on recoit direct en cuisine. On a reduit les erreurs et on gagne du temps."

"J'etais sur Uber Eats, je perdais 25% sur chaque commande. Avec commandeici c'est 19 euros/mois, point. En un mois j'ai economise plus de 800 euros."

Si vous voulez tester pour {name}, c'est gratuit pendant 4 semaines : https://app.commandeici.com/inscription

Sarah - CommandeIci"""

    return {"subject": subject, "text": text, "html": text_to_html(text, name, email)}


def build_touch4(name: str, city: str, resto_type: str, email: str = "") -> dict:
    """Touch 4 (+45 days): break-up email."""
    subject = f"Dernier message pour {name}"
    text = f"""Bonjour,

C'est mon dernier mail, promis.

Si la commande en ligne n'est pas un sujet pour {name} en ce moment, aucun souci. Je ne vous embeterai plus.

Si un jour ca vous interesse : https://app.commandeici.com/inscription
4 semaines gratuites, 19 euros/mois apres, resiliable en un clic.

Bonne continuation a toute l'equipe.

Sarah - CommandeIci"""

    return {"subject": subject, "text": text, "html": text_to_html(text, name, email)}


TOUCH_BUILDERS = [build_touch1, build_touch2, build_touch3, build_touch4]


def build_email(name: str, city: str, resto_type: str, send_count: int, email: str = "") -> dict:
    """Build the right email for the touch number.
    send_count=0 -> touch 1, send_count=1 -> touch 2, etc."""
    idx = min(send_count, len(TOUCH_BUILDERS) - 1)
    return TOUCH_BUILDERS[idx](name, city, resto_type, email)


# --- Resend API ---------------------------------------------------------------

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


def log_to_supabase(resend_id: str, email: str, name: str, city: str, touch: int):
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
                "metadata": {"restaurant_name": name, "city": city, "touch": touch},
            },
            timeout=5,
        )
    except Exception as e:
        print(f"    [supabase log error: {e}]")


# --- Tracking -----------------------------------------------------------------

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


# --- Google Sheets Tracking ---------------------------------------------------

def track_to_sheets(restaurant: dict, resend_id: str, slot: str, touch: int):
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
                "touch": touch,
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


def sync_unsubscribed_to_sheets(unsubscribed_set):
    """Sync unsubscribed emails to Google Sheets 'Desinscrits' tab."""
    if not GOOGLE_SHEETS_WEBHOOK or not unsubscribed_set:
        return
    try:
        entries = [{"email": e, "date": "", "source": "supabase"} for e in unsubscribed_set]
        requests.post(
            GOOGLE_SHEETS_WEBHOOK,
            json={"action": "sync_unsubscribed", "entries": entries},
            timeout=15,
        )
        print(f"  [Sheets] {len(entries)} desinscrits synchronises")
    except Exception as e:
        print(f"    [sheets unsub sync error: {e}]")


# --- Unsubscribe blacklist ----------------------------------------------------

def load_unsubscribed():
    """Load unsubscribed emails from Supabase (one request)."""
    if not SUPABASE_KEY:
        return set()
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/prospection_unsubscribed?select=email",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return {row["email"].lower().strip() for row in resp.json()}
    except Exception as e:
        print(f"WARNING: Could not load unsubscribe list: {e}")
        return set()


# --- Main ---------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Send prospection emails")
    parser.add_argument("--batch-size", type=int, default=95, help="Number of emails to send (default: 95)")
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

    # Load unsubscribe blacklist
    unsubscribed = load_unsubscribed()
    print(f"Desinscrits   : {len(unsubscribed)}")

    # Deduplicate: 1 email per restaurant (pick best: contact@ > first clean)
    best_per_resto = {}
    for r in restaurants:
        email = r.get("email", "").strip().lower()
        if not email or not is_clean_email(email):
            continue
        if email in unsubscribed:
            continue
        name = r.get("name", "").strip()
        if name not in best_per_resto:
            best_per_resto[name] = {**r, "email": email}
        else:
            current = best_per_resto[name]["email"]
            if email.startswith("contact@") and not current.startswith("contact@"):
                best_per_resto[name] = {**r, "email": email}

    # Build lists by touch level
    now = datetime.now(timezone.utc)
    new_leads = []        # Never contacted (touch 0 -> send touch 1)
    retarget_r1 = []      # send_count=1, 15+ days (touch 1 -> send touch 2)
    retarget_r2 = []      # send_count=2, 15+ days (touch 2 -> send touch 3)
    retarget_r3 = []      # send_count=3, 15+ days (touch 3 -> send touch 4)
    seen_emails = set()

    for r in best_per_resto.values():
        email = r["email"]
        if email in seen_emails:
            continue
        seen_emails.add(email)

        if email not in sent_log:
            new_leads.append({"restaurant": r, "send_count": 0})
        else:
            entry = sent_log[email]
            send_count = entry.get("send_count", 1)
            if send_count >= MAX_TOUCHES:
                continue
            last_sent = entry.get("last_sent_at", entry.get("sent_at", ""))
            if not last_sent:
                continue
            try:
                last_dt = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
                days_since = (now - last_dt).days
                if days_since < RETARGET_DELAY_DAYS:
                    continue
                item = {
                    "restaurant": r,
                    "send_count": send_count,
                    "days_since": days_since,
                }
                if send_count == 3:
                    retarget_r3.append(item)
                elif send_count == 2:
                    retarget_r2.append(item)
                else:
                    retarget_r1.append(item)
            except (ValueError, TypeError):
                continue

    # Sort retargetable: oldest first within each tier
    for lst in [retarget_r1, retarget_r2, retarget_r3]:
        lst.sort(key=lambda x: x.get("days_since", 0), reverse=True)

    # Sort new leads: priority cities first
    def city_priority(item):
        city = item["restaurant"].get("city", "").strip()
        for i, pc in enumerate(PRIORITY_CITIES):
            if city.lower() == pc.lower():
                return i
        return len(PRIORITY_CITIES)

    new_leads.sort(key=city_priority)

    priority_count = sum(1 for u in new_leads if city_priority(u) < len(PRIORITY_CITIES))
    print(f"Nouveaux contacts     : {len(new_leads)} (dont {priority_count} prioritaires)")
    print(f"Retargetables R1 (T2) : {len(retarget_r1)}")
    print(f"Retargetables R2 (T3) : {len(retarget_r2)}")
    print(f"Retargetables R3 (T4) : {len(retarget_r3)}")
    if PRIORITY_CITIES:
        print(f"Villes prioritaires   : {', '.join(PRIORITY_CITIES)}")

    # Priority scheduling: hot leads > R3 (10%) > R2 (25%) > R1 (35%) > new (rest)
    batch_size = args.batch_size
    combined = []

    # R3 gets 10% of budget
    r3_budget = min(int(batch_size * 0.10), len(retarget_r3))
    combined.extend(retarget_r3[:r3_budget])

    # R2 gets 25% of budget
    r2_budget = min(int(batch_size * 0.25), len(retarget_r2))
    combined.extend(retarget_r2[:r2_budget])

    # R1 gets 35% of budget
    r1_budget = min(int(batch_size * 0.35), len(retarget_r1))
    combined.extend(retarget_r1[:r1_budget])

    # New fills the rest
    remaining = batch_size - len(combined)
    combined.extend(new_leads[:max(remaining, 0)])

    # If retargets didn't fill their quota, fill with more new leads
    if len(combined) < batch_size:
        already_emails = {item["restaurant"]["email"] for item in combined}
        extra_new = [n for n in new_leads if n["restaurant"]["email"] not in already_emails]
        combined.extend(extra_new[:batch_size - len(combined)])

    if not combined:
        print("Rien a envoyer. Tous les contacts sont a jour.")
        sys.exit(0)

    # Apply start-from offset
    if args.start_from > 0:
        combined = combined[args.start_from:]
        print(f"Apres offset (--start-from {args.start_from}) : {len(combined)}")

    # Take batch
    batch = combined[:batch_size]
    new_count = sum(1 for b in batch if b["send_count"] == 0)
    retarget_count = sum(1 for b in batch if b["send_count"] > 0)
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
        send_count = item["send_count"]
        touch_num = send_count + 1  # touch 1-4

        email = r["email"].strip().lower()
        name = r["name"].strip()
        city = r["city"].strip()
        resto_type = detect_type(r)

        email_data = build_email(name, city, resto_type, send_count, email)
        subject = email_data["subject"]
        html = email_data["html"]
        text = email_data["text"]

        tag = f"TOUCH {touch_num}" if touch_num > 1 else "NOUVEAU"
        type_tag = resto_type if resto_type != "restaurant" else ""
        type_str = f" [{type_tag}]" if type_tag else ""

        print(f"  [{i+1}/{len(batch)}] [{tag}]{type_str} {name} ({city}) -> {email}", end="", flush=True)

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
            log_to_supabase(resend_id, email, name, city, touch_num)
            track_to_sheets(r, resend_id, slot, touch_num)
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
                    log_to_supabase(resend_id, email, name, city, touch_num)
                    track_to_sheets(r, resend_id, slot, touch_num)
                except Exception as e2:
                    print(f"    Retry FAILED: {e2}")

            if error_count >= 5:
                print("\nTrop d'erreurs, arret du batch.")
                break
        except Exception as e:
            error_count += 1
            print(f"  ERROR: {e}")
            if error_count >= 5:
                print("\nTrop d'erreurs, arret du batch.")
                break

        # Small delay between sends
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
    stats["runs"] = stats["runs"][-100:]
    save_stats(stats)

    # Notify Sheets
    sheets_batch_summary()
    sync_unsubscribed_to_sheets(unsubscribed)

    # Summary
    remaining_new = max(len(new_leads) - new_count, 0)
    print(f"\n{'=' * 60}")
    print(f"RESULTATS")
    print(f"{'=' * 60}")
    print(f"Envoyes ce batch  : {sent_count} ({new_count} nouveaux + {retarget_count} relances)")
    print(f"Erreurs           : {error_count}")
    print(f"Total envoyes     : {stats['total_sent']}")
    print(f"Nouveaux restants : {remaining_new}")
    print(f"Retargetables     : R1={len(retarget_r1)} R2={len(retarget_r2)} R3={len(retarget_r3)}")
    if remaining_new > 0:
        days_left = remaining_new // 95
        print(f"Jours restants    : ~{days_left} jours (a 95/jour)")


if __name__ == "__main__":
    main()
