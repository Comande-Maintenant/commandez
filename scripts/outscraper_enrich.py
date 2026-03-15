#!/usr/bin/env python3
"""
Enrich restaurant leads using Outscraper Google Maps API.
Scrapes Google Maps for restaurants by department, matches with existing leads,
and updates leads.json with phone (mobile only), email, website, rating.

Usage:
    python3 scripts/outscraper_enrich.py --dept 21 --api-key KEY          # One department
    python3 scripts/outscraper_enrich.py --dept 21,75,69 --api-key KEY    # Multiple departments
    python3 scripts/outscraper_enrich.py --priority --api-key KEY          # Priority departments
    python3 scripts/outscraper_enrich.py --stats                           # Show stats
    python3 scripts/outscraper_enrich.py --free-tier --api-key KEY         # Max 500 fiches, Dijon first

Cost: ~$3/1000 fiches (Outscraper pricing).
Free tier: 500 fiches max.
"""

import argparse
import csv
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timezone

import requests

# ─── Config ───────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROSPECTION_DIR = os.path.join(BASE_DIR, "..", "prospection")
LEADS_FILE = os.path.join(PROSPECTION_DIR, "leads.json")
RAW_FILE = os.path.join(PROSPECTION_DIR, "outscraper_raw.json")
NEW_LEADS_CSV = os.path.join(PROSPECTION_DIR, "outscraper_new_leads.csv")
PROGRESS_FILE = os.path.join(PROSPECTION_DIR, "outscraper_progress.json")

OUTSCRAPER_API_URL = "https://api.app.outscraper.com/maps/search-v3"

# Categories to search on Google Maps
CATEGORIES = [
    "restaurant",
    "kebab",
    "pizzeria",
    "fast food",
    "snack",
    "tacos",
    "burger",
]

# Chain restaurants to exclude
CHAIN_NAMES = [
    "mcdonald", "kfc", "burger king", "subway", "domino", "pizza hut",
    "starbucks", "quick", "buffalo grill", "flunch", "hippopotamus",
    "courtepaille", "del arte", "la pataterie",
]

# Priority departments (big cities / high density)
PRIORITY_DEPTS = [
    "21",  # Cote-d'Or (Dijon - home base)
    "75",  # Paris
    "69",  # Rhone (Lyon)
    "13",  # Bouches-du-Rhone (Marseille)
    "31",  # Haute-Garonne (Toulouse)
    "33",  # Gironde (Bordeaux)
    "59",  # Nord (Lille)
    "44",  # Loire-Atlantique (Nantes)
    "67",  # Bas-Rhin (Strasbourg)
    "34",  # Herault (Montpellier)
]

# Department names for readable queries
DEPT_NAMES = {
    "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
    "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardeche", "08": "Ardennes",
    "09": "Ariege", "10": "Aube", "11": "Aude", "12": "Aveyron",
    "13": "Bouches-du-Rhone", "14": "Calvados", "15": "Cantal", "16": "Charente",
    "17": "Charente-Maritime", "18": "Cher", "19": "Correze", "21": "Cote-d'Or",
    "22": "Cotes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs",
    "26": "Drome", "27": "Eure", "28": "Eure-et-Loir", "29": "Finistere",
    "2A": "Corse-du-Sud", "2B": "Haute-Corse",
    "30": "Gard", "31": "Haute-Garonne", "32": "Gers", "33": "Gironde",
    "34": "Herault", "35": "Ille-et-Vilaine", "36": "Indre", "37": "Indre-et-Loire",
    "38": "Isere", "39": "Jura", "40": "Landes", "41": "Loir-et-Cher",
    "42": "Loire", "43": "Haute-Loire", "44": "Loire-Atlantique", "45": "Loiret",
    "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozere", "49": "Maine-et-Loire",
    "50": "Manche", "51": "Marne", "52": "Haute-Marne", "53": "Mayenne",
    "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan", "57": "Moselle",
    "58": "Nievre", "59": "Nord", "60": "Oise", "61": "Orne",
    "62": "Pas-de-Calais", "63": "Puy-de-Dome", "64": "Pyrenees-Atlantiques",
    "65": "Hautes-Pyrenees", "66": "Pyrenees-Orientales", "67": "Bas-Rhin",
    "68": "Haut-Rhin", "69": "Rhone", "70": "Haute-Saone", "71": "Saone-et-Loire",
    "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie", "75": "Paris",
    "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
    "79": "Deux-Sevres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
    "83": "Var", "84": "Vaucluse", "85": "Vendee", "86": "Vienne",
    "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
    "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
    "94": "Val-de-Marne", "95": "Val-d'Oise",
}

MOBILE_PHONE_REGEX = re.compile(
    r"0[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}"
)

PHONE_INTL_REGEX = re.compile(
    r"\+33\s?[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}"
)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def normalize(text: str) -> str:
    """Normalize text for fuzzy matching: lowercase, strip accents, remove punctuation."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    # Remove common prefixes/suffixes
    text = re.sub(
        r"\b(restaurant|brasserie|cafe|bar|snack|pizzeria|kebab|tacos|burger|"
        r"le |la |l'|les |chez |au |aux |du |de |des )\b",
        "", text
    )
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_city(city: str) -> str:
    """Normalize city name for matching."""
    if not city:
        return ""
    city = unicodedata.normalize("NFKD", city)
    city = "".join(c for c in city if not unicodedata.combining(c))
    city = city.lower().strip()
    city = re.sub(r"\s*\d+(e|er|eme|eme)?\s*(arrondissement)?", "", city)
    city = re.sub(r"[^a-z\s]", "", city)
    city = re.sub(r"\s+", " ", city).strip()
    return city


def similarity(a: str, b: str) -> float:
    """Simple similarity score based on common words / total words."""
    if not a or not b:
        return 0.0
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return 0.0
    common = words_a & words_b
    total = words_a | words_b
    return len(common) / len(total) if total else 0.0


def is_chain(name: str) -> bool:
    """Check if a restaurant name belongs to a chain."""
    name_lower = name.lower() if name else ""
    return any(chain in name_lower for chain in CHAIN_NAMES)


def extract_mobile(phone_str: str) -> str:
    """Extract a mobile phone number (06/07) from a string. Returns formatted or empty."""
    if not phone_str:
        return ""
    # Try +33 format first
    intl_match = PHONE_INTL_REGEX.search(phone_str)
    if intl_match:
        digits = re.sub(r"[^\d]", "", intl_match.group())
        # +33 6/7 XX XX XX XX -> 0 6/7 XX XX XX XX
        if digits.startswith("33"):
            digits = "0" + digits[2:]
        if len(digits) == 10 and digits[1] in ("6", "7"):
            return f"{digits[0:2]} {digits[2:4]} {digits[4:6]} {digits[6:8]} {digits[8:10]}"

    # Try 06/07 format
    match = MOBILE_PHONE_REGEX.search(phone_str)
    if match:
        digits = re.sub(r"[^\d]", "", match.group())
        if len(digits) == 10:
            return f"{digits[0:2]} {digits[2:4]} {digits[4:6]} {digits[6:8]} {digits[8:10]}"

    return ""


def extract_dept_from_address(address: str) -> str:
    """Try to extract department code from a French address (postal code)."""
    if not address:
        return ""
    # Match 5-digit French postal code
    m = re.search(r"\b(\d{5})\b", address)
    if m:
        code = m.group(1)
        dept = code[:2]
        if dept == "20":
            # Corsica: 20000-20199 = 2A, 20200+ = 2B
            if int(code) >= 20200:
                return "2B"
            return "2A"
        if dept in ("97",):
            return code[:3]  # DOM-TOM
        return dept
    return ""


def load_leads() -> dict:
    """Load leads.json."""
    if not os.path.exists(LEADS_FILE):
        print(f"ERROR: {LEADS_FILE} not found")
        sys.exit(1)
    with open(LEADS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_leads(leads: dict):
    """Save leads.json atomically."""
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=PROSPECTION_DIR, suffix=".json", prefix="leads_tmp_"
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(leads, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, LEADS_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def load_progress() -> dict:
    """Load progress file."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"departments_done": [], "total_fiches": 0, "seen_place_ids": []}


def save_progress(progress: dict):
    """Save progress file atomically."""
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=PROSPECTION_DIR, suffix=".json", prefix="progress_tmp_"
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, PROGRESS_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def build_leads_index(leads: dict) -> dict:
    """Build an index of normalized name -> list of (key, lead) for matching."""
    index = {}
    for key, lead in leads.items():
        name_norm = normalize(lead.get("name", ""))
        city_norm = normalize_city(lead.get("city", ""))
        if name_norm:
            index.setdefault(city_norm, []).append({
                "key": key,
                "name_norm": name_norm,
                "name": lead.get("name", ""),
                "city": lead.get("city", ""),
            })
    return index


# ─── Outscraper API ──────────────────────────────────────────────────────────


def outscraper_search(query: str, api_key: str, limit: int = 100) -> list:
    """
    Search Outscraper Google Maps API.
    Returns a list of place results.
    """
    params = {
        "query": query,
        "limit": limit,
        "language": "fr",
        "region": "FR",
        "enrichments": "emails_and_contacts",
        "async": False,
    }
    headers = {"X-API-KEY": api_key}

    try:
        resp = requests.get(
            OUTSCRAPER_API_URL,
            params=params,
            headers=headers,
            timeout=120,
        )
        if resp.status_code == 429:
            print("  [WARN] Rate limited, waiting 30s...")
            time.sleep(30)
            resp = requests.get(
                OUTSCRAPER_API_URL,
                params=params,
                headers=headers,
                timeout=120,
            )

        if resp.status_code != 200:
            print(f"  [ERROR] API returned {resp.status_code}: {resp.text[:200]}")
            return []

        data = resp.json()

        # Outscraper v3 returns nested list: [[results]]
        if isinstance(data, list) and len(data) > 0:
            if isinstance(data[0], list):
                return data[0]
            return data

        if isinstance(data, dict):
            # Check for async polling result or direct data
            if "data" in data:
                results = data["data"]
                if isinstance(results, list) and len(results) > 0:
                    if isinstance(results[0], list):
                        return results[0]
                    return results
            # Sometimes results are at top level
            if "results" in data:
                return data["results"]

        return []

    except requests.exceptions.Timeout:
        print(f"  [ERROR] Timeout for query: {query}")
        return []
    except Exception as e:
        print(f"  [ERROR] API exception: {e}")
        return []


def scrape_department(dept: str, api_key: str, progress: dict, free_tier_limit: int = 0) -> list:
    """
    Scrape all restaurant categories for a department.
    Returns list of all results.
    """
    dept_name = DEPT_NAMES.get(dept, dept)
    all_results = []
    seen_ids = set(progress.get("seen_place_ids", []))

    for cat in CATEGORIES:
        if free_tier_limit > 0 and progress["total_fiches"] >= free_tier_limit:
            print(f"  [LIMIT] Free tier limit reached ({free_tier_limit} fiches)")
            break

        query = f"{cat}, {dept_name}, France"
        print(f"  Searching: {query}")

        results = outscraper_search(query, api_key, limit=100)

        new_count = 0
        for r in results:
            place_id = r.get("place_id", r.get("google_id", ""))
            if place_id and place_id in seen_ids:
                continue
            if place_id:
                seen_ids.add(place_id)
            all_results.append(r)
            new_count += 1

        fiches_count = len(results)
        progress["total_fiches"] += fiches_count

        print(f"    -> {fiches_count} fiches ({new_count} new, {fiches_count - new_count} dupes)")

        # Be polite to the API
        time.sleep(2)

    progress["seen_place_ids"] = list(seen_ids)
    return all_results


# ─── Matching ─────────────────────────────────────────────────────────────────


def match_and_update(results: list, leads: dict, leads_index: dict, dept: str) -> dict:
    """
    Match Outscraper results with existing leads. Update leads in-place.
    Returns stats dict.
    """
    stats = {
        "total": len(results),
        "chains_filtered": 0,
        "matched": 0,
        "phones_added": 0,
        "emails_added": 0,
        "websites_added": 0,
        "ratings_added": 0,
        "new_leads": [],
    }

    for r in results:
        name = r.get("name", "")
        if not name:
            continue

        # Filter chains
        if is_chain(name):
            stats["chains_filtered"] += 1
            continue

        # Extract useful data from Outscraper result
        phone_raw = r.get("phone", "") or ""
        mobile = extract_mobile(phone_raw)
        email = r.get("email", "") or ""
        # emails_and_contacts enrichment may put emails in different fields
        if not email:
            emails_list = r.get("emails_and_contacts", {})
            if isinstance(emails_list, dict):
                email = emails_list.get("email", "") or ""
                if isinstance(email, list) and email:
                    email = email[0]
            elif isinstance(emails_list, list) and emails_list:
                email = emails_list[0] if isinstance(emails_list[0], str) else ""
        # Also check emails field directly
        if not email:
            emails_field = r.get("emails", [])
            if isinstance(emails_field, list) and emails_field:
                email = emails_field[0]
            elif isinstance(emails_field, str) and emails_field:
                email = emails_field

        website = r.get("site", "") or r.get("website", "") or ""
        rating = str(r.get("rating", "")) if r.get("rating") else ""
        reviews = str(r.get("reviews", "")) if r.get("reviews") else ""
        city = r.get("city", "") or ""
        address_full = r.get("full_address", "") or r.get("address", "") or ""

        # Try to get department from address
        result_dept = extract_dept_from_address(address_full)

        # Normalize for matching
        name_norm = normalize(name)
        city_norm = normalize_city(city)

        # Try matching by city first, then check name similarity
        matched = False
        best_match = None
        best_score = 0.0

        # Look in the city-based index
        for city_key in [city_norm]:
            candidates = leads_index.get(city_key, [])
            for cand in candidates:
                score = similarity(name_norm, cand["name_norm"])
                if score > best_score:
                    best_score = score
                    best_match = cand

        # Accept match if score > 0.7
        if best_match and best_score > 0.7:
            matched = True
            lead_key = best_match["key"]
            lead = leads[lead_key]

            # Update lead with new data (only if missing)
            if mobile and not lead.get("phone"):
                lead["phone"] = mobile
                stats["phones_added"] += 1
            elif mobile and lead.get("phone") and not extract_mobile(lead["phone"]):
                # Replace landline with mobile
                lead["phone_landline"] = lead["phone"]
                lead["phone"] = mobile
                stats["phones_added"] += 1

            if email and not lead.get("email"):
                lead["email"] = email
                stats["emails_added"] += 1

            if website and not lead.get("website"):
                lead["website"] = website
                stats["websites_added"] += 1

            if rating and not lead.get("rating"):
                lead["rating"] = rating
                stats["ratings_added"] += 1

            if reviews and not lead.get("reviews_count"):
                lead["reviews_count"] = reviews

            # Mark outscraper enrichment
            lead["outscraper_matched"] = True

            stats["matched"] += 1

        if not matched and email:
            # New lead not in our base
            stats["new_leads"].append({
                "name": name,
                "city": city,
                "email": email,
                "phone": mobile,
                "website": website,
                "rating": rating,
                "reviews_count": reviews,
                "address": address_full,
                "dept": result_dept or dept,
                "place_id": r.get("place_id", ""),
                "source": "outscraper",
                "date_added": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })

    return stats


# ─── Stats ────────────────────────────────────────────────────────────────────


def show_stats():
    """Show enrichment and progress stats."""
    leads = load_leads()
    progress = load_progress()

    total = len(leads)
    with_phone = sum(1 for l in leads.values() if l.get("phone"))
    with_mobile = sum(1 for l in leads.values() if extract_mobile(l.get("phone", "")))
    with_email = sum(1 for l in leads.values() if l.get("email"))
    with_website = sum(1 for l in leads.values() if l.get("website"))
    with_rating = sum(1 for l in leads.values() if l.get("rating"))
    outscraper_matched = sum(1 for l in leads.values() if l.get("outscraper_matched"))

    print("=" * 60)
    print("  OUTSCRAPER ENRICHMENT STATS")
    print("=" * 60)
    print(f"  Total leads:           {total:>8,}")
    print(f"  With phone:            {with_phone:>8,} ({with_phone/total*100:.1f}%)")
    print(f"  With mobile (06/07):   {with_mobile:>8,} ({with_mobile/total*100:.1f}%)")
    print(f"  With email:            {with_email:>8,} ({with_email/total*100:.1f}%)")
    print(f"  With website:          {with_website:>8,} ({with_website/total*100:.1f}%)")
    print(f"  With rating:           {with_rating:>8,} ({with_rating/total*100:.1f}%)")
    print(f"  Outscraper matched:    {outscraper_matched:>8,}")
    print()
    print("  OUTSCRAPER PROGRESS")
    print("-" * 60)
    print(f"  Total fiches scraped:  {progress.get('total_fiches', 0):>8,}")
    print(f"  Estimated cost:        ${progress.get('total_fiches', 0) * 3 / 1000:>8.2f}")
    print(f"  Departments done:      {len(progress.get('departments_done', []))}")
    if progress.get("departments_done"):
        print(f"    -> {', '.join(sorted(progress['departments_done']))}")
    print(f"  Unique place IDs:      {len(progress.get('seen_place_ids', [])):>8,}")
    print("=" * 60)

    # Check for new leads CSV
    if os.path.exists(NEW_LEADS_CSV):
        try:
            with open(NEW_LEADS_CSV, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # skip header
                new_count = sum(1 for _ in reader)
            print(f"  New leads (CSV):       {new_count:>8,}")
        except Exception:
            pass


# ─── CSV export ───────────────────────────────────────────────────────────────


def append_new_leads_csv(new_leads: list):
    """Append new leads to outscraper_new_leads.csv."""
    if not new_leads:
        return

    file_exists = os.path.exists(NEW_LEADS_CSV)
    fieldnames = [
        "name", "city", "email", "phone", "website", "rating",
        "reviews_count", "address", "dept", "place_id", "source", "date_added",
    ]

    with open(NEW_LEADS_CSV, "a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for lead in new_leads:
            writer.writerow({k: lead.get(k, "") for k in fieldnames})


def save_raw_results(results: list, dept: str):
    """Append raw results to outscraper_raw.json for debugging."""
    raw_data = {}
    if os.path.exists(RAW_FILE):
        try:
            with open(RAW_FILE, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except Exception:
            raw_data = {}

    raw_data[dept] = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "results": results,
    }

    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=PROSPECTION_DIR, suffix=".json", prefix="raw_tmp_"
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, RAW_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


# ─── Main ─────────────────────────────────────────────────────────────────────


def run_enrichment(departments: list, api_key: str, free_tier_limit: int = 0):
    """Run enrichment for given departments."""
    leads = load_leads()
    progress = load_progress()
    leads_index = build_leads_index(leads)

    total_stats = {
        "fiches_scraped": 0,
        "matches": 0,
        "phones_added": 0,
        "emails_added": 0,
        "websites_added": 0,
        "new_leads": 0,
        "chains_filtered": 0,
    }

    print(f"\nLoaded {len(leads):,} leads")
    print(f"Progress: {progress.get('total_fiches', 0)} fiches already scraped")
    if free_tier_limit > 0:
        remaining = max(0, free_tier_limit - progress.get("total_fiches", 0))
        print(f"Free tier mode: {remaining} fiches remaining (limit: {free_tier_limit})")
    print(f"Departments to scrape: {', '.join(departments)}")
    print()

    for dept in departments:
        if free_tier_limit > 0 and progress["total_fiches"] >= free_tier_limit:
            print(f"\n[LIMIT] Free tier limit reached. Stopping.")
            break

        if dept in progress.get("departments_done", []):
            print(f"[SKIP] Department {dept} already done")
            continue

        dept_name = DEPT_NAMES.get(dept, dept)
        print(f"\n{'='*60}")
        print(f"  Department {dept} - {dept_name}")
        print(f"{'='*60}")

        results = scrape_department(dept, api_key, progress, free_tier_limit)

        if not results:
            print(f"  No results for {dept}")
            progress.setdefault("departments_done", []).append(dept)
            save_progress(progress)
            continue

        # Save raw results for debugging
        save_raw_results(results, dept)

        # Match and update
        stats = match_and_update(results, leads, leads_index, dept)

        print(f"\n  Results for {dept}:")
        print(f"    Fiches:          {stats['total']}")
        print(f"    Chains filtered: {stats['chains_filtered']}")
        print(f"    Matched:         {stats['matched']}")
        print(f"    Phones added:    {stats['phones_added']}")
        print(f"    Emails added:    {stats['emails_added']}")
        print(f"    Websites added:  {stats['websites_added']}")
        print(f"    Ratings added:   {stats['ratings_added']}")
        print(f"    New leads:       {len(stats['new_leads'])}")

        # Update totals
        total_stats["fiches_scraped"] += stats["total"]
        total_stats["matches"] += stats["matched"]
        total_stats["phones_added"] += stats["phones_added"]
        total_stats["emails_added"] += stats["emails_added"]
        total_stats["websites_added"] += stats["websites_added"]
        total_stats["new_leads"] += len(stats["new_leads"])
        total_stats["chains_filtered"] += stats["chains_filtered"]

        # Save new leads to CSV
        if stats["new_leads"]:
            append_new_leads_csv(stats["new_leads"])

        # Mark department as done
        progress.setdefault("departments_done", []).append(dept)

        # Save progress
        save_progress(progress)
        save_leads(leads)
        print(f"  [SAVED] leads.json + progress updated")

    # Final summary
    cost = progress["total_fiches"] * 3 / 1000
    print(f"\n{'='*60}")
    print(f"  ENRICHMENT COMPLETE")
    print(f"{'='*60}")
    print(f"  Fiches scraped (session): {total_stats['fiches_scraped']:,}")
    print(f"  Fiches scraped (total):   {progress['total_fiches']:,}")
    print(f"  Chains filtered:          {total_stats['chains_filtered']:,}")
    print(f"  Matched to existing:      {total_stats['matches']:,}")
    print(f"  Phones added:             {total_stats['phones_added']:,}")
    print(f"  Emails added:             {total_stats['emails_added']:,}")
    print(f"  Websites added:           {total_stats['websites_added']:,}")
    print(f"  New leads (CSV):          {total_stats['new_leads']:,}")
    print(f"  Estimated cost (total):   ${cost:.2f}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(
        description="Enrich restaurant leads using Outscraper Google Maps API"
    )
    parser.add_argument(
        "--dept",
        type=str,
        help="Department code(s), comma-separated (e.g., 21,75,69)",
    )
    parser.add_argument(
        "--priority",
        action="store_true",
        help="Scrape priority departments (big cities)",
    )
    parser.add_argument(
        "--free-tier",
        action="store_true",
        help="Free tier mode: max 500 fiches, start with Dijon (21)",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="Outscraper API key",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show enrichment stats",
    )
    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    if not args.api_key:
        # Try env variable, then fallback
        api_key = os.environ.get("OUTSCRAPER_API_KEY", "")
        if not api_key:
            api_key = "MTlmODZiZWMyZjkwNGZmODhhMjA0M2U0NDE4M2U5MDZ8MTdiMTBhZTEyNw"
    else:
        api_key = args.api_key

    if args.free_tier:
        # Free tier: 500 fiches max, start with dept 21 (Dijon)
        departments = ["21"] + [d for d in PRIORITY_DEPTS if d != "21"]
        run_enrichment(departments, api_key, free_tier_limit=500)
    elif args.priority:
        run_enrichment(PRIORITY_DEPTS, api_key)
    elif args.dept:
        departments = [d.strip() for d in args.dept.split(",")]
        # Validate
        for d in departments:
            if d not in DEPT_NAMES:
                print(f"WARNING: Unknown department code '{d}', will still try")
        run_enrichment(departments, api_key)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
