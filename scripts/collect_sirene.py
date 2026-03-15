#!/usr/bin/env python3
"""
collect_sirene.py - Collect active restaurants from SIRENE (INSEE) database
and maintain a master leads.json for commandeici prospection.

Usage:
    python3 scripts/collect_sirene.py --all                    # All active restaurants
    python3 scripts/collect_sirene.py --since 2026-03-01       # New creations since date
    python3 scripts/collect_sirene.py --department 75           # Filter by department
    python3 scripts/collect_sirene.py --since 2026-03-01 --department 75
    python3 scripts/collect_sirene.py --export                  # Generate export CSVs
    python3 scripts/collect_sirene.py --dry-run --all           # Show counts only
    python3 scripts/collect_sirene.py --refresh --all           # Force re-query even if CSV exists

Run from repo root: python3 scripts/collect_sirene.py --all
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta
from collections import Counter

# Paths (relative to repo root)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROSPECTION_DIR = os.path.join(REPO_ROOT, "prospection")
SIRENE_CSV = os.path.join(PROSPECTION_DIR, "sirene_restaurants.csv")
LEADS_JSON = os.path.join(PROSPECTION_DIR, "leads.json")
EXISTING_CSV = os.path.join(PROSPECTION_DIR, "restaurants_with_emails.csv")
SENT_LOG = os.path.join(PROSPECTION_DIR, "sent_log.json")

PARQUET_URL = "https://object.files.data.gouv.fr/data-pipeline-open/siren/stock/StockEtablissement_utf8.parquet"

NAF_CODES = ("56.10A", "56.10B", "56.10C")
NAF_LABELS = {
    "56.10A": "Restauration traditionnelle",
    "56.10B": "Cafeterias et autres libres-services",
    "56.10C": "Restauration rapide",
}

# Max age in hours before re-querying SIRENE
CACHE_MAX_AGE_HOURS = 24

SIRENE_COLUMNS = [
    "siret",
    "siren",
    "denominationUsuelleEtablissement",
    "enseigne1Etablissement",
    "enseigne2Etablissement",
    "enseigne3Etablissement",
    "activitePrincipaleEtablissement",
    "dateCreationEtablissement",
    "etatAdministratifEtablissement",
    "codePostalEtablissement",
    "libelleCommuneEtablissement",
    "codeCommuneEtablissement",
    "numeroVoieEtablissement",
    "typeVoieEtablissement",
    "libelleVoieEtablissement",
    "complementAdresseEtablissement",
    "trancheEffectifsEtablissement",
    "etablissementSiege",
]


def log(msg):
    print(f"[SIRENE] {msg}")


def sirene_csv_is_fresh():
    """Check if sirene_restaurants.csv exists and is recent enough."""
    if not os.path.exists(SIRENE_CSV):
        return False
    mtime = os.path.getmtime(SIRENE_CSV)
    age_hours = (datetime.now().timestamp() - mtime) / 3600
    return age_hours < CACHE_MAX_AGE_HOURS


def query_sirene(since=None, department=None):
    """Query SIRENE parquet via DuckDB and return list of dicts."""
    import duckdb

    log("Connecting to SIRENE database (remote parquet)...")
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")

    # Build WHERE clause
    naf_list = ", ".join(f"'{c}'" for c in NAF_CODES)
    where = f"""
        activitePrincipaleEtablissement IN ({naf_list})
        AND etatAdministratifEtablissement = 'A'
    """
    if since:
        where += f"\n        AND dateCreationEtablissement >= '{since}'"
    if department:
        # Department = first 2 digits of codePostal (or 3 for DOM-TOM)
        if len(department) == 2:
            where += f"\n        AND codePostalEtablissement LIKE '{department}%'"
        elif len(department) == 3:
            where += f"\n        AND codePostalEtablissement LIKE '{department}%'"

    cols = ", ".join(SIRENE_COLUMNS)
    query = f"""
        SELECT {cols}
        FROM '{PARQUET_URL}'
        WHERE {where}
        ORDER BY dateCreationEtablissement DESC
    """

    log("Executing query (this may take 10-20 seconds)...")
    if since:
        log(f"  Filter: creations since {since}")
    if department:
        log(f"  Filter: department {department}")

    result = con.execute(query)
    columns = [desc[0] for desc in result.description]
    rows = result.fetchall()
    con.close()

    log(f"  Found {len(rows):,} establishments")

    records = []
    for row in rows:
        record = dict(zip(columns, row))
        # Convert date objects to strings
        for key, val in record.items():
            if hasattr(val, "isoformat"):
                record[key] = val.isoformat()
        records.append(record)

    return records


def is_nd(val):
    """Check if a value is Non Diffusible."""
    return not val or val.strip() in ("[ND]", "ND", "")


def build_name(record):
    """Build a display name from SIRENE fields."""
    name = record.get("denominationUsuelleEtablissement") or ""
    if is_nd(name):
        name = record.get("enseigne1Etablissement") or ""
    if is_nd(name):
        name = record.get("enseigne2Etablissement") or ""
    if is_nd(name):
        name = record.get("enseigne3Etablissement") or ""
    if is_nd(name):
        return "Sans nom"
    return name.strip()


def build_address(record):
    """Build a full address string."""
    parts = []
    num = record.get("numeroVoieEtablissement") or ""
    typ = record.get("typeVoieEtablissement") or ""
    voie = record.get("libelleVoieEtablissement") or ""
    if not is_nd(num):
        parts.append(num)
    if not is_nd(typ):
        parts.append(typ)
    if not is_nd(voie):
        parts.append(voie)
    street = " ".join(parts).strip()

    cp = record.get("codePostalEtablissement") or ""
    commune = record.get("libelleCommuneEtablissement") or ""
    if is_nd(cp):
        cp = ""
    if is_nd(commune):
        commune = ""

    if street and cp:
        return f"{street} {cp} {commune}".strip()
    elif cp:
        return f"{cp} {commune}".strip()
    return commune or ""


def normalize_for_dedup(name, city):
    """Normalize name+city for dedup matching."""
    import re
    text = f"{name} {city}".lower().strip()
    text = re.sub(r"[^a-z0-9 ]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def save_sirene_csv(records):
    """Save SIRENE records to CSV."""
    fieldnames = [
        "siret", "siren", "name", "enseigne", "naf", "naf_label",
        "date_creation", "code_postal", "commune", "code_commune",
        "address", "effectifs", "siege",
    ]

    rows = []
    for r in records:
        rows.append({
            "siret": r.get("siret", ""),
            "siren": r.get("siren", ""),
            "name": build_name(r),
            "enseigne": r.get("enseigne1Etablissement", "") or "",
            "naf": r.get("activitePrincipaleEtablissement", ""),
            "naf_label": NAF_LABELS.get(r.get("activitePrincipaleEtablissement", ""), ""),
            "date_creation": r.get("dateCreationEtablissement", ""),
            "code_postal": r.get("codePostalEtablissement", ""),
            "commune": r.get("libelleCommuneEtablissement", ""),
            "code_commune": r.get("codeCommuneEtablissement", ""),
            "address": build_address(r),
            "effectifs": r.get("trancheEffectifsEtablissement", ""),
            "siege": r.get("etablissementSiege", ""),
        })

    with open(SIRENE_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    log(f"Saved {len(rows):,} records to {SIRENE_CSV}")
    return rows


def load_existing_emails():
    """Load existing restaurants_with_emails.csv."""
    if not os.path.exists(EXISTING_CSV):
        return []
    rows = []
    with open(EXISTING_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def load_sent_log():
    """Load sent_log.json."""
    if not os.path.exists(SENT_LOG):
        return {}
    with open(SENT_LOG, "r", encoding="utf-8") as f:
        return json.load(f)


def load_leads():
    """Load existing leads.json or return empty dict."""
    if not os.path.exists(LEADS_JSON):
        return {}
    with open(LEADS_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def save_leads(leads):
    """Save leads.json."""
    with open(LEADS_JSON, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)
    log(f"Saved {len(leads):,} leads to {LEADS_JSON}")


def merge_into_leads(sirene_rows, dry_run=False):
    """
    Merge all data sources into leads.json.
    - existing email leads (restaurants_with_emails.csv)
    - SIRENE data (sirene_restaurants.csv rows)
    - sent_log.json (send status)
    """
    leads = load_leads()
    today = datetime.now().strftime("%Y-%m-%d")

    # --- 1. Merge existing email contacts ---
    email_contacts = load_existing_emails()
    log(f"Merging {len(email_contacts):,} email contacts...")

    email_added = 0
    for contact in email_contacts:
        email = (contact.get("email") or "").strip().lower()
        if not email:
            continue

        if email not in leads:
            leads[email] = {
                "name": contact.get("name", ""),
                "city": contact.get("city", ""),
                "email": email,
                "phone": contact.get("phone", ""),
                "siret": "",
                "address": "",
                "naf": "",
                "source": "google_places",
                "date_added": today,
                "date_creation_sirene": "",
                "status": "new",
                "send_count": 0,
                "last_sent_at": "",
                "website": contact.get("website", ""),
                "rating": contact.get("rating", ""),
                "reviews_count": contact.get("reviews_count", ""),
                "type": contact.get("type", ""),
            }
            email_added += 1
        else:
            # Update fields if currently empty
            existing = leads[email]
            if not existing.get("phone") and contact.get("phone"):
                existing["phone"] = contact["phone"]
            if not existing.get("website") and contact.get("website"):
                existing["website"] = contact["website"]
            if not existing.get("rating") and contact.get("rating"):
                existing["rating"] = contact["rating"]

    log(f"  {email_added} new email contacts added")

    # --- 2. Merge SIRENE data ---
    # Build siret index for dedup
    siret_index = {}
    for key, lead in leads.items():
        if lead.get("siret"):
            siret_index[lead["siret"]] = key

    # Build name+city index for fuzzy dedup
    name_city_index = {}
    for key, lead in leads.items():
        norm = normalize_for_dedup(lead.get("name", ""), lead.get("city", ""))
        if norm and norm != " ":
            name_city_index[norm] = key

    sirene_new = 0
    sirene_enriched = 0
    for row in sirene_rows:
        siret = row.get("siret", "")
        name = row.get("name", "")
        commune = row.get("commune", "")

        # Check siret dedup
        if siret and siret in siret_index:
            # Enrich existing lead with SIRENE data
            existing_key = siret_index[siret]
            lead = leads[existing_key]
            if not lead.get("naf"):
                lead["naf"] = row.get("naf", "")
            if not lead.get("address"):
                lead["address"] = row.get("address", "")
            if not lead.get("date_creation_sirene"):
                lead["date_creation_sirene"] = row.get("date_creation", "")
            sirene_enriched += 1
            continue

        # Check name+city dedup
        norm = normalize_for_dedup(name, commune)
        if norm in name_city_index:
            existing_key = name_city_index[norm]
            lead = leads[existing_key]
            if not lead.get("siret"):
                lead["siret"] = siret
            if not lead.get("naf"):
                lead["naf"] = row.get("naf", "")
            if not lead.get("address"):
                lead["address"] = row.get("address", "")
            if not lead.get("date_creation_sirene"):
                lead["date_creation_sirene"] = row.get("date_creation", "")
            sirene_enriched += 1
            continue

        # New SIRENE lead (no email yet) - key by siret
        key = f"sirene:{siret}"
        if key not in leads:
            leads[key] = {
                "name": name,
                "city": commune,
                "email": "",
                "phone": "",
                "siret": siret,
                "address": row.get("address", ""),
                "naf": row.get("naf", ""),
                "source": "sirene",
                "date_added": today,
                "date_creation_sirene": row.get("date_creation", ""),
                "status": "no_email",
                "send_count": 0,
                "last_sent_at": "",
                "code_postal": row.get("code_postal", ""),
                "code_commune": row.get("code_commune", ""),
            }
            sirene_new += 1
            # Update indexes
            siret_index[siret] = key
            name_city_index[norm] = key

    log(f"  {sirene_new:,} new SIRENE leads (no email)")
    log(f"  {sirene_enriched:,} existing leads enriched with SIRENE data")

    # --- 3. Merge sent_log ---
    sent_log = load_sent_log()
    sent_updated = 0
    for email, entry in sent_log.items():
        email_lower = email.strip().lower()
        if email_lower in leads:
            lead = leads[email_lower]
            lead["status"] = "sent"
            lead["send_count"] = max(lead.get("send_count", 0), 1)
            if entry.get("sent_at"):
                lead["last_sent_at"] = entry["sent_at"]
            sent_updated += 1

    log(f"  {sent_updated} leads updated with send status")

    if not dry_run:
        save_leads(leads)

    return leads


def print_stats(sirene_rows, leads):
    """Print detailed stats."""
    print("\n" + "=" * 60)
    print("SIRENE COLLECTION STATS")
    print("=" * 60)

    # SIRENE stats
    print(f"\nSIRENE restaurants found: {len(sirene_rows):,}")

    if sirene_rows:
        # By NAF
        naf_counts = Counter(r.get("naf", "") for r in sirene_rows)
        print("\nBy NAF code:")
        for code, count in naf_counts.most_common():
            label = NAF_LABELS.get(code, "Unknown")
            print(f"  {code} ({label}): {count:,}")

        # By department (top 20)
        dept_counts = Counter()
        for r in sirene_rows:
            cp = r.get("code_postal", "") or ""
            # Skip non-diffusible or invalid postal codes
            if len(cp) >= 5 and cp[0].isdigit():
                dept = cp[:2] if not cp.startswith("97") else cp[:3]
                dept_counts[dept] += 1
            elif r.get("code_commune", "") and len(r.get("code_commune", "")) >= 2:
                dept_counts[r["code_commune"][:2]] += 1
        print(f"\nTop 20 departments:")
        for dept, count in dept_counts.most_common(20):
            print(f"  {dept}: {count:,}")

        # New creations (last 30 days)
        cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        recent = sum(1 for r in sirene_rows if (r.get("date_creation") or "") >= cutoff)
        print(f"\nCreated in last 30 days: {recent:,}")

    # Leads stats
    if leads:
        print(f"\n{'=' * 60}")
        print("LEADS MASTER FILE STATS")
        print("=" * 60)
        print(f"Total leads: {len(leads):,}")

        source_counts = Counter(l.get("source", "unknown") for l in leads.values())
        print("\nBy source:")
        for src, count in source_counts.most_common():
            print(f"  {src}: {count:,}")

        status_counts = Counter(l.get("status", "unknown") for l in leads.values())
        print("\nBy status:")
        for status, count in status_counts.most_common():
            print(f"  {status}: {count:,}")

        with_email = sum(1 for l in leads.values() if l.get("email"))
        with_phone = sum(1 for l in leads.values() if l.get("phone"))
        with_siret = sum(1 for l in leads.values() if l.get("siret"))
        print(f"\nWith email: {with_email:,}")
        print(f"With phone: {with_phone:,}")
        print(f"With SIRET: {with_siret:,}")

    print("=" * 60)


def export_csvs(leads):
    """Generate export CSV files from leads.json."""
    today = datetime.now()
    cutoff_30d = (today - timedelta(days=30)).strftime("%Y-%m-%d")

    # Export 1: restaurants with email (ready for email prospection)
    email_leads = [l for l in leads.values() if l.get("email") and l.get("status") != "sent"]
    email_path = os.path.join(PROSPECTION_DIR, "restos_avec_email.csv")
    _export_csv(email_path, email_leads, [
        "name", "city", "email", "phone", "siret", "address", "naf", "source", "date_added",
    ])
    log(f"Exported {len(email_leads):,} email leads -> {email_path}")

    # Export 2: restaurants with phone (ready for phone prospection)
    phone_leads = [l for l in leads.values() if l.get("phone")]
    phone_path = os.path.join(PROSPECTION_DIR, "restos_avec_tel.csv")
    _export_csv(phone_path, phone_leads, [
        "name", "city", "phone", "email", "siret", "address", "naf", "source", "date_added",
    ])
    log(f"Exported {len(phone_leads):,} phone leads -> {phone_path}")

    # Export 3: new restaurants (created in last 30 days, priority targets)
    new_leads = [
        l for l in leads.values()
        if (l.get("date_creation_sirene") or "") >= cutoff_30d
    ]
    new_path = os.path.join(PROSPECTION_DIR, "restos_nouveaux.csv")
    _export_csv(new_path, new_leads, [
        "name", "city", "email", "phone", "siret", "address", "naf",
        "date_creation_sirene", "source", "date_added",
    ])
    log(f"Exported {len(new_leads):,} new restaurants (< 30 days) -> {new_path}")

    # Summary
    print(f"\n{'=' * 60}")
    print("EXPORT SUMMARY")
    print("=" * 60)
    print(f"  restos_avec_email.csv : {len(email_leads):,} leads (unsent, with email)")
    print(f"  restos_avec_tel.csv   : {len(phone_leads):,} leads (with phone)")
    print(f"  restos_nouveaux.csv   : {len(new_leads):,} leads (created < 30 days)")
    print("=" * 60)


def _export_csv(path, rows, fieldnames):
    """Write a list of dicts to CSV."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def load_sirene_csv():
    """Load sirene_restaurants.csv if it exists."""
    if not os.path.exists(SIRENE_CSV):
        return []
    rows = []
    with open(SIRENE_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser(description="Collect restaurants from SIRENE database")
    parser.add_argument("--all", action="store_true", help="All active restaurants (NAF 56.10A/B/C)")
    parser.add_argument("--since", type=str, help="Only creations since YYYY-MM-DD")
    parser.add_argument("--department", type=str, help="Filter by department code (e.g. 75, 69, 971)")
    parser.add_argument("--export", action="store_true", help="Generate export CSV files")
    parser.add_argument("--dry-run", action="store_true", help="Show counts without writing files")
    parser.add_argument("--refresh", action="store_true", help="Force re-query even if CSV is recent")
    parser.add_argument("--merge-only", action="store_true", help="Only merge existing data into leads.json")

    args = parser.parse_args()

    # Validate args
    if not any([args.all, args.since, args.export, args.merge_only]):
        parser.print_help()
        print("\nError: specify --all, --since, --export, or --merge-only")
        sys.exit(1)

    # --- Export mode ---
    if args.export:
        leads = load_leads()
        if not leads:
            log("No leads.json found. Run --all or --merge-only first.")
            sys.exit(1)
        export_csvs(leads)
        return

    # --- Merge-only mode ---
    if args.merge_only:
        sirene_rows = load_sirene_csv()
        log(f"Loaded {len(sirene_rows):,} SIRENE records from cache")
        leads = merge_into_leads(sirene_rows, dry_run=args.dry_run)
        print_stats(sirene_rows, leads)
        return

    # --- Collection mode ---
    use_cache = sirene_csv_is_fresh() and not args.refresh and not args.since and not args.department
    if use_cache:
        log(f"Using cached SIRENE data (< {CACHE_MAX_AGE_HOURS}h old). Use --refresh to re-query.")
        sirene_rows = load_sirene_csv()
        log(f"Loaded {len(sirene_rows):,} records from cache")
    else:
        records = query_sirene(since=args.since, department=args.department)
        if args.dry_run:
            log("DRY RUN - not writing files")
            sirene_rows = []
            for r in records:
                sirene_rows.append({
                    "siret": r.get("siret", ""),
                    "name": build_name(r),
                    "naf": r.get("activitePrincipaleEtablissement", ""),
                    "date_creation": r.get("dateCreationEtablissement", ""),
                    "code_postal": r.get("codePostalEtablissement", ""),
                    "commune": r.get("libelleCommuneEtablissement", ""),
                    "address": build_address(r),
                })
            print_stats(sirene_rows, {})
            return
        sirene_rows = save_sirene_csv(records)

    # Merge into leads.json
    leads = merge_into_leads(sirene_rows, dry_run=args.dry_run)

    # Print stats
    print_stats(sirene_rows, leads)


if __name__ == "__main__":
    main()
