"""
02_simulate.py — Full 15-step admin creation flow.

Run AFTER 01_login.py (requires /tmp/login.json with a valid JWT).

Usage:
    python3 docs/simulation/02_simulate.py

Requirements:
    - API running on http://localhost:3001
    - /tmp/login.json created by 01_login.py
    - Seeded database (default seed provides Women category, Red/Black colors, S/M/L sizes)

Steps:
    1.  Find seeded Women root category
    2.  Create / fix  Dresses category  (level 1, under Women)
    3.  Create Midi Dresses category    (level 2, under Dresses)
    4.  Reuse seeded Red + Black colors  (hex-unique: lookup by hex if name absent)
    5.  Reuse seeded S / M / L sizes
    6.  Create brand: Zara
    7.  Create collection: Summer 2026
    8.  Create attribute filter: Material  (Satin | Crepe | Chiffon)
    9.  Create product: Zara Satin Midi Dress
          — 6 variants across 2 colors × 3 sizes (Red S/M/L + Black S/M/L)
          — 3 media (2 Red, 1 Black)
          — 1 attribute (Material = Satin)
    10. Add supplier cost record
    11. Add 3 competitor price records
    12. Read financial report
    13. Read full admin product detail — shows all color/size/stock combos
    14. Verify public catalog: product by slug
    15. Verify public catalog: category product listing
"""

import json, urllib.request, urllib.error

BASE = "http://localhost:3001/api/v1"
TOKEN = json.load(open('/tmp/login.json'))['token']

def req(method, path, body=None, auth=True):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        print(f"\n!!! ERROR {e.code} {method} {path}\n{body_txt}\n")
        raise

def sep(title):
    print(f"\n{'━'*56}\n  {title}\n{'━'*56}")

def _flatten(cats, out):
    for c in cats:
        out[c['slug']] = c
        if c.get('children'):
            _flatten(c['children'], out)

def get_all_cats():
    tree = req("GET", "/admin/categories")
    flat = {}
    _flatten(tree, flat)
    return flat

def get_or_create_color(colors_list, name, hex_code):
    """
    Return existing color id by name OR by hexCode.
    If neither exists, create it.
    Hex codes are globally unique — new API rejects 409 on duplicate hex.
    """
    by_name = next((c for c in colors_list if c['name'].lower() == name.lower()), None)
    if by_name:
        return by_name['id']
    by_hex = next((c for c in colors_list if c['hexCode'].lower() == hex_code.lower()), None)
    if by_hex:
        return by_hex['id']
    color = req("POST", "/admin/colors", {"name": name, "hexCode": hex_code})
    print(f"  Created color '{name}' ({hex_code})  id={color['id']}")
    return color['id']

# ── STEP 1 ──────────────────────────────────────────────────────
sep("STEP 1  Find seeded Women root category")
cats_tree = req("GET", "/admin/categories?search=Women")
WOMEN_ID = next(c['id'] for c in cats_tree if c['name'] == 'Women')
print(f"  Women ID: {WOMEN_ID}")

# ── STEP 2 ──────────────────────────────────────────────────────
sep("STEP 2  Category: Women > Dresses  (level 1)")
all_cats = get_all_cats()  # full flat map {slug: cat}
existing_dresses = all_cats.get('dresses')
if existing_dresses:
    req("PATCH", f"/admin/categories/{existing_dresses['id']}", {
        "parentId": WOMEN_ID, "level": 1
    })
    print(f"  Fixed existing Dresses: {existing_dresses['id']}")
    DRESSES_ID = existing_dresses['id']
else:
    dresses = req("POST", "/admin/categories", {
        "name": "Dresses", "slug": "dresses", "level": 1,
        "parentId": WOMEN_ID, "position": 0, "isActive": True
    })
    print(json.dumps(dresses, indent=2))
    DRESSES_ID = dresses['id']
print(f"  Dresses ID: {DRESSES_ID}")

# ── STEP 3 ──────────────────────────────────────────────────────
sep("STEP 3  Category: Women > Dresses > Midi Dresses  (level 2)")
existing_midi = all_cats.get('midi-dresses')
if existing_midi:
    MIDI_ID = existing_midi['id']
    print(f"  Reusing existing Midi Dresses: {MIDI_ID}")
else:
    midi = req("POST", "/admin/categories", {
        "name": "Midi Dresses", "slug": "midi-dresses", "level": 2,
        "parentId": DRESSES_ID, "position": 0, "isActive": True
    })
    print(json.dumps(midi, indent=2))
    MIDI_ID = midi['id']
print(f"  Midi Dresses ID: {MIDI_ID}")

# ── STEP 4 ──────────────────────────────────────────────────────
sep("STEP 4  Colors — Red + Black  (hex-unique: get-or-create by hex)")
colors_resp = req("GET", "/admin/colors?limit=100")
colors_list = colors_resp['items']
RED_ID   = get_or_create_color(colors_list, "Red",   "#C0392B")
BLACK_ID = get_or_create_color(colors_list, "Black", "#000000")
print(f"  Red ID={RED_ID}  Black ID={BLACK_ID}")
# Fetch actual hex assigned to Red (may differ if seeded DB used #FF0000 etc.)
red_hex = next(c['hexCode'] for c in req("GET", "/admin/colors?limit=100")['items']
               if c['id'] == RED_ID)
# Demonstrate that submitting the same hex again returns 409
try:
    req("POST", "/admin/colors", {"name": "DupTestColor", "hexCode": red_hex})
    print(f"  WARN: expected 409 for duplicate hex {red_hex} but got success")
except urllib.error.HTTPError as e:
    if e.code == 409:
        print(f"  ✓ 409 Conflict correctly rejected duplicate hex {red_hex}")
    else:
        raise

# ── STEP 5 ──────────────────────────────────────────────────────
sep("STEP 5  Seeded sizes S / M / L  (response shape: { items: [] })")
slist = req("GET", "/admin/sizes")['items']
SIZE_S = next(s['id'] for s in slist if s['name'] == 'S')
SIZE_M = next(s['id'] for s in slist if s['name'] == 'M')
SIZE_L = next(s['id'] for s in slist if s['name'] == 'L')
print(f"  S={SIZE_S}\n  M={SIZE_M}\n  L={SIZE_L}")

# ── STEP 6 ──────────────────────────────────────────────────────
sep("STEP 6  Brand: Zara")
all_brands = req("GET", "/admin/brands?limit=100")['items']
existing_brand = next((b for b in all_brands if b['name'] == 'Zara'), None)
if existing_brand:
    BRAND_ID = existing_brand['id']
    print(f"  Reusing existing Zara brand: {BRAND_ID}")
else:
    brand = req("POST", "/admin/brands", {
        "name": "Zara", "slug": "zara", "categoryIds": [DRESSES_ID]
    })
    print(json.dumps(brand, indent=2))
    BRAND_ID = brand['id']

# ── STEP 7 ──────────────────────────────────────────────────────
sep("STEP 7  Collection: Summer 2026")
all_colls = req("GET", "/admin/collections")
existing_coll = next((c for c in (all_colls if isinstance(all_colls, list) else all_colls.get('items', []))
                      if c['name'] == 'Summer 2026'), None)
if existing_coll:
    COLL_ID = existing_coll['id']
    print(f"  Reusing existing collection: {COLL_ID}")
else:
    coll = req("POST", "/admin/collections", {
        "name": "Summer 2026", "slug": "summer-2026", "position": 1
    })
    print(json.dumps(coll, indent=2))
    COLL_ID = coll['id']

# ── STEP 8 ──────────────────────────────────────────────────────
sep("STEP 8  Attribute filter: Material (Satin | Crepe | Chiffon)")
existing_filters = req("GET", "/admin/filters?limit=100")['items']
existing_filter = next(
    (f for f in existing_filters
     if any(c['categoryId'] == DRESSES_ID for c in f.get('categories', []))
     and f['slug'] == 'material'), None
)
if existing_filter:
    FILTER_DEF_ID = existing_filter['id']
    SATIN_OPT_ID  = next(o['id'] for o in existing_filter['options'] if o['value'] == 'satin')
    print(f"  Reusing existing Material filter: {FILTER_DEF_ID}")
else:
    filt = req("POST", "/admin/filters", {
        "categoryIds": [DRESSES_ID],
        "name": "Material",
        "slug": "material",
        "inputType": "multi_select",
        "position": 0,
        "isActive": True,
        "options": [
            {"label": "Satin",   "value": "satin",   "position": 0},
            {"label": "Crepe",   "value": "crepe",   "position": 1},
            {"label": "Chiffon", "value": "chiffon", "position": 2},
        ]
    })
    print(json.dumps(filt, indent=2))
    FILTER_DEF_ID = filt['id']
    SATIN_OPT_ID  = next(o['id'] for o in filt['options'] if o['value'] == 'satin')

# ── STEP 9 ──────────────────────────────────────────────────────
sep("STEP 9  Create product: Zara Satin Midi Dress\n"
    "         2 colors × 3 sizes = 6 variants  (Red S/M/L + Black S/M/L)")
all_products = req("GET", "/admin/products?limit=100")['items']
existing_product = next((p for p in all_products if p['slug'] == 'zara-satin-midi-dress'), None)
if existing_product:
    PRODUCT_ID = existing_product['id']
    print(f"  Reusing existing product: {PRODUCT_ID}")
else:
    product = req("POST", "/admin/products", {
        "brandId":      BRAND_ID,
        "collectionId": COLL_ID,
        "name":         "Zara Satin Midi Dress",
        "slug":         "zara-satin-midi-dress",
        "description":  "Elegant satin midi dress with wrap front and flutter sleeves. Perfect for formal occasions and evening events.",
        "basePrice":    3500,
        "hasDiscount":  True,
        "discountPrice": 2800,
        "isIndicativePrice": False,
        "isPublished":  True,
        "isVisible":    True,
        "stockStatus":  "in_stock",
        "mainColorId":  RED_ID,
        "metaTitle":    "Zara Satin Midi Dress | Summer 2026",
        "metaDescription": "Elegant wrap-front satin midi dress. Shop the Summer 2026 collection.",
        "categoryIds": [MIDI_ID, DRESSES_ID],
        "sizeIds":     [SIZE_S, SIZE_M, SIZE_L],
        # ── Multi-color variants: Red × S/M/L  +  Black × S/M/L ──────────────
        "variants": [
            {"colorId": RED_ID,   "sizeId": SIZE_S, "stockQuantity": 8},
            {"colorId": RED_ID,   "sizeId": SIZE_M, "stockQuantity": 12},
            {"colorId": RED_ID,   "sizeId": SIZE_L, "stockQuantity": 5},
            {"colorId": BLACK_ID, "sizeId": SIZE_S, "stockQuantity": 6},
            {"colorId": BLACK_ID, "sizeId": SIZE_M, "stockQuantity": 10},
            {"colorId": BLACK_ID, "sizeId": SIZE_L, "stockQuantity": 4},
        ],
        # ── Per-color media ───────────────────────────────────────────────────
        "media": [
            {"url": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800",
             "mediaType": "image", "position": 0, "isPrimary": True,  "colorId": RED_ID},
            {"url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800",
             "mediaType": "image", "position": 1, "isPrimary": False, "colorId": RED_ID},
            {"url": "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=800",
             "mediaType": "image", "position": 2, "isPrimary": False, "colorId": BLACK_ID},
        ],
        "attributes": [
            {"attributeDefinitionId": FILTER_DEF_ID, "attributeOptionIds": [SATIN_OPT_ID]}
        ],
        "keyCharacteristics": [
            {"title": "Fabric",  "description": "100% Satin polyester, luxuriously smooth finish"},
            {"title": "Fit",     "description": "Wrap-front silhouette with adjustable tie-waist"},
            {"title": "Length",  "description": "Midi, falls to mid-calf (~110 cm from shoulder)"},
            {"title": "Sleeves", "description": "Flutter sleeves, elegant and feminine"},
        ],
        "returnPolicy": [
            {"title": "Return Window", "description": "30 days from delivery date"},
            {"title": "Condition",     "description": "Unworn and unwashed with original tags attached"},
        ]
    })
    print(json.dumps(product, indent=2))
    PRODUCT_ID = product['id']

# ── STEP 10 ─────────────────────────────────────────────────────
sep("STEP 10  Supplier cost (financial analysis)")
existing_financial = req("GET", f"/admin/products/{PRODUCT_ID}/financial")
if existing_financial['suppliers']:
    print(f"  Reusing existing supplier: {existing_financial['suppliers'][0]['id']}")
else:
    supplier = req("POST", f"/admin/products/{PRODUCT_ID}/suppliers", {
        "supplierName":      "Guangzhou Textile Co.",
        "supplierLink":      "https://www.alibaba.com/product-detail/satin-midi-dress",
        "supplierPrice":     1200,
        "priceWithDelivery": 1450,
        "deliveryTax":       180,
        "otherCosts":        70,
        "notes":             "MOQ 30 units, lead time 45 days — Alibaba verified supplier"
    })
    print(json.dumps(supplier, indent=2))

# ── STEP 11 ─────────────────────────────────────────────────────
sep("STEP 11  Competitor prices")
existing_financial2 = req("GET", f"/admin/products/{PRODUCT_ID}/financial")
if existing_financial2['competitors']:
    print(f"  Reusing {len(existing_financial2['competitors'])} existing competitor(s)")
else:
    for comp in [
        {"link": "https://www2.hm.com/en_mol/productpage.satin-midi-dress.html",
         "price": 3200, "comments": "Lower quality fabric, no lining — avg 3.8/5"},
        {"link": "https://www.woolworths.co.za/cat/Women/Dresses/Midi-Dresses/satin-dress",
         "price": 4100, "comments": "Higher quality lining and finish — avg 4.5/5"},
        {"link": "https://shop.mango.com/mz/women/dresses/midi-satin-dress",
         "price": 3750, "comments": "Similar quality, narrower size range — avg 4.1/5"},
    ]:
        c = req("POST", f"/admin/products/{PRODUCT_ID}/competitors", comp)
        print(f"  {c['id']}  price={c['price']}  link={c['link']}")

# ── STEP 12 ─────────────────────────────────────────────────────
sep("STEP 12  Financial report")
fin = req("GET", f"/admin/products/{PRODUCT_ID}/financial")
print(json.dumps(fin, indent=2))

# ── STEP 13 ─────────────────────────────────────────────────────
sep("STEP 13  Full admin product detail — all color/size/stock combos")
# GET /:id returns slim data (IDs only for variants/categories/sizes/attributes);
# use the sub-endpoints to retrieve full relational objects.
full     = req("GET", f"/admin/products/{PRODUCT_ID}")
variants = req("GET", f"/admin/products/{PRODUCT_ID}/variants")
cats     = req("GET", f"/admin/products/{PRODUCT_ID}/categories")
media    = req("GET", f"/admin/products/{PRODUCT_ID}/media")
print(f"  name         : {full['name']}")
print(f"  slug         : {full['slug']}")
print(f"  brand        : {full['brand']['name']}")
print(f"  collection   : {full['collection']['name']}")
print(f"  basePrice    : {full['basePrice']} MZN")
print(f"  discountPrice: {full['discountPrice']} MZN")
print(f"  isPublished  : {full['isPublished']}")
print(f"  stockStatus  : {full['stockStatus']}")
print(f"  categories   : {[c['name'] for c in cats]}")
print(f"  variants ({len(variants)} total — colour × size matrix):")
for v in sorted(variants, key=lambda x: (x['color']['name'], x['size']['name'])):
    print(f"    {v['color']['name']:10} {v['color']['hexCode']}  /  {v['size']['name']:4}  stock={v['stockQuantity']:3}  sku={v['sku']}")
print(f"  media files  : {len(media)}")
for m in media:
    color_name = m['color']['name'] if m.get('color') else 'untagged'
    print(f"    pos={m['position']}  primary={m['isPrimary']}  color={color_name}")
print(f"  attributes   : {[(a['attributeDefinitionId'], a['attributeOptionId']) for a in full['attributes']]}")
print(f"  sizes        : {[ps['sizeId'] for ps in full['sizes']]}")

# ── STEP 14 ─────────────────────────────────────────────────────
sep("STEP 14  Public catalog: GET /catalog/products/zara-satin-midi-dress")
pub = req("GET", "/catalog/products/zara-satin-midi-dress", auth=False)
print(json.dumps(pub, indent=2))

# ── STEP 15 ─────────────────────────────────────────────────────
sep("STEP 15  Public catalog: GET /catalog/categories/midi-dresses/products")
listing = req("GET", "/catalog/categories/midi-dresses/products", auth=False)
items = listing.get('items') if isinstance(listing, dict) else listing
print(f"  {len(items)} product(s) found:")
for p in items:
    print(f"    {p['name']}  {p['basePrice']} MZN")

# ── SUMMARY ─────────────────────────────────────────────────────
print()
print("=" * 62)
print("  E2E SIMULATION COMPLETE")
print("=" * 62)
print(f"  Product ID   : {PRODUCT_ID}")
print(f"  Name         : Zara Satin Midi Dress")
print(f"  Brand        : Zara")
print(f"  Collection   : Summer 2026")
print(f"  Category tree: Women > Dresses > Midi Dresses")
print(f"  Colors       : Red (#C0392B) + Black (#000000)  — 2 distinct hex codes")
print(f"  Variants     : 6  (Red × S/M/L  +  Black × S/M/L)")
print(f"  Total stock  : 45 units")
print(f"  Price        : 3500 MZN → 2800 MZN (20% discount)")
print(f"  Supplier     : Guangzhou Textile Co. @ 1200 MZN (+ 250 logistics)")
print(f"  Competitors  : H&M 3200 | Mango 3750 | Woolworths 4100")
print(f"  Media        : 3 images (2 Red, 1 Black — colour-tagged)")
print(f"  Attributes   : Material = Satin")
print("=" * 62)
