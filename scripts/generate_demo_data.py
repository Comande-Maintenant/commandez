#!/usr/bin/env python3
"""
Generate realistic demo data for the Antalya Kebab demo restaurant.
~900 orders over 30 days + ~30 restaurant_customers.
Run once, not committed. Uses Supabase Management API (bypass RLS).
"""

import json
import random
import uuid
from datetime import datetime, timedelta
import requests

# ── Config ──
SUPABASE_PROJECT = "rbqgsxhkccbhqdmdtxwr"
SUPABASE_TOKEN = "sbp_230be05e89adf1016d7b2fb7120155f5c082ed14"
API_URL = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT}/database/query"
HEADERS = {
    "Authorization": f"Bearer {SUPABASE_TOKEN}",
    "Content-Type": "application/json",
}

RESTAURANT_ID = "81079f24-9e36-4c5b-b874-3eee6aa849d5"

# ── Menu items (from actual DB) ──
MENU_ITEMS = {
    # Sandwichs (main items - most popular)
    "kebab": {"id": "f1a", "name": "Kebab", "price": 6.5, "category": "Sandwichs", "weight": 35},
    "galette": {"id": "f1b", "name": "Galette", "price": 7.0, "category": "Sandwichs", "weight": 12},
    "panini": {"id": "f1c", "name": "Panini", "price": 5.5, "category": "Sandwichs", "weight": 5},
    "sandwich_poulet": {"id": "f1d", "name": "Sandwich Poulet creme", "price": 7.0, "category": "Sandwichs", "weight": 8},
    "sandwich_merguez": {"id": "f1e", "name": "Sandwich Merguez", "price": 7.0, "category": "Sandwichs", "weight": 4},
    "sandwich_kofte": {"id": "f1f", "name": "Sandwich Kofte", "price": 7.0, "category": "Sandwichs", "weight": 3},
    "sandwich_chicken": {"id": "f1g", "name": "Sandwich Chicken", "price": 7.0, "category": "Sandwichs", "weight": 4},
    "sandwich_steak": {"id": "f1h", "name": "Sandwich Steak", "price": 7.0, "category": "Sandwichs", "weight": 3},
    "hamburger": {"id": "f1i", "name": "Hamburger", "price": 5.5, "category": "Sandwichs", "weight": 4},
    "hamburger_double": {"id": "f1j", "name": "Hamburger Double Steak", "price": 8.0, "category": "Sandwichs", "weight": 3},
    "tacos_1": {"id": "f1k", "name": "Tacos 1 viande", "price": 8.0, "category": "Sandwichs", "weight": 8},
    "tacos_2": {"id": "f1l", "name": "Tacos 2 viandes", "price": 10.0, "category": "Sandwichs", "weight": 5},
    "tacos_3": {"id": "f1m", "name": "Tacos 3 viandes", "price": 12.0, "category": "Sandwichs", "weight": 2},
    "galette_geante": {"id": "f1n", "name": "Galette Geante", "price": 10.0, "category": "Sandwichs", "weight": 3},
    # Assiettes
    "petite_assiette": {"id": "f2a", "name": "Petite assiette", "price": 8.0, "category": "ASSIETTES", "weight": 4},
    "assiette_kebab": {"id": "f2b", "name": "Assiette Kebab", "price": 11.0, "category": "ASSIETTES", "weight": 15},
    "assiette_poulet": {"id": "f2c", "name": "Assiette Poulet", "price": 11.5, "category": "ASSIETTES", "weight": 6},
    "assiette_merguez": {"id": "f2d", "name": "Assiette Merguez", "price": 11.5, "category": "ASSIETTES", "weight": 3},
    "assiette_kofte": {"id": "f2e", "name": "Assiette Kofte", "price": 11.5, "category": "ASSIETTES", "weight": 3},
    "assiette_steak": {"id": "f2f", "name": "Assiette Steak", "price": 12.5, "category": "ASSIETTES", "weight": 2},
    "assiette_2viandes": {"id": "f2g", "name": "Assiette 2 viandes", "price": 13.0, "category": "ASSIETTES", "weight": 4},
    "assiette_3viandes": {"id": "f2h", "name": "Assiette 3 viandes", "price": 15.0, "category": "ASSIETTES", "weight": 2},
    # Boissons
    "coca": {"id": "f3a", "name": "Coca Cola, Orangina, Oasis... - 33 cl.", "price": 1.5, "category": "BOISSONS", "weight": 30},
    "eau": {"id": "f3b", "name": "Eau", "price": 1.0, "category": "BOISSONS", "weight": 10},
    "ayran": {"id": "f3c", "name": "Ayran", "price": 1.5, "category": "BOISSONS", "weight": 8},
    "redbull": {"id": "f3d", "name": "Redbull", "price": 3.0, "category": "BOISSONS", "weight": 4},
    "biere": {"id": "f3e", "name": "Heineken, 1664", "price": 3.0, "category": "BOISSONS", "weight": 5},
    "bouteille_coca": {"id": "f3f", "name": "Bouteille Coca Cola / Fanta", "price": 4.0, "category": "BOISSONS", "weight": 3},
    "cafe": {"id": "f3g", "name": "Cafe", "price": 1.5, "category": "BOISSONS", "weight": 5},
    # Desserts
    "chocolat": {"id": "f4a", "name": "Barre de chocolat au choix", "price": 1.5, "category": "DESSERTS", "weight": 8},
    "glace": {"id": "f4b", "name": "GLACES (en saison)", "price": 2.5, "category": "DESSERTS", "weight": 5},
    # Divers
    "frites": {"id": "f5a", "name": "Barquette Frites", "price": 5.0, "category": "DIVERS", "weight": 6},
    "nuggets": {"id": "f5b", "name": "6 Nuggets + frites", "price": 7.0, "category": "DIVERS", "weight": 4},
    "salade": {"id": "f5c", "name": "Salade", "price": 7.0, "category": "DIVERS", "weight": 2},
}

# Separate items by type for order generation
MAIN_ITEMS = {k: v for k, v in MENU_ITEMS.items() if v["category"] in ("Sandwichs", "ASSIETTES", "DIVERS")}
DRINK_ITEMS = {k: v for k, v in MENU_ITEMS.items() if v["category"] == "BOISSONS"}
DESSERT_ITEMS = {k: v for k, v in MENU_ITEMS.items() if v["category"] == "DESSERTS"}

# ── Customer names (realistic French mix) ──
CUSTOMERS = [
    ("Lucas Martin", "06 12 34 56 78"),
    ("Sophie Dubois", "06 23 45 67 89"),
    ("Mohammed Ben Ali", "06 34 56 78 90"),
    ("Julie Lefevre", "06 45 67 89 01"),
    ("Thomas Bernard", "06 56 78 90 12"),
    ("Camille Moreau", "06 67 89 01 23"),
    ("Mehdi Kaddouri", "06 78 90 12 34"),
    ("Marie Laurent", "06 89 01 23 45"),
    ("Antoine Petit", "06 90 12 34 56"),
    ("Lea Richard", "07 12 34 56 78"),
    ("Youssef Amrani", "07 23 45 67 89"),
    ("Emma Dupont", "07 34 56 78 90"),
    ("Nicolas Garcia", "07 45 67 89 01"),
    ("Fatima El Idrissi", "07 56 78 90 12"),
    ("Pierre Roux", "07 67 89 01 23"),
    ("Sarah Mercier", "07 78 90 12 34"),
    ("Kevin Durand", "07 89 01 23 45"),
    ("Chloe Bonnet", "06 11 22 33 44"),
    ("Rachid Benali", "06 22 33 44 55"),
    ("Manon Girard", "06 33 44 55 66"),
    ("Hugo Lambert", "06 44 55 66 77"),
    ("Ines Morel", "07 11 22 33 44"),
    ("Maxime Fournier", "07 22 33 44 55"),
    ("Clara Simon", "07 33 44 55 66"),
    ("Dylan Muller", "07 44 55 66 77"),
    ("Nadia Hamidi", "06 55 66 77 88"),
    ("Romain Leroy", "06 66 77 88 99"),
    ("Amina Ouali", "07 55 66 77 88"),
    ("Julien Masson", "07 66 77 88 99"),
    ("Pauline Andre", "06 77 88 99 00"),
]

# Loyal customers (index into CUSTOMERS) - they order frequently
LOYAL_INDICES = [0, 2, 6, 9, 14, 18]

# ── Volume patterns ──
# day_of_week: (min_orders, max_orders, midi_ratio)
DAY_PATTERNS = {
    0: (30, 40, 0.70),   # Monday
    1: (20, 25, 0.50),   # Tuesday
    2: (20, 25, 0.50),   # Wednesday
    3: (25, 30, 0.45),   # Thursday
    4: (40, 50, 0.30),   # Friday
    5: (35, 45, 0.20),   # Saturday
    6: (0, 0, 0),        # Sunday - closed
}


def weighted_choice(items_dict):
    """Pick a random item weighted by its weight field."""
    keys = list(items_dict.keys())
    weights = [items_dict[k]["weight"] for k in keys]
    return items_dict[random.choices(keys, weights=weights, k=1)[0]]


def random_time_in_slot(slot_start_h, slot_start_m, slot_end_h, slot_end_m, peak_start_h, peak_start_m, peak_end_h, peak_end_m):
    """Generate a random time within a slot, biased toward peak hours."""
    # 60% chance of being in peak hours
    if random.random() < 0.60:
        start_min = peak_start_h * 60 + peak_start_m
        end_min = peak_end_h * 60 + peak_end_m
    else:
        start_min = slot_start_h * 60 + slot_start_m
        end_min = slot_end_h * 60 + slot_end_m

    minutes = random.randint(start_min, end_min - 1)
    h, m = divmod(minutes, 60)
    s = random.randint(0, 59)
    return h, m, s


def generate_order_items():
    """Generate realistic order items."""
    items = []

    # 1-4 main items (avg ~2.2)
    num_mains = random.choices([1, 2, 3, 4], weights=[30, 45, 18, 7], k=1)[0]
    for _ in range(num_mains):
        item = weighted_choice(MAIN_ITEMS)
        qty = 1
        # Sometimes order 2 of same item (10% chance)
        if random.random() < 0.10:
            qty = 2
        items.append({
            "name": item["name"],
            "quantity": qty,
            "price": item["price"],
            "sauces": [],
            "supplements": [],
        })

    # 60% chance of a drink
    if random.random() < 0.60:
        drink = weighted_choice(DRINK_ITEMS)
        items.append({
            "name": drink["name"],
            "quantity": 1,
            "price": drink["price"],
            "sauces": [],
            "supplements": [],
        })

    # 15% chance of a dessert
    if random.random() < 0.15:
        dessert = weighted_choice(DESSERT_ITEMS)
        items.append({
            "name": dessert["name"],
            "quantity": 1,
            "price": dessert["price"],
            "sauces": [],
            "supplements": [],
        })

    return items


def calc_total(items):
    return sum(i["price"] * i["quantity"] for i in items)


def pick_customer(is_loyal_slot):
    """Pick a customer. Loyal customers get 20% of orders."""
    if is_loyal_slot:
        idx = random.choice(LOYAL_INDICES)
    else:
        idx = random.randint(0, len(CUSTOMERS) - 1)
    return CUSTOMERS[idx]


def run_query(sql):
    """Execute SQL via Supabase Management API."""
    resp = requests.post(API_URL, headers=HEADERS, json={"query": sql})
    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text[:500]}")
        return None
    return resp.json()


def main():
    now = datetime.now()
    today = now.date()

    # Generate orders for last 30 days
    all_orders = []
    order_number = 1

    for day_offset in range(30, -1, -1):  # 30 days ago to today
        current_date = today - timedelta(days=day_offset)
        dow = current_date.weekday()  # 0=Monday, 6=Sunday

        pattern = DAY_PATTERNS.get(dow)
        if not pattern or pattern[0] == 0:
            continue  # Sunday - closed

        min_orders, max_orders, midi_ratio = pattern
        total_orders = random.randint(min_orders, max_orders)
        midi_count = int(total_orders * midi_ratio)
        soir_count = total_orders - midi_count

        is_today = (day_offset == 0)

        # Close time for evening varies by day
        soir_end_h = 23 if dow in (4, 5) else 22  # Fri/Sat: 23h, else 22h

        daily_number = 0

        for i in range(total_orders):
            daily_number += 1
            is_midi = i < midi_count

            if is_midi:
                h, m, s = random_time_in_slot(11, 0, 14, 0, 12, 0, 13, 0)
            else:
                h, m, s = random_time_in_slot(18, 0, soir_end_h, 0, 19, 30, 20, 30)

            order_time = datetime(current_date.year, current_date.month, current_date.day, h, m, s)

            # Pick customer (20% loyal)
            is_loyal = random.random() < 0.20
            cust_name, cust_phone = pick_customer(is_loyal)

            # Generate items
            items = generate_order_items()
            total = round(calc_total(items), 2)
            subtotal = total

            # Payment method
            payment_method = "card" if random.random() < 0.65 else "cash"

            # Order type
            r = random.random()
            if r < 0.60:
                order_type = "collect"
            elif r < 0.85:
                order_type = "sur_place"
            elif r < 0.95:
                order_type = "a_emporter"
            else:
                order_type = "telephone"

            # Source
            source = None if random.random() < 0.70 else "pos"

            # Status
            if is_today and i >= total_orders - 6:
                # Last few orders today get mixed statuses
                remaining = total_orders - i
                if remaining <= 2:
                    status = "new"
                elif remaining <= 4:
                    status = "preparing"
                elif remaining <= 5:
                    status = "ready"
                else:
                    status = "done"
            else:
                status = "done"

            # Timestamps
            created_at = order_time.isoformat()
            accepted_at = None
            ready_at = None
            completed_at = None

            if status in ("preparing", "ready", "done"):
                accepted_at = (order_time + timedelta(minutes=random.randint(1, 3))).isoformat()
            if status in ("ready", "done"):
                ready_at = (order_time + timedelta(minutes=random.randint(10, 25))).isoformat()
            if status == "done":
                completed_at = (order_time + timedelta(minutes=random.randint(12, 35))).isoformat()

            order_id = str(uuid.uuid4())

            all_orders.append({
                "id": order_id,
                "restaurant_id": RESTAURANT_ID,
                "order_number": order_number,
                "daily_number": daily_number,
                "customer_name": cust_name,
                "customer_phone": cust_phone,
                "customer_email": "",
                "order_type": order_type,
                "payment_method": payment_method,
                "source": source,
                "status": status,
                "items": items,
                "subtotal": subtotal,
                "total": total,
                "notes": "",
                "created_at": created_at,
                "accepted_at": accepted_at,
                "ready_at": ready_at,
                "completed_at": completed_at,
            })

            order_number += 1

    print(f"Generated {len(all_orders)} orders")

    # Calculate stats
    total_ca = sum(o["total"] for o in all_orders)
    avg_ticket = total_ca / len(all_orders)
    print(f"Total CA: {total_ca:.2f} EUR")
    print(f"Average ticket: {avg_ticket:.2f} EUR")
    print(f"Daily avg: {total_ca / 30:.2f} EUR")

    # ── Insert orders in batches ──
    print("\nInserting orders...")
    batch_size = 50
    for batch_start in range(0, len(all_orders), batch_size):
        batch = all_orders[batch_start:batch_start + batch_size]

        values_parts = []
        for o in batch:
            items_json = json.dumps(o["items"]).replace("'", "''")
            source_val = f"'{o['source']}'" if o["source"] else "NULL"
            accepted_val = f"'{o['accepted_at']}'" if o["accepted_at"] else "NULL"
            ready_val = f"'{o['ready_at']}'" if o["ready_at"] else "NULL"
            completed_val = f"'{o['completed_at']}'" if o["completed_at"] else "NULL"

            values_parts.append(
                f"('{o['id']}', '{o['restaurant_id']}', {o['order_number']}, {o['daily_number']}, "
                f"'{o['customer_name']}', '{o['customer_phone']}', '{o['customer_email']}', "
                f"'{o['order_type']}', '{o['payment_method']}', {source_val}, "
                f"'{o['status']}', '{items_json}'::jsonb, {o['subtotal']}, {o['total']}, "
                f"'{o['notes']}', '{o['created_at']}', "
                f"{accepted_val}, {ready_val}, {completed_val})"
            )

        sql = f"""INSERT INTO orders (
            id, restaurant_id, order_number, daily_number,
            customer_name, customer_phone, customer_email,
            order_type, payment_method, source,
            status, items, subtotal, total,
            notes, created_at,
            accepted_at, ready_at, completed_at
        ) VALUES {', '.join(values_parts)}
        ON CONFLICT (id) DO NOTHING;"""

        result = run_query(sql)
        if result is None:
            print(f"  FAILED batch {batch_start}-{batch_start + len(batch)}")
        else:
            print(f"  Inserted batch {batch_start}-{batch_start + len(batch)}")

    # ── Generate restaurant_customers from order data ──
    print("\nGenerating customers...")
    customer_stats = {}
    for o in all_orders:
        key = o["customer_phone"]
        if key not in customer_stats:
            customer_stats[key] = {
                "name": o["customer_name"],
                "phone": o["customer_phone"],
                "email": "",
                "total_orders": 0,
                "total_spent": 0.0,
                "first_order_at": o["created_at"],
                "last_order_at": o["created_at"],
                "items": {},
            }
        cs = customer_stats[key]
        cs["total_orders"] += 1
        cs["total_spent"] += o["total"]
        cs["last_order_at"] = o["created_at"]
        for item in o["items"]:
            item_name = item["name"]
            cs["items"][item_name] = cs["items"].get(item_name, 0) + item["quantity"]

    print(f"  {len(customer_stats)} unique customers")

    # Insert customers
    for phone, cs in customer_stats.items():
        # Top 3 favorite items
        sorted_items = sorted(cs["items"].items(), key=lambda x: x[1], reverse=True)
        favorites = [name for name, _ in sorted_items[:3]]
        last_items_list = [name for name, _ in sorted_items[:5]]
        avg_basket = round(cs["total_spent"] / cs["total_orders"], 2)

        favorites_json = json.dumps(favorites).replace("'", "''")
        last_items_json = json.dumps(last_items_list).replace("'", "''")

        sql = f"""INSERT INTO restaurant_customers (
            restaurant_id, customer_name, customer_phone, customer_email,
            total_orders, total_spent, average_basket,
            favorite_items, last_items,
            first_order_at, last_order_at,
            is_banned, banned_reason, banned_ip, notes
        ) VALUES (
            '{RESTAURANT_ID}', '{cs["name"]}', '{cs["phone"]}', '',
            {cs["total_orders"]}, {round(cs["total_spent"], 2)}, {avg_basket},
            '{favorites_json}'::jsonb, '{last_items_json}'::jsonb,
            '{cs["first_order_at"]}', '{cs["last_order_at"]}',
            false, '', '', ''
        ) ON CONFLICT (restaurant_id, customer_phone) DO UPDATE SET
            total_orders = EXCLUDED.total_orders,
            total_spent = EXCLUDED.total_spent,
            average_basket = EXCLUDED.average_basket,
            favorite_items = EXCLUDED.favorite_items,
            last_items = EXCLUDED.last_items,
            last_order_at = EXCLUDED.last_order_at;"""

        run_query(sql)

    print(f"\nDone! {len(all_orders)} orders + {len(customer_stats)} customers inserted.")
    print(f"CA total: {total_ca:.2f} EUR | Ticket moyen: {avg_ticket:.2f} EUR")


if __name__ == "__main__":
    main()
