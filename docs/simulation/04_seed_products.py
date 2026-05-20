#!/usr/bin/env python3
"""
04_seed_products.py — MultiTraders comprehensive product seeder.

Analyses test_data/ images and creates, in order:
  1. Colours & Sizes
  2. Brands: Zara, Redbat, Lacoste, Cotton On
  3. Collection: Urban Essentials
  4. Category tree (3 levels): Women & Men with Tops / Bottoms / Outerwear / Footwear
  5. Attribute filters per L3 category (Material, Fit, Neckline, Closure, etc.)
  6. Uploads all images to R2 via presigned URLs (converts AVIF→JPEG first)
  7. Creates 11 products with full variant + media + attribute data
  8. Creates 2 stories (3 slides & 5 slides) with product associations

Usage:
    python3 docs/simulation/04_seed_products.py
"""

import json
import os
import subprocess
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError

BASE = "http://localhost:3001/api/v1"
TEST_DATA = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../test_data")
)
ADMIN_TOKEN_FILE = "/tmp/login.json"

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def http(method, path, body=None, *, token=None, raw_url=None,
         binary_data=None, ct="application/json"):
    url = raw_url or f"{BASE}{path}"
    headers = {"Accept": "application/json", "Content-Type": ct}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if binary_data is not None:
        data = binary_data
        headers["Content-Type"] = ct
    elif body is not None:
        data = json.dumps(body).encode()
    else:
        data = None
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {"_status": r.status}
    except HTTPError as e:
        msg = e.read().decode()
        print(f"  ✗ HTTP {e.code} {method} {url}: {msg[:400]}")
        raise


def get(path, *, token):
    return http("GET", path, token=token)


def post(path, body, *, token):
    return http("POST", path, body, token=token)


def put_file(upload_url, file_path, content_type):
    with open(file_path, "rb") as fh:
        data = fh.read()
    http("PUT", None, raw_url=upload_url, binary_data=data, ct=content_type)


# ── Auth ──────────────────────────────────────────────────────────────────────

def load_admin_token():
    with open(ADMIN_TOKEN_FILE) as fh:
        data = json.load(fh)
        # Support both {"token": "..."} and {"accessToken": "..."}
        return data.get("token") or data["accessToken"]


def dev_login(email):
    return http("POST", "/auth/dev-login", {"email": email})["accessToken"]


# ── AVIF conversion ───────────────────────────────────────────────────────────

def convert_avif_to_jpg(avif_path):
    """Use macOS `sips` to convert AVIF → JPEG (in-place, same dir)."""
    jpg_path = avif_path[:-5] + ".jpg"
    if os.path.exists(jpg_path):
        return jpg_path
    result = subprocess.run(
        ["sips", "-s", "format", "jpeg", avif_path, "--out", jpg_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"sips failed for {avif_path}: {result.stderr.strip()}")
    return jpg_path


# ── Get-or-create helpers ──────────────────────────────────────────────────────

def ensure_color(token, name, hex_code):
    """
    Get-or-create a color.  Hex codes are now globally unique in the DB.

    Lookup order:
      1. Existing list by hexCode (definitive unique key)
      2. Existing list by name
      3. POST to create — if API returns 409 (duplicate hex race), re-fetch
    """
    resp = get("/admin/colors?limit=100", token=token)
    colors = resp["items"]
    by_hex = next((c for c in colors if c["hexCode"].lower() == hex_code.lower()), None)
    if by_hex:
        print(f"  · Color '{name}' ({hex_code}) exists as '{by_hex['name']}'")
        return by_hex["id"]
    by_name = next((c for c in colors if c["name"].lower() == name.lower()), None)
    if by_name:
        print(f"  · Color '{name}' exists")
        return by_name["id"]
    try:
        c = post("/admin/colors", {"name": name, "hexCode": hex_code}, token=token)
        print(f"  ✓ Color '{name}' created  ({hex_code})")
        return c["id"]
    except HTTPError as e:
        if e.code == 409:
            # hex already exists (race condition or prior partial run)
            resp2 = get("/admin/colors?limit=100", token=token)
            existing2 = next(c for c in resp2["items"]
                             if c["hexCode"].lower() == hex_code.lower())
            print(f"  · Color '{name}' ({hex_code}) already exists (409)")
            return existing2["id"]
        raise


def ensure_size(token, name, label, system="universal", position=0):
    resp = get("/admin/sizes?limit=100", token=token)
    existing = next(
        (s for s in resp["items"]
         if s["name"] == name and s["sizeSystem"] == system), None
    )
    if existing:
        print(f"  · Size '{name}' ({system}) exists")
        return existing["id"]
    s = post("/admin/sizes",
             {"name": name, "label": label, "sizeSystem": system,
              "position": position},
             token=token)
    print(f"  ✓ Size '{name}' ({system}) created")
    return s["id"]


def ensure_brand(token, name, slug):
    resp = get("/admin/brands?limit=100", token=token)
    existing = next((b for b in resp["items"]
                     if b["name"].lower() == name.lower()), None)
    if existing:
        print(f"  · Brand '{name}' exists")
        return existing["id"]
    b = post("/admin/brands", {"name": name, "slug": slug}, token=token)
    print(f"  ✓ Brand '{name}' created")
    return b["id"]


def ensure_collection(token, name, slug):
    # Collections endpoint returns a plain array (not paginated)
    resp = get("/admin/collections", token=token)
    items = resp if isinstance(resp, list) else resp.get("items", [])
    existing = next((c for c in items
                     if c["name"].lower() == name.lower()), None)
    if existing:
        print(f"  · Collection '{name}' exists")
        return existing["id"]
    c = post("/admin/collections",
             {"name": name, "slug": slug, "isActive": True, "position": 0},
             token=token)
    print(f"  ✓ Collection '{name}' created")
    return c["id"]


def _walk_tree(cats, flat):
    for c in cats:
        flat[c["slug"]] = c
        if c.get("children"):
            _walk_tree(c["children"], flat)


def get_category_map(token):
    """Returns {slug: category_object} spanning the full tree."""
    tree = get("/admin/categories", token=token)
    flat = {}
    _walk_tree(tree, flat)
    return flat


def ensure_category(token, cats, *, name, slug, level, parent_id=None, gender=None):
    if slug in cats:
        print(f"  · Category '{name}' (L{level}) exists")
        return cats[slug]["id"]
    payload = {
        "name": name, "slug": slug, "level": level,
        "isActive": True, "position": 0,
    }
    if parent_id:
        payload["parentId"] = parent_id
    if gender:
        payload["genderScope"] = gender
    c = post("/admin/categories", payload, token=token)
    print(f"  ✓ Category '{name}' (L{level}) created")
    cats[slug] = c
    return c["id"]


def ensure_filter(token, category_id, name, slug, options):
    """Returns (filter_id, {value: option_id})."""
    resp = get("/admin/filters?limit=100", token=token)
    existing = next(
        (f for f in resp["items"]
         if any(c["categoryId"] == category_id for c in f.get("categories", []))
         and f["slug"] == slug), None
    )
    if existing:
        print(f"  · Filter '{name}' exists")
        return existing["id"], {o["value"]: o["id"] for o in existing["options"]}
    f = post("/admin/filters", {
        "categoryIds": [category_id],
        "name": name,
        "slug": slug,
        "inputType": "multi_select",
        "position": 0,
        "isActive": True,
        "options": [
            {"label": o["label"], "value": o["value"], "position": i}
            for i, o in enumerate(options)
        ],
    }, token=token)
    print(f"  ✓ Filter '{name}' created")
    return f["id"], {o["value"]: o["id"] for o in f["options"]}


# ── Image upload ──────────────────────────────────────────────────────────────

_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
}


def upload_image(client_token, file_path, context="product"):
    """Presign → PUT → return publicUrl."""
    ext = os.path.splitext(file_path)[1].lower()
    content_type = _MIME.get(ext)
    if not content_type:
        raise ValueError(f"Unsupported extension '{ext}' for {file_path}")
    filename = os.path.basename(file_path)
    presign = post("/media/presign",
                   {"filename": filename, "contentType": content_type,
                    "context": context},
                   token=client_token)
    put_file(presign["uploadUrl"], file_path, content_type)
    print(f"  ✓ Uploaded {filename}")
    return presign["publicUrl"]


# ── Product creation ──────────────────────────────────────────────────────────

def create_product(token, payload):
    """Get existing product by slug or create it (paginated, max 100 per page)."""
    slug = payload["slug"]
    cursor = None
    while True:
        url = "/admin/products?limit=100"
        if cursor:
            url += f"&cursor={cursor}"
        resp = http("GET", url, token=token)
        items = resp.get("items", [])
        existing = next((p for p in items if p["slug"] == slug), None)
        if existing:
            print(f"  · Product '{payload['name']}' exists  id={existing['id']}")
            return existing["id"]
        cursor = resp.get("nextCursor")
        if not cursor:
            break
    p = post("/admin/products", payload, token=token)
    print(f"  ✓ Product '{payload['name']}' created  id={p['id']}")
    return p["id"]


# ── Story creation ────────────────────────────────────────────────────────────

def create_story(token, payload):
    """Get existing story by name or create it."""
    resp = http("GET", "/admin/stories?limit=100", token=token)
    items = resp.get("items", resp) if isinstance(resp, dict) else resp
    existing = next((s for s in items if s["name"] == payload["name"]), None)
    if existing:
        print(f"  · Story '{payload['name']}' exists  id={existing['id']}")
        return existing["id"]
    s = post("/admin/stories", payload, token=token)
    print(f"  ✓ Story '{payload['name']}' created  id={s['id']}")
    return s["id"]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    sep = "=" * 65
    print(sep)
    print("  MultiTraders — Product Seeder  (04_seed_products.py)")
    print(sep)

    # ── Auth ──────────────────────────────────────────────────────────────────
    admin_token = load_admin_token()
    print("\n[AUTH] Admin token loaded from /tmp/login.json")
    client_token = dev_login("seeder@multitraders.mz")
    print("[AUTH] Client dev-login → seeder@multitraders.mz")

    # ── 1. Convert AVIF → JPEG ────────────────────────────────────────────────
    print("\n[1/8] Converting AVIF images …")
    avif_names = [
        "SH0030_350_24.avif",
        "SH0030_350_31.avif",
        "SH0030_350_32.avif",
        "SH0030_350_33.avif",
    ]
    shoe_jpgs = {}   # avif_name → converted jpg path
    for avif_name in avif_names:
        avif_path = os.path.join(TEST_DATA, avif_name)
        jpg_path = convert_avif_to_jpg(avif_path)
        shoe_jpgs[avif_name] = jpg_path
        print(f"  ✓ {avif_name} → {os.path.basename(jpg_path)}")

    # ── 2. Colours ────────────────────────────────────────────────────────────
    print("\n[2/8] Ensuring colours …")
    col = {
        "White":    ensure_color(admin_token, "White",    "#FFFFFF"),
        "Black":    ensure_color(admin_token, "Black",    "#000000"),
        "Yellow":   ensure_color(admin_token, "Yellow",   "#F5E14E"),
        "Navy":     ensure_color(admin_token, "Navy",     "#1B2B6B"),
        "Brown":    ensure_color(admin_token, "Brown",    "#6B3A2A"),
        "Cream":    ensure_color(admin_token, "Cream",    "#F5F0E0"),
        "Charcoal": ensure_color(admin_token, "Charcoal", "#36393C"),
        "Green":    ensure_color(admin_token, "Green",    "#3E6B35"),
        "Red":      ensure_color(admin_token, "Red",      "#C0392B"),
    }

    # ── 3. Sizes ──────────────────────────────────────────────────────────────
    print("\n[3/8] Ensuring sizes …")
    sz = {}
    clothing = [
        ("XS", "Extra Small",  "universal", 1),
        ("S",  "Small",        "universal", 2),
        ("M",  "Medium",       "universal", 3),
        ("L",  "Large",        "universal", 4),
        ("XL", "Extra Large",  "universal", 5),
        ("XXL","2X Large",     "universal", 6),
    ]
    shoes = [
        ("38", "EU 38", "EU", 10),
        ("39", "EU 39", "EU", 11),
        ("40", "EU 40", "EU", 12),
        ("41", "EU 41", "EU", 13),
        ("42", "EU 42", "EU", 14),
        ("43", "EU 43", "EU", 15),
        ("44", "EU 44", "EU", 16),
    ]
    for name, label, system, pos in clothing + shoes:
        sz[(name, system)] = ensure_size(admin_token, name, label, system, pos)

    # Convenient size-ID lists
    clth_ids = [sz[(n, "universal")] for n in ["XS", "S", "M", "L", "XL", "XXL"]]
    shoe_ids = [sz[(n, "EU")]        for n in ["38", "39", "40", "41", "42"]]

    # ── 4. Brands ─────────────────────────────────────────────────────────────
    print("\n[4/8] Ensuring brands …")
    brands = {
        "Zara":      ensure_brand(admin_token, "Zara",      "zara"),
        "Redbat":    ensure_brand(admin_token, "Redbat",    "redbat"),
        "Lacoste":   ensure_brand(admin_token, "Lacoste",   "lacoste"),
        "Cotton On": ensure_brand(admin_token, "Cotton On", "cotton-on"),
    }

    # ── 5. Collection ─────────────────────────────────────────────────────────
    print("\n[5/8] Ensuring collection …")
    urban_col = ensure_collection(admin_token, "Urban Essentials", "urban-essentials")

    # ── 6. Category tree ──────────────────────────────────────────────────────
    print("\n[6/8] Ensuring category tree …")
    cats = get_category_map(admin_token)

    # L1 — root categories exist at level 0 (seeded via Prisma), look up by slug
    w_id = ensure_category(admin_token, cats, name="Women", slug="women",
                           level=1, gender="women")
    m_id = ensure_category(admin_token, cats, name="Men",   slug="men",
                           level=1, gender="men")

    # L1 sub (level=1, parent is L0 Women/Men)
    wt_id = ensure_category(admin_token, cats, name="Tops",    slug="women-tops",
                            level=1, parent_id=w_id, gender="women")
    wb_id = ensure_category(admin_token, cats, name="Bottoms", slug="women-bottoms",
                            level=1, parent_id=w_id, gender="women")

    # L1 sub – Men
    mt_id = ensure_category(admin_token, cats, name="Tops",      slug="men-tops",
                            level=1, parent_id=m_id, gender="men")
    mb_id = ensure_category(admin_token, cats, name="Bottoms",   slug="men-bottoms",
                            level=1, parent_id=m_id, gender="men")
    mo_id = ensure_category(admin_token, cats, name="Outerwear", slug="men-outerwear",
                            level=1, parent_id=m_id, gender="men")
    mf_id = ensure_category(admin_token, cats, name="Footwear",  slug="men-footwear",
                            level=1, parent_id=m_id, gender="men")

    # L2 leaf categories (level=2, parent is L1 Tops/Bottoms/etc.)
    wts_id = ensure_category(admin_token, cats, name="T-Shirts",      slug="women-t-shirts",
                             level=2, parent_id=wt_id, gender="women")
    wjg_id = ensure_category(admin_token, cats, name="Joggers",       slug="women-joggers",
                             level=2, parent_id=wb_id, gender="women")
    wwl_id = ensure_category(admin_token, cats, name="Wide-Leg Pants",slug="women-wide-leg",
                             level=2, parent_id=wb_id, gender="women")

    # L2 leaf – Men
    mts_id = ensure_category(admin_token, cats, name="T-Shirts", slug="men-t-shirts",
                             level=2, parent_id=mt_id, gender="men")
    mjg_id = ensure_category(admin_token, cats, name="Joggers",  slug="men-joggers",
                             level=2, parent_id=mb_id, gender="men")
    mjk_id = ensure_category(admin_token, cats, name="Jackets",  slug="men-jackets",
                             level=2, parent_id=mo_id, gender="men")
    msn_id = ensure_category(admin_token, cats, name="Sneakers", slug="men-sneakers",
                             level=2, parent_id=mf_id, gender="men")

    # ── 7. Filters ────────────────────────────────────────────────────────────
    print("\n[7/8] Ensuring attribute filters …")

    tshirt_material_options = [
        {"label": "100% Cotton",      "value": "cotton"},
        {"label": "Cotton-blend",     "value": "cotton-blend"},
        {"label": "Polyester",        "value": "polyester"},
        {"label": "Jersey",           "value": "jersey"},
        {"label": "Mesh / Polyester", "value": "mesh"},
    ]
    tshirt_fit_options = [
        {"label": "Regular",   "value": "regular"},
        {"label": "Slim",      "value": "slim"},
        {"label": "Oversized", "value": "oversized"},
        {"label": "Boxy",      "value": "boxy"},
    ]
    tshirt_neckline_options = [
        {"label": "Crew neck",  "value": "crew-neck"},
        {"label": "V-neck",     "value": "v-neck"},
        {"label": "Round neck", "value": "round-neck"},
    ]

    # Women's T-Shirts filters
    wts_mat_id, wts_mat = ensure_filter(admin_token, wts_id, "Material",
                                        "material", tshirt_material_options)
    wts_fit_id, wts_fit = ensure_filter(admin_token, wts_id, "Fit",
                                        "fit", tshirt_fit_options)
    wts_neck_id, wts_neck = ensure_filter(admin_token, wts_id, "Neckline",
                                          "neckline", tshirt_neckline_options)

    # Men's T-Shirts filters
    mts_mat_id, mts_mat = ensure_filter(admin_token, mts_id, "Material",
                                        "material", tshirt_material_options)
    mts_fit_id, mts_fit = ensure_filter(admin_token, mts_id, "Fit",
                                        "fit", tshirt_fit_options)
    mts_neck_id, mts_neck = ensure_filter(admin_token, mts_id, "Neckline",
                                          "neckline", tshirt_neckline_options)

    # Women's Joggers filters
    wjg_mat_id, wjg_mat = ensure_filter(admin_token, wjg_id, "Material", "material", [
        {"label": "100% Cotton",   "value": "cotton"},
        {"label": "Fleece",        "value": "fleece"},
        {"label": "Polyester mix", "value": "polyester-mix"},
    ])
    wjg_fit_id, wjg_fit = ensure_filter(admin_token, wjg_id, "Fit", "fit", [
        {"label": "Regular", "value": "regular"},
        {"label": "Slim",    "value": "slim"},
        {"label": "Relaxed", "value": "relaxed"},
    ])
    wjg_wb_id, wjg_wb = ensure_filter(admin_token, wjg_id, "Waistband", "waistband", [
        {"label": "Elastic + Drawstring", "value": "elastic-drawstring"},
        {"label": "Elastic only",         "value": "elastic"},
        {"label": "Drawstring only",      "value": "drawstring"},
    ])

    # Women's Wide-Leg Pants filters
    wwl_mat_id, wwl_mat = ensure_filter(admin_token, wwl_id, "Material", "material", [
        {"label": "Fleece",        "value": "fleece"},
        {"label": "100% Cotton",   "value": "cotton"},
        {"label": "Polyester mix", "value": "polyester-mix"},
    ])
    wwl_fit_id, wwl_fit = ensure_filter(admin_token, wwl_id, "Fit", "fit", [
        {"label": "Wide-leg", "value": "wide-leg"},
        {"label": "Relaxed",  "value": "relaxed"},
    ])

    # Men's Joggers filters
    mjg_mat_id, mjg_mat = ensure_filter(admin_token, mjg_id, "Material", "material", [
        {"label": "Polyester",     "value": "polyester"},
        {"label": "Fleece",        "value": "fleece"},
        {"label": "100% Cotton",   "value": "cotton"},
    ])
    mjg_fit_id, mjg_fit = ensure_filter(admin_token, mjg_id, "Fit", "fit", [
        {"label": "Relaxed",  "value": "relaxed"},
        {"label": "Regular",  "value": "regular"},
        {"label": "Slim",     "value": "slim"},
    ])

    # Men's Jackets filters
    mjk_mat_id, mjk_mat = ensure_filter(admin_token, mjk_id, "Material", "material", [
        {"label": "100% Polyester", "value": "polyester"},
        {"label": "Nylon blend",    "value": "nylon-blend"},
        {"label": "Cotton blend",   "value": "cotton-blend"},
    ])
    mjk_clo_id, mjk_clo = ensure_filter(admin_token, mjk_id, "Closure", "closure", [
        {"label": "Full zip",   "value": "full-zip"},
        {"label": "Half zip",   "value": "half-zip"},
        {"label": "Button",     "value": "button"},
    ])
    mjk_sty_id, mjk_sty = ensure_filter(admin_token, mjk_id, "Style", "style", [
        {"label": "Bomber",    "value": "bomber"},
        {"label": "Track",     "value": "track"},
        {"label": "Windbreaker","value": "windbreaker"},
    ])

    # Men's Sneakers filters
    msn_upp_id, msn_upp = ensure_filter(admin_token, msn_id, "Upper Material",
                                        "upper-material", [
        {"label": "Leather",    "value": "leather"},
        {"label": "Synthetic",  "value": "synthetic"},
        {"label": "Canvas",     "value": "canvas"},
        {"label": "Textile",    "value": "textile"},
    ])
    msn_sol_id, msn_sol = ensure_filter(admin_token, msn_id, "Sole", "sole", [
        {"label": "Rubber",   "value": "rubber"},
        {"label": "Foam",     "value": "foam"},
        {"label": "Flat",     "value": "flat"},
    ])

    # ── 8. Upload images + create products ────────────────────────────────────
    print("\n[8/8] Uploading images & creating products …")

    def img(filename):
        """Resolve absolute path for a test_data file."""
        return os.path.join(TEST_DATA, filename)

    def up(filename):
        """Upload a product image and return its public URL."""
        return upload_image(client_token, img(filename), context="product")

    def up_story(filename):
        """Upload a story slide image and return its public URL."""
        return upload_image(client_token, img(filename), context="story")

    # Variants builder helpers
    def variants_c_s(color_id, size_ids, qty=15):
        return [{"colorId": color_id, "sizeId": sid, "stockQuantity": qty}
                for sid in size_ids]

    def media_primary(url, color_id=None, pos=0):
        m = {"url": url, "mediaType": "image", "position": pos, "isPrimary": True}
        if color_id:
            m["colorId"] = color_id
        return m

    def media_extra(url, color_id=None, pos=1):
        m = {"url": url, "mediaType": "image", "position": pos, "isPrimary": False}
        if color_id:
            m["colorId"] = color_id
        return m

    # ── Product 1: Women's Lace-Hem T-Shirt (Zara) ───────────────────────────
    print("\n  → Product 1: Women's Lace-Hem T-Shirt (Zara)")
    p1_url = up("04770151251-p.jpg")
    p1_id = create_product(admin_token, {
        "brandId":       brands["Zara"],
        "collectionId":  urban_col,
        "name":          "Lace-Hem Cotton T-Shirt",
        "slug":          "lace-hem-cotton-tshirt-zara",
        "description":   "Effortlessly chic white T-shirt with delicate lace hem detail. "
                         "Relaxed regular fit crafted from soft 100% cotton.",
        "basePrice":     1290,
        "stockStatus":   "in_stock",
        "isPublished":   True,
        "isVisible":     True,
        "mainColorId":   col["White"],
        "categoryIds":   [wts_id],
        "sizeIds":       clth_ids,
        "variants":      variants_c_s(col["White"], clth_ids),
        "media":         [media_primary(p1_url, col["White"])],
        "keyCharacteristics": [
            {"title": "Fabric", "description": "100% Cotton"},
            {"title": "Fit", "description": "Regular"},
            {"title": "Detail", "description": "Lace hem"},
            {"title": "Neckline", "description": "Crew neck"},
        ],
        "attributes": [
            {"attributeDefinitionId": wts_mat_id,
             "attributeOptionIds": [wts_mat["cotton"]]},
            {"attributeDefinitionId": wts_fit_id,
             "attributeOptionIds": [wts_fit["regular"]]},
            {"attributeDefinitionId": wts_neck_id,
             "attributeOptionIds": [wts_neck["crew-neck"]]},
        ],
    })

    # ── Product 2: Women's Fitted Logo T-Shirt (Redbat) ──────────────────────
    print("\n  → Product 2: Women's Fitted Logo T-Shirt (Redbat)")
    p2_url = up("204720228-1200-1600.webp")
    p2_id = create_product(admin_token, {
        "brandId":      brands["Redbat"],
        "collectionId": urban_col,
        "name":         "Fitted Logo T-Shirt",
        "slug":         "fitted-logo-tshirt-redbat",
        "description":  "Sleek slim-fit T-shirt with embossed Redbat logo on the chest. "
                         "Breathable cotton-blend for all-day comfort.",
        "basePrice":     899,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Black"],
        "categoryIds":  [wts_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Black"], clth_ids),
        "media":        [media_primary(p2_url, col["Black"])],
        "keyCharacteristics": [
            {"title": "Fabric", "description": "Cotton-blend"},
            {"title": "Fit",    "description": "Slim"},
            {"title": "Logo",   "description": "Embossed chest logo"},
        ],
        "attributes": [
            {"attributeDefinitionId": wts_mat_id,
             "attributeOptionIds": [wts_mat["cotton-blend"]]},
            {"attributeDefinitionId": wts_fit_id,
             "attributeOptionIds": [wts_fit["slim"]]},
            {"attributeDefinitionId": wts_neck_id,
             "attributeOptionIds": [wts_neck["crew-neck"]]},
        ],
    })

    # ── Product 3: Women's Slogan Oversized T-Shirt ───────────────────────────
    print("\n  → Product 3: Women's Slogan Oversized T-Shirt (Redbat)")
    p3_url = up("222401871-1200-1600.png")
    p3_id = create_product(admin_token, {
        "brandId":      brands["Redbat"],
        "collectionId": urban_col,
        "name":         "Obsessed to Progress Oversized Tee",
        "slug":         "obsessed-progress-oversized-tee",
        "description":  "Bold statement oversized T-shirt with front graphic print and "
                         "motivational slogan. Drop-shoulder cut for a street-ready look.",
        "basePrice":     999,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Black"],
        "categoryIds":  [wts_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Black"], clth_ids),
        "media":        [media_primary(p3_url, col["Black"])],
        "keyCharacteristics": [
            {"title": "Fabric",  "description": "100% Cotton"},
            {"title": "Fit",     "description": "Oversized / Drop-shoulder"},
            {"title": "Print",   "description": "Motivational front graphic"},
        ],
        "attributes": [
            {"attributeDefinitionId": wts_mat_id,
             "attributeOptionIds": [wts_mat["cotton"]]},
            {"attributeDefinitionId": wts_fit_id,
             "attributeOptionIds": [wts_fit["oversized"]]},
            {"attributeDefinitionId": wts_neck_id,
             "attributeOptionIds": [wts_neck["crew-neck"]]},
        ],
    })

    # ── Product 4: Women's NY #80 Football Jersey (Cotton On) ─────────────────
    print("\n  → Product 4: Women's NY #80 Football Jersey (Cotton On)")
    p4_url = up("222910458-1200-1600.png")
    p4_id = create_product(admin_token, {
        "brandId":      brands["Cotton On"],
        "collectionId": urban_col,
        "name":         "New York #80 Mesh Football Jersey",
        "slug":         "ny-80-mesh-football-jersey",
        "description":  "Retro-inspired oversized mesh football jersey with iconic "
                         "number print. V-neck with striped cuffs, perfect for streetwear styling.",
        "basePrice":     1199,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Cream"],
        "categoryIds":  [wts_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Cream"], clth_ids),
        "media":        [media_primary(p4_url, col["Cream"])],
        "keyCharacteristics": [
            {"title": "Fabric", "description": "100% Polyester mesh"},
            {"title": "Fit",    "description": "Oversized"},
            {"title": "Print",  "description": "New York #80 number print"},
            {"title": "Neckline", "description": "V-neck"},
        ],
        "attributes": [
            {"attributeDefinitionId": wts_mat_id,
             "attributeOptionIds": [wts_mat["mesh"]]},
            {"attributeDefinitionId": wts_fit_id,
             "attributeOptionIds": [wts_fit["oversized"]]},
            {"attributeDefinitionId": wts_neck_id,
             "attributeOptionIds": [wts_neck["v-neck"]]},
        ],
    })

    # ── Product 5: Men's Essential Oversized T-Shirt (Zara) — White + Black ──
    print("\n  → Product 5: Men's Essential Oversized T-Shirt (Zara)  [2 colours]")
    p5_url = up("208419606-1200-1600.png")
    p5_id = create_product(admin_token, {
        "brandId":      brands["Zara"],
        "collectionId": urban_col,
        "name":         "Men's Essential Oversized T-Shirt",
        "slug":         "mens-essential-oversized-tshirt-zara",
        "description":  "Clean oversized T-shirt with subtle embossed logo. "
                         "Relaxed boxy cut in premium 100% cotton. "
                         "Available in White and Black.",
        "basePrice":    1099,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["White"],
        "categoryIds":  [mts_id],
        "sizeIds":      clth_ids,
        # ── 2 colours × 6 sizes = 12 variants ────────────────────────────────
        "variants":     (variants_c_s(col["White"], clth_ids, qty=15) +
                         variants_c_s(col["Black"], clth_ids, qty=12)),
        "media":        [media_primary(p5_url, col["White"])],
        "keyCharacteristics": [
            {"title": "Fabric", "description": "100% Cotton"},
            {"title": "Fit",    "description": "Oversized"},
            {"title": "Logo",   "description": "Subtle embossed chest logo"},
            {"title": "Colors", "description": "White (stock 15/size), Black (stock 12/size)"},
        ],
        "attributes": [
            {"attributeDefinitionId": mts_mat_id,
             "attributeOptionIds": [mts_mat["cotton"]]},
            {"attributeDefinitionId": mts_fit_id,
             "attributeOptionIds": [mts_fit["oversized"]]},
            {"attributeDefinitionId": mts_neck_id,
             "attributeOptionIds": [mts_neck["crew-neck"]]},
        ],
    })

    # ── Product 6: Men's Regular Fit T-Shirt (Cotton On) — White + Black ─────
    print("\n  → Product 6: Men's Regular Fit T-Shirt (Cotton On)  [2 colours]")
    p6_url = up("220436084-1200-1600.png")
    p6_id = create_product(admin_token, {
        "brandId":      brands["Cotton On"],
        "collectionId": urban_col,
        "name":         "Men's Regular Fit Cotton T-Shirt",
        "slug":         "mens-regular-fit-cotton-tshirt",
        "description":  "Everyday wardrobe staple. Regular-fit T-shirt in "
                         "soft breathable cotton. Classic crew neck. "
                         "Available in White and Black.",
        "basePrice":    699,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["White"],
        "categoryIds":  [mts_id],
        "sizeIds":      clth_ids,
        # ── 2 colours × 6 sizes = 12 variants ────────────────────────────────
        "variants":     (variants_c_s(col["White"], clth_ids, qty=20) +
                         variants_c_s(col["Black"], clth_ids, qty=20)),
        "media":        [media_primary(p6_url, col["White"])],
        "keyCharacteristics": [
            {"title": "Fabric", "description": "100% Cotton"},
            {"title": "Fit",    "description": "Regular"},
            {"title": "Colors", "description": "White (stock 20/size), Black (stock 20/size)"},
        ],
        "attributes": [
            {"attributeDefinitionId": mts_mat_id,
             "attributeOptionIds": [mts_mat["cotton"]]},
            {"attributeDefinitionId": mts_fit_id,
             "attributeOptionIds": [mts_fit["regular"]]},
            {"attributeDefinitionId": mts_neck_id,
             "attributeOptionIds": [mts_neck["crew-neck"]]},
        ],
    })

    # ── Product 7: Men's Greatness Graphic T-Shirt (Cotton On) ───────────────
    print("\n  → Product 7: Men's Greatness Graphic T-Shirt (Cotton On)")
    p7_url = up("223613262-1200-1600.png")
    p7_id = create_product(admin_token, {
        "brandId":      brands["Cotton On"],
        "collectionId": urban_col,
        "name":         "Champions Drive for Greatness Back-Print Tee",
        "slug":         "greatness-backprint-tshirt",
        "description":  "Statement T-shirt with elegant back typography print. "
                         "Oversized fit in rich chocolate brown. 100% cotton.",
        "basePrice":    999,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Brown"],
        "categoryIds":  [mts_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Brown"], clth_ids),
        "media":        [media_primary(p7_url, col["Brown"])],
        "keyCharacteristics": [
            {"title": "Fabric",  "description": "100% Cotton"},
            {"title": "Fit",     "description": "Oversized"},
            {"title": "Print",   "description": "Back typography graphic"},
        ],
        "attributes": [
            {"attributeDefinitionId": mts_mat_id,
             "attributeOptionIds": [mts_mat["cotton"]]},
            {"attributeDefinitionId": mts_fit_id,
             "attributeOptionIds": [mts_fit["oversized"]]},
            {"attributeDefinitionId": mts_neck_id,
             "attributeOptionIds": [mts_neck["crew-neck"]]},
        ],
    })

    # ── Product 8: Women's Lacoste Fleece Jogger Pants — Yellow + Black ───────
    # Yellow has 5 dedicated images; Black shares no image but has its own stock
    print("\n  → Product 8: Women's Lacoste Fleece Jogger Pants (5 images, 2 colours)")
    jog_front  = up("XF0343_361_20_0c01568d-6b2c-412b-9413-dfd38c62cefe.webp")
    jog_side   = up("XF0343_361_21_faf432bd-f146-4e67-a505-9a84589fd11e.webp")
    jog_back   = up("XF0343_361_22_1fd8aebb-d377-4d5b-8ec9-dde757968284.webp")
    jog_flat   = up("XF0343_361_24_1cd1d740-c88e-44c8-9dd9-37ad84a05b47.webp")
    jog_life   = up("XF0343_361_L1_6b8a31cd-9c3c-45bc-b2e1-eb3f96e10d4f.webp")

    p8_id = create_product(admin_token, {
        "brandId":      brands["Lacoste"],
        "collectionId": urban_col,
        "name":         "Women's Lacoste Fleece Jogger Pants",
        "slug":         "womens-lacoste-fleece-jogger-pants",
        "description":  "Premium fleece jogger pants crafted by Lacoste. "
                         "Elastic drawstring waist, tapered cuffed leg and signature "
                         "crocodile emblem. Available in Yellow and Black.",
        "basePrice":    5499,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Yellow"],
        "categoryIds":  [wjg_id],
        "sizeIds":      clth_ids,
        # ── 2 colours × 6 sizes = 12 variants  (Yellow per-size, Black per-size) ─
        "variants": (
            # Yellow: XS=10 S=12 M=15 L=10 XL=8 XXL=6
            [{"colorId": col["Yellow"], "sizeId": sz[(n, "universal")], "stockQuantity": q}
             for n, q in [("XS",10),("S",12),("M",15),("L",10),("XL",8),("XXL",6)]] +
            # Black: XS=8 S=10 M=12 L=8 XL=6 XXL=4
            [{"colorId": col["Black"], "sizeId": sz[(n, "universal")], "stockQuantity": q}
             for n, q in [("XS",8),("S",10),("M",12),("L",8),("XL",6),("XXL",4)]]
        ),
        # ── Media: all 5 images tagged Yellow ────────────────────────────────
        "media": [
            media_primary(jog_front, col["Yellow"], pos=0),
            media_extra(jog_side,    col["Yellow"], pos=1),
            media_extra(jog_back,    col["Yellow"], pos=2),
            media_extra(jog_flat,    col["Yellow"], pos=3),
            media_extra(jog_life,    col["Yellow"], pos=4),
        ],
        "keyCharacteristics": [
            {"title": "Fabric",    "description": "Brushed fleece (300 gsm)"},
            {"title": "Fit",       "description": "Regular tapered"},
            {"title": "Waistband", "description": "Elastic + Drawstring"},
            {"title": "Detail",    "description": "Embroidered Lacoste croc logo"},
            {"title": "Pockets",   "description": "Two side zip pockets + back pocket"},
            {"title": "Colors",    "description": "Yellow (stock 10–15/size), Black (stock 4–12/size)"},
        ],
        "attributes": [
            {"attributeDefinitionId": wjg_mat_id,
             "attributeOptionIds": [wjg_mat["fleece"]]},
            {"attributeDefinitionId": wjg_fit_id,
             "attributeOptionIds": [wjg_fit["regular"]]},
            {"attributeDefinitionId": wjg_wb_id,
             "attributeOptionIds": [wjg_wb["elastic-drawstring"]]},
        ],
    })

    # ── Product 9: Men's Lacoste Zip Bomber Jacket ────────────────────────────
    print("\n  → Product 9: Men's Lacoste All-Over Print Zip Jacket")
    p9_url = up("SJ1233_QIE_24.webp")
    p9_id = create_product(admin_token, {
        "brandId":      brands["Lacoste"],
        "collectionId": urban_col,
        "name":         "Men's Lacoste All-Over Print Zip Jacket",
        "slug":         "mens-lacoste-allover-print-zip-jacket",
        "description":  "Navy blue all-over monogram print short jacket from Lacoste. "
                         "Full-zip fastening, stand collar, and bold Lacoste branding. "
                         "A defining piece for streetwear culture.",
        "basePrice":    8999,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Navy"],
        "categoryIds":  [mjk_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Navy"], clth_ids, qty=8),
        "media":        [media_primary(p9_url, col["Navy"])],
        "keyCharacteristics": [
            {"title": "Fabric",  "description": "100% Polyester"},
            {"title": "Fit",     "description": "Regular"},
            {"title": "Closure", "description": "Full zip"},
            {"title": "Print",   "description": "All-over monogram"},
            {"title": "Collar",  "description": "Stand collar"},
        ],
        "attributes": [
            {"attributeDefinitionId": mjk_mat_id,
             "attributeOptionIds": [mjk_mat["polyester"]]},
            {"attributeDefinitionId": mjk_clo_id,
             "attributeOptionIds": [mjk_clo["full-zip"]]},
            {"attributeDefinitionId": mjk_sty_id,
             "attributeOptionIds": [mjk_sty["bomber"]]},
        ],
    })

    # ── Product 10: Men's Lacoste Monogram Track Pants ────────────────────────
    print("\n  → Product 10: Men's Lacoste Monogram Track Pants")
    p10_url = up("XJ1232_4PC_24.webp")
    p10_id = create_product(admin_token, {
        "brandId":      brands["Lacoste"],
        "collectionId": urban_col,
        "name":         "Men's Lacoste Monogram All-Over Print Track Pants",
        "slug":         "mens-lacoste-monogram-track-pants",
        "description":  "Relaxed-fit track pants with full Lacoste diamond monogram print. "
                         "Elastic waist with crocodile patch logo. Straight wide leg silhouette.",
        "basePrice":    7299,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Black"],
        "categoryIds":  [mjg_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Black"], clth_ids, qty=8),
        "media":        [media_primary(p10_url, col["Black"])],
        "keyCharacteristics": [
            {"title": "Fabric",    "description": "Polyester blend"},
            {"title": "Fit",       "description": "Relaxed / Straight"},
            {"title": "Waistband", "description": "Elastic"},
            {"title": "Print",     "description": "All-over diamond monogram"},
        ],
        "attributes": [
            {"attributeDefinitionId": mjg_mat_id,
             "attributeOptionIds": [mjg_mat["polyester"]]},
            {"attributeDefinitionId": mjg_fit_id,
             "attributeOptionIds": [mjg_fit["relaxed"]]},
        ],
    })

    # ── Product 11: Women's Lacoste Wide-Leg Track Pants ─────────────────────
    print("\n  → Product 11: Women's Lacoste Wide-Leg Track Pants (Lifestyle shot)")
    p11_url = up("XF5248_SKB_L1_465b53d7-1cbd-4f5a-85d8-9758a19e3eca.webp")
    p11_id = create_product(admin_token, {
        "brandId":      brands["Lacoste"],
        "collectionId": urban_col,
        "name":         "Women's Lacoste Wide-Leg Track Pants",
        "slug":         "womens-lacoste-wide-leg-track-pants",
        "description":  "Sophisticated wide-leg track pants in deep charcoal. "
                         "Side Lacoste logo, elastic waist, and wide flowing silhouette. "
                         "Pairs effortlessly with blazers or casual separates.",
        "basePrice":    6799,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  col["Charcoal"],
        "categoryIds":  [wwl_id],
        "sizeIds":      clth_ids,
        "variants":     variants_c_s(col["Charcoal"], clth_ids, qty=10),
        "media":        [media_primary(p11_url, col["Charcoal"])],
        "keyCharacteristics": [
            {"title": "Fabric",    "description": "Fleece blend"},
            {"title": "Fit",       "description": "Wide-leg"},
            {"title": "Waistband", "description": "Elastic"},
            {"title": "Logo",      "description": "Side Lacoste patch"},
        ],
        "attributes": [
            {"attributeDefinitionId": wwl_mat_id,
             "attributeOptionIds": [wwl_mat["fleece"]]},
            {"attributeDefinitionId": wwl_fit_id,
             "attributeOptionIds": [wwl_fit["wide-leg"]]},
        ],
    })

    # ── Product 12: Lacoste Classic Sneakers (4 colours from AVIF) ───────────
    print("\n  → Product 12: Lacoste Classic Sneakers (4 colour variants)")
    # AVIF converted to JPEG; assign plausible colours
    shoe_colour_map = {
        "SH0030_350_24.avif": ("White",    col["White"]),
        "SH0030_350_31.avif": ("Navy",     col["Navy"]),
        "SH0030_350_32.avif": ("Green",    col["Green"]),
        "SH0030_350_33.avif": ("Black",    col["Black"]),
    }
    shoe_media   = []
    shoe_variants = []
    first_colour_id = None
    for avif_name, (colour_name, colour_id) in shoe_colour_map.items():
        jpg_path = shoe_jpgs[avif_name]  # already converted path
        shoe_url = upload_image(client_token, jpg_path, context="product")
        is_primary = first_colour_id is None
        shoe_media.append({
            "url":       shoe_url,
            "mediaType": "image",
            "position":  list(shoe_colour_map.keys()).index(avif_name),
            "isPrimary": is_primary,
            "colorId":   colour_id,
        })
        for sid in shoe_ids:
            shoe_variants.append({
                "colorId":       colour_id,
                "sizeId":        sid,
                "stockQuantity": 6,
            })
        if first_colour_id is None:
            first_colour_id = colour_id

    p12_id = create_product(admin_token, {
        "brandId":      brands["Lacoste"],
        "collectionId": urban_col,
        "name":         "Lacoste Classic Leather Sneakers",
        "slug":         "lacoste-classic-leather-sneakers",
        "description":  "Iconic Lacoste low-top sneaker with leather upper and "
                         "textured rubber sole. Timeless silhouette, available in "
                         "White, Navy, Green, and Black.",
        "basePrice":    6499,
        "stockStatus":  "in_stock",
        "isPublished":  True,
        "isVisible":    True,
        "mainColorId":  first_colour_id,
        "categoryIds":  [msn_id],
        "sizeIds":      shoe_ids,
        "variants":     shoe_variants,
        "media":        shoe_media,
        "keyCharacteristics": [
            {"title": "Upper",   "description": "Full-grain leather"},
            {"title": "Sole",    "description": "Textured rubber"},
            {"title": "Lining",  "description": "Textile"},
            {"title": "Closure", "description": "Lace-up"},
        ],
        "attributes": [
            {"attributeDefinitionId": msn_upp_id,
             "attributeOptionIds": [msn_upp["leather"]]},
            {"attributeDefinitionId": msn_sol_id,
             "attributeOptionIds": [msn_sol["rubber"]]},
        ],
    })

    product_ids = {
        "p1": p1_id,  "p2": p2_id,  "p3": p3_id,  "p4": p4_id,
        "p5": p5_id,  "p6": p6_id,  "p7": p7_id,  "p8": p8_id,
        "p9": p9_id,  "p10": p10_id,"p11": p11_id, "p12": p12_id,
    }
    print(f"\n  All 12 products created successfully.")

    # ── Stories ───────────────────────────────────────────────────────────────
    print("\n[→] Creating stories …")

    # Story 1 — 3 slides: Women's Lifestyle Collection
    print("\n  → Story 1: Women's Lifestyle Collection (3 slides)")
    s1_slide1_url = up_story("XF0343_361_L1_6b8a31cd-9c3c-45bc-b2e1-eb3f96e10d4f.webp")
    s1_slide2_url = up_story("XF5248_SKB_L1_465b53d7-1cbd-4f5a-85d8-9758a19e3eca.webp")
    s1_slide3_url = up_story("04770151251-p.jpg")

    story1_id = create_story(admin_token, {
        "name":         "Women's New Arrivals",
        "thumbnailUrl": s1_slide1_url,
        "position":     0,
        "slides": [
            {
                "mediaUrl":   s1_slide1_url,
                "mediaType":  "image",
                "position":   0,
                "productIds": [p8_id],   # Women's Jogger Pants
            },
            {
                "mediaUrl":   s1_slide2_url,
                "mediaType":  "image",
                "position":   1,
                "productIds": [p11_id],  # Women's Wide-Leg Track Pants
            },
            {
                "mediaUrl":   s1_slide3_url,
                "mediaType":  "image",
                "position":   2,
                "productIds": [p1_id, p4_id],  # Lace-Hem Tee + NY Jersey
            },
        ],
    })

    # Story 2 — 5 slides: Urban Street Style
    print("\n  → Story 2: Urban Street Style (5 slides)")
    s2_slide1_url = up_story("SJ1233_QIE_24.webp")
    s2_slide2_url = up_story("XJ1232_4PC_24.webp")
    s2_slide3_url = up_story("222401871-1200-1600.png")
    s2_slide4_url = up_story("223613262-1200-1600.png")
    s2_slide5_url = up_story("208419606-1200-1600.png")

    story2_id = create_story(admin_token, {
        "name":         "Urban Street Style",
        "thumbnailUrl": s2_slide1_url,
        "position":     1,
        "slides": [
            {
                "mediaUrl":   s2_slide1_url,
                "mediaType":  "image",
                "position":   0,
                "productIds": [p9_id],       # Men's Lacoste Zip Jacket
            },
            {
                "mediaUrl":   s2_slide2_url,
                "mediaType":  "image",
                "position":   1,
                "productIds": [p10_id],      # Men's Monogram Track Pants
            },
            {
                "mediaUrl":   s2_slide3_url,
                "mediaType":  "image",
                "position":   2,
                "productIds": [p3_id],       # Women's Slogan Oversized Tee
            },
            {
                "mediaUrl":   s2_slide4_url,
                "mediaType":  "image",
                "position":   3,
                "productIds": [p7_id],       # Men's Greatness Graphic Tee
            },
            {
                "mediaUrl":   s2_slide5_url,
                "mediaType":  "image",
                "position":   4,
                "productIds": [p5_id, p6_id],  # Men's Oversized + Regular Tee
            },
        ],
    })

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + sep)
    print("  SEEDING COMPLETE")
    print(sep)
    print(f"  Colours created/verified : {len(col)}  (hex uniqueness enforced)")
    print(f"  Sizes created/verified   : {len(sz)}")
    print(f"  Brands created/verified  : {len(brands)}")
    print(f"  Categories (L0-L2)       : 14 nodes")
    print(f"  Attribute filters        : 14 definitions")
    print(f"  Products                 : {len(product_ids)}")
    print(f"  Multi-colour products    : P5 (White+Black 12v), P6 (White+Black 12v),")
    print(f"                             P8 (Yellow+Black 12v), P12 (4 colours 20v)")
    print(f"  Stories                  : 2  (3 slides + 5 slides)")
    print()
    print("  Product IDs:")
    for key, pid in product_ids.items():
        print(f"    {key}: {pid}")
    print()
    print(f"  Story 1 (Women's New Arrivals) : {story1_id}")
    print(f"  Story 2 (Urban Street Style)   : {story2_id}")
    print(sep)


if __name__ == "__main__":
    main()
