import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOMEM_ID = "ecaaa828-dae4-419e-812c-79209be0f9f1";

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Data ─────────────────────────────────────────────────────────────────────
// Each entry: { name: "PT name", children: ["PT child", ...] }

const LEVEL1_CATEGORIES = [
  {
    name: "Vestuário",
    children: [
      "Novidades",
      "T-Shirts & Regatas",
      "Hoodies & Sweatshirts",
      "Jeans",
      "Casacos & Blusões",
      "Malhas",
      "Chinos",
      "Calças de Treino",
      "Fatos & Alfaiataria",
      "Roupa Interior & Meias",
      "Casacos de Inverno",
      "Golfe & Polos",
      "Camisas",
      "Collants",
      "Calções",
      "Roupa Desportiva",
      "Calças",
      "Fatos de Banho",
    ],
  },
  {
    name: "Calçado",
    children: [
      "Novidades",
      "Botas",
      "Sapatos com Atacadores",
      "Mocassins & Slip-Ons",
      "Sandálias & Chinelos",
      "Sapatilhas",
      "Sapatilhas de Desporto",
    ],
  },
  {
    name: "Acessórios",
    children: [
      "Malas & Carteiras",
      "Cintos",
      "Gémeos & Alfinetes de Lapela",
      "Chapéus & Bonés",
      "Cachecóis & Luvas",
      "Óculos de Sol",
      "Gravatas & Lenços de Bolso",
      "Novidades",
    ],
  },
  {
    name: "Grooming",
    children: [
      "Novidades",
      "Fragrâncias",
      "Produtos de Barbear",
      "Cuidados com a Pele",
    ],
  },
  {
    name: "Desporto Masculino",
    children: ["Novidades", "Vestuário", "Calçado"],
  },
  {
    name: "Joalheria Masculina",
    children: [
      "Relógios",
      "Joalheria Fashion",
      "Joalheria Fina",
      "Pulseiras & Braceletes",
      "Brincos",
      "Colares",
      "Anéis",
      "Novidades",
    ],
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding subcategories for Homem...\n");

  // Verify Homem exists
  const homem = await prisma.category.findUnique({ where: { id: HOMEM_ID } });
  if (!homem) throw new Error(`Category "Homem" not found (id: ${HOMEM_ID})`);

  console.log(`✅  Found root: ${homem.name} (level ${homem.level})\n`);

  for (let l1Pos = 0; l1Pos < LEVEL1_CATEGORIES.length; l1Pos++) {
    const l1 = LEVEL1_CATEGORIES[l1Pos];
    const l1Slug = `homem-${slug(l1.name)}`;

    const level1 = await prisma.category.upsert({
      where: { slug: l1Slug },
      update: {},
      create: {
        name: l1.name,
        slug: l1Slug,
        level: 1,
        parentId: HOMEM_ID,
        position: l1Pos + 1,
        genderScope: "men",
        isActive: true,
      },
    });

    console.log(`  📁  ${level1.name} (${level1.id})`);

    for (let l2Pos = 0; l2Pos < l1.children.length; l2Pos++) {
      const childName = l1.children[l2Pos];
      const l2Slug = `${l1Slug}-${slug(childName)}`;

      const level2 = await prisma.category.upsert({
        where: { slug: l2Slug },
        update: {},
        create: {
          name: childName,
          slug: l2Slug,
          level: 2,
          parentId: level1.id,
          position: l2Pos + 1,
          genderScope: "men",
          isActive: true,
        },
      });

      console.log(`       └─ ${level2.name}`);
    }
  }

  console.log("\n✅  Done!\n");
}

main()
  .catch((e) => {
    console.error("❌  Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
