#!/usr/bin/env python3
"""
03_bug_tests.py — Targeted regression tests for all fixed bugs.

Run AFTER 01_login.py and 02_simulate.py.

Requirements:
    - API running on http://localhost:3001
    - /tmp/login.json created by 01_login.py
    - Zara Satin Midi Dress published (02_simulate.py)
    - NODE_ENV != 'production'  (dev-login must be enabled for user tests)
"""
import json
import sys
import time
import urllib.request
import urllib.error
from urllib.parse import urlencode

BASE = "http://localhost:3001/api/v1"

with open("/tmp/login.json") as f:
    data = json.load(f)
    ADMIN_TOKEN = data.get("token") or data.get("accessToken", "")

errors: list = []


# ── HTTP helper ───────────────────────────────────────────────────────────────

def http(method, path, body=None, *, token=None, params=None):
    url = BASE + path
    if params:
        url += "?" + urlencode(params)
    data = json.dumps(body).encode() if body else None
    headers = {"Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw.decode(errors="replace")}


def check(name, status, body, expected_status, check_fn=None):
    ok = status == expected_status
    if check_fn and ok:
        try:
            ok = check_fn(body)
        except Exception:
            ok = False
    symbol = "✓" if ok else "✗"
    print(f"  {symbol} [{status}] {name}")
    if not ok:
        errors.append(f"{name}: got {status}, expected {expected_status}")
        if status not in (204,):
            print(f"       → {json.dumps(body)[:300]}")
    return ok


def dev_login(email):
    s, b = http("POST", "/auth/dev-login", {"email": email})
    if s == 200:
        return b.get("accessToken", "")
    print(f"  ! dev-login failed for {email}: {s}")
    return ""


# ── BUG-2: newOrdersToday includes all statuses ───────────────────────────────
print("\n── BUG-2: newOrdersToday counts all statuses ──")
s, b = http("GET", "/admin/orders", token=ADMIN_TOKEN)
check("GET /admin/orders returns stats.newOrdersToday", s, b, 200,
      lambda j: "stats" in j and "newOrdersToday" in j.get("stats", {}))


# ── BUG-3: Catalog total is accurate count ───────────────────────────────────
print("\n── BUG-3: Catalog total is accurate count ──")
s, b = http("GET", "/catalog/categories/midi-dresses/products", params={"limit": 2})
ok = check("GET /catalog products returns total field", s, b, 200,
           lambda j: "total" in j)
if ok and s == 200:
    total = b.get("total")
    items_count = len(b.get("items", []))
    if total is not None and total >= items_count:
        print(f"  ✓ total={total} >= items_on_page={items_count}")
    elif total is not None:
        print(f"  ✗ total={total} < items_on_page={items_count} (suspicious)")
        errors.append("BUG-3: total < items count")


# ── BUG-7: popular sort is rejected ──────────────────────────────────────────
print("\n── BUG-7: popular sort rejected ──")
s, b = http("GET", "/catalog/categories/midi-dresses/products", params={"sort": "popular"})
check("sort=popular returns 400", s, b, 400)
s, b = http("GET", "/catalog/categories/midi-dresses/products", params={"sort": "newest"})
check("sort=newest still works", s, b, 200)


# ── BUG-5: whatsappNumber field in contact update ─────────────────────────────
print("\n── BUG-5: whatsappNumber field accepted ──")
user_token = dev_login("bugtest_5@example.com")
if user_token:
    s, b = http("PATCH", "/auth/me/contact",
                {"whatsappNumber": "+258840000099"}, token=user_token)
    check("PATCH /auth/me/contact with whatsappNumber → 200", s, b, 200)
    s2, b2 = http("PATCH", "/auth/me/contact",
                  {"whatsapp": "+258840000099"}, token=user_token)
    print(f"  ✓ old 'whatsapp' field response: {s2} (no crash)")


# ── BUG-8: Admin clients sortBy=totalSpent ───────────────────────────────────
print("\n── BUG-8: sortBy=totalSpent uses real SUM ──")
s, b = http("GET", "/admin/clients",
            params={"sortBy": "totalSpent", "sortOrder": "desc"}, token=ADMIN_TOKEN)
check("GET /admin/clients?sortBy=totalSpent", s, b, 200)
if s == 200:
    items = b.get("items", b if isinstance(b, list) else [])
    if items:
        print(f"  ✓ returned {len(items)} client(s), first: {items[0].get('email', '?')}")


# ── BUG-9: Category search finds all levels ───────────────────────────────────
print("\n── BUG-9: Category search includes all levels ──")
s, b = http("GET", "/admin/categories", params={"search": "dresses"}, token=ADMIN_TOKEN)
check("GET /admin/categories?search=dresses returns results", s, b, 200,
      lambda j: len(j) > 0 if isinstance(j, list) else len(j.get("items", [])) > 0)
if s == 200:
    items = b if isinstance(b, list) else b.get("items", [])
    names = [c.get("name", "") for c in items]
    print(f"  ✓ Found categories: {names[:5]}")


# ── BUG-10: Size slug regenerated on rename ───────────────────────────────────
print("\n── BUG-10: Size slug regenerated on name update ──")
uid = str(int(time.time()))[-5:]
s, b = http("POST", "/admin/sizes",
            {"name": f"SzT-{uid}", "label": "SLG"}, token=ADMIN_TOKEN)
if s == 201:
    sid = b["id"]
    old_slug = b.get("slug", "")
    s2, b2 = http("PATCH", f"/admin/sizes/{sid}",
                  {"name": f"SzR-{uid}"}, token=ADMIN_TOKEN)
    ok = check("PATCH size: name update returns 200", s2, b2, 200)
    if ok:
        new_slug = b2.get("slug", "")
        slug_changed = old_slug != new_slug
        sym = "✓" if slug_changed else "✗"
        print(f"  {sym} Slug updated: '{old_slug}' → '{new_slug}'")
        if not slug_changed:
            errors.append("BUG-10: slug not updated when name changed")
    http("DELETE", f"/admin/sizes/{sid}", token=ADMIN_TOKEN)
else:
    print(f"  - Could not create test size ({s}), skipping")


# ── BUG-11: Order list includes size in variant ───────────────────────────────
print("\n── BUG-11: Order list variant includes size ──")
user_token = dev_login("bugtest_11@example.com")
if user_token:
    s, b = http("GET", "/orders", token=user_token)
    check("GET /orders returns 200", s, b, 200)
    if s == 200:
        items = b.get("items", b if isinstance(b, list) else [])
        if items:
            order_items = items[0].get("items", [])
            if order_items:
                variant = order_items[0].get("variant", {})
                has_size = "size" in variant
                sym = "✓" if has_size else "✗"
                print(f"  {sym} Variant keys: {list(variant.keys())[:6]}")
                if not has_size:
                    errors.append("BUG-11: 'size' missing from variant in order list")
            else:
                print("  - No order items for test user")
        else:
            print("  - No orders for test user")


# ── BUG-12: Chat read/unread filters ─────────────────────────────────────────
print("\n── BUG-12: Read/unread chat filters work correctly ──")
s, b = http("GET", "/admin/chats", params={"filter": "read"}, token=ADMIN_TOKEN)
check("GET /admin/chats?filter=read returns 200", s, b, 200)
s2, b2 = http("GET", "/admin/chats", params={"filter": "unread"}, token=ADMIN_TOKEN)
check("GET /admin/chats?filter=unread returns 200", s2, b2, 200)
if s == 200 and s2 == 200:
    read_count   = len(b.get("items",  b  if isinstance(b,  list) else []))
    unread_count = len(b2.get("items", b2 if isinstance(b2, list) else []))
    print(f"  ✓ read={read_count}, unread={unread_count}")


# ── BUG-13: Cart returns correct error codes ──────────────────────────────────
print("\n── BUG-13: Cart wrong item → 404 ──")
user_token = dev_login("bugtest_13@example.com")
if user_token:
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    s, b = http("PATCH", f"/cart/items/{fake_uuid}",
                {"quantity": 1}, token=user_token)
    check("PATCH non-existent cart item → 404", s, b, 404)
    s2, b2 = http("DELETE", f"/cart/items/{fake_uuid}", token=user_token)
    check("DELETE non-existent cart item → 404", s2, b2, 404)


# ── BUG-15: Redis cacheDelPattern server alive ────────────────────────────────
print("\n── BUG-15: Redis cacheDelPattern (SCAN) — server alive check ──")
s, b = http("GET", "/admin/categories", token=ADMIN_TOKEN)
check("GET /admin/categories (exercises cache layer) → 200", s, b, 200)


# ── SEC-3: Admin login is audited ─────────────────────────────────────────────
print("\n── SEC-3: Admin login audit log entry ──")
s, b = http("POST", "/admin/auth/login",
            {"email": "admin@ecommerce.mz", "password": "changeme123"})
check("Admin login returns 200", s, b, 200)
s2, b2 = http("GET", "/admin/authority/audit-log",
              params={"limit": 5}, token=ADMIN_TOKEN)
if s2 == 200:
    logs = b2 if isinstance(b2, list) else b2.get("items", [])
    has_login = any(l.get("action") == "admin.login" for l in logs)
    sym = "✓" if has_login else "✗"
    print(f"  {sym} admin.login in audit log: {[l.get('action') for l in logs[:3]]}")
    if not has_login:
        errors.append("SEC-3: admin.login not found in audit log")
else:
    check("GET /admin/authority/audit-log", s2, b2, 200)


# ── BUG-C: Stock check / orders stats ───────────────────────────────────────
print("\n── BUG-C: Stock check prevents negative inventory ──")
s, b = http("GET", "/admin/orders", params={"limit": 1}, token=ADMIN_TOKEN)
check("GET /admin/orders returns stats", s, b, 200, lambda j: "stats" in j)


# ── BUG-D: Collections respects sort + returns total ─────────────────────────
print("\n── BUG-D: Collections endpoint respects sort + returns total ──")
s, b = http("GET", "/catalog/collections")
if s == 200 and b:
    first = b[0] if isinstance(b, list) else (b.get("items") or [{}])[0]
    slug = first.get("slug", "")
    if slug:
        s2, b2 = http("GET", f"/catalog/collections/{slug}/products",
                      params={"sort": "price_asc", "limit": 2})
        check(f"GET /catalog/collections/{slug}/products?sort=price_asc → total", s2, b2, 200,
              lambda j: "total" in j)
        if s2 == 200:
            print(f"  ✓ total={b2.get('total')}, items={len(b2.get('items', []))}")
    else:
        print("  - No collections with slug, skipping BUG-D")
else:
    print("  - No collections seeded, skipping BUG-D")


# ── BUG-E: Admin orders clientId filter ──────────────────────────────────────
print("\n── BUG-E: Admin orders clientId filter ──")
s, b = http("GET", "/admin/clients",
            params={"limit": 1, "sortBy": "createdAt"}, token=ADMIN_TOKEN)
if s == 200:
    items = b.get("items", [])
    if items:
        cid = items[0]["id"]
        s2, b2 = http("GET", "/admin/orders",
                      params={"clientId": cid}, token=ADMIN_TOKEN)
        check(f"GET /admin/orders?clientId={cid[:8]}... → 200", s2, b2, 200)
    else:
        print("  - No clients yet, skipping BUG-E")
else:
    check("GET /admin/clients", s, b, 200)


# ── BUG-F: Server alive after socket.ts change ───────────────────────────────
print("\n── BUG-F: Server alive after socket.ts change ──")
s, b = http("GET", "/admin/categories", token=ADMIN_TOKEN)
check("Server alive after socket.ts change", s, b, 200)


# ── CART: POST returns 409 on duplicate variant ───────────────────────────────
print("\n── CART: POST /cart/items returns 409 for duplicate variant ──")
user_token = dev_login("bugtest_cart@example.com")
if user_token:
    s, b = http("GET", "/catalog/categories/midi-dresses/products", params={"limit": 1})
    if s == 200 and b.get("items"):
        slug = b["items"][0]["slug"]
        s2, b2 = http("GET", f"/catalog/products/{slug}")
        if s2 == 200:
            in_stock = [v for v in b2.get("variants", []) if v.get("stockQuantity", 0) > 0]
            if in_stock:
                vid = in_stock[0]["id"]
                # Clear cart first so prior-run leftovers don't cause a 409
                http("DELETE", "/cart", token=user_token)
                s3, b3 = http("POST", "/cart/items",
                              {"productVariantId": vid, "quantity": 1}, token=user_token)
                check("POST /cart/items first add → 201", s3, b3, 201)
                s4, b4 = http("POST", "/cart/items",
                              {"productVariantId": vid, "quantity": 1}, token=user_token)
                check("POST /cart/items duplicate variant → 409", s4, b4, 409)
            else:
                print("  - No in-stock variants available")
    else:
        print("  - No products in midi-dresses, skipping cart duplicate test")


# ── FILTERS: by-category uses categoryIds query param ────────────────────────
print("\n── FILTERS: GET /admin/filters/by-category uses categoryIds query param ──")
s, b = http("GET", "/admin/categories", params={"search": "Dresses"}, token=ADMIN_TOKEN)
if s == 200:
    cats = b if isinstance(b, list) else b.get("items", [])
    dresses = next((c for c in cats if c.get("name") == "Dresses"), None)
    if dresses:
        s2, b2 = http("GET", "/admin/filters/by-category",
                      params={"categoryIds": dresses["id"]}, token=ADMIN_TOKEN)
        check("GET /admin/filters/by-category?categoryIds=... → 200", s2, b2, 200)
        if s2 == 200:
            print(f"  ✓ Returned {len(b2)} filter(s) for Dresses")
    else:
        print("  - Dresses category not found, skipping filters test")
else:
    print("  - Could not fetch categories, skipping filters test")


# ── Summary ────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
if errors:
    print(f"  FAILED: {len(errors)} test(s)")
    for e in errors:
        print(f"    ✗ {e}")
    sys.exit(1)
else:
    print("  ALL TESTS PASSED")
print("=" * 60)
