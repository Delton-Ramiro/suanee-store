"""
inject_colors.py — Seed 55 unique random colors via the admin API.

Run AFTER 01_login.py (requires /tmp/login.json with a valid JWT).

Usage:
    python3 docs/simulation/inject_colors.py

Requirements:
    - API running on http://localhost:3001
    - /tmp/login.json created by 01_login.py
"""

import json
import random
import urllib.request
import urllib.error

BASE = "http://localhost:3001/api/v1"
TOKEN = json.load(open("/tmp/login.json"))["token"]

# 55 hand-picked named colors with unique hex codes
COLORS = [
    ("Vermelho carmim",    "#DC143C"),
    ("Coral vivo",         "#FF6B6B"),
    ("Rosa chá",           "#F7CAC9"),
    ("Salmão",             "#FA8072"),
    ("Laranja queimado",   "#CC5500"),
    ("Laranja neon",       "#FF6700"),
    ("Âmbar",              "#FFBF00"),
    ("Amarelo canário",    "#FFE066"),
    ("Amarelo mostarda",   "#FFDB58"),
    ("Lima",               "#32CD32"),
    ("Verde folha",        "#228B22"),
    ("Verde esmeralda",    "#50C878"),
    ("Verde menta",        "#98FF98"),
    ("Verde musgo",        "#8A9A5B"),
    ("Verde oliva",        "#808000"),
    ("Verde caqui",        "#BDB76B"),
    ("Verde ciano",        "#00CED1"),
    ("Turquesa",           "#40E0D0"),
    ("Azul petróleo",      "#008080"),
    ("Azul royal",         "#4169E1"),
    ("Azul cobalto",       "#0047AB"),
    ("Azul dodger",        "#1E90FF"),
    ("Azul céu",           "#87CEEB"),
    ("Azul powder",        "#B0E0E6"),
    ("Índigo",             "#4B0082"),
    ("Lavanda",            "#E6E6FA"),
    ("Violeta médio",      "#9370DB"),
    ("Orquídea",           "#DA70D6"),
    ("Fúcsia",             "#FF00FF"),
    ("Rosa choque",        "#FF69B4"),
    ("Rosa quartzo",       "#F4C2C2"),
    ("Vinho",              "#722F37"),
    ("Borgonha",           "#800020"),
    ("Carmesim",           "#A22122"),
    ("Maroon",             "#800000"),
    ("Chocolate",          "#7B3F00"),
    ("Mogno",              "#C04000"),
    ("Caramelo",           "#C68642"),
    ("Bege areia",         "#F5F5DC"),
    ("Creme",              "#FFFDD0"),
    ("Branco neve",        "#FFFAFA"),
    ("Prata",              "#C0C0C0"),
    ("Cinza ardósia",      "#708090"),
    ("Cinza carvão",       "#36454F"),
    ("Preto azulado",      "#151B54"),
    ("Preto espaço",       "#1C1C1C"),
    ("Dourado",            "#FFD700"),
    ("Bronze",             "#CD7F32"),
    ("Cobre",              "#B87333"),
    ("Champanhe",          "#F7E7CE"),
    ("Nude",               "#E3BC9A"),
    ("Pêssego",            "#FFCBA4"),
    ("Terracota",          "#E2725B"),
    ("Tijolo",             "#CB4154"),
    ("Salmão escuro",      "#E9967A"),
]


def post(path: str, body: dict):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        return None, json.loads(e.read()).get("error", str(e))


def main():
    # Shuffle so insertion order is random
    colors = list(COLORS)
    random.shuffle(colors)

    created = 0
    skipped = 0

    for name, hex_code in colors:
        result, err = post("/admin/colors", {"name": name, "hexCode": hex_code})
        if result:
            print(f"  ✓ {name} ({hex_code})")
            created += 1
        else:
            print(f"  ✗ {name} ({hex_code}) — {err}")
            skipped += 1

    print(f"\n{'─' * 40}")
    print(f"  Criadas : {created}")
    print(f"  Ignoradas: {skipped}  (já existiam ou conflito de hex)")
    print(f"{'─' * 40}")


if __name__ == "__main__":
    main()
