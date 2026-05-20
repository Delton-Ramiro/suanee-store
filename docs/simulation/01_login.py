"""
01_login.py — Authenticate as super-admin and save the JWT to /tmp/login.json.

Must be run BEFORE 02_simulate.py.

Usage:
    python3 docs/simulation/01_login.py

Requirements:
    - API running on http://localhost:3001
    - Default seed credentials intact
"""

import json
import urllib.request

BASE = "http://localhost:3001/api/v1"
CREDENTIALS = {
    "email": "admin@ecommerce.mz",
    "password": "changeme123"
}
TOKEN_FILE = "/tmp/login.json"

payload = json.dumps(CREDENTIALS).encode()
req = urllib.request.Request(
    f"{BASE}/admin/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

with open(TOKEN_FILE, "w") as f:
    json.dump(data, f, indent=2)

print(f"✓ Logged in as: {data['admin']['email']}")
print(f"✓ Token saved to: {TOKEN_FILE}")
print(f"  (expires in ~24h — rerun this script if the simulation fails with 401)")
