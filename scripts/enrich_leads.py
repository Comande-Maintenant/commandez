#!/usr/bin/env python3
"""
Enrich 44,656 SIRENE restaurant leads with phone numbers and emails.
Uses FREE sources only: OpenStreetMap (Overpass API), Pages Jaunes, website scraping, search engines.

Usage:
    python3 scripts/enrich_leads.py --source osm            # Phase 1: match via OpenStreetMap
    python3 scripts/enrich_leads.py --source pagesjaunes     # Phase 1b: match via Pages Jaunes scraping
    python3 scripts/enrich_leads.py --source website         # Phase 2: scrape websites for emails
    python3 scripts/enrich_leads.py --source search --batch 200  # Phase 3: search engine fallback
    python3 scripts/enrich_leads.py --source facebook --departments 75  # Phase 4: Facebook page scraping
    python3 scripts/enrich_leads.py --source dorking --departments 75   # Phase 5: Google dorking via DDG
    python3 scripts/enrich_leads.py --stats                  # Show enrichment stats
    python3 scripts/enrich_leads.py --dry-run --source osm   # Preview without saving
    python3 scripts/enrich_leads.py --test                   # Test with 5 leads

Sources (run in order):
    1. osm          - Bulk download from OpenStreetMap by department, fuzzy match by name+city
    1b. pagesjaunes - Scrape Pages Jaunes by department/city, fuzzy match by name
    2. website      - Scrape found websites for email addresses (threaded, 8 workers)
    3. search       - DuckDuckGo/Bing search for phone/website (slow, use as fallback)
    4. facebook     - Search Facebook pages via DuckDuckGo, extract phone/email
    5. dorking      - DuckDuckGo dorking queries by city, match contacts to leads
"""

import argparse
import json
import os
import re
import sys
import time
import random
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, quote_plus

import requests
from bs4 import BeautifulSoup

# ─── Config ──────────────────────────────────────────────────────────────────────

LEADS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prospection", "leads.json")

SAVE_EVERY = 50  # Save progress every N leads

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
]

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)

PHONE_REGEX = re.compile(
    r"(?:\+33\s?|0033\s?|0)([1-9])[\s.\-]?(\d{2})[\s.\-]?(\d{2})[\s.\-]?(\d{2})[\s.\-]?(\d{2})"
)

MOBILE_PHONE_REGEX = re.compile(
    r"0[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}"
)

FB_PHONE_JSON_REGEX = re.compile(r'"phone_number"\s*:\s*"([^"]+)"')

BLACKLIST_DOMAINS = {
    "example.com", "sentry.io", "wixpress.com", "googleapis.com",
    "w3.org", "schema.org", "wordpress.org", "facebook.com",
    "instagram.com", "google.com", "apple.com", "microsoft.com",
    "cloudflare.com", "jsdelivr.net", "bootstrapcdn.com",
    "squarespace.com", "wix.com", "godaddy.com", "ovh.net",
    "gandi.net", "shopify.com", "herokuapp.com", "netlify.app",
    "pagesjaunes.fr", "tripadvisor.fr", "tripadvisor.com",
    "yelp.com", "yelp.fr", "thefork.com", "lafourchette.com",
    "bold-themes.com", "developer.com",
}

# Departments: metro (01-95) + DOM (971-976)
METRO_DEPTS = [f"{i:02d}" for i in range(1, 96)]
DOM_DEPTS = ["971", "972", "973", "974", "975", "976"]
ALL_DEPTS = METRO_DEPTS + DOM_DEPTS


# ─── Helpers ─────────────────────────────────────────────────────────────────────


def normalize(text: str) -> str:
    """Normalize text for fuzzy matching: lowercase, strip accents, remove punctuation."""
    if not text:
        return ""
    # NFKD decomposition then strip combining marks
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    # Remove common suffixes/prefixes that differ between SIRENE and OSM
    text = re.sub(r"\b(restaurant|brasserie|cafe|bar|snack|pizzeria|le |la |l'|les |chez |au |aux )\b", "", text)
    # Remove punctuation and extra spaces
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
    # Remove arrondissement info
    city = re.sub(r"\s*\d+e?\s*(arrondissement)?", "", city)
    city = re.sub(r"[^a-z0-9\s]", " ", city)
    city = re.sub(r"\s+", " ", city).strip()
    return city


def similarity(a: str, b: str) -> float:
    """Simple similarity score between two normalized strings (0-1)."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Check if one contains the other
    if a in b or b in a:
        return 0.85
    # Token overlap (Jaccard)
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def format_phone(phone_match) -> str:
    """Format a phone regex match to standard French format: 01 23 45 67 89."""
    groups = phone_match.groups() if hasattr(phone_match, 'groups') else phone_match
    return f"0{groups[0]} {groups[1]} {groups[2]} {groups[3]} {groups[4]}"


def normalize_phone(raw: str) -> str:
    """Normalize any phone string to 0X XX XX XX XX format."""
    if not raw:
        return ""
    # Remove all non-digit except +
    digits = re.sub(r"[^\d+]", "", raw)
    # Handle +33 or 0033
    if digits.startswith("+33"):
        digits = "0" + digits[3:]
    elif digits.startswith("0033"):
        digits = "0" + digits[4:]
    # Must be 10 digits starting with 0
    if len(digits) == 10 and digits.startswith("0"):
        return f"{digits[0:2]} {digits[2:4]} {digits[4:6]} {digits[6:8]} {digits[8:10]}"
    return ""


def is_valid_email(email: str) -> bool:
    """Check if email looks legit (not a system/framework address)."""
    email = email.lower().strip()
    if len(email) > 100 or len(email) < 5:
        return False
    if "@" not in email:
        return False
    domain = email.split("@")[1]
    if domain in BLACKLIST_DOMAINS:
        return False
    if any(
        p in email
        for p in [
            "noreply", "no-reply", "mailer-daemon", "postmaster",
            "webmaster@wordpress", "admin@wordpress", "test@",
            "example@", "info@wix", "privacy@", "abuse@",
            "support@wix", "support@squarespace", "donotreply",
            "unsubscribe", "newsletter@", "marketing@",
            "developer@", "dev@wordpress", "theme@",
            "demo@", "sales@developer", "hello@developer",
        ]
    ):
        return False
    # Block web agency / framework emails
    if any(
        kw in domain
        for kw in ["developer", "theme", "template", "starter", "developer"]
    ):
        return False
    tld = domain.split(".")[-1]
    if len(tld) < 2 or len(tld) > 10:
        return False
    return True


def get_headers() -> dict:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
    }


def is_mobile_phone(phone_str: str) -> bool:
    """Check if a normalized phone number is a mobile (06/07)."""
    if not phone_str:
        return False
    digits = re.sub(r"[^\d]", "", phone_str)
    return len(digits) == 10 and digits[:2] in ("06", "07")


def search_duckduckgo(query: str, max_results: int = 10) -> list:
    """Search DuckDuckGo HTML endpoint. Returns list of {title, url, snippet}.

    No API key needed. Uses https://html.duckduckgo.com/html/
    Returns empty list on error/captcha/block.
    """
    try:
        resp = requests.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={
                "User-Agent": random.choice(USER_AGENTS),
                "Referer": "https://html.duckduckgo.com/",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
            },
            timeout=15,
        )
        if resp.status_code in (403, 429, 503):
            return []
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")

        # Check for captcha / bot detection
        if "captcha" in resp.text.lower() or "robot" in resp.text.lower():
            return []

        results = []
        for r in soup.select(".result"):
            title_el = r.select_one(".result__title a, .result__a")
            snippet_el = r.select_one(".result__snippet")
            if not title_el:
                continue
            href = title_el.get("href", "")
            # DDG wraps URLs in redirect; extract actual URL
            if "uddg=" in href:
                from urllib.parse import parse_qs, urlparse as _urlparse
                parsed = _urlparse(href)
                qs = parse_qs(parsed.query)
                href = qs.get("uddg", [href])[0]
            results.append({
                "title": title_el.get_text(strip=True),
                "url": href,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
            })
            if len(results) >= max_results:
                break
        return results
    except Exception:
        return []


def dept_from_postal(code_postal: str) -> str:
    """Extract department code from postal code."""
    if not code_postal or code_postal == "[ND]":
        return ""
    if code_postal.startswith("97"):
        return code_postal[:3]
    return code_postal[:2]


# ─── Source 1: OpenStreetMap / Overpass ───────────────────────────────────────────


def fetch_osm_restaurants_by_dept(dept: str) -> list:
    """Fetch all restaurants/fast_food from OSM for a French department."""
    # For DOM departments, use different admin_level
    if dept in DOM_DEPTS:
        # DOM departments use admin_level 6
        query = f"""[out:json][timeout:60];
area["ref"="{dept}"]["admin_level"="6"]->.a;
(
  node["amenity"~"restaurant|fast_food"](area.a);
  way["amenity"~"restaurant|fast_food"](area.a);
);
out body;"""
    else:
        query = f"""[out:json][timeout:60];
area["ref"="{dept}"]["admin_level"="6"]->.a;
(
  node["amenity"~"restaurant|fast_food"](area.a);
  way["amenity"~"restaurant|fast_food"](area.a);
);
out body;"""

    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            timeout=90,
        )
        if resp.status_code == 429:
            print(f"    Rate limited on dept {dept}, waiting 30s...")
            time.sleep(30)
            resp = requests.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
                timeout=90,
            )
        if resp.status_code != 200:
            print(f"    Error fetching dept {dept}: HTTP {resp.status_code}")
            return []
        data = resp.json()
        return data.get("elements", [])
    except Exception as e:
        print(f"    Error fetching dept {dept}: {e}")
        return []


def build_osm_index(elements: list) -> dict:
    """Build a lookup index from OSM elements: {normalized_name: [element, ...]}."""
    index = defaultdict(list)
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue
        norm = normalize(name)
        if norm:
            index[norm].append(el)
        # Also index by individual significant words (3+ chars)
        for word in norm.split():
            if len(word) >= 4:
                index[f"_word_{word}"].append(el)
    return index


def match_lead_to_osm(lead: dict, osm_index: dict):
    """Try to match a lead to an OSM element. Returns {phone, website, email} or None."""
    lead_name = normalize(lead.get("name", ""))
    lead_city = normalize_city(lead.get("city", ""))

    if not lead_name or lead_name in ("sans nom", "sans objet"):
        return None

    candidates = []

    # Exact match
    if lead_name in osm_index:
        candidates.extend(osm_index[lead_name])

    # Word-based match
    lead_words = [w for w in lead_name.split() if len(w) >= 4]
    for word in lead_words:
        key = f"_word_{word}"
        if key in osm_index:
            candidates.extend(osm_index[key])

    if not candidates:
        return None

    # Score candidates
    best_score = 0
    best_el = None

    for el in candidates:
        tags = el.get("tags", {})
        osm_name = normalize(tags.get("name", ""))
        osm_city = ""

        # Try to get city from addr:city tag
        addr_city = tags.get("addr:city", tags.get("addr:commune", ""))
        if addr_city:
            osm_city = normalize_city(addr_city)

        name_sim = similarity(lead_name, osm_name)

        # City match bonus
        city_bonus = 0
        if lead_city and osm_city:
            if normalize_city(lead_city) == normalize_city(osm_city):
                city_bonus = 0.3
            elif normalize_city(lead_city) in normalize_city(osm_city) or normalize_city(osm_city) in normalize_city(lead_city):
                city_bonus = 0.15

        # Postal code match bonus
        postal_bonus = 0
        osm_postal = tags.get("addr:postcode", "")
        lead_postal = lead.get("code_postal", "")
        if osm_postal and lead_postal and osm_postal == lead_postal:
            postal_bonus = 0.2

        score = name_sim + city_bonus + postal_bonus

        if score > best_score:
            best_score = score
            best_el = el

    # Require a minimum confidence
    if best_score < 0.7:
        return None

    tags = best_el.get("tags", {})
    phone = tags.get("phone", tags.get("contact:phone", ""))
    website = tags.get("website", tags.get("contact:website", ""))
    email = tags.get("email", tags.get("contact:email", ""))

    # Must have at least phone or website
    if not phone and not website and not email:
        return None

    result = {"match_score": round(best_score, 2)}
    if phone:
        normalized = normalize_phone(phone)
        if normalized:
            result["phone"] = normalized
    if website:
        result["website"] = website
    if email and is_valid_email(email):
        result["email"] = email.lower()

    # Still need at least something useful
    if "phone" not in result and "website" not in result and "email" not in result:
        return None

    return result


def enrich_from_osm(leads: dict, dry_run: bool = False, test_mode: bool = False):
    """Phase 1: Match leads against OpenStreetMap data by department."""
    print("\n=== Phase 1: OpenStreetMap enrichment ===\n")

    # Group leads by department
    dept_leads = defaultdict(list)
    for key, lead in leads.items():
        if lead.get("source") != "sirene":
            continue
        if lead.get("enriched_osm"):
            continue
        if lead.get("email") or lead.get("phone"):
            continue
        dept = dept_from_postal(lead.get("code_postal", ""))
        if dept:
            dept_leads[dept].append(key)

    total_depts = len(dept_leads)
    print(f"Departments to process: {total_depts}")
    print(f"Total leads to match: {sum(len(v) for v in dept_leads.values())}")

    if test_mode:
        # Only process first 2 departments
        test_depts = list(dept_leads.keys())[:2]
        dept_leads = {d: dept_leads[d] for d in test_depts}
        print(f"TEST MODE: processing only depts {test_depts}")

    stats = {"matched": 0, "phone_found": 0, "website_found": 0, "email_found": 0, "processed": 0}
    save_counter = 0

    for dept_idx, (dept, lead_keys) in enumerate(sorted(dept_leads.items())):
        print(f"\n[{dept_idx+1}/{len(dept_leads)}] Dept {dept}: {len(lead_keys)} leads to match")

        # Fetch OSM data for this department
        elements = fetch_osm_restaurants_by_dept(dept)
        if not elements:
            print(f"    No OSM data for dept {dept}")
            # Mark as tried
            for key in lead_keys:
                leads[key]["enriched_osm"] = True
            continue

        with_contact = sum(1 for e in elements if any(
            k in e.get("tags", {}) for k in ["phone", "contact:phone", "website", "contact:website"]
        ))
        print(f"    OSM restaurants: {len(elements)} ({with_contact} with contact info)")

        # Build index
        osm_index = build_osm_index(elements)

        # Match each lead
        matched_this_dept = 0
        for key in lead_keys:
            lead = leads[key]
            result = match_lead_to_osm(lead, osm_index)

            if result:
                matched_this_dept += 1
                stats["matched"] += 1

                if not dry_run:
                    if "phone" in result and not lead.get("phone"):
                        lead["phone"] = result["phone"]
                        stats["phone_found"] += 1
                    if "website" in result and not lead.get("website"):
                        lead["website"] = result["website"]
                        stats["website_found"] += 1
                    if "email" in result and not lead.get("email"):
                        lead["email"] = result["email"]
                        lead["status"] = "new"
                        stats["email_found"] += 1
                    lead["enrichment_source"] = "osm"
                    lead["enriched_at"] = datetime.now(timezone.utc).isoformat()

                if test_mode or (matched_this_dept <= 3):
                    print(f"    MATCH: {lead.get('name')} ({lead.get('city')}) -> phone={result.get('phone','?')} web={result.get('website','?')[:40]} score={result.get('match_score')}")

            lead["enriched_osm"] = True
            stats["processed"] += 1
            save_counter += 1

        print(f"    Matched: {matched_this_dept}/{len(lead_keys)}")

        # Save progress
        if not dry_run and save_counter >= SAVE_EVERY:
            save_leads(leads)
            save_counter = 0
            print(f"    [saved]")

        # Respect Overpass rate limits (1 req per 5s is safe)
        if dept_idx < len(dept_leads) - 1:
            time.sleep(5)

    # Final save
    if not dry_run and save_counter > 0:
        save_leads(leads)

    print(f"\n--- OSM Results ---")
    print(f"Processed: {stats['processed']}")
    print(f"Matched: {stats['matched']}")
    print(f"Phones found: {stats['phone_found']}")
    print(f"Websites found: {stats['website_found']}")
    print(f"Emails found: {stats['email_found']}")


# ─── Source 1b: Pages Jaunes scraping ─────────────────────────────────────────────

# Playwright browser instance (reused across cities for performance)
_pw_browser = None
_pw_context = None
_pw_available = None  # None = not checked, True/False after check


def _check_playwright():
    """Check if playwright is installed and has chromium."""
    global _pw_available
    if _pw_available is not None:
        return _pw_available
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
        _pw_available = True
    except ImportError:
        _pw_available = False
    return _pw_available


def _get_pw_context():
    """Get or create a reusable Playwright browser context."""
    global _pw_browser, _pw_context
    if _pw_context is not None:
        return _pw_context

    from playwright.sync_api import sync_playwright

    pw = sync_playwright().start()
    _pw_browser = pw.chromium.launch(
        headless=True,
        args=["--disable-blink-features=AutomationControlled"],
    )
    _pw_context = _pw_browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale="fr-FR",
        viewport={"width": 1280, "height": 800},
    )
    return _pw_context


def _close_pw():
    """Clean up Playwright resources."""
    global _pw_browser, _pw_context
    try:
        if _pw_context:
            _pw_context.close()
        if _pw_browser:
            _pw_browser.close()
    except Exception:
        pass
    _pw_context = None
    _pw_browser = None


def _city_to_pj_slug(city: str) -> str:
    """Convert city name to Pages Jaunes URL slug.

    'AMBERIEU-EN-BUGEY' -> 'amberieu-en-bugey'
    'SAINT DENIS' -> 'saint-denis'
    'LES ABYMES' -> 'les-abymes'
    """
    slug = unicodedata.normalize("NFKD", city)
    slug = "".join(c for c in slug if not unicodedata.combining(c))
    slug = slug.lower().strip()
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def fetch_pj_results_for_city(city: str, code_postal: str, max_pages: int = 3) -> list:
    """Fetch restaurant listings from Pages Jaunes for a given city.

    Uses Playwright (headless Chromium) to bypass Cloudflare JS challenge.
    Install: pip install playwright && python -m playwright install chromium

    URL format: https://www.pagesjaunes.fr/annuaire/{city-slug}-{code_postal}/restaurants

    Returns a list of dicts: [{name, phone, website}, ...]
    """
    if not _check_playwright():
        print("      [!] Playwright not installed. Run: pip install playwright && python -m playwright install chromium")
        return []

    results = []
    ctx = _get_pw_context()
    city_slug = _city_to_pj_slug(city)

    for page_num in range(1, max_pages + 1):
        full_url = f"https://www.pagesjaunes.fr/annuaire/{city_slug}-{code_postal}/restaurants"
        if page_num > 1:
            full_url += f"?page={page_num}"

        try:
            page = ctx.new_page()
            resp = page.goto(full_url, wait_until="domcontentloaded", timeout=25000)

            if resp is None or (resp.status and resp.status >= 400):
                page.close()
                return results

            time.sleep(2)

            # Dismiss cookie consent overlay (blocks clicks)
            try:
                page.evaluate('document.querySelector("#appconsent")?.remove()')
            except Exception:
                pass

            # Check if still on Cloudflare challenge page
            title = page.title()
            if "moment" in title.lower():
                time.sleep(5)
                title = page.title()
                if "moment" in title.lower():
                    print(f"      Cloudflare challenge on {city}, skipping")
                    page.close()
                    return results

            # Click all "Afficher le N" buttons at once to reveal phone numbers
            try:
                page.evaluate(
                    'document.querySelectorAll("button.btn_tel").forEach(btn => btn.click())'
                )
                time.sleep(2)  # Wait for phone reveals (AJAX calls)
            except Exception:
                pass

            content = page.content()
            soup = BeautifulSoup(content, "html.parser")

            cards = soup.select("li.bi")
            page_results = 0
            for card in cards:
                entry = _parse_pj_card(card)
                if entry and entry.get("name"):
                    results.append(entry)
                    page_results += 1

            page.close()

            # No results -> stop pagination
            if page_results == 0:
                break

            # Delay between pages
            time.sleep(1.5 + random.random())

        except Exception as e:
            error_msg = str(e)
            if "timeout" in error_msg.lower():
                print(f"      Timeout on {city} page {page_num}")
            else:
                print(f"      Error PJ {city} p{page_num}: {error_msg[:80]}")
            try:
                page.close()
            except Exception:
                pass
            break

    return results


def _parse_pj_card(card) -> dict:
    """Parse a single Pages Jaunes result card into {name, phone, website}."""
    import base64 as _b64

    entry = {}

    # Extract business name from .bi-denomination
    name_el = card.select_one("a.bi-denomination, .bi-denomination")
    if name_el:
        # The name is inside the h3 inside the link
        h3 = name_el.select_one("h3")
        entry["name"] = (h3 or name_el).get_text(strip=True)
    else:
        return {}

    # Extract phone number (revealed after clicking "Afficher le N" button)
    phone = None

    # Method 1: tel: links (appear after phone reveal click)
    for tel in card.select("a[href^='tel:']"):
        raw = tel["href"].replace("tel:", "").strip()
        normalized = normalize_phone(raw)
        if normalized:
            phone = normalized
            break

    # Method 2: phone pattern in card text (fallback)
    if not phone:
        card_text = card.get_text()
        m = PHONE_REGEX.search(card_text)
        if m:
            phone = format_phone(m)

    if phone:
        entry["phone"] = phone

    # Extract website from data-pjlb attribute on a.bi-website
    website = None

    site_el = card.select_one("a.bi-website")
    if site_el:
        pjlb_raw = site_el.get("data-pjlb", "")
        if pjlb_raw:
            try:
                pjlb_data = json.loads(pjlb_raw)
                decoded = _b64.b64decode(pjlb_data.get("url", "")).decode("utf-8")
                if decoded.startswith("http"):
                    website = decoded
            except Exception:
                pass

    if website:
        entry["website"] = website

    return entry


def build_pj_index(pj_results: list) -> dict:
    """Build a lookup index from PJ results: {normalized_name: [result, ...]}."""
    index = defaultdict(list)
    for res in pj_results:
        name = res.get("name", "")
        if not name:
            continue
        norm = normalize(name)
        if norm:
            index[norm].append(res)
        # Also index by significant words
        for word in norm.split():
            if len(word) >= 4:
                index[f"_word_{word}"].append(res)
    return index


def match_lead_to_pj(lead: dict, pj_index: dict):
    """Try to match a lead to a Pages Jaunes result. Returns {phone, website} or None."""
    lead_name = normalize(lead.get("name", ""))

    if not lead_name or lead_name in ("sans nom", "sans objet"):
        return None

    candidates = []

    # Exact match
    if lead_name in pj_index:
        candidates.extend(pj_index[lead_name])

    # Word-based match
    lead_words = [w for w in lead_name.split() if len(w) >= 4]
    for word in lead_words:
        key = f"_word_{word}"
        if key in pj_index:
            candidates.extend(pj_index[key])

    if not candidates:
        return None

    # Deduplicate candidates by name
    seen = set()
    unique_candidates = []
    for c in candidates:
        cname = c.get("name", "")
        if cname not in seen:
            seen.add(cname)
            unique_candidates.append(c)

    # Score candidates
    best_score = 0
    best_res = None

    for res in unique_candidates:
        pj_name = normalize(res.get("name", ""))
        name_sim = similarity(lead_name, pj_name)

        if name_sim > best_score:
            best_score = name_sim
            best_res = res

    # Require a minimum confidence (same threshold as OSM)
    if best_score < 0.7:
        return None

    # Must have at least phone or website
    if not best_res.get("phone") and not best_res.get("website"):
        return None

    result = {"match_score": round(best_score, 2)}
    if best_res.get("phone"):
        result["phone"] = best_res["phone"]
    if best_res.get("website"):
        result["website"] = best_res["website"]

    return result


def enrich_from_pagesjaunes(leads: dict, batch: int = 0, dry_run: bool = False, test_mode: bool = False, dept_filter: set = None):
    """Phase 1b: Match leads against Pages Jaunes data by department/city."""
    print("\n=== Phase 1b: Pages Jaunes enrichment ===\n")

    # Group leads by department, then by (city, code_postal)
    # We need code_postal for the PJ URL: /annuaire/{city-slug}-{code_postal}/restaurants
    # Structure: dept_leads[dept][(city, code_postal)] = [lead_keys]
    dept_leads = defaultdict(lambda: defaultdict(list))
    for key, lead in leads.items():
        if lead.get("source") != "sirene":
            continue
        if lead.get("enriched_pj"):
            continue
        # Skip leads that already have both phone and email
        if lead.get("phone") and lead.get("email"):
            continue
        city = (lead.get("city") or "").strip()
        code_postal = (lead.get("code_postal") or "").strip()
        if not city or not code_postal or code_postal == "[ND]":
            continue
        dept = dept_from_postal(code_postal)
        if dept:
            if dept_filter and dept not in dept_filter:
                continue
            dept_leads[dept][(city, code_postal)].append(key)

    total_depts = len(dept_leads)
    total_cities = sum(len(cities) for cities in dept_leads.values())
    total_leads = sum(
        len(keys) for cities in dept_leads.values() for keys in cities.values()
    )
    print(f"Departments to process: {total_depts}")
    print(f"Cities to scrape: {total_cities}")
    print(f"Total leads to match: {total_leads}")

    if test_mode:
        # Only process first department, max 3 cities
        test_dept = sorted(dept_leads.keys())[0]
        cities_subset = dict(list(sorted(dept_leads[test_dept].items()))[:3])
        dept_leads = {test_dept: cities_subset}
        city_names = [c for c, _ in cities_subset.keys()]
        print(f"TEST MODE: dept {test_dept}, cities: {city_names}")

    if batch > 0:
        # Limit total leads processed
        count = 0
        limited = defaultdict(lambda: defaultdict(list))
        for dept in sorted(dept_leads.keys()):
            for city_key in sorted(dept_leads[dept].keys()):
                keys = dept_leads[dept][city_key]
                remaining = batch - count
                if remaining <= 0:
                    break
                limited[dept][city_key] = keys[:remaining]
                count += len(limited[dept][city_key])
            if count >= batch:
                break
        dept_leads = limited
        print(f"BATCH MODE: limited to {count} leads")

    stats = {
        "matched": 0, "phone_found": 0, "website_found": 0,
        "processed": 0, "cities_scraped": 0, "cities_blocked": 0,
        "pj_results_total": 0,
    }
    save_counter = 0

    for dept_idx, dept in enumerate(sorted(dept_leads.keys())):
        cities = dept_leads[dept]
        dept_lead_count = sum(len(v) for v in cities.values())
        print(f"\n[{dept_idx+1}/{len(dept_leads)}] Dept {dept}: {len(cities)} cities, {dept_lead_count} leads")

        for city_idx, ((city, code_postal), lead_keys) in enumerate(sorted(cities.items())):
            print(f"  [{city_idx+1}/{len(cities)}] {city} ({code_postal}): {len(lead_keys)} leads", end="")

            # Fetch Pages Jaunes results for this city
            pj_results = fetch_pj_results_for_city(city, code_postal)
            stats["cities_scraped"] += 1
            stats["pj_results_total"] += len(pj_results)

            if not pj_results:
                print(f" -> 0 PJ results")
                # Mark as tried
                for key in lead_keys:
                    leads[key]["enriched_pj"] = True
                    stats["processed"] += 1
                    save_counter += 1
                # Delay between cities
                time.sleep(2 + random.random())
                continue

            with_phone = sum(1 for r in pj_results if r.get("phone"))
            print(f" -> {len(pj_results)} PJ results ({with_phone} with phone)")

            # Build index for this city
            pj_index = build_pj_index(pj_results)

            # Match each lead
            matched_this_city = 0
            for key in lead_keys:
                lead = leads[key]
                result = match_lead_to_pj(lead, pj_index)

                if result:
                    matched_this_city += 1
                    stats["matched"] += 1

                    if not dry_run:
                        if "phone" in result and not lead.get("phone"):
                            lead["phone"] = result["phone"]
                            stats["phone_found"] += 1
                        if "website" in result and not lead.get("website"):
                            lead["website"] = result["website"]
                            stats["website_found"] += 1
                        # Update enrichment source
                        if lead.get("enrichment_source"):
                            lead["enrichment_source"] += "+pj"
                        else:
                            lead["enrichment_source"] = "pj"
                        lead["enriched_at"] = datetime.now(timezone.utc).isoformat()

                    if test_mode or matched_this_city <= 3:
                        print(f"    MATCH: {lead.get('name')} -> phone={result.get('phone','?')} web={result.get('website','?')[:40] if result.get('website') else '?'} score={result.get('match_score')}")

                lead["enriched_pj"] = True
                stats["processed"] += 1
                save_counter += 1

            if matched_this_city > 3:
                print(f"    ... {matched_this_city} matches total")

            # Save progress
            if not dry_run and save_counter >= SAVE_EVERY:
                save_leads(leads)
                save_counter = 0
                print(f"    [saved]")

            # Respect rate limits: 2-3 seconds between city requests
            time.sleep(2 + random.random())

    # Final save
    if not dry_run and save_counter > 0:
        save_leads(leads)

    # Clean up Playwright browser
    _close_pw()

    print(f"\n--- Pages Jaunes Results ---")
    print(f"Cities scraped: {stats['cities_scraped']} ({stats['cities_blocked']} blocked)")
    print(f"PJ results found: {stats['pj_results_total']}")
    print(f"Leads processed: {stats['processed']}")
    print(f"Matched: {stats['matched']}")
    print(f"Phones found: {stats['phone_found']}")
    print(f"Websites found: {stats['website_found']}")


# ─── Source 2: Website scraping for emails ───────────────────────────────────────


def extract_emails_from_url(url: str, timeout: int = 8) -> set:
    """Scrape a website for email addresses (homepage + contact pages)."""
    emails = set()
    try:
        resp = requests.get(
            url, headers=get_headers(), timeout=timeout, allow_redirects=True
        )
        if resp.status_code != 200:
            return emails

        html = resp.text

        # Extract from raw HTML
        for match in EMAIL_REGEX.findall(html):
            if is_valid_email(match):
                emails.add(match.lower())

        # Extract from mailto: links
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            if "mailto:" in a["href"]:
                email = a["href"].replace("mailto:", "").split("?")[0].strip()
                if is_valid_email(email):
                    emails.add(email.lower())

        # Crawl contact/legal pages on same domain
        contact_urls = set()
        base_domain = urlparse(url).netloc
        for a in soup.find_all("a", href=True):
            href = a["href"].lower()
            text = (a.get_text() or "").lower()
            if any(
                kw in href or kw in text
                for kw in [
                    "contact", "mentions", "legal", "a-propos", "about",
                    "info", "qui-sommes", "nous-contacter", "impressum",
                ]
            ):
                full_url = urljoin(url, a["href"])
                if urlparse(full_url).netloc == base_domain:
                    contact_urls.add(full_url)

        for contact_url in list(contact_urls)[:3]:
            try:
                time.sleep(0.5)
                resp2 = requests.get(
                    contact_url, headers=get_headers(), timeout=timeout, allow_redirects=True
                )
                if resp2.status_code != 200:
                    continue
                for match in EMAIL_REGEX.findall(resp2.text):
                    if is_valid_email(match):
                        emails.add(match.lower())
                soup2 = BeautifulSoup(resp2.text, "html.parser")
                for a in soup2.find_all("a", href=True):
                    if "mailto:" in a["href"]:
                        email = a["href"].replace("mailto:", "").split("?")[0].strip()
                        if is_valid_email(email):
                            emails.add(email.lower())
            except Exception:
                pass
    except Exception:
        pass

    return emails


def extract_phone_from_url(url: str, timeout: int = 8):
    """Try to find a phone number on a website."""
    try:
        resp = requests.get(
            url, headers=get_headers(), timeout=timeout, allow_redirects=True
        )
        if resp.status_code != 200:
            return None

        # Search in visible text (strip HTML)
        soup = BeautifulSoup(resp.text, "html.parser")
        text = soup.get_text()

        # Also check tel: links
        for a in soup.find_all("a", href=True):
            if "tel:" in a["href"]:
                raw = a["href"].replace("tel:", "").strip()
                normalized = normalize_phone(raw)
                if normalized:
                    return normalized

        # Search phone patterns in text
        matches = PHONE_REGEX.findall(text)
        if matches:
            return format_phone(matches[0])

    except Exception:
        pass
    return None


def enrich_from_website(leads: dict, batch: int = 0, dry_run: bool = False, test_mode: bool = False):
    """Phase 2: Scrape websites found in Phase 1 for email addresses and phone numbers."""
    print("\n=== Phase 2: Website scraping for emails ===\n")

    # Find leads with website but no email
    to_scrape = []
    for key, lead in leads.items():
        if lead.get("enriched_website"):
            continue
        website = lead.get("website", "")
        if not website:
            continue
        if lead.get("email"):
            continue
        to_scrape.append(key)

    if batch > 0:
        to_scrape = to_scrape[:batch]

    if test_mode:
        to_scrape = to_scrape[:5]

    print(f"Leads with website to scrape: {len(to_scrape)}")

    stats = {"emails_found": 0, "phones_found": 0, "processed": 0, "errors": 0}
    save_counter = 0

    def process_lead(key):
        lead = leads[key]
        website = lead["website"]
        result = {"key": key, "email": None, "phone": None, "error": False}

        try:
            # Scrape for emails
            emails = extract_emails_from_url(website)
            if emails:
                result["email"] = sorted(emails)[0]  # Pick first alphabetically

            # If no phone yet, try to find one
            if not lead.get("phone"):
                phone = extract_phone_from_url(website)
                if phone:
                    result["phone"] = phone

        except Exception as e:
            result["error"] = True

        return result

    # Use thread pool for parallel scraping
    max_workers = 8 if not test_mode else 2
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_lead, key): key for key in to_scrape}

        for future in as_completed(futures):
            result = future.result()
            key = result["key"]
            lead = leads[key]
            stats["processed"] += 1

            if not dry_run:
                lead["enriched_website"] = True
                lead["enriched_at"] = datetime.now(timezone.utc).isoformat()

                if result["email"]:
                    lead["email"] = result["email"]
                    lead["status"] = "new"
                    if lead.get("enrichment_source"):
                        lead["enrichment_source"] += "+website"
                    else:
                        lead["enrichment_source"] = "website"
                    stats["emails_found"] += 1

                if result["phone"]:
                    lead["phone"] = result["phone"]
                    stats["phones_found"] += 1

                if result["error"]:
                    stats["errors"] += 1

            if result["email"] or result["phone"]:
                name = lead.get("name", "?")[:30]
                print(f"  FOUND: {name} -> email={result.get('email','?')} phone={result.get('phone','?')}")

            save_counter += 1
            if not dry_run and save_counter >= SAVE_EVERY:
                save_leads(leads)
                save_counter = 0
                if stats["processed"] % 100 == 0:
                    print(f"  ... {stats['processed']}/{len(to_scrape)} processed, {stats['emails_found']} emails found")

    # Final save
    if not dry_run and save_counter > 0:
        save_leads(leads)

    print(f"\n--- Website Results ---")
    print(f"Processed: {stats['processed']}")
    print(f"Emails found: {stats['emails_found']}")
    print(f"Phones found: {stats['phones_found']}")
    print(f"Errors: {stats['errors']}")


# ─── Source 3: Search engine scraping ────────────────────────────────────────────


def search_bing(query: str):
    """Search Bing for a restaurant, extract phone and website from results."""
    try:
        url = f"https://www.bing.com/search?q={quote_plus(query)}"
        resp = requests.get(url, headers=get_headers(), timeout=10)
        if resp.status_code != 200:
            return None

        html = resp.text

        # Extract search results
        results_html = re.findall(r'<li class="b_algo".*?</li>', html, re.DOTALL)
        if not results_html:
            return None

        result = {}

        for res_html in results_html[:5]:
            # Strip HTML for text analysis
            text = re.sub(r'<[^>]+>', ' ', res_html)
            text = re.sub(r'\s+', ' ', text).strip()

            # Find phone in result text
            phone_matches = PHONE_REGEX.findall(text)
            if phone_matches and "phone" not in result:
                result["phone"] = format_phone(phone_matches[0])

            # Find website URLs (not bing.com or directory sites)
            urls = re.findall(r'href="(https?://[^"]+)"', res_html)
            for u in urls:
                parsed = urlparse(u)
                domain = parsed.netloc.lower()
                if any(skip in domain for skip in [
                    "bing.com", "microsoft.com", "pagesjaunes.fr", "tripadvisor",
                    "yelp", "thefork", "lafourchette", "facebook.com",
                    "instagram.com", "google.com", "twitter.com", "wikipedia",
                ]):
                    continue
                if "website" not in result:
                    # Try to resolve bing redirect
                    result["website"] = u
                    break

        return result if result else None

    except Exception:
        return None


def enrich_from_search(leads: dict, batch: int = 200, dry_run: bool = False, test_mode: bool = False):
    """Phase 3: Use search engines to find phone/website for remaining leads."""
    print("\n=== Phase 3: Search engine enrichment ===\n")

    # Find leads without phone and not yet searched
    to_search = []
    for key, lead in leads.items():
        if lead.get("source") != "sirene":
            continue
        if lead.get("enriched_search"):
            continue
        if lead.get("phone") and lead.get("email"):
            continue
        name = lead.get("name", "")
        if not name or name in ("Sans nom", "SANS OBJET"):
            continue
        to_search.append(key)

    if batch > 0:
        to_search = to_search[:batch]
    if test_mode:
        to_search = to_search[:5]

    print(f"Leads to search: {len(to_search)}")

    stats = {"phones_found": 0, "websites_found": 0, "processed": 0}
    save_counter = 0

    for i, key in enumerate(to_search):
        lead = leads[key]
        name = lead.get("name", "")
        city = lead.get("city", "")

        query = f'"{name}" {city} restaurant telephone'
        result = search_bing(query)

        if not dry_run:
            lead["enriched_search"] = True
            lead["enriched_at"] = datetime.now(timezone.utc).isoformat()

        if result:
            if "phone" in result and not lead.get("phone"):
                if not dry_run:
                    lead["phone"] = result["phone"]
                stats["phones_found"] += 1
                print(f"  PHONE: {name} ({city}) -> {result['phone']}")

            if "website" in result and not lead.get("website"):
                if not dry_run:
                    lead["website"] = result["website"]
                    if lead.get("enrichment_source"):
                        lead["enrichment_source"] += "+search"
                    else:
                        lead["enrichment_source"] = "search"
                stats["websites_found"] += 1

        stats["processed"] += 1
        save_counter += 1

        if not dry_run and save_counter >= SAVE_EVERY:
            save_leads(leads)
            save_counter = 0

        if stats["processed"] % 50 == 0:
            print(f"  ... {stats['processed']}/{len(to_search)} processed")

        # Rate limit: 2-4 seconds between searches
        delay = 2 + random.random() * 2
        time.sleep(delay)

    if not dry_run and save_counter > 0:
        save_leads(leads)

    print(f"\n--- Search Results ---")
    print(f"Processed: {stats['processed']}")
    print(f"Phones found: {stats['phones_found']}")
    print(f"Websites found: {stats['websites_found']}")


# ─── Stats ───────────────────────────────────────────────────────────────────────


def print_stats(leads: dict):
    """Print enrichment statistics."""
    total = 0
    sirene = 0
    has_email = 0
    has_phone = 0
    has_website = 0
    has_both = 0
    enriched_osm = 0
    enriched_pj = 0
    enriched_website = 0
    enriched_search = 0
    matched_osm = 0
    by_source = defaultdict(int)

    for key, lead in leads.items():
        total += 1
        if lead.get("source") == "sirene":
            sirene += 1
        if lead.get("email"):
            has_email += 1
        if lead.get("phone"):
            has_phone += 1
        if lead.get("website"):
            has_website += 1
        if lead.get("email") and lead.get("phone"):
            has_both += 1
        if lead.get("enriched_osm"):
            enriched_osm += 1
        if lead.get("enriched_pj"):
            enriched_pj += 1
        if lead.get("enriched_website"):
            enriched_website += 1
        if lead.get("enriched_search"):
            enriched_search += 1
        src = lead.get("enrichment_source", "")
        if src:
            by_source[src] += 1

    no_contact = sum(1 for l in leads.values() if not l.get("email") and not l.get("phone"))

    print("\n=== Enrichment Stats ===\n")
    print(f"Total leads:           {total}")
    print(f"  SIRENE leads:        {sirene}")
    print(f"  Google Places leads: {total - sirene}")
    print()
    print(f"Has email:             {has_email} ({100*has_email//max(total,1)}%)")
    print(f"Has phone:             {has_phone} ({100*has_phone//max(total,1)}%)")
    print(f"Has website:           {has_website} ({100*has_website//max(total,1)}%)")
    print(f"Has email+phone:       {has_both} ({100*has_both//max(total,1)}%)")
    print(f"No contact info:       {no_contact} ({100*no_contact//max(total,1)}%)")
    print()
    print(f"OSM processed:         {enriched_osm}")
    print(f"Pages Jaunes tried:    {enriched_pj}")
    print(f"Website scraped:       {enriched_website}")
    print(f"Search engine tried:   {enriched_search}")
    print()
    if by_source:
        print("By enrichment source:")
        for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
            print(f"  {src}: {count}")


# ─── I/O ─────────────────────────────────────────────────────────────────────────


def load_leads() -> dict:
    """Load leads from JSON file."""
    with open(LEADS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_leads(leads: dict):
    """Save leads to JSON file (atomic write)."""
    tmp_file = LEADS_FILE + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, LEADS_FILE)


# ─── Main ────────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Enrich restaurant leads with phone/email (FREE sources)")
    parser.add_argument("--source", choices=["osm", "pagesjaunes", "website", "search"], help="Enrichment source to use")
    parser.add_argument("--batch", type=int, default=0, help="Max leads to process (0=all)")
    parser.add_argument("--stats", action="store_true", help="Print enrichment stats")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--test", action="store_true", help="Test with 5 leads")
    parser.add_argument("--departments", type=str, default="", help="Comma-separated dept range: '01,02,03' or '01-24'")

    args = parser.parse_args()

    if not args.stats and not args.source and not args.test:
        parser.print_help()
        sys.exit(1)

    # Load leads
    print(f"Loading leads from {LEADS_FILE}...")
    leads = load_leads()
    print(f"Loaded {len(leads)} leads")

    if args.stats:
        print_stats(leads)
        return

    if args.test:
        args.source = args.source or "osm"
        args.dry_run = False  # Actually save in test mode to verify

    # Parse department filter
    dept_filter = None
    if args.departments:
        dept_filter = set()
        for part in args.departments.split(","):
            if "-" in part:
                start, end = part.split("-", 1)
                for d in range(int(start), int(end) + 1):
                    dept_filter.add(str(d).zfill(2))
            else:
                dept_filter.add(part.strip().zfill(2))

    if args.source == "osm":
        enrich_from_osm(leads, dry_run=args.dry_run, test_mode=args.test)
    elif args.source == "pagesjaunes":
        enrich_from_pagesjaunes(leads, batch=args.batch, dry_run=args.dry_run, test_mode=args.test, dept_filter=dept_filter)
    elif args.source == "website":
        enrich_from_website(leads, batch=args.batch, dry_run=args.dry_run, test_mode=args.test)
    elif args.source == "search":
        enrich_from_search(leads, batch=args.batch, dry_run=args.dry_run, test_mode=args.test)

    # Show final stats
    if not args.dry_run:
        leads = load_leads()  # Reload to get latest
    print_stats(leads)


if __name__ == "__main__":
    main()
