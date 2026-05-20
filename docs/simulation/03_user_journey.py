"""
03_user_journey.py — Full end-to-end user journey simulation.

Steps:
  1.  Client authenticates via dev bypass  (POST /auth/dev-login)
  2.  Browse catalog: category tree
  3.  Product listing in Midi Dresses
  4.  View product detail by slug
  5.  Add two variants to cart
  6.  View cart
  7.  Start a conversation with a message to admin
  8.  Admin sees the new conversation in the inbox
  9.  Admin reads conversation messages
  10. Admin views the user's cart via GET /admin/clients/:id/cart
  11. Admin replies to the user
  12. Real-time delivery note (Socket.io — logged, not live in script)
  13. Admin creates an order from the conversation + cart items
  14. Admin: pending → paid  (stock deducted)
  15. Admin: paid → in_process
  16. Admin: in_process → in_transit
  17. Admin: in_transit → delivered
  18. User fetches order list
  19. User fetches order detail

Run AFTER 01_login.py and 02_simulate.py.

Requirements:
    - API running on http://localhost:3001
    - /tmp/login.json created by 01_login.py
    - NODE_ENV != 'production'  (dev-login must be enabled)
    - Zara Satin Midi Dress product already published (02_simulate.py)
"""

import json
import urllib.request
import urllib.error

BASE = "http://localhost:3001/api/v1"
ADMIN_TOKEN = json.load(open("/tmp/login.json"))["token"]


def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {}
    if data:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        print(f"\n!!! ERROR {e.code} {method} {path}\n{body_txt}\n")
        raise


def sep(title):
    print(f"\n{'━'*60}\n  {title}\n{'━'*60}")


# ── STEP 1 ────────────────────────────────────────────────────────────────────
sep("STEP 1  Client authentication  [POST /auth/dev-login]")
user_resp = req("POST", "/auth/dev-login", {"email": "testuser@simulation.mz"})
USER_TOKEN = user_resp["accessToken"]
USER_ID    = user_resp["user"]["id"]
print(f"  User ID   : {USER_ID}")
print(f"  Email     : {user_resp['user']['email']}")

# ── STEP 2 ────────────────────────────────────────────────────────────────────
sep("STEP 2  Browse catalog — GET /catalog/categories")
categories = req("GET", "/catalog/categories")
root_names = [c["name"] for c in categories]
print(f"  Root categories: {root_names}")

women = next(c for c in categories if c["name"] == "Women")
dresses_child = next(
    (c for c in women.get("children", []) if c["name"] == "Dresses"), None
)
midi_child = None
if dresses_child:
    midi_child = next(
        (c for c in dresses_child.get("children", []) if c["name"] == "Midi Dresses"),
        None,
    )
TARGET_SLUG = midi_child["slug"] if midi_child else "midi-dresses"
print(f"  Women → Dresses → Midi Dresses slug: {TARGET_SLUG}")

# ── STEP 3 ────────────────────────────────────────────────────────────────────
sep("STEP 3  Product listing — GET /catalog/categories/midi-dresses/products")
listing = req("GET", f"/catalog/categories/{TARGET_SLUG}/products?limit=5&sort=newest")
print(f"  Products returned: {len(listing['items'])}")
first_product = listing["items"][0]
PRODUCT_SLUG = first_product["slug"]
PRODUCT_ID   = first_product["id"]
print(f"  First product : {first_product['name']}")
print(f"  Slug          : {PRODUCT_SLUG}")
print(f"  Base price    : {first_product['basePrice']} MZN")
print(f"  Discount price: {first_product.get('discountPrice')} MZN")

# ── STEP 4 ────────────────────────────────────────────────────────────────────
sep("STEP 4  Product detail — GET /catalog/products/:slug")
product = req("GET", f"/catalog/products/{PRODUCT_SLUG}")
print(f"  Name     : {product['name']}")
print(f"  Brand    : {product['brand']['name']}")

variants = product["variants"]
print(f"  Variants : {len(variants)} total  (multi-color product)")
# Group by color to show the color × size matrix
colors_seen: dict = {}
for v in variants:
    cn = v["color"]["name"]
    if cn not in colors_seen:
        colors_seen[cn] = {"hex": v["color"]["hexCode"], "sizes": []}
    colors_seen[cn]["sizes"].append(v["size"]["name"])
for cn, info in colors_seen.items():
    print(f"    {cn:12} {info['hex']}  sizes={info['sizes']}")

# Prefer Red/M + Black/S (created by 02_simulate.py).  Fall back to any two
# in-stock variants from different colors to keep the script self-contained.
in_stock = [v for v in variants if v["stockQuantity"] > 0]
var1 = next((v for v in in_stock if v["color"]["name"] == "Red"   and v["size"]["name"] == "M"), None)
var2 = next((v for v in in_stock if v["color"]["name"] == "Black" and v["size"]["name"] == "S"), None)
if not var1 or not var2:
    # Fallback: pick two in-stock variants from different colors
    color_variants: dict = {}
    for v in in_stock:
        cn = v["color"]["name"]
        if cn not in color_variants:
            color_variants[cn] = v
    distinct = list(color_variants.values())
    if len(distinct) < 2:
        raise RuntimeError("Need ≥2 in-stock colour variants — run 02_simulate.py first")
    var1, var2 = distinct[0], distinct[1]
print(f"  → Cart demo: {var1['color']['name']}/{var1['size']['name']} ({var1['color']['hexCode']})  +  {var2['color']['name']}/{var2['size']['name']} ({var2['color']['hexCode']})")
print(f"    Var1 stock={var1['stockQuantity']}  id={var1['id']}")
print(f"    Var2 stock={var2['stockQuantity']}  id={var2['id']}")

# ── STEP 5 ────────────────────────────────────────────────────────────────────
sep("STEP 5  Add to cart — two items from different colors")
# Clear any stale items from prior runs before adding fresh ones
req("DELETE", "/cart", token=USER_TOKEN)
print("  Cart cleared (idempotent reset)")
cart1 = req("POST", "/cart/items",
    {"productVariantId": var1["id"], "quantity": 1}, token=USER_TOKEN)
print(f"  Added {var1['color']['name']}/{var1['size']['name']} (qty=1)  → cart item: {cart1['id']}")

cart2 = req("POST", "/cart/items",
    {"productVariantId": var2["id"], "quantity": 2}, token=USER_TOKEN)
print(f"  Added {var2['color']['name']}/{var2['size']['name']} (qty=2)  → cart item: {cart2['id']}")

# ── STEP 6 ────────────────────────────────────────────────────────────────────
sep("STEP 6  View cart — GET /cart")
cart = req("GET", "/cart", token=USER_TOKEN)
print(f"  Items    : {len(cart['items'])}")
print(f"  Subtotal : {cart['subtotal']} MZN")
for item in cart["items"]:
    p     = item["variant"]["product"]
    color = item["variant"]["color"]["name"]
    size  = item["variant"]["size"]["name"]
    price = p.get("discountPrice") or p["basePrice"]
    print(f"    • {p['name']}  {color}/{size}  qty={item['quantity']}  unit={price} MZN")

# ── STEP 7 ────────────────────────────────────────────────────────────────────
sep("STEP 7  User starts conversation — POST /chats/conversations")
msg_text = (f"Hi! I've added {var1['color']['name']}/{var1['size']['name']} and "
            f"{var2['color']['name']}/{var2['size']['name']} to my cart. "
            f"Can you confirm availability and delivery time to Maputo?")
conv_resp = req(
    "POST", "/chats/conversations",
    {"message": msg_text},
    token=USER_TOKEN,
)
CONV_ID = conv_resp["id"]
print(f"  Conversation ID : {CONV_ID}")

# Verify the message was persisted (fix for Bug 4 — re-entry no longer drops message)
msgs_check = req("GET", f"/chats/conversations/{CONV_ID}/messages", token=USER_TOKEN)
print(f"  Messages saved  : {len(msgs_check['items'])}")
print(f"  Last message    : {msgs_check['items'][-1]['content'][:70]}")

# ── STEP 8 ────────────────────────────────────────────────────────────────────
sep("STEP 8  Admin inbox — GET /admin/chats")
inbox = req("GET", "/admin/chats", token=ADMIN_TOKEN)
target_conv = next((c for c in inbox.get("items", []) if c["id"] == CONV_ID), None)
print(f"  Conversations in inbox: {len(inbox['items'])}")
if target_conv:
    print(f"  Found conversation:")
    print(f"    user        : {target_conv['user']['name']}")
    print(f"    unreadCount : {target_conv['unreadCount']}")
    print(f"    lastMessage : {(target_conv.get('lastMessage') or {}).get('content', '—')[:60]}")

# ── STEP 9 ────────────────────────────────────────────────────────────────────
sep("STEP 9  Admin reads messages — GET /admin/chats/:id/messages")
messages_resp = req("GET", f"/admin/chats/{CONV_ID}/messages", token=ADMIN_TOKEN)
messages = messages_resp.get("items", [])
print(f"  Messages: {len(messages)}")
for m in messages:
    label = "USER " if m["senderType"] == "user" else "ADMIN"
    print(f"    [{label}] {m['content'][:80]}")

# ── STEP 10 ───────────────────────────────────────────────────────────────────
sep("STEP 10  Admin views user cart — GET /admin/clients/:id/cart")
admin_cart = req("GET", f"/admin/clients/{USER_ID}/cart", token=ADMIN_TOKEN)
print(f"  Items    : {len(admin_cart['items'])}")
print(f"  Subtotal : {admin_cart['subtotal']} MZN")
for item in admin_cart["items"]:
    p     = item["variant"]["product"]
    color = item["variant"]["color"]["name"]
    size  = item["variant"]["size"]["name"]
    price = p.get("discountPrice") or p["basePrice"]
    print(f"    • {p['name']}  {color}/{size}  qty={item['quantity']}  unit={price} MZN  sku={item['variant']['sku']}")

# ── STEP 11 ───────────────────────────────────────────────────────────────────
sep("STEP 11  Admin replies — POST /admin/chats/:id/messages")
reply_text = (f"Hello! Both {var1['color']['name']}/{var1['size']['name']} and "
              f"{var2['color']['name']}/{var2['size']['name']} are available. "
              f"Delivery is 2–3 business days in Maputo. Would you like to proceed?")
admin_msg = req(
    "POST", f"/admin/chats/{CONV_ID}/messages",
    {"content": reply_text},
    token=ADMIN_TOKEN,
)
print(f"  Admin message ID : {admin_msg['id']}")
print(f"  Content          : {admin_msg['content'][:100]}")

# ── STEP 12 ───────────────────────────────────────────────────────────────────
sep("STEP 12  Real-time delivery")
print("  Socket.io emits 'message:new' to room user:{USER_ID}")
print("  Mobile app would display an in-chat notification.")
print("  (Full offline push requires fcmTokens on User model — not yet implemented)")

# ── STEP 13 ───────────────────────────────────────────────────────────────────
sep("STEP 13  Admin creates order — POST /admin/orders")
order_items = []
for item in admin_cart["items"]:
    p     = item["variant"]["product"]
    price = int(p.get("discountPrice") or p["basePrice"])
    order_items.append({
        "productId":        p["id"],
        "productVariantId": item["variant"]["id"],
        "quantity":         item["quantity"],
        "unitPrice":        price,
    })

order = req(
    "POST", "/admin/orders",
    {"conversationId": CONV_ID, "userId": USER_ID, "shippingCost": 150, "items": order_items},
    token=ADMIN_TOKEN,
)
ORDER_ID = order["id"]
print(f"  Order ID  : {ORDER_ID}")
print(f"  Status    : {order['status']}")
print(f"  Subtotal  : {order['subtotal']} MZN")
print(f"  Shipping  : {order['shippingCost']} MZN")
print(f"  Total     : {order['total']} MZN")

# ── STEP 14 ───────────────────────────────────────────────────────────────────
sep("STEP 14  Admin: pending → paid  (stock deducted)")
paid_order = req("PATCH", f"/admin/orders/{ORDER_ID}/status", {"status": "paid"}, token=ADMIN_TOKEN)
print(f"  Status: {paid_order['status']}")

# Validate state machine: assert invalid jump is blocked
sep("STEP 14b  State-machine guard: paid → delivered must be rejected (409)")
try:
    req("PATCH", f"/admin/orders/{ORDER_ID}/status", {"status": "delivered"}, token=ADMIN_TOKEN)
    print("  ✗ ERROR — invalid transition was NOT blocked")
except urllib.error.HTTPError as e:
    if e.code == 409:
        print(f"  ✓ Correctly rejected with 409: {e.read().decode()[:80]}")
    else:
        raise

# ── STEP 15 ───────────────────────────────────────────────────────────────────
sep("STEP 15  Admin: paid → in_process")
in_process = req("PATCH", f"/admin/orders/{ORDER_ID}/status", {"status": "in_process"}, token=ADMIN_TOKEN)
print(f"  Status: {in_process['status']}")

# ── STEP 16 ───────────────────────────────────────────────────────────────────
sep("STEP 16  Admin: in_process → in_transit")
in_transit = req("PATCH", f"/admin/orders/{ORDER_ID}/status", {"status": "in_transit"}, token=ADMIN_TOKEN)
print(f"  Status: {in_transit['status']}")

# ── STEP 17 ───────────────────────────────────────────────────────────────────
sep("STEP 17  Admin: in_transit → delivered")
delivered = req("PATCH", f"/admin/orders/{ORDER_ID}/status", {"status": "delivered"}, token=ADMIN_TOKEN)
print(f"  Status      : {delivered['status']}")
print(f"  Delivered at: {delivered.get('deliveredAt')}")

# ── STEP 18 ───────────────────────────────────────────────────────────────────
sep("STEP 18  User order list — GET /orders")
user_orders = req("GET", "/orders", token=USER_TOKEN)
print(f"  Orders: {len(user_orders['items'])}")
for o in user_orders["items"]:
    print(f"    {o['id'][:8]}…  status={o['status']}  total={o['total']} MZN")

# ── STEP 19 ───────────────────────────────────────────────────────────────────
sep("STEP 19  User order detail — GET /orders/:id")
order_detail = req("GET", f"/orders/{ORDER_ID}", token=USER_TOKEN)
print(f"  Order  : {order_detail['id']}")
print(f"  Status : {order_detail['status']}")
print(f"  Total  : {order_detail['total']} MZN")
for i in order_detail["items"]:
    color = i["variant"]["color"]["name"]
    size  = i["variant"]["size"]["name"]
    print(f"    • {i['variant']['product']['name']}  {color}/{size}  qty={i['quantity']}  unit={i['unitPrice']} MZN")

# ── DONE ──────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("  USER JOURNEY COMPLETE")
print("=" * 60)
print(f"  User        : {user_resp['user']['email']}")
print(f"  Conversation: {CONV_ID}")
print(f"  Order       : {ORDER_ID} — {delivered['status']}")
print(f"  Cart items  : {var1['color']['name']}/{var1['size']['name']} + {var2['color']['name']}/{var2['size']['name']}")
print(f"  Colors used : 2 distinct hex codes ({var1['color']['hexCode']}, {var2['color']['hexCode']})")
print("=" * 60)
