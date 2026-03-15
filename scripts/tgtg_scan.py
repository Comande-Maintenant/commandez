#!/usr/bin/env python3
"""
TGTG (Too Good To Go) scanner for France restaurants.
Scans for restaurant stores, cross-matches with existing leads, extracts contacts.

Usage:
    python3 scripts/tgtg_scan.py --auth --email EMAIL    # First auth (interactive, saves credentials)
    python3 scripts/tgtg_scan.py --scan --mode cities    # Scan major cities only (~38 cities)
    python3 scripts/tgtg_scan.py --scan --mode grid      # Scan all France (grid, step=30km, radius=20km)
    python3 scripts/tgtg_scan.py --enrich                # Enrich from websites found
    python3 scripts/tgtg_scan.py --stats                 # Show stats

Auth:
    First run requires --auth --email YOUR_EMAIL (sends verification email).
    Credentials saved to .tgtg_credentials.json for subsequent runs.
    Env vars TGTG_ACCESS_TOKEN, TGTG_REFRESH_TOKEN, TGTG_USER_ID, TGTG_COOKIE override file.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
PROSPECTION_DIR = PROJECT_DIR / "prospection"
LEADS_FILE = PROSPECTION_DIR / "leads.json"
STORES_FILE = PROSPECTION_DIR / "tgtg_stores.json"
NEW_LEADS_FILE = PROSPECTION_DIR / "tgtg_new_leads.csv"
PROGRESS_FILE = PROSPECTION_DIR / "tgtg_progress.json"
CREDENTIALS_FILE = PROJECT_DIR / ".tgtg_credentials.json"

# ---------------------------------------------------------------------------
# France bounding box & cities
# ---------------------------------------------------------------------------

# Metropolitan France bounding box (lat/lng)
FR_LAT_MIN = 42.33
FR_LAT_MAX = 51.09
FR_LNG_MIN = -4.79
FR_LNG_MAX = 8.23

GRID_STEP_KM = 30
SCAN_RADIUS_KM = 20

# Approximate km per degree
KM_PER_LAT = 111.0
KM_PER_LNG_AT_46 = 77.0  # cos(46 deg) ~ 0.694

MAJOR_CITIES = {
    "Paris": (48.8566, 2.3522),
    "Marseille": (43.2965, 5.3698),
    "Lyon": (45.7640, 4.8357),
    "Toulouse": (43.6047, 1.4442),
    "Nice": (43.7102, 7.2620),
    "Nantes": (47.2184, -1.5536),
    "Montpellier": (43.6108, 3.8767),
    "Strasbourg": (48.5734, 7.7521),
    "Bordeaux": (44.8378, -0.5792),
    "Lille": (50.6292, 3.0573),
    "Rennes": (48.1173, -1.6778),
    "Reims": (49.2583, 3.2794),
    "Toulon": (43.1242, 5.9280),
    "Grenoble": (45.1885, 5.7245),
    "Dijon": (47.3220, 5.0415),
    "Angers": (47.4784, -0.5632),
    "Nimes": (43.8367, 4.3601),
    "Saint-Etienne": (45.4397, 4.3872),
    "Le Mans": (48.0061, 0.1996),
    "Clermont-Ferrand": (45.7772, 3.0870),
    "Brest": (48.3904, -4.4861),
    "Tours": (47.3941, 0.6848),
    "Amiens": (49.8941, 2.2958),
    "Limoges": (45.8336, 1.2611),
    "Metz": (49.1193, 6.1757),
    "Perpignan": (42.6887, 2.8948),
    "Besancon": (47.2378, 6.0241),
    "Orleans": (47.9029, 1.9093),
    "Rouen": (49.4432, 1.0999),
    "Caen": (49.1829, -0.3707),
    "Mulhouse": (47.7508, 7.3359),
    "Nancy": (48.6921, 6.1844),
    "Pau": (43.2951, -0.3708),
    "Avignon": (43.9493, 4.8055),
    "La Rochelle": (46.1603, -1.1511),
    "Poitiers": (46.5802, 0.3404),
    "Valence": (44.9334, 4.8924),
    "Auxerre": (47.7979, 3.5714),
}

SCAN_DELAY = 5  # seconds between TGTG API calls
CAPTCHA_WAIT = 60  # seconds to wait on DataDome/captcha

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def normalize(text: str) -> str:
    """Normalize text for fuzzy matching: lowercase, strip accents, remove punctuation."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def fuzzy_match(a: str, b: str) -> float:
    """Simple token-based similarity ratio between two strings."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    tokens_a = set(na.split())
    tokens_b = set(nb.split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    return len(intersection) / max(len(tokens_a), len(tokens_b))


def extract_siren(tax_identifier: str) -> Optional[str]:
    """Extract 9-digit SIREN from TGTG tax_identifier format FRXX{SIREN9}{SIRET5}."""
    if not tax_identifier:
        return None
    digits = re.sub(r"[^0-9]", "", tax_identifier)
    # Format: FR + 2 chars + 9 digits SIREN (+ optional 5 digits NIC)
    # After stripping non-digits, we get the key + SIREN + NIC
    # The tax_identifier is like "FR12345678901234" -> digits = "12345678901234"
    # key=2 digits, SIREN=9 digits, NIC=5 digits (if SIRET)
    # But sometimes it's just the TVA number: FRXX + SIREN (11 digits after FR)
    # TVA intra: FR + 2-digit key + 9-digit SIREN = 13 chars total
    # So digits part = 2 (key) + 9 (SIREN) = 11 digits
    if len(digits) >= 11:
        siren = digits[2:11]
        return siren
    return None


def atomic_save(filepath: Path, data: Any):
    """Atomic write: write to temp file then rename."""
    tmp = filepath.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.rename(filepath)


def load_json(filepath: Path, default=None):
    """Load JSON file, return default if not found."""
    if not filepath.exists():
        return default if default is not None else {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_dirs():
    """Ensure prospection directory exists."""
    PROSPECTION_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# TGTG Client wrapper
# ---------------------------------------------------------------------------


def get_tgtg_client():
    """Get authenticated TgtgClient. Tries env vars, then credentials file."""
    try:
        from tgtg import TgtgClient
    except ImportError:
        print("ERROR: tgtg package not installed. Run: pip install tgtg")
        sys.exit(1)

    # Try env vars first
    access_token = os.environ.get("TGTG_ACCESS_TOKEN")
    refresh_token = os.environ.get("TGTG_REFRESH_TOKEN")
    user_id = os.environ.get("TGTG_USER_ID")
    cookie = os.environ.get("TGTG_COOKIE")

    if access_token and refresh_token and user_id:
        print("[auth] Using credentials from environment variables")
        return TgtgClient(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user_id,
            cookie=cookie or "",
        )

    # Try credentials file
    if CREDENTIALS_FILE.exists():
        creds = load_json(CREDENTIALS_FILE)
        if creds.get("access_token") and creds.get("refresh_token") and creds.get("user_id"):
            print(f"[auth] Using credentials from {CREDENTIALS_FILE}")
            return TgtgClient(
                access_token=creds["access_token"],
                refresh_token=creds["refresh_token"],
                user_id=creds["user_id"],
                cookie=creds.get("cookie", ""),
            )

    print("ERROR: No TGTG credentials found.")
    print("Run first: python3 scripts/tgtg_scan.py --auth --email YOUR_EMAIL")
    print("Or set env vars: TGTG_ACCESS_TOKEN, TGTG_REFRESH_TOKEN, TGTG_USER_ID")
    sys.exit(1)


def do_auth(email: str):
    """Perform TGTG authentication (interactive: sends email with code)."""
    try:
        from tgtg import TgtgClient
    except ImportError:
        print("ERROR: tgtg package not installed. Run: pip install tgtg")
        sys.exit(1)

    print(f"[auth] Authenticating with email: {email}")
    print("[auth] Check your email for the TGTG verification link/code...")

    client = TgtgClient(email=email)
    # This call triggers the email and blocks until user clicks the link
    credentials = client.get_credentials()

    # Save credentials
    creds = {
        "access_token": credentials["access_token"],
        "refresh_token": credentials["refresh_token"],
        "user_id": credentials["user_id"],
        "cookie": credentials.get("cookie", ""),
        "email": email,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2)

    print(f"[auth] Credentials saved to {CREDENTIALS_FILE}")
    print("[auth] You can now run --scan")


# ---------------------------------------------------------------------------
# Store extraction
# ---------------------------------------------------------------------------


def extract_store_data(item: dict) -> Optional[dict]:
    """Extract relevant fields from a TGTG item response."""
    store = item.get("store", {})
    if not store:
        return None

    address = store.get("store_location", {}).get("address", {})
    country = address.get("country", {}).get("iso_code", "")

    # Only keep France
    if country != "FR":
        return None

    store_id = str(store.get("store_id", ""))
    if not store_id:
        return None

    # Extract SIREN from tax_identifier
    tax_id = store.get("tax_identifier", "")
    siren = extract_siren(tax_id)

    return {
        "tgtg_store_id": store_id,
        "name": store.get("store_name", ""),
        "branch": store.get("branch", ""),
        "address_line": address.get("address_line", ""),
        "city": address.get("city", ""),
        "postal_code": address.get("postal_code", ""),
        "country": country,
        "latitude": store.get("store_location", {}).get("location", {}).get("latitude"),
        "longitude": store.get("store_location", {}).get("location", {}).get("longitude"),
        "logo_url": store.get("logo_picture", {}).get("current_url", ""),
        "website": store.get("website", ""),
        "tax_identifier": tax_id,
        "siren": siren,
        "store_description": store.get("description", ""),
        "items_available": item.get("items_available", 0),
        "price_value": item.get("item", {}).get("price_including_taxes", {}).get("minor_units", 0) / 100.0
        if item.get("item", {}).get("price_including_taxes", {}).get("minor_units")
        else None,
        "category": item.get("item", {}).get("item_category", ""),
        "badges": [b.get("badge_type", "") for b in item.get("badges", [])],
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Scan logic
# ---------------------------------------------------------------------------


def generate_grid_points() -> List[Tuple[float, float, str]]:
    """Generate a grid of (lat, lng, label) points covering France."""
    points = []
    lat_step = GRID_STEP_KM / KM_PER_LAT
    lng_step = GRID_STEP_KM / KM_PER_LNG_AT_46

    lat = FR_LAT_MIN
    row = 0
    while lat <= FR_LAT_MAX:
        lng = FR_LNG_MIN
        col = 0
        while lng <= FR_LNG_MAX:
            label = f"grid_{row}_{col}"
            points.append((lat, lng, label))
            lng += lng_step
            col += 1
        lat += lat_step
        row += 1

    return points


def generate_city_points() -> List[Tuple[float, float, str]]:
    """Generate points for major French cities."""
    return [(lat, lng, name) for name, (lat, lng) in MAJOR_CITIES.items()]


def scan_point(client, lat: float, lng: float, radius_km: int = SCAN_RADIUS_KM) -> List[dict]:
    """Scan a single point with TGTG API. Returns list of store dicts."""
    try:
        items = client.get_items(
            favorites_only=False,
            latitude=lat,
            longitude=lng,
            radius=radius_km,
        )
        stores = []
        for item in items:
            store_data = extract_store_data(item)
            if store_data:
                stores.append(store_data)
        return stores
    except Exception as e:
        err_str = str(e).lower()
        if "captcha" in err_str or "datadome" in err_str or "403" in err_str:
            print(f"  [!] DataDome/captcha detected. Waiting {CAPTCHA_WAIT}s...")
            time.sleep(CAPTCHA_WAIT)
            # Retry once
            try:
                items = client.get_items(
                    favorites_only=False,
                    latitude=lat,
                    longitude=lng,
                    radius=radius_km,
                )
                stores = []
                for item in items:
                    store_data = extract_store_data(item)
                    if store_data:
                        stores.append(store_data)
                return stores
            except Exception as e2:
                print(f"  [!] Retry failed: {e2}. Skipping point.")
                return []
        elif "429" in err_str or "too many" in err_str:
            print(f"  [!] Rate limited. Waiting {CAPTCHA_WAIT}s...")
            time.sleep(CAPTCHA_WAIT)
            return []
        else:
            print(f"  [!] Error scanning ({lat:.4f}, {lng:.4f}): {e}")
            return []


def do_scan(mode: str):
    """Main scan routine. Resumable via progress file."""
    ensure_dirs()
    client = get_tgtg_client()

    # Load progress
    progress = load_json(PROGRESS_FILE, {"scanned_points": [], "total_stores_found": 0})
    scanned_set: Set[str] = set(progress.get("scanned_points", []))

    # Load existing stores
    all_stores: Dict[str, dict] = {}
    if STORES_FILE.exists():
        existing = load_json(STORES_FILE, [])
        for s in existing:
            all_stores[s["tgtg_store_id"]] = s

    # Generate points
    if mode == "cities":
        points = generate_city_points()
        print(f"[scan] Mode: cities ({len(points)} points)")
    else:
        points = generate_grid_points()
        print(f"[scan] Mode: grid ({len(points)} points)")

    # Filter already scanned
    remaining = [(lat, lng, label) for lat, lng, label in points if label not in scanned_set]
    print(f"[scan] Already scanned: {len(scanned_set)}, remaining: {len(remaining)}")

    new_count = 0
    for i, (lat, lng, label) in enumerate(remaining):
        print(f"[scan] {i + 1}/{len(remaining)} - {label} ({lat:.4f}, {lng:.4f})...", end="", flush=True)

        stores = scan_point(client, lat, lng)

        new_in_point = 0
        for s in stores:
            sid = s["tgtg_store_id"]
            if sid not in all_stores:
                all_stores[sid] = s
                new_in_point += 1
                new_count += 1
            else:
                # Update scanned_at timestamp
                all_stores[sid]["scanned_at"] = s["scanned_at"]

        print(f" {len(stores)} stores ({new_in_point} new)")

        # Track progress
        scanned_set.add(label)
        progress["scanned_points"] = list(scanned_set)
        progress["total_stores_found"] = len(all_stores)
        progress["last_scan"] = datetime.now(timezone.utc).isoformat()

        # Save periodically
        if (i + 1) % 10 == 0 or i == len(remaining) - 1:
            atomic_save(STORES_FILE, list(all_stores.values()))
            atomic_save(PROGRESS_FILE, progress)

        time.sleep(SCAN_DELAY)

    # Final save
    atomic_save(STORES_FILE, list(all_stores.values()))
    atomic_save(PROGRESS_FILE, progress)

    print(f"\n[scan] Done. Total unique stores: {len(all_stores)}, new this run: {new_count}")
    print(f"[scan] Saved to {STORES_FILE}")

    # Cross-match with leads
    cross_match_leads(all_stores)


# ---------------------------------------------------------------------------
# Cross-matching with leads.json
# ---------------------------------------------------------------------------


def cross_match_leads(stores: Dict[str, dict]):
    """Cross-match TGTG stores with existing leads.json."""
    if not LEADS_FILE.exists():
        print("[match] No leads.json found, skipping cross-match")
        export_new_leads(stores, set())
        return

    leads = load_json(LEADS_FILE, [])
    if not leads:
        print("[match] leads.json is empty, skipping cross-match")
        export_new_leads(stores, set())
        return

    print(f"[match] Cross-matching {len(stores)} TGTG stores with {len(leads)} leads...")

    # Build SIREN index from leads
    leads_by_siren: Dict[str, int] = {}
    for i, lead in enumerate(leads):
        siren = lead.get("siren", "")
        if siren and len(siren) >= 9:
            leads_by_siren[siren[:9]] = i

    # Build name+city index for fuzzy matching
    leads_name_city: List[Tuple[str, str, int]] = []
    for i, lead in enumerate(leads):
        name = lead.get("name", "") or lead.get("nom_complet", "") or ""
        city = lead.get("city", "") or lead.get("commune", "") or ""
        if name:
            leads_name_city.append((normalize(name), normalize(city), i))

    matched_count = 0
    updated_count = 0
    matched_store_ids: Set[str] = set()

    for sid, store in stores.items():
        matched_idx = None

        # 1. Try SIREN match
        if store.get("siren"):
            if store["siren"] in leads_by_siren:
                matched_idx = leads_by_siren[store["siren"]]

        # 2. Try fuzzy name+city match
        if matched_idx is None:
            store_name_norm = normalize(store.get("name", ""))
            store_city_norm = normalize(store.get("city", ""))
            if store_name_norm:
                best_score = 0.0
                best_idx = None
                for lead_name, lead_city, idx in leads_name_city:
                    name_score = fuzzy_match(store.get("name", ""), leads[idx].get("name", "") or leads[idx].get("nom_complet", "") or "")
                    city_score = fuzzy_match(store.get("city", ""), leads[idx].get("city", "") or leads[idx].get("commune", "") or "")
                    # Require strong name match + some city match
                    if name_score >= 0.7 and city_score >= 0.5:
                        combined = name_score * 0.7 + city_score * 0.3
                        if combined > best_score:
                            best_score = combined
                            best_idx = idx
                if best_idx is not None:
                    matched_idx = best_idx

        if matched_idx is not None:
            matched_count += 1
            matched_store_ids.add(sid)
            lead = leads[matched_idx]

            # Update lead with TGTG data
            changed = False
            if store.get("website") and not lead.get("website"):
                lead["website"] = store["website"]
                changed = True
            if store.get("siren") and not lead.get("siren"):
                lead["siren"] = store["siren"]
                changed = True
            if not lead.get("tgtg_store_id"):
                lead["tgtg_store_id"] = sid
                changed = True
            if not lead.get("latitude") and store.get("latitude"):
                lead["latitude"] = store["latitude"]
                lead["longitude"] = store["longitude"]
                changed = True

            if changed:
                updated_count += 1

    # Save updated leads
    if updated_count > 0:
        atomic_save(LEADS_FILE, leads)
        print(f"[match] Updated {updated_count} leads with TGTG data")

    print(f"[match] Matched {matched_count}/{len(stores)} stores to existing leads")

    # Export new leads (unmatched stores)
    export_new_leads(stores, matched_store_ids)


def export_new_leads(stores: Dict[str, dict], matched_ids: Set[str]):
    """Export unmatched TGTG stores as new leads CSV."""
    new_stores = [s for sid, s in stores.items() if sid not in matched_ids]
    if not new_stores:
        print("[export] No new leads to export")
        return

    fieldnames = [
        "tgtg_store_id", "name", "branch", "address_line", "city", "postal_code",
        "website", "siren", "tax_identifier", "category", "price_value",
        "latitude", "longitude", "scanned_at",
    ]

    with open(NEW_LEADS_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for s in sorted(new_stores, key=lambda x: x.get("city", "")):
            writer.writerow(s)

    print(f"[export] Exported {len(new_stores)} new leads to {NEW_LEADS_FILE}")


# ---------------------------------------------------------------------------
# Enrich: scrape websites for email/phone
# ---------------------------------------------------------------------------


def scrape_contact_from_website(url: str) -> dict:
    """Scrape a website for email and mobile phone number."""
    import requests
    from bs4 import BeautifulSoup

    result = {"email": None, "phone": None}
    if not url:
        return result

    # Normalize URL
    if not url.startswith("http"):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    try:
        resp = requests.get(url, timeout=10, headers=headers, allow_redirects=True)
        if resp.status_code != 200:
            return result

        text = resp.text
        soup = BeautifulSoup(text, "html.parser")
        page_text = soup.get_text(" ", strip=True)

        # Find emails
        emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", page_text)
        # Filter out common non-contact emails
        skip_domains = {"example.com", "sentry.io", "wixpress.com", "w3.org", "schema.org", "googleapis.com"}
        emails = [e for e in emails if not any(d in e.lower() for d in skip_domains)]
        if emails:
            result["email"] = emails[0].lower()

        # Find French mobile phones (06/07)
        phones = re.findall(r"(?:(?:\+33|0033)\s*[67]|0[67])[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}", page_text)
        if phones:
            # Clean up phone
            phone = re.sub(r"[\s.\-]", "", phones[0])
            if phone.startswith("+33"):
                phone = "0" + phone[3:]
            elif phone.startswith("0033"):
                phone = "0" + phone[4:]
            result["phone"] = phone

    except Exception:
        pass

    return result


def do_enrich():
    """Enrich TGTG stores and leads with website contact data."""
    ensure_dirs()

    if not STORES_FILE.exists():
        print("[enrich] No tgtg_stores.json found. Run --scan first.")
        return

    stores = load_json(STORES_FILE, [])
    leads = load_json(LEADS_FILE, []) if LEADS_FILE.exists() else []

    # Build lead lookup by tgtg_store_id
    leads_by_tgtg: Dict[str, int] = {}
    for i, lead in enumerate(leads):
        tid = lead.get("tgtg_store_id")
        if tid:
            leads_by_tgtg[tid] = i

    enriched = 0
    total_with_website = 0

    for store in stores:
        website = store.get("website", "")
        if not website:
            continue
        total_with_website += 1

        # Check if already enriched
        if store.get("scraped_email") or store.get("scraped_phone"):
            continue

        print(f"[enrich] Scraping {website}...", end="", flush=True)
        contact = scrape_contact_from_website(website)

        if contact["email"]:
            store["scraped_email"] = contact["email"]
        if contact["phone"]:
            store["scraped_phone"] = contact["phone"]

        if contact["email"] or contact["phone"]:
            enriched += 1
            print(f" email={contact['email']}, phone={contact['phone']}")

            # Also update matching lead
            sid = store.get("tgtg_store_id")
            if sid in leads_by_tgtg:
                idx = leads_by_tgtg[sid]
                if contact["email"] and not leads[idx].get("email"):
                    leads[idx]["email"] = contact["email"]
                if contact["phone"] and not leads[idx].get("phone"):
                    leads[idx]["phone"] = contact["phone"]
        else:
            print(" (no contact found)")

        time.sleep(1)  # polite delay

        # Save every 20
        if enriched % 20 == 0 and enriched > 0:
            atomic_save(STORES_FILE, stores)
            if leads:
                atomic_save(LEADS_FILE, leads)

    # Final save
    atomic_save(STORES_FILE, stores)
    if leads:
        atomic_save(LEADS_FILE, leads)

    print(f"\n[enrich] Done. {total_with_website} stores with websites, {enriched} newly enriched.")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


def do_stats():
    """Show scan statistics."""
    ensure_dirs()

    print("=== TGTG Scan Stats ===\n")

    # Progress
    progress = load_json(PROGRESS_FILE, {})
    scanned = len(progress.get("scanned_points", []))
    print(f"Points scanned: {scanned}")
    print(f"Last scan: {progress.get('last_scan', 'never')}")

    # Stores
    if STORES_FILE.exists():
        stores = load_json(STORES_FILE, [])
        print(f"\nTotal unique stores: {len(stores)}")

        # By city
        cities: Dict[str, int] = {}
        with_website = 0
        with_siren = 0
        with_email = 0
        with_phone = 0
        for s in stores:
            city = s.get("city", "Unknown")
            cities[city] = cities.get(city, 0) + 1
            if s.get("website"):
                with_website += 1
            if s.get("siren"):
                with_siren += 1
            if s.get("scraped_email"):
                with_email += 1
            if s.get("scraped_phone"):
                with_phone += 1

        print(f"With website: {with_website}")
        print(f"With SIREN: {with_siren}")
        print(f"With email (scraped): {with_email}")
        print(f"With phone (scraped): {with_phone}")

        print(f"\nTop 20 cities:")
        for city, count in sorted(cities.items(), key=lambda x: -x[1])[:20]:
            print(f"  {city}: {count}")
    else:
        print("\nNo stores file found. Run --scan first.")

    # New leads
    if NEW_LEADS_FILE.exists():
        with open(NEW_LEADS_FILE, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = sum(1 for _ in reader) - 1  # minus header
        print(f"\nNew leads (not in base): {rows}")

    # Leads cross-match
    if LEADS_FILE.exists():
        leads = load_json(LEADS_FILE, [])
        tgtg_matched = sum(1 for l in leads if l.get("tgtg_store_id"))
        print(f"Leads matched to TGTG: {tgtg_matched}/{len(leads)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="TGTG France restaurant scanner")
    parser.add_argument("--auth", action="store_true", help="Authenticate with TGTG (interactive)")
    parser.add_argument("--email", type=str, help="Email for TGTG auth")
    parser.add_argument("--scan", action="store_true", help="Run scan")
    parser.add_argument("--mode", type=str, choices=["cities", "grid"], default="cities", help="Scan mode")
    parser.add_argument("--enrich", action="store_true", help="Enrich stores from websites")
    parser.add_argument("--stats", action="store_true", help="Show statistics")

    args = parser.parse_args()

    if not any([args.auth, args.scan, args.enrich, args.stats]):
        parser.print_help()
        sys.exit(1)

    if args.auth:
        if not args.email:
            print("ERROR: --auth requires --email EMAIL")
            sys.exit(1)
        do_auth(args.email)
        return

    if args.scan:
        do_scan(args.mode)
        return

    if args.enrich:
        do_enrich()
        return

    if args.stats:
        do_stats()
        return


if __name__ == "__main__":
    main()
