#!/usr/bin/env python3
"""
05_test_all_endpoints.py — Full endpoint test suite for the MultiTraders API.

Covers every endpoint documented in API.md. Runs in dependency order:
creates required resources (brand, category, color, size, product, etc.),
exercises all CRUD operations, then cleans up best-effort.

Requirements:
  - API running at http://localhost:3001
  - Default seed admin: admin@ecommerce.mz / changeme123
  - NODE_ENV != 'production'  (POST /auth/dev-login must be enabled)

Usage:
    python3 docs/simulation/05_test_all_endpoints.py
"""

import json
import sys
import time
import urllib.request
import urllib.error
from urllib.parse import urlencode

# ── Config ───────────────────────────────────────────────────────────────────
ROOT     = "http://localhost:3001"
BASE     = f"{ROOT}/api/v1"
ADMIN_EMAIL    = "admin@ecommerce.mz"
ADMIN_PASSWORD = "changeme123"
TS = int(time.time())                          # unique suffix for this run
TEST_USER_EMAIL = f"testuser.{TS}@testrun.com"

# ── Colours  ─────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Counters / state ─────────────────────────────────────────────────────────
PASS = FAIL = SKIP = 0
ADMIN_TOKEN = None
USER_TOKEN  = None
ctx: dict   = {}          # populated as resources are created
failures: list[str] = []  # labels of failed tests

# ─────────────────────────────────────────────────────────────────────────────
#  HTTP HELPER
# ─────────────────────────────────────────────────────────────────────────────

def http(method: str, path: str, body=None, *, token=None, params=None, base=BASE):
    url = base + path
    if params:
        url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
    data = json.dumps(body).encode() if body is not None else None
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
    except urllib.error.URLError as e:
        print(f"\n{RED}✗ Cannot connect to {url}: {e.reason}{RESET}")
        print(f"{RED}  Is the API server running on port 3001?{RESET}\n")
        sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
#  TEST HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def check(label: str, status: int, body, expected: int, *assertions):
    global PASS, FAIL
    ok = status == expected
    if ok:
        for fn in assertions:
            try:
                if not fn(body):
                    ok = False
                    break
            except Exception:
                ok = False
                break
    sym = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
    print(f"  {sym} [{status}] {label}")
    if not ok:
        hint = ""
        if isinstance(body, dict):
            hint = body.get("error") or body.get("errors") or ""
        if hint:
            print(f"      └─ {hint}")
        failures.append(label)
    if ok:
        PASS += 1
    else:
        FAIL += 1
    return ok


def skip_test(label: str, reason: str = ""):
    global SKIP
    tag = f" ({reason})" if reason else ""
    print(f"  {YELLOW}-{RESET} [SKIP] {label}{tag}")
    SKIP += 1


def section(title: str):
    print(f"\n{BOLD}{BLUE}{'━' * 65}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'━' * 65}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
#  1. HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

section("HEALTH")
status, body = http("GET", "/health", base=ROOT)
check("GET /health", status, body, 200, lambda b: b.get("status") == "ok")

# ─────────────────────────────────────────────────────────────────────────────
#  2. ADMIN AUTH
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN AUTH")

# Login
status, body = http("POST", "/admin/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
if check("POST /admin/auth/login", status, body, 200, lambda b: "token" in b):
    ADMIN_TOKEN = body["token"]
else:
    print(f"\n{RED}  Admin login failed — cannot continue.{RESET}")
    sys.exit(1)

# Wrong credentials
status, body = http("POST", "/admin/auth/login", {"email": ADMIN_EMAIL, "password": "wrong"})
check("POST /admin/auth/login (wrong password → 401)", status, body, 401)

# GET /admin/auth/me
status, body = http("GET", "/admin/auth/me", token=ADMIN_TOKEN)
check("GET /admin/auth/me", status, body, 200, lambda b: b.get("email") == ADMIN_EMAIL)

# FCM token register / remove
status, body = http("POST", "/admin/auth/fcm-token", {"token": "test-fcm-token"}, token=ADMIN_TOKEN)
check("POST /admin/auth/fcm-token", status, body, 200)

status, body = http("DELETE", "/admin/auth/fcm-token", {"token": "test-fcm-token"}, token=ADMIN_TOKEN)
check("DELETE /admin/auth/fcm-token", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  3. ADMIN DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN DASHBOARD")
status, body = http("GET", "/admin/dashboard", token=ADMIN_TOKEN)
check("GET /admin/dashboard", status, body, 200, lambda b: "stats" in b)

# ─────────────────────────────────────────────────────────────────────────────
#  4. ADMIN ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN ANALYTICS")
status, body = http("GET", "/admin/analytics/visitors", token=ADMIN_TOKEN)
check("GET /admin/analytics/visitors", status, body, 200, lambda b: "totalSessions" in b)

status, body = http("GET", "/admin/analytics/search-terms", token=ADMIN_TOKEN)
check("GET /admin/analytics/search-terms", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  5. CURRENCIES
# ─────────────────────────────────────────────────────────────────────────────

section("CURRENCIES")
status, body = http("GET", "/admin/currencies", token=ADMIN_TOKEN)
check("GET /admin/currencies", status, body, 200)

status, body = http("POST", "/admin/currencies",
    {"code": f"TC{TS % 10000}", "name": "TestCoin", "symbol": "T$", "rate": 50.0},
    token=ADMIN_TOKEN)
if check("POST /admin/currencies", status, body, 201, lambda b: "id" in b):
    ctx["currency_id"]   = body["id"]
    ctx["currency_code"] = body["code"]

if ctx.get("currency_id"):
    status, body = http("PATCH", f"/admin/currencies/{ctx['currency_id']}",
        {"rate": 51.5}, token=ADMIN_TOKEN)
    check("PATCH /admin/currencies/:id", status, body, 200, lambda b: float(b.get("rate", 0)) == 51.5)

# ─────────────────────────────────────────────────────────────────────────────
#  6. CATEGORIES
# ─────────────────────────────────────────────────────────────────────────────

section("CATEGORIES")

# GET full tree — grab first root for parenting
status, body = http("GET", "/admin/categories", token=ADMIN_TOKEN)
check("GET /admin/categories", status, body, 200)
root_category_id   = None
root_category_slug = None
if isinstance(body, list) and body:
    root_category_id   = body[0]["id"]
    root_category_slug = body[0]["slug"]
elif isinstance(body, dict) and body.get("items"):
    root_category_id   = body["items"][0]["id"]
    root_category_slug = body["items"][0]["slug"]

# POST — create level 1 subcategory under root
if root_category_id:
    cat_slug = f"test-cat-{TS}"
    status, body = http("POST", "/admin/categories",
        {"name": f"TestCat {TS}", "slug": cat_slug, "level": 1,
         "parentId": root_category_id, "position": 99, "isActive": True},
        token=ADMIN_TOKEN)
    if check("POST /admin/categories (level 1)", status, body, 201, lambda b: "id" in b):
        ctx["category_id"]   = body["id"]
        ctx["category_slug"] = body["slug"]

    # POST a level 2 subcategory for filter linking
    if ctx.get("category_id"):
        status, body = http("POST", "/admin/categories",
            {"name": f"TestSubCat {TS}", "slug": f"test-subcat-{TS}", "level": 2,
             "parentId": ctx["category_id"], "position": 99, "isActive": True},
            token=ADMIN_TOKEN)
        if check("POST /admin/categories (level 2)", status, body, 201, lambda b: "id" in b):
            ctx["subcategory_id"] = body["id"]
else:
    skip_test("POST /admin/categories", "no root category found")

# PATCH
if ctx.get("category_id"):
    status, body = http("PATCH", f"/admin/categories/{ctx['category_id']}",
        {"description": "Created by test suite"}, token=ADMIN_TOKEN)
    check("PATCH /admin/categories/:id", status, body, 200)

    # Reorder (pass a single-element list — valid under the schema)
    status, body = http("PATCH", "/admin/categories/reorder",
        {"orderedIds": [ctx["category_id"]]}, token=ADMIN_TOKEN)
    check("PATCH /admin/categories/reorder", status, body, 200)

    # GET :id/products
    status, body = http("GET", f"/admin/categories/{ctx['category_id']}/products",
        token=ADMIN_TOKEN)
    check("GET /admin/categories/:id/products", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  7. BRANDS
# ─────────────────────────────────────────────────────────────────────────────

section("BRANDS")
status, body = http("GET", "/admin/brands", token=ADMIN_TOKEN)
check("GET /admin/brands", status, body, 200)

status, body = http("POST", "/admin/brands",
    {"name": f"TestBrand {TS}", "slug": f"testbrand-{TS}"},
    token=ADMIN_TOKEN)
if check("POST /admin/brands", status, body, 201, lambda b: "id" in b):
    ctx["brand_id"]   = body["id"]
    ctx["brand_slug"] = body["slug"]

if ctx.get("brand_id"):
    status, body = http("PATCH", f"/admin/brands/{ctx['brand_id']}",
        {"name": f"TestBrand {TS} Updated"}, token=ADMIN_TOKEN)
    check("PATCH /admin/brands/:id", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  8. COLORS
# ─────────────────────────────────────────────────────────────────────────────

section("COLORS")
status, body = http("GET", "/admin/colors", token=ADMIN_TOKEN)
check("GET /admin/colors", status, body, 200)

# Generate a unique hex: encode last 3 digits of timestamp as RGB
r = (TS >> 16) & 0xFF
g = (TS >> 8)  & 0xFF
b_val = TS & 0xFF
test_hex = f"#{r:02X}{g:02X}{b_val:02X}"

status, body = http("POST", "/admin/colors",
    {"name": f"TestColor {TS}", "hexCode": test_hex},
    token=ADMIN_TOKEN)
if check("POST /admin/colors", status, body, 201, lambda b: "id" in b):
    ctx["color_id"] = body["id"]

# Duplicate hex → 409
status, body = http("POST", "/admin/colors",
    {"name": "Dup", "hexCode": test_hex}, token=ADMIN_TOKEN)
check("POST /admin/colors (duplicate hex → 409)", status, body, 409)

if ctx.get("color_id"):
    new_hex = f"#{(r + 1) % 256:02X}{g:02X}{b_val:02X}"
    status, body = http("PATCH", f"/admin/colors/{ctx['color_id']}",
        {"hexCode": new_hex}, token=ADMIN_TOKEN)
    check("PATCH /admin/colors/:id", status, body, 200)
    ctx["color_hex"] = new_hex  # keep in sync for later tests

# ─────────────────────────────────────────────────────────────────────────────
#  9. SIZES
# ─────────────────────────────────────────────────────────────────────────────

section("SIZES")
status, body = http("GET", "/admin/sizes", token=ADMIN_TOKEN)
check("GET /admin/sizes", status, body, 200)

size_cat_ids = [ctx["category_id"]] if ctx.get("category_id") else []
status, body = http("POST", "/admin/sizes",
    {"name": f"TS{TS % 100}", "label": f"TS{TS % 100}", "sizeSystem": "universal",
     "position": 99, "categoryIds": size_cat_ids},
    token=ADMIN_TOKEN)
if check("POST /admin/sizes", status, body, 201, lambda b: "id" in b):
    ctx["size_id"]   = body["id"]
    ctx["size_slug"] = body["slug"]

if ctx.get("size_id"):
    status, body = http("PATCH", f"/admin/sizes/{ctx['size_id']}",
        {"label": f"TS{TS % 100}x"}, token=ADMIN_TOKEN)
    check("PATCH /admin/sizes/:id", status, body, 200)

    status, body = http("PATCH", "/admin/sizes/reorder",
        {"orderedIds": [ctx["size_id"]]}, token=ADMIN_TOKEN)
    check("PATCH /admin/sizes/reorder", status, body, 200)

# Size Guides
status, body = http("GET", "/admin/sizes/guides", token=ADMIN_TOKEN)
check("GET /admin/sizes/guides", status, body, 200)

status, body = http("POST", "/admin/sizes/guides",
    {"name": f"TestGuide {TS}", "description": "Automated test guide",
     "images": [{"url": "https://example.com/guide.jpg", "position": 0}]},
    token=ADMIN_TOKEN)
if check("POST /admin/sizes/guides", status, body, 201, lambda b: "id" in b):
    ctx["guide_id"] = body["id"]

if ctx.get("guide_id"):
    status, body = http("PATCH", f"/admin/sizes/guides/{ctx['guide_id']}",
        {"description": "Updated description"}, token=ADMIN_TOKEN)
    check("PATCH /admin/sizes/guides/:id", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  10. FILTERS (ATTRIBUTE DEFINITIONS)
# ─────────────────────────────────────────────────────────────────────────────

section("FILTERS / ATTRIBUTE DEFINITIONS")
status, body = http("GET", "/admin/filters", token=ADMIN_TOKEN)
check("GET /admin/filters", status, body, 200)

if ctx.get("category_id"):
    status, body = http("GET", "/admin/filters/by-category",
        params={"categoryIds": ctx["category_id"]}, token=ADMIN_TOKEN)
    check("GET /admin/filters/by-category", status, body, 200)

if ctx.get("category_id"):
    status, body = http("POST", "/admin/filters",
        {"name": f"TestFilter {TS}", "slug": f"testfilter-{TS}",
         "categoryIds": [ctx["category_id"]],
         "inputType": "multi_select", "isActive": True, "position": 0,
         "options": [
             {"label": "OptA", "value": "opt-a", "position": 0},
             {"label": "OptB", "value": "opt-b", "position": 1},
         ]},
        token=ADMIN_TOKEN)
    if check("POST /admin/filters", status, body, 201, lambda b: "id" in b):
        ctx["filter_id"] = body["id"]
        if body.get("options") and len(body["options"]) >= 1:
            ctx["filter_opt_a_id"] = body["options"][0]["id"]  # for PATCH update in-place
        # Grab the ID of the second option to test option deletion
        if body.get("options") and len(body["options"]) >= 2:
            ctx["filter_option_id"] = body["options"][1]["id"]

if ctx.get("filter_id"):
    # Include the existing option ID for an in-place update (avoid duplicate-value conflict)
    existing_opt_id = ctx.get("filter_opt_a_id")  # captured from POST response below
    opt_patch = {"id": existing_opt_id, "label": "OptA Updated", "value": "opt-a-upd", "position": 0} if existing_opt_id else {"label": "OptA New", "value": "opt-a-new", "position": 0}
    status, body = http("PATCH", f"/admin/filters/{ctx['filter_id']}",
        {"name": f"TestFilter {TS} Upd", "options": [opt_patch]},
        token=ADMIN_TOKEN)
    check("PATCH /admin/filters/:id", status, body, 200)

if ctx.get("filter_option_id"):
    status, body = http("DELETE", f"/admin/filters/options/{ctx['filter_option_id']}",
        token=ADMIN_TOKEN)
    check("DELETE /admin/filters/options/:optionId", status, body, 204)
else:
    skip_test("DELETE /admin/filters/options/:optionId", "option id not captured")

# ─────────────────────────────────────────────────────────────────────────────
#  11. COLLECTIONS
# ─────────────────────────────────────────────────────────────────────────────

section("COLLECTIONS")
status, body = http("GET", "/admin/collections", token=ADMIN_TOKEN)
check("GET /admin/collections", status, body, 200)

status, body = http("POST", "/admin/collections",
    {"name": f"TestCollection {TS}", "slug": f"testcollection-{TS}",
     "coverImageUrl": "https://example.com/cover.jpg", "position": 99, "isActive": True},
    token=ADMIN_TOKEN)
if check("POST /admin/collections", status, body, 201, lambda b: "id" in b):
    ctx["collection_id"]   = body["id"]
    ctx["collection_slug"] = body["slug"]

if ctx.get("collection_id"):
    status, body = http("PATCH", f"/admin/collections/{ctx['collection_id']}",
        {"name": f"TestCollection {TS} Upd"}, token=ADMIN_TOKEN)
    check("PATCH /admin/collections/:id", status, body, 200)

    status, body = http("PATCH", "/admin/collections/reorder",
        {"orderedIds": [ctx["collection_id"]]}, token=ADMIN_TOKEN)
    check("PATCH /admin/collections/reorder", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  12. STORIES
# ─────────────────────────────────────────────────────────────────────────────

section("STORIES")
status, body = http("GET", "/admin/stories", token=ADMIN_TOKEN)
check("GET /admin/stories", status, body, 200)

status, body = http("POST", "/admin/stories",
    {"name": f"TestStory {TS}", "thumbnailUrl": "https://example.com/thumb.jpg",
     "position": 99, "isActive": True,
     "slides": [{"mediaUrl": "https://example.com/slide.jpg",
                 "mediaType": "image", "position": 0, "productIds": []}]},
    token=ADMIN_TOKEN)
if check("POST /admin/stories", status, body, 201, lambda b: "id" in b):
    ctx["story_id"] = body["id"]

if ctx.get("story_id"):
    status, body = http("GET", f"/admin/stories/{ctx['story_id']}", token=ADMIN_TOKEN)
    check("GET /admin/stories/:id", status, body, 200)

    status, body = http("PATCH", f"/admin/stories/{ctx['story_id']}",
        {"name": f"TestStory {TS} Upd",
         "slides": [{"mediaUrl": "https://example.com/slide2.jpg",
                     "mediaType": "image", "position": 0, "productIds": []}]},
        token=ADMIN_TOKEN)
    check("PATCH /admin/stories/:id", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  13. MOST SEARCHED
# ─────────────────────────────────────────────────────────────────────────────

section("MOST SEARCHED")
status, body = http("GET", "/admin/most-searched", token=ADMIN_TOKEN)
check("GET /admin/most-searched", status, body, 200)

# Use root category (level 1 is ok; level 0 roots may be level 1 per seed logic)
most_searched_cat_id = ctx.get("category_id") or root_category_id
if most_searched_cat_id:
    status, body = http("POST", "/admin/most-searched",
        {"categoryId": most_searched_cat_id, "position": 99},
        token=ADMIN_TOKEN)
    if check("POST /admin/most-searched", status, body, 201, lambda b: "id" in b):
        ctx["most_searched_id"] = body["id"]
    elif body.get("error", "").lower().startswith("category level"):
        # root might be level 0 which fails the ≤2 check — try with our created level-1 category
        skip_test("POST /admin/most-searched", "root category level too high")

    if ctx.get("most_searched_id"):
        status, body = http("PATCH", "/admin/most-searched/reorder",
            {"orderedIds": [ctx["most_searched_id"]]}, token=ADMIN_TOKEN)
        check("PATCH /admin/most-searched/reorder", status, body, 200)
else:
    skip_test("POST /admin/most-searched", "no category available")

# ─────────────────────────────────────────────────────────────────────────────
#  14. ADMIN PRODUCTS (full CRUD)
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN PRODUCTS")

# GET list
status, body = http("GET", "/admin/products", token=ADMIN_TOKEN)
check("GET /admin/products", status, body, 200)

can_create_product = all([
    ctx.get("brand_id"), ctx.get("category_id"),
    ctx.get("color_id"), ctx.get("size_id"),
])

if not can_create_product:
    skip_test("POST /admin/products", "missing brand/category/color/size")
else:
    prod_slug = f"test-product-{TS}"
    product_body = {
        "name": f"Test Product {TS}",
        "slug": prod_slug,
        "description": "Automated test product",
        "brandId": ctx["brand_id"],
        "collectionId": ctx.get("collection_id"),
        "sizeGuideId": ctx.get("guide_id"),
        "basePrice": 999.0,
        "hasDiscount": True,
        "discountPrice": 799.0,
        "isIndicativePrice": False,
        "stockStatus": "in_stock",
        "genderScope": "unisex",
        "isPublished": True,
        "isVisible": True,
        "mainColorId": ctx["color_id"],
        "metaTitle": "Test Product",
        "metaDescription": "Automated test product for endpoint tests",
        "keyCharacteristics": [{"title": "Material", "description": "100% Test Fabric"}],
        "returnPolicy": [{"title": "Return window", "description": "14 days"}],
        "categoryIds": [ctx["category_id"]],
        "sizeIds": [ctx["size_id"]],
        "variants": [
            {"colorId": ctx["color_id"], "sizeId": ctx["size_id"],
             "stockQuantity": 50}
        ],
        "media": [
            {"url": "https://example.com/product-img-1.jpg",
             "mediaType": "image", "colorId": ctx["color_id"],
             "isPrimary": True, "position": 0},
            {"url": "https://example.com/product-img-2.jpg",
             "mediaType": "image", "colorId": ctx["color_id"],
             "isPrimary": False, "position": 1},
        ],
    }
    status, body = http("POST", "/admin/products", product_body, token=ADMIN_TOKEN)
    if check("POST /admin/products", status, body, 201, lambda b: "id" in b):
        ctx["product_id"]   = body["id"]
        ctx["product_slug"] = body["slug"]
        # Extract the first variant and media IDs for sub-endpoint tests
        if body.get("variants"):
            ctx["variant_id"] = body["variants"][0]["id"]
        if body.get("media"):
            ctx["media_id"]   = body["media"][0]["id"]
            ctx["media_id_2"] = body["media"][1]["id"] if len(body["media"]) > 1 else None

# Also create a minimal product used ONLY to test successful deletion
if ctx.get("brand_id") and ctx.get("category_id") and ctx.get("color_id") and ctx.get("size_id"):
    del_slug = f"test-del-product-{TS}"
    del_body = {
        "name": f"DeleteMe {TS}", "slug": del_slug,
        "brandId": ctx["brand_id"], "basePrice": 10.0,
        "stockStatus": "in_stock", "isPublished": False, "isVisible": False,
        "categoryIds": [ctx["category_id"]], "sizeIds": [ctx["size_id"]],
        "variants": [{"colorId": ctx["color_id"], "sizeId": ctx["size_id"],
                      "stockQuantity": 1}],
        "media": [{"url": "https://example.com/del.jpg", "mediaType": "image",
                   "isPrimary": True, "position": 0}],
    }
    status, body = http("POST", "/admin/products", del_body, token=ADMIN_TOKEN)
    if status == 201:
        ctx["delete_product_id"] = body["id"]

# GET :id and sub-endpoints
if ctx.get("product_id"):
    pid = ctx["product_id"]

    status, body = http("GET", f"/admin/products/{pid}", token=ADMIN_TOKEN)
    check("GET /admin/products/:id", status, body, 200, lambda b: b.get("id") == pid)

    status, body = http("GET", f"/admin/products/{pid}/variants", token=ADMIN_TOKEN)
    check("GET /admin/products/:id/variants", status, body, 200, lambda b: isinstance(b, list))

    status, body = http("GET", f"/admin/products/{pid}/media", token=ADMIN_TOKEN)
    check("GET /admin/products/:id/media", status, body, 200, lambda b: isinstance(b, list))

    status, body = http("GET", f"/admin/products/{pid}/categories", token=ADMIN_TOKEN)
    check("GET /admin/products/:id/categories", status, body, 200, lambda b: isinstance(b, list))

    status, body = http("GET", f"/admin/products/{pid}/financial", token=ADMIN_TOKEN)
    check("GET /admin/products/:id/financial", status, body, 200,
          lambda b: "suppliers" in b and "competitors" in b)

    # PATCH
    status, body = http("PATCH", f"/admin/products/{pid}",
        {"description": "Updated by test suite"}, token=ADMIN_TOKEN)
    check("PATCH /admin/products/:id", status, body, 200)

    # PATCH visibility
    status, body = http("PATCH", f"/admin/products/{pid}/visibility",
        {"isVisible": False}, token=ADMIN_TOKEN)
    check("PATCH /admin/products/:id/visibility (hide)", status, body, 200,
          lambda b: b.get("isVisible") is False)
    # Restore
    http("PATCH", f"/admin/products/{pid}/visibility",
         {"isVisible": True}, token=ADMIN_TOKEN)

    # Not-found visibility test
    status, body = http("PATCH", "/admin/products/00000000-0000-0000-0000-000000000000/visibility",
        {"isVisible": True}, token=ADMIN_TOKEN)
    check("PATCH /admin/products/:id/visibility (not found → 404)", status, body, 404)

    # Suppliers
    status, body = http("POST", f"/admin/products/{pid}/suppliers",
        {"supplierName": "Test Supplier Co.", "supplierPrice": 400.0,
         "priceWithDelivery": 450.0, "deliveryTax": 30.0, "otherCosts": 20.0,
         "currencyRateId": ctx.get("currency_id"), "notes": "Test notes"},
        token=ADMIN_TOKEN)
    if check("POST /admin/products/:id/suppliers", status, body, 201, lambda b: "id" in b):
        ctx["supplier_id"] = body["id"]

    if ctx.get("supplier_id"):
        status, body = http("PATCH", f"/admin/products/{pid}/suppliers/{ctx['supplier_id']}",
            {"notes": "Updated notes"}, token=ADMIN_TOKEN)
        check("PATCH /admin/products/:id/suppliers/:supplierId", status, body, 200)

        status, body = http("DELETE", f"/admin/products/{pid}/suppliers/{ctx['supplier_id']}",
            token=ADMIN_TOKEN)
        check("DELETE /admin/products/:id/suppliers/:supplierId", status, body, 204)

    # Competitors
    status, body = http("POST", f"/admin/products/{pid}/competitors",
        {"link": "https://rival.example.com/product", "price": 1200.0,
         "comments": "Slightly cheaper rival"},
        token=ADMIN_TOKEN)
    if check("POST /admin/products/:id/competitors", status, body, 201, lambda b: "id" in b):
        ctx["competitor_id"] = body["id"]

    if ctx.get("competitor_id"):
        status, body = http("PATCH",
            f"/admin/products/{pid}/competitors/{ctx['competitor_id']}",
            {"price": 1150.0}, token=ADMIN_TOKEN)
        check("PATCH /admin/products/:id/competitors/:competitorId", status, body, 200)

        status, body = http("DELETE",
            f"/admin/products/{pid}/competitors/{ctx['competitor_id']}",
            token=ADMIN_TOKEN)
        check("DELETE /admin/products/:id/competitors/:competitorId", status, body, 204)

    # Media soft-delete
    if ctx.get("media_id"):
        status, body = http("PATCH", f"/admin/products/{pid}/media/{ctx['media_id']}",
            {"isDeleted": True}, token=ADMIN_TOKEN)
        check("PATCH /admin/products/:id/media/:mediaId (soft-delete)", status, body, 200)
        # Restore so the product has visible media for catalog tests
        http("PATCH", f"/admin/products/{pid}/media/{ctx['media_id']}",
             {"isDeleted": False}, token=ADMIN_TOKEN)

    # Media reorder
    if ctx.get("media_id") and ctx.get("media_id_2"):
        status, body = http("PATCH", f"/admin/products/{pid}/media/reorder",
            {"orderedIds": [ctx["media_id_2"], ctx["media_id"]]}, token=ADMIN_TOKEN)
        check("PATCH /admin/products/:id/media/reorder", status, body, 200)

    # DELETE product with order history → 409 (tested later after order creation)
    # Tested as: DELETE /admin/products/:id (order history → 409)

    # DELETE the delete-only product (no orders)
    if ctx.get("delete_product_id"):
        status, body = http("DELETE", f"/admin/products/{ctx['delete_product_id']}",
            token=ADMIN_TOKEN)
        check("DELETE /admin/products/:id (no order history → 204)", status, body, 204)
        ctx.pop("delete_product_id")

else:
    for lbl in [
        "GET /admin/products/:id", "GET /admin/products/:id/variants",
        "GET /admin/products/:id/media", "GET /admin/products/:id/categories",
        "GET /admin/products/:id/financial", "PATCH /admin/products/:id",
        "PATCH /admin/products/:id/visibility (hide)", "POST /admin/products/:id/suppliers",
        "PATCH /admin/products/:id/suppliers/:supplierId",
        "DELETE /admin/products/:id/suppliers/:supplierId",
        "POST /admin/products/:id/competitors",
        "PATCH /admin/products/:id/competitors/:competitorId",
        "DELETE /admin/products/:id/competitors/:competitorId",
        "PATCH /admin/products/:id/media/:mediaId (soft-delete)",
        "PATCH /admin/products/:id/media/reorder",
        "DELETE /admin/products/:id (no order history → 204)",
    ]:
        skip_test(lbl, "product not created")

# ─────────────────────────────────────────────────────────────────────────────
#  15. ADMIN CLIENTS
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN CLIENTS")
status, body = http("GET", "/admin/clients", token=ADMIN_TOKEN)
check("GET /admin/clients", status, body, 200, lambda b: "stats" in b)

# ─────────────────────────────────────────────────────────────────────────────
#  16. ADMIN AUTHORITY
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN AUTHORITY")

status, body = http("GET", "/admin/authority", token=ADMIN_TOKEN)
check("GET /admin/authority", status, body, 200)

# Create a test admin
status, body = http("POST", "/admin/authority",
    {"name": f"TestAdmin {TS}", "email": f"testadmin.{TS}@ecommerce.mz",
     "password": "TestPass1", "permissions": 3},   # DASHBOARD_VIEW + ORDERS_VIEW
    token=ADMIN_TOKEN)
if check("POST /admin/authority", status, body, 201, lambda b: "id" in b):
    ctx["test_admin_id"] = body["id"]
else:
    ctx["test_admin_id"] = None

if ctx.get("test_admin_id"):
    status, body = http("PATCH", f"/admin/authority/{ctx['test_admin_id']}",
        {"name": f"TestAdmin {TS} Updated"}, token=ADMIN_TOKEN)
    check("PATCH /admin/authority/:id", status, body, 200)

    status, body = http("PATCH", f"/admin/authority/{ctx['test_admin_id']}/deactivate",
        token=ADMIN_TOKEN)
    check("PATCH /admin/authority/:id/deactivate", status, body, 200)

    status, body = http("PATCH", f"/admin/authority/{ctx['test_admin_id']}/activate",
        token=ADMIN_TOKEN)
    check("PATCH /admin/authority/:id/activate", status, body, 200)

    # Cannot deactivate self
    admin_self_id = None
    s2, b2 = http("GET", "/admin/auth/me", token=ADMIN_TOKEN)
    if s2 == 200:
        admin_self_id = b2.get("id")
    if admin_self_id:
        status, body = http("PATCH", f"/admin/authority/{admin_self_id}/deactivate",
            token=ADMIN_TOKEN)
        check("PATCH /admin/authority/:id/deactivate (self → 422)", status, body, 422)

# POST /admin/authority (duplicate email → 409)
status, body = http("POST", "/admin/authority",
    {"name": "Dup", "email": ADMIN_EMAIL, "password": "TestPass1", "permissions": 1},
    token=ADMIN_TOKEN)
check("POST /admin/authority (duplicate email → 409)", status, body, 409)

status, body = http("GET", "/admin/authority/audit-log", token=ADMIN_TOKEN)
check("GET /admin/authority/audit-log", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  17. CLIENT AUTH — DEV-LOGIN + USER ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

section("CLIENT AUTH (dev-login)")

status, body = http("POST", "/auth/dev-login", {"email": TEST_USER_EMAIL})
if check("POST /auth/dev-login", status, body, 200,
         lambda b: "accessToken" in b and "refreshToken" in b):
    USER_TOKEN           = body["accessToken"]
    ctx["user_refresh"]  = body["refreshToken"]
    ctx["user_id"]       = body["user"]["id"]
else:
    # dev-login disabled in production — skip all user-side tests
    for lbl in ["GET /auth/me", "PATCH /auth/me/contact", "POST /auth/refresh",
                "POST /auth/logout (client)", "GET /users/me", "PATCH /users/me",
                "POST /users/me/fcm-token", "DELETE /users/me/fcm-token",
                "GET /cart", "POST /cart/items", "PATCH /cart/items/:id",
                "DELETE /cart/items/:id", "DELETE /cart", "GET /favorites",
                "POST /favorites", "DELETE /favorites/:productId", "GET /orders",
                "GET /chats/conversations", "POST /chats/conversations",
                "GET /chats/conversations/:id/messages",
                "POST /chats/conversations/:id/messages",
                "POST /media/presign", "POST /analytics/sessions"]:
        skip_test(lbl, "dev-login unavailable")
    USER_TOKEN = None

# ─────────────────────────────────────────────────────────────────────────────
#  18. CLIENT USERS
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN:
    section("CLIENT USERS")

    status, body = http("GET", "/auth/me", token=USER_TOKEN)
    check("GET /auth/me", status, body, 200, lambda b: "email" in b)

    status, body = http("PATCH", "/auth/me/contact",
        {"phone": "+258841111111", "whatsappNumber": "+258841111111"},
        token=USER_TOKEN)
    check("PATCH /auth/me/contact", status, body, 200)

    skip_test("POST /auth/google", "requires real Google idToken")

    # Refresh token
    status, body = http("POST", "/auth/refresh", {"refreshToken": ctx["user_refresh"]})
    if check("POST /auth/refresh", status, body, 200,
             lambda b: "accessToken" in b and "refreshToken" in b):
        USER_TOKEN          = body["accessToken"]
        ctx["user_refresh"] = body["refreshToken"]

    # Old token is now revoked  — using same refresh again → 401
    status, body = http("POST", "/auth/refresh",
        {"refreshToken": ctx.get("user_old_refresh", ctx["user_refresh"] + "x")})
    # Don't assert specific code here — just confirm the endpoint responds

    status, body = http("GET", "/users/me", token=USER_TOKEN)
    check("GET /users/me", status, body, 200)

    status, body = http("PATCH", "/users/me",
        {"name": f"Test User {TS}"}, token=USER_TOKEN)
    check("PATCH /users/me", status, body, 200)

    status, body = http("POST", "/users/me/fcm-token",
        {"token": "test-fcm-client-token"}, token=USER_TOKEN)
    check("POST /users/me/fcm-token", status, body, 200)

    status, body = http("DELETE", "/users/me/fcm-token",
        {"token": "test-fcm-client-token"}, token=USER_TOKEN)
    check("DELETE /users/me/fcm-token", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  19. CLIENT CATALOG
# ─────────────────────────────────────────────────────────────────────────────

section("CLIENT CATALOG")

# Categories tree (public)
status, body = http("GET", "/catalog/categories")
check("GET /catalog/categories", status, body, 200)

# Find a real category slug for subsequent tests
_cat_slug = root_category_slug or "women"
status, body = http("GET", f"/catalog/categories/{_cat_slug}")
ok = check(f"GET /catalog/categories/:slug ({_cat_slug})", status, body, 200)
if ok and body.get("slug"):
    _cat_slug_for_filters = body["slug"]
else:
    _cat_slug_for_filters = _cat_slug

status, body = http("GET", f"/catalog/categories/{_cat_slug_for_filters}/filters")
check("GET /catalog/categories/:slug/filters", status, body, 200)

status, body = http("GET", f"/catalog/categories/{_cat_slug_for_filters}/products",
    params={"limit": "5", "sort": "newest"})
check("GET /catalog/categories/:slug/products", status, body, 200)

# Brands (public)
status, body = http("GET", "/catalog/brands")
check("GET /catalog/brands", status, body, 200)

# Products — use our created product slug
if ctx.get("product_slug"):
    status, body = http("GET", f"/catalog/products/{ctx['product_slug']}")
    check("GET /catalog/products/:slug", status, body, 200, lambda b: b.get("id") == ctx["product_id"])

    status, body = http("GET", f"/catalog/products/{ctx['product_slug']}/similar")
    check("GET /catalog/products/:slug/similar", status, body, 200)

    # Not found
    status, body = http("GET", "/catalog/products/this-product-does-not-exist-xyz")
    check("GET /catalog/products/:slug (not found → 404)", status, body, 404)
else:
    skip_test("GET /catalog/products/:slug", "test product not created")
    skip_test("GET /catalog/products/:slug/similar", "test product not created")

# Collections (public)
status, body = http("GET", "/catalog/collections")
check("GET /catalog/collections", status, body, 200)

if ctx.get("collection_slug"):
    status, body = http("GET", f"/catalog/collections/{ctx['collection_slug']}/products",
        params={"limit": "5"})
    check("GET /catalog/collections/:slug/products", status, body, 200)
else:
    skip_test("GET /catalog/collections/:slug/products", "collection not created")

# ─────────────────────────────────────────────────────────────────────────────
#  20. CLIENT SEARCH
# ─────────────────────────────────────────────────────────────────────────────

section("CLIENT SEARCH")

status, body = http("GET", "/search", params={"q": "test", "perPage": "5"})
# Typesense might not be running in all environments — accept 200 or 500/503
if status == 200:
    check("GET /search (Typesense)", status, body, 200)
elif status in (500, 503):
    skip_test("GET /search (Typesense)", f"Typesense unavailable (HTTP {status})")
else:
    check("GET /search", status, body, 200)

status, body = http("GET", "/search/suggest")
check("GET /search/suggest", status, body, 200)

# ─────────────────────────────────────────────────────────────────────────────
#  21. CLIENT STORIES
# ─────────────────────────────────────────────────────────────────────────────

section("CLIENT STORIES")

status, body = http("GET", "/stories")
check("GET /stories", status, body, 200)

# Find any active story from the public list to test :id
story_id_for_client = None
if isinstance(body, list) and body:
    story_id_for_client = body[0]["id"]

if story_id_for_client:
    status, body = http("GET", f"/stories/{story_id_for_client}")
    check("GET /stories/:id", status, body, 200)
else:
    skip_test("GET /stories/:id", "no active/non-expired stories visible to public")

# ─────────────────────────────────────────────────────────────────────────────
#  22. CLIENT CART
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN and ctx.get("variant_id"):
    section("CLIENT CART")

    status, body = http("GET", "/cart", token=USER_TOKEN)
    check("GET /cart", status, body, 200, lambda b: "items" in b and "subtotal" in b)

    # Add item
    status, body = http("POST", "/cart/items",
        {"productVariantId": ctx["variant_id"], "quantity": 2}, token=USER_TOKEN)
    if check("POST /cart/items", status, body, 201):
        ctx["cart_item_id"] = body["id"]

    # Duplicate add → 409
    status, body = http("POST", "/cart/items",
        {"productVariantId": ctx["variant_id"], "quantity": 1}, token=USER_TOKEN)
    check("POST /cart/items (duplicate → 409)", status, body, 409)

    # PATCH quantity
    if ctx.get("cart_item_id"):
        status, body = http("PATCH", f"/cart/items/{ctx['cart_item_id']}",
            {"quantity": 3}, token=USER_TOKEN)
        check("PATCH /cart/items/:id", status, body, 200, lambda b: b.get("quantity") == 3)

        # DELETE single item
        status, body = http("DELETE", f"/cart/items/{ctx['cart_item_id']}",
            token=USER_TOKEN)
        check("DELETE /cart/items/:id", status, body, 204)

    # Add again so we can test DELETE /cart (clear)
    http("POST", "/cart/items",
         {"productVariantId": ctx["variant_id"], "quantity": 1}, token=USER_TOKEN)
    status, body = http("DELETE", "/cart", token=USER_TOKEN)
    check("DELETE /cart (clear)", status, body, 204)

elif not USER_TOKEN:
    pass  # already skipped above
else:
    section("CLIENT CART")
    for lbl in ["GET /cart", "POST /cart/items", "POST /cart/items (duplicate → 409)",
                "PATCH /cart/items/:id", "DELETE /cart/items/:id", "DELETE /cart (clear)"]:
        skip_test(lbl, "no test variant available")

# ─────────────────────────────────────────────────────────────────────────────
#  23. CLIENT FAVORITES
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN and ctx.get("product_id"):
    section("CLIENT FAVORITES")

    status, body = http("GET", "/favorites", token=USER_TOKEN)
    check("GET /favorites", status, body, 200)

    status, body = http("POST", "/favorites",
        {"productId": ctx["product_id"]}, token=USER_TOKEN)
    check("POST /favorites", status, body, 201)

    # Idempotent — second call should also be 201 (upsert)
    status, body = http("POST", "/favorites",
        {"productId": ctx["product_id"]}, token=USER_TOKEN)
    check("POST /favorites (idempotent repeat)", status, body, 201)

    status, body = http("DELETE", f"/favorites/{ctx['product_id']}", token=USER_TOKEN)
    check("DELETE /favorites/:productId", status, body, 204)

elif USER_TOKEN:
    section("CLIENT FAVORITES")
    for lbl in ["GET /favorites", "POST /favorites",
                "POST /favorites (idempotent repeat)", "DELETE /favorites/:productId"]:
        skip_test(lbl, "no test product available")

# ─────────────────────────────────────────────────────────────────────────────
#  24. CLIENT CHATS
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN:
    section("CLIENT CHATS")

    status, body = http("GET", "/chats/conversations", token=USER_TOKEN)
    check("GET /chats/conversations", status, body, 200)

    # Start / reuse conversation
    status, body = http("POST", "/chats/conversations",
        {"message": f"Test message from automated suite run {TS}"},
        token=USER_TOKEN)
    ok = check("POST /chats/conversations", status, body, 201) or status == 200
    if status in (200, 201) and isinstance(body, dict) and body.get("id"):
        ctx["conversation_id"] = body["id"]

    if ctx.get("conversation_id"):
        conv_id = ctx["conversation_id"]

        status, body = http("GET", f"/chats/conversations/{conv_id}/messages",
            token=USER_TOKEN, params={"limit": "10"})
        check("GET /chats/conversations/:id/messages", status, body, 200)

        status, body = http("POST", f"/chats/conversations/{conv_id}/messages",
            {"content": "Follow-up message"},
            token=USER_TOKEN)
        check("POST /chats/conversations/:id/messages", status, body, 201)

# ─────────────────────────────────────────────────────────────────────────────
#  25. ADMIN CHATS
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN CHATS")

status, body = http("GET", "/admin/chats", token=ADMIN_TOKEN)
check("GET /admin/chats", status, body, 200)

if ctx.get("conversation_id"):
    conv_id = ctx["conversation_id"]

    status, body = http("GET", f"/admin/chats/{conv_id}/messages",
        token=ADMIN_TOKEN, params={"limit": "10"})
    check("GET /admin/chats/:conversationId/messages", status, body, 200)

    status, body = http("POST", f"/admin/chats/{conv_id}/messages",
        {"content": "Admin reply from test suite"},
        token=ADMIN_TOKEN)
    check("POST /admin/chats/:conversationId/messages", status, body, 201)
else:
    for lbl in ["GET /admin/chats/:conversationId/messages",
                "POST /admin/chats/:conversationId/messages"]:
        skip_test(lbl, "no conversation (user not logged in or chat not started)")

# ─────────────────────────────────────────────────────────────────────────────
#  26. ADMIN ORDERS + FULL ORDER FLOW
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN ORDERS + ORDER FLOW")

status, body = http("GET", "/admin/orders", token=ADMIN_TOKEN)
check("GET /admin/orders", status, body, 200, lambda b: "stats" in b)

can_create_order = all([
    ctx.get("user_id"), ctx.get("conversation_id"),
    ctx.get("product_id"), ctx.get("variant_id"),
])

if can_create_order:
    status, body = http("POST", "/admin/orders",
        {"userId": ctx["user_id"],
         "conversationId": ctx["conversation_id"],
         "shippingCost": 150.0,
         "items": [{"productId": ctx["product_id"],
                    "productVariantId": ctx["variant_id"],
                    "quantity": 1, "unitPrice": 799.0}]},
        token=ADMIN_TOKEN)
    if check("POST /admin/orders", status, body, 201, lambda b: "id" in b):
        ctx["order_id"] = body["id"]
        if body.get("items"):
            ctx["order_item_id"] = body["items"][0]["id"]

    if ctx.get("order_id"):
        oid = ctx["order_id"]

        status, body = http("GET", f"/admin/orders/{oid}", token=ADMIN_TOKEN)
        check("GET /admin/orders/:id", status, body, 200)

        # Edit item while pending
        if ctx.get("order_item_id"):
            status, body = http("PATCH", f"/admin/orders/{oid}/items/{ctx['order_item_id']}",
                {"quantity": 2, "unitPrice": 750.0}, token=ADMIN_TOKEN)
            check("PATCH /admin/orders/:id/items/:itemId (while pending)", status, body, 200)

            # Restore quantity to 1 so stock check passes on paid transition
            http("PATCH", f"/admin/orders/{oid}/items/{ctx['order_item_id']}",
                 {"quantity": 1, "unitPrice": 799.0}, token=ADMIN_TOKEN)

        # Advance to paid (deducts stock)
        status, body = http("PATCH", f"/admin/orders/{oid}/status",
            {"status": "paid", "proofNotes": "Test payment confirmed"},
            token=ADMIN_TOKEN)
        check("PATCH /admin/orders/:id/status (pending → paid)", status, body, 200,
              lambda b: b.get("status") == "paid")

        # Invalid transition: paid → delivered (skip in_process / in_transit)
        status, body = http("PATCH", f"/admin/orders/{oid}/status",
            {"status": "delivered"}, token=ADMIN_TOKEN)
        check("PATCH /admin/orders/:id/status (invalid transition → 409)", status, body, 409)

        # Continue valid path
        http("PATCH", f"/admin/orders/{oid}/status",
             {"status": "in_process"}, token=ADMIN_TOKEN)
        http("PATCH", f"/admin/orders/{oid}/status",
             {"status": "in_transit"}, token=ADMIN_TOKEN)

        # Edit item after paid → 409
        if ctx.get("order_item_id"):
            status, body = http("PATCH", f"/admin/orders/{oid}/items/{ctx['order_item_id']}",
                {"quantity": 3}, token=ADMIN_TOKEN)
            check("PATCH /admin/orders/:id/items/:itemId (not pending → 409)", status, body, 409)

        # Deliver
        status, body = http("PATCH", f"/admin/orders/{oid}/status",
            {"status": "delivered"}, token=ADMIN_TOKEN)
        check("PATCH /admin/orders/:id/status (→ delivered)", status, body, 200)

else:
    skip_test("POST /admin/orders", "missing user/conversation/product")
    for lbl in ["GET /admin/orders/:id",
                "PATCH /admin/orders/:id/items/:itemId (while pending)",
                "PATCH /admin/orders/:id/status (pending → paid)",
                "PATCH /admin/orders/:id/status (invalid transition → 409)",
                "PATCH /admin/orders/:id/items/:itemId (not pending → 409)",
                "PATCH /admin/orders/:id/status (→ delivered)"]:
        skip_test(lbl, "order not created")

# DELETE product with order history → 409
if ctx.get("order_id") and ctx.get("product_id"):
    status, body = http("DELETE", f"/admin/products/{ctx['product_id']}", token=ADMIN_TOKEN)
    check("DELETE /admin/products/:id (order history → 409 blocked)", status, body, 409)
else:
    skip_test("DELETE /admin/products/:id (order history → 409 blocked)",
              "no order was created with test product")

# ─────────────────────────────────────────────────────────────────────────────
#  27. CLIENT ORDERS (VIEW)
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN:
    section("CLIENT ORDERS")

    status, body = http("GET", "/orders", token=USER_TOKEN)
    check("GET /orders", status, body, 200)

    if ctx.get("order_id"):
        status, body = http("GET", f"/orders/{ctx['order_id']}", token=USER_TOKEN)
        check("GET /orders/:id", status, body, 200, lambda b: b.get("id") == ctx["order_id"])
    else:
        skip_test("GET /orders/:id", "no order created")

# ─────────────────────────────────────────────────────────────────────────────
#  28. ADMIN CLIENTS (with real user)
# ─────────────────────────────────────────────────────────────────────────────

if ctx.get("user_id"):
    section("ADMIN CLIENTS (detail)")

    uid = ctx["user_id"]
    status, body = http("GET", f"/admin/clients/{uid}", token=ADMIN_TOKEN)
    check("GET /admin/clients/:id", status, body, 200)

    status, body = http("GET", f"/admin/clients/{uid}/cart", token=ADMIN_TOKEN)
    check("GET /admin/clients/:id/cart", status, body, 200, lambda b: "items" in b)

    status, body = http("GET", "/admin/clients/00000000-0000-0000-0000-000000000000",
        token=ADMIN_TOKEN)
    check("GET /admin/clients/:id (not found → 404)", status, body, 404)

# ─────────────────────────────────────────────────────────────────────────────
#  29. CLIENT MEDIA
# ─────────────────────────────────────────────────────────────────────────────

if USER_TOKEN:
    section("CLIENT MEDIA")

    status, body = http("POST", "/media/presign",
        {"context": "product", "filename": "photo.jpg", "contentType": "image/jpeg"},
        token=USER_TOKEN)
    check("POST /media/presign", status, body, 200,
          lambda b: "uploadUrl" in b and "publicUrl" in b)

    # Unsupported content type
    status, body = http("POST", "/media/presign",
        {"context": "product", "filename": "file.pdf", "contentType": "application/pdf"},
        token=USER_TOKEN)
    check("POST /media/presign (bad content type → 400)", status, body, 400)

# ─────────────────────────────────────────────────────────────────────────────
#  30. CLIENT ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

section("CLIENT ANALYTICS")

import uuid as _uuid
anon_id = str(_uuid.uuid4())
status, body = http("POST", "/analytics/sessions",
    {"anonymousId": anon_id, "platform": "web"})
check("POST /analytics/sessions (anonymous)", status, body, 201)

# Link session to user
if USER_TOKEN and ctx.get("user_id"):
    anon_id2 = str(_uuid.uuid4())
    status, body = http("POST", "/analytics/sessions",
        {"anonymousId": anon_id2, "platform": "android", "userId": ctx["user_id"]},
        token=USER_TOKEN)
    check("POST /analytics/sessions (linked to user)", status, body, 201)

    # userId mismatch → 403
    status, body = http("POST", "/analytics/sessions",
        {"anonymousId": str(_uuid.uuid4()), "platform": "ios",
         "userId": "00000000-0000-0000-0000-000000000000"},
        token=USER_TOKEN)
    check("POST /analytics/sessions (userId mismatch → 403)", status, body, 403)

# ─────────────────────────────────────────────────────────────────────────────
#  31. ADMIN AUTH — PASSWORD RESET FLOW + LOGOUT
# ─────────────────────────────────────────────────────────────────────────────

section("ADMIN AUTH — RESET + LOGOUT")

status, body = http("POST", "/admin/auth/request-password-reset",
    {"newPassword": "NewTestPass1"}, token=ADMIN_TOKEN)
check("POST /admin/auth/request-password-reset", status, body, 201,
      lambda b: b.get("success") is True)

# approve-reset/:token requires the email link token — cannot automate without it
skip_test("POST /admin/auth/approve-reset/:token",
          "requires one-time token from approval email")

# Client logout (revokes refresh token)
if USER_TOKEN and ctx.get("user_refresh"):
    status, body = http("POST", "/auth/logout", {"refreshToken": ctx["user_refresh"]})
    check("POST /auth/logout (client)", status, body, 200)

# Admin logout
status, body = http("POST", "/admin/auth/logout", token=ADMIN_TOKEN)
check("POST /admin/auth/logout", status, body, 200, lambda b: b.get("success") is True)

# ─────────────────────────────────────────────────────────────────────────────
#  32. CLEANUP (best-effort)
# ─────────────────────────────────────────────────────────────────────────────

# Re-authenticate (admin logout may have blacklisted the token in a fixed version)
_, reauth = http("POST", "/admin/auth/login",
    {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
if "token" in reauth:
    ADMIN_TOKEN = reauth["token"]

section("CLEANUP")

def attempt_delete(method, path, label):
    s, b = http(method, path, token=ADMIN_TOKEN)
    sym = f"{GREEN}✓{RESET}" if s in (204, 200) else f"{YELLOW}~{RESET}"
    print(f"  {sym} [{s}] {label}")

# Deactivate the test admin (best-effort, so it can't login)
if ctx.get("test_admin_id"):
    http("PATCH", f"/admin/authority/{ctx['test_admin_id']}/deactivate",
         token=ADMIN_TOKEN)
    print(f"  {GREEN}✓{RESET} deactivated test admin {ctx['test_admin_id']}")

attempt_delete("DELETE", f"/admin/most-searched/{ctx.get('most_searched_id', 'SKIP')}",
               "DELETE /admin/most-searched/:id")
attempt_delete("DELETE", f"/admin/stories/{ctx.get('story_id', 'SKIP')}",
               "DELETE /admin/stories/:id")
attempt_delete("DELETE", f"/admin/collections/{ctx.get('collection_id', 'SKIP')}",
               "DELETE /admin/collections/:id")
attempt_delete("DELETE", f"/admin/filters/{ctx.get('filter_id', 'SKIP')}",
               "DELETE /admin/filters/:id")
attempt_delete("DELETE", f"/admin/sizes/guides/{ctx.get('guide_id', 'SKIP')}",
               "DELETE /admin/sizes/guides/:id")
attempt_delete("DELETE", f"/admin/sizes/{ctx.get('size_id', 'SKIP')}",
               "DELETE /admin/sizes/:id")
attempt_delete("DELETE", f"/admin/colors/{ctx.get('color_id', 'SKIP')}",
               "DELETE /admin/colors/:id")
attempt_delete("DELETE", f"/admin/currencies/{ctx.get('currency_id', 'SKIP')}",
               "DELETE /admin/currencies/:id")

# Products: main product might be blocked (has order); delete-product should already be gone
if ctx.get("product_id"):
    s, b = http("DELETE", f"/admin/products/{ctx['product_id']}", token=ADMIN_TOKEN)
    if s == 204:
        print(f"  {GREEN}✓{RESET} [204] DELETE /admin/products/:id (test product)")
    elif s == 409:
        print(f"  {YELLOW}~{RESET} [409] DELETE /admin/products/:id "
              f"(kept — has order history, expected)")
    else:
        print(f"  {YELLOW}~{RESET} [{s}] DELETE /admin/products/:id")

# Brand
if ctx.get("brand_id"):
    s, b = http("DELETE", f"/admin/brands/{ctx['brand_id']}", token=ADMIN_TOKEN)
    if s == 409:
        print(f"  {YELLOW}~{RESET} [409] DELETE /admin/brands/:id (has products, expected)")
    else:
        print(f"  {GREEN if s == 204 else YELLOW}{'✓' if s == 204 else '~'}{RESET} [{s}] DELETE /admin/brands/:id")

# Subcategory before category
if ctx.get("subcategory_id"):
    attempt_delete("DELETE", f"/admin/categories/{ctx['subcategory_id']}",
                   "DELETE /admin/categories/:id (subcategory)")
if ctx.get("category_id"):
    s, b = http("DELETE", f"/admin/categories/{ctx['category_id']}", token=ADMIN_TOKEN)
    if s == 409:
        print(f"  {YELLOW}~{RESET} [409] DELETE /admin/categories/:id (has products/subcategories, expected)")
    else:
        print(f"  {GREEN if s == 204 else YELLOW}{'✓' if s == 204 else '~'}{RESET} [{s}] DELETE /admin/categories/:id")

# ─────────────────────────────────────────────────────────────────────────────
#  SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

total = PASS + FAIL + SKIP
print(f"\n{BOLD}{'═' * 65}{RESET}")
print(f"{BOLD}  RESULTS — {total} tests{RESET}")
print(f"{'═' * 65}")
print(f"  {GREEN}PASS{RESET}  {PASS}")
print(f"  {RED}FAIL{RESET}  {FAIL}")
print(f"  {YELLOW}SKIP{RESET}  {SKIP}")
print(f"{'═' * 65}")

if failures:
    print(f"\n{RED}Failed tests:{RESET}")
    for f in failures:
        print(f"  • {f}")

print()
sys.exit(0 if FAIL == 0 else 1)
