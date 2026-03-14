#!/usr/bin/env python3
"""
Collect restaurant emails via Google Places API for commandeici B2B prospecting.

Usage:
    export GOOGLE_PLACES_API_KEY="your_key"
    python3 scripts/collect_restaurants.py

Features:
    - 40 cities x 6 query types = 240 searches
    - Automatic pagination (up to 60 results per query)
    - Place Details for website + phone
    - Website scraping for emails (homepage + contact/legal pages)
    - Chain filtering (McDo, BK, KFC, etc.)
    - Deduplication by place_id
    - Resume capability (saves progress every 50 items)
    - CSV + JSON output

Estimated API cost: ~$20 for ~4000 restaurants
"""

import csv
import json
import os
import re
import sys
import time
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ─── Config ──────────────────────────────────────────────────────────────────────

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prospection")

CITIES = [
    "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux",
    "Nice", "Nantes", "Strasbourg", "Montpellier", "Lille",
    "Rennes", "Reims", "Le Havre", "Saint-Etienne", "Toulon",
    "Grenoble", "Dijon", "Angers", "Nimes", "Clermont-Ferrand",
    "Le Mans", "Aix-en-Provence", "Brest", "Tours", "Amiens",
    "Limoges", "Perpignan", "Metz", "Besancon", "Orleans",
    "Rouen", "Mulhouse", "Caen", "Nancy", "Avignon",
    "Poitiers", "La Rochelle", "Pau", "Calais", "Valence",
]

QUERIES = [
    "kebab {city}",
    "pizzeria {city}",
    "fast food {city}",
    "snack {city}",
    "tacos {city}",
    "restaurant rapide {city}",
]

CHAIN_KEYWORDS = [
    "mcdonald", "burger king", "kfc", "subway", "domino", "pizza hut",
    "five guys", "quick", "o'tacos", "bagelstein", "class'croute",
    "la mie caline", "paul ", "brioche doree", "flunch", "buffalo grill",
    "hippopotamus", "leon de bruxelles", "del arte", "la pataterie",
    "popeyes", "taco bell", "wendy", "papa john", "little caesars",
    "jack's express", "speed burger", "mcdo", "starbucks", "columbus cafe",
    "nachos", "pitaya", "pokawa", "cojean", "eat sushi", "sushi shop",
]

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.IGNORECASE
)

BLACKLIST_DOMAINS = {
    "example.com", "sentry.io", "wixpress.com", "googleapis.com",
    "w3.org", "schema.org", "wordpress.org", "facebook.com",
    "instagram.com", "google.com", "apple.com", "microsoft.com",
    "cloudflare.com", "jsdelivr.net", "bootstrapcdn.com",
    "squarespace.com", "wix.com", "godaddy.com", "ovh.net",
    "gandi.net", "shopify.com", "herokuapp.com", "netlify.app",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


# ─── Helpers ─────────────────────────────────────────────────────────────────────


def is_chain(name: str) -> bool:
    name_lower = name.lower()
    return any(chain in name_lower for chain in CHAIN_KEYWORDS)


def is_valid_email(email: str) -> bool:
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
            "support@wix", "support@squarespace",
        ]
    ):
        return False
    # Must have a valid TLD
    tld = domain.split(".")[-1]
    if len(tld) < 2 or len(tld) > 10:
        return False
    return True


def load_json(path: str) -> list:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_json(data: list, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─── Google Places API ───────────────────────────────────────────────────────────


def search_places(query: str, page_token: str = None) -> dict:
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": API_KEY,
        "language": "fr",
        "region": "fr",
    }
    if page_token:
        params["pagetoken"] = page_token

    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def collect_all_places(city: str, query_template: str) -> list:
    query = query_template.format(city=city)
    all_results = []

    data = search_places(query)
    all_results.extend(data.get("results", []))

    # Pagination (max 3 pages = 60 results)
    while "next_page_token" in data and len(all_results) < 60:
        time.sleep(2)  # Required delay for next_page_token
        data = search_places(query, page_token=data["next_page_token"])
        all_results.extend(data.get("results", []))

    return all_results


def get_place_details(place_id: str) -> dict:
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,website,business_status",
        "key": API_KEY,
        "language": "fr",
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("result", {})


# ─── Email scraping ──────────────────────────────────────────────────────────────


def extract_emails_from_url(url: str, timeout: int = 8) -> set:
    emails = set()
    try:
        resp = requests.get(
            url, headers=HEADERS, timeout=timeout, allow_redirects=True
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
                time.sleep(0.3)
                resp2 = requests.get(
                    contact_url, headers=HEADERS, timeout=timeout, allow_redirects=True
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


# ─── Restaurant type detection ───────────────────────────────────────────────────


def detect_type(name: str) -> str:
    name_lower = name.lower()
    if any(kw in name_lower for kw in ["kebab", "doner", "durum", "berliner", "istanbul"]):
        return "kebab"
    if any(kw in name_lower for kw in ["pizza", "pizzeria", "napoli"]):
        return "pizzeria"
    if any(kw in name_lower for kw in ["tacos", "taco "]):
        return "tacos"
    if "snack" in name_lower:
        return "snack"
    if "burger" in name_lower:
        return "burger"
    if any(kw in name_lower for kw in ["fast", "rapide", "express"]):
        return "fast-food"
    return "restaurant"


# ─── Main ────────────────────────────────────────────────────────────────────────


def main():
    if not API_KEY:
        print("ERROR: Set GOOGLE_PLACES_API_KEY environment variable")
        print("  export GOOGLE_PLACES_API_KEY='your_key_here'")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    places_path = os.path.join(OUTPUT_DIR, "restaurants_places.json")
    details_path = os.path.join(OUTPUT_DIR, "restaurants_details.json")
    emails_path = os.path.join(OUTPUT_DIR, "restaurants_emails.json")
    csv_all_path = os.path.join(OUTPUT_DIR, "restaurants_all.csv")
    csv_emails_path = os.path.join(OUTPUT_DIR, "restaurants_with_emails.csv")

    # ─── PHASE 1: Collect place_ids ──────────────────────────────────────────

    existing_places = load_json(places_path)
    if existing_places:
        all_places = {p["place_id"]: p for p in existing_places}
        print(f"[RESUME] Loaded {len(all_places)} places from previous run")

        # Check which city+query combos are already done
        done_combos = set()
        for p in existing_places:
            if "search_query" in p:
                done_combos.add(p["search_query"])
    else:
        all_places = {}
        done_combos = set()

    print("=" * 60)
    print("PHASE 1 : Recherche de restaurants via Google Places")
    print(f"  {len(CITIES)} villes x {len(QUERIES)} types = {len(CITIES) * len(QUERIES)} recherches")
    print("=" * 60)

    search_count = 0
    for city in CITIES:
        for query_template in QUERIES:
            query = query_template.format(city=city)
            combo_key = f"{city}|{query_template}"

            if combo_key in done_combos:
                continue

            print(f"  {query}...", end=" ", flush=True)
            search_count += 1

            try:
                results = collect_all_places(city, query_template)
                new_count = 0
                for place in results:
                    pid = place.get("place_id")
                    if pid and pid not in all_places and not is_chain(place.get("name", "")):
                        all_places[pid] = {
                            "place_id": pid,
                            "name": place.get("name", ""),
                            "address": place.get("formatted_address", ""),
                            "city": city,
                            "rating": place.get("rating"),
                            "user_ratings_total": place.get("user_ratings_total"),
                            "types": place.get("types", []),
                            "search_query": combo_key,
                        }
                        new_count += 1
                print(f"+{new_count} (total: {len(all_places)})")
            except Exception as e:
                print(f"ERROR: {e}")

            time.sleep(0.5)

        # Save after each city
        save_json(list(all_places.values()), places_path)

    print(f"\nTotal restaurants uniques : {len(all_places)}")
    print(f"Recherches API effectuees : {search_count}")

    # ─── PHASE 2: Get details (website + phone) ─────────────────────────────

    # Load previously fetched details
    existing_details = load_json(details_path)
    details_done = {p["place_id"] for p in existing_details if p.get("details_fetched")}

    places_list = list(all_places.values())

    # Merge existing details
    details_map = {p["place_id"]: p for p in existing_details}
    for place in places_list:
        if place["place_id"] in details_map:
            saved = details_map[place["place_id"]]
            place["phone"] = saved.get("phone", "")
            place["website"] = saved.get("website", "")
            place["business_status"] = saved.get("business_status", "")
            place["details_fetched"] = saved.get("details_fetched", False)

    to_fetch = [p for p in places_list if not p.get("details_fetched")]

    print(f"\n{'=' * 60}")
    print(f"PHASE 2 : Details (site web, telephone)")
    print(f"  Deja fait : {len(details_done)}, Reste : {len(to_fetch)}")
    print("=" * 60)

    for i, place in enumerate(to_fetch):
        print(f"  [{i+1}/{len(to_fetch)}] {place['name'][:40]}...", end=" ", flush=True)

        try:
            details = get_place_details(place["place_id"])
            place["phone"] = details.get("formatted_phone_number", "")
            place["website"] = details.get("website", "")
            place["business_status"] = details.get("business_status", "")
            place["details_fetched"] = True

            if place["website"]:
                print(f"OK {place['website'][:50]}")
            else:
                print("pas de site")
        except Exception as e:
            print(f"ERROR: {e}")
            place["details_fetched"] = True  # Skip on next run

        time.sleep(0.1)

        if (i + 1) % 50 == 0:
            save_json(places_list, details_path)
            print(f"  [save {i+1}]")

    save_json(places_list, details_path)

    with_website = [p for p in places_list if p.get("website")]
    print(f"\nAvec site web : {len(with_website)}/{len(places_list)}")

    # ─── PHASE 3: Scrape emails ──────────────────────────────────────────────

    existing_emails = load_json(emails_path)
    emails_done = {p["place_id"] for p in existing_emails if p.get("emails_scraped")}

    # Merge
    emails_map = {p["place_id"]: p for p in existing_emails}
    for place in places_list:
        if place["place_id"] in emails_map:
            saved = emails_map[place["place_id"]]
            place["emails"] = saved.get("emails", [])
            place["emails_scraped"] = saved.get("emails_scraped", False)

    to_scrape = [p for p in with_website if not p.get("emails_scraped")]

    print(f"\n{'=' * 60}")
    print(f"PHASE 3 : Extraction emails depuis les sites web (10 threads)")
    print(f"  Deja fait : {len(emails_done)}, Reste : {len(to_scrape)}")
    print("=" * 60)

    scrape_lock = threading.Lock()
    scrape_count = [0]
    email_count = [0]

    def scrape_one(place):
        try:
            emails = extract_emails_from_url(place["website"])
            place["emails"] = list(emails)
            place["emails_scraped"] = True
            with scrape_lock:
                scrape_count[0] += 1
                if emails:
                    email_count[0] += 1
                    print(f"  [{scrape_count[0]}/{len(to_scrape)}] {place['name'][:40]}... OK {'; '.join(emails)}")
                else:
                    if scrape_count[0] % 20 == 0:
                        print(f"  [{scrape_count[0]}/{len(to_scrape)}] ... {email_count[0]} emails trouves")
            return place
        except Exception as e:
            place["emails_scraped"] = True
            with scrape_lock:
                scrape_count[0] += 1
            return place

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(scrape_one, p): p for p in to_scrape}
        done_batch = 0
        for future in as_completed(futures):
            future.result()
            done_batch += 1
            if done_batch % 100 == 0:
                save_json(places_list, emails_path)
                print(f"  [save {done_batch}]")

    save_json(places_list, emails_path)

    # ─── PHASE 4: Export CSV ─────────────────────────────────────────────────

    print(f"\n{'=' * 60}")
    print("PHASE 4 : Export CSV")
    print("=" * 60)

    # All restaurants
    with open(csv_all_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "name", "address", "city", "phone", "website", "email",
            "rating", "reviews_count", "type", "business_status",
        ])
        for p in places_list:
            if p.get("business_status") == "CLOSED_PERMANENTLY":
                continue
            email_str = "; ".join(p.get("emails", []))
            writer.writerow([
                p["name"], p["address"], p["city"], p.get("phone", ""),
                p.get("website", ""), email_str,
                p.get("rating", ""), p.get("user_ratings_total", ""),
                detect_type(p["name"]), p.get("business_status", ""),
            ])

    # With emails only (for campaign)
    with_emails = [p for p in places_list if p.get("emails") and p.get("business_status") != "CLOSED_PERMANENTLY"]
    with open(csv_emails_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "name", "city", "email", "phone", "website", "rating", "reviews_count", "type",
        ])
        for p in with_emails:
            for email in p["emails"]:
                writer.writerow([
                    p["name"], p["city"], email, p.get("phone", ""),
                    p.get("website", ""), p.get("rating", ""),
                    p.get("user_ratings_total", ""), detect_type(p["name"]),
                ])

    # Unique emails
    unique_emails = set()
    for p in with_emails:
        unique_emails.update(p.get("emails", []))

    # Stats
    print(f"\n{'=' * 60}")
    print("RESULTATS")
    print(f"{'=' * 60}")
    print(f"Total restaurants  : {len(places_list)}")
    print(f"Avec site web      : {len(with_website)}")
    print(f"Avec email         : {len(with_emails)}")
    print(f"Emails uniques     : {len(unique_emails)}")
    print()
    print(f"Fichiers :")
    print(f"  {csv_all_path}")
    print(f"  {csv_emails_path}")
    print(f"  {emails_path}")

    # Per-city stats
    print(f"\nPar ville :")
    city_stats = defaultdict(lambda: {"total": 0, "email": 0})
    for p in places_list:
        city_stats[p["city"]]["total"] += 1
        if p.get("emails"):
            city_stats[p["city"]]["email"] += 1
    for city, stats in sorted(city_stats.items(), key=lambda x: -x[1]["total"]):
        pct = round(stats["email"] / stats["total"] * 100) if stats["total"] > 0 else 0
        print(f"  {city:20s} : {stats['total']:4d} restos, {stats['email']:3d} emails ({pct}%)")

    # Per-type stats
    print(f"\nPar type :")
    type_stats = defaultdict(lambda: {"total": 0, "email": 0})
    for p in places_list:
        t = detect_type(p["name"])
        type_stats[t]["total"] += 1
        if p.get("emails"):
            type_stats[t]["email"] += 1
    for t, stats in sorted(type_stats.items(), key=lambda x: -x[1]["total"]):
        print(f"  {t:15s} : {stats['total']:4d} restos, {stats['email']:3d} emails")


if __name__ == "__main__":
    main()
