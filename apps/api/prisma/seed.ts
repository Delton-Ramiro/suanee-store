import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Permissions, ALL_PERMISSIONS } from "@ecommerce/types";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ── Super admin ─────────────────────────────────────────────────────────
  const existingAdmin = await prisma.adminUser.findFirst({
    where: { email: "admin@ecommerce.mz" },
  });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("changeme123", 12);
    await prisma.adminUser.create({
      data: {
        name: "Super Admin",
        email: "admin@ecommerce.mz",
        passwordHash,
        permissions: BigInt(ALL_PERMISSIONS),
        isActive: true,
      },
    });
    console.log("Super admin created: admin@ecommerce.mz / changeme123");
  } else {
    console.log("Super admin already exists");
  }

  // ── Root categories ─────────────────────────────────────────────────────
  const categoryData = [
    { name: "Men", slug: "men", level: 0, position: 0, genderScope: "men" },
    {
      name: "Women",
      slug: "women",
      level: 0,
      position: 1,
      genderScope: "women",
    },
    { name: "Kids", slug: "kids", level: 0, position: 2, genderScope: "kids" },
    {
      name: "Unisex",
      slug: "unisex",
      level: 0,
      position: 3,
      genderScope: "unisex",
    },
  ] as const;

  for (const cat of categoryData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { ...cat, isActive: true },
      update: {},
    });
  }
  console.log("Root categories seeded");

  // ── Colors ──────────────────────────────────────────────────────────────
  const colors = [
    { name: "Black", slug: "black", hexCode: "#000000" },
    { name: "White", slug: "white", hexCode: "#FFFFFF" },
    { name: "Red", slug: "red", hexCode: "#FF0000" },
    { name: "Blue", slug: "blue", hexCode: "#0000FF" },
    { name: "Green", slug: "green", hexCode: "#008000" },
    { name: "Grey", slug: "grey", hexCode: "#808080" },
    { name: "Navy", slug: "navy", hexCode: "#001F5B" },
    { name: "Beige", slug: "beige", hexCode: "#F5F0DC" },
  ];

  for (const color of colors) {
    await prisma.color.upsert({
      where: { slug: color.slug },
      create: color,
      update: {},
    });
  }
  console.log("Colors seeded");

  // ── Sizes ───────────────────────────────────────────────────────────────
  const sizes = [
    {
      name: "XS",
      slug: "xs",
      label: "XS",
      position: 0,
      sizeSystem: "universal" as const,
    },
    {
      name: "S",
      slug: "s",
      label: "S",
      position: 1,
      sizeSystem: "universal" as const,
    },
    {
      name: "M",
      slug: "m",
      label: "M",
      position: 2,
      sizeSystem: "universal" as const,
    },
    {
      name: "L",
      slug: "l",
      label: "L",
      position: 3,
      sizeSystem: "universal" as const,
    },
    {
      name: "XL",
      slug: "xl",
      label: "XL",
      position: 4,
      sizeSystem: "universal" as const,
    },
    {
      name: "XXL",
      slug: "xxl",
      label: "XXL",
      position: 5,
      sizeSystem: "universal" as const,
    },
    {
      name: "3XL",
      slug: "3xl",
      label: "3XL",
      position: 6,
      sizeSystem: "universal" as const,
    },
    {
      name: "36",
      slug: "36",
      label: "36",
      position: 7,
      sizeSystem: "EU" as const,
    },
    {
      name: "37",
      slug: "37",
      label: "37",
      position: 8,
      sizeSystem: "EU" as const,
    },
    {
      name: "38",
      slug: "38",
      label: "38",
      position: 9,
      sizeSystem: "EU" as const,
    },
    {
      name: "39",
      slug: "39",
      label: "39",
      position: 10,
      sizeSystem: "EU" as const,
    },
    {
      name: "40",
      slug: "40",
      label: "40",
      position: 11,
      sizeSystem: "EU" as const,
    },
    {
      name: "41",
      slug: "41",
      label: "41",
      position: 12,
      sizeSystem: "EU" as const,
    },
    {
      name: "42",
      slug: "42",
      label: "42",
      position: 13,
      sizeSystem: "EU" as const,
    },
    {
      name: "43",
      slug: "43",
      label: "43",
      position: 14,
      sizeSystem: "EU" as const,
    },
    {
      name: "44",
      slug: "44",
      label: "44",
      position: 15,
      sizeSystem: "EU" as const,
    },
    {
      name: "45",
      slug: "45",
      label: "45",
      position: 16,
      sizeSystem: "EU" as const,
    },
  ];

  for (const size of sizes) {
    await prisma.size.upsert({
      where: { slug: size.slug },
      create: size,
      update: {},
    });
  }
  console.log("✅ Sizes seeded");

  // ── Currency rates (illustrative) ───────────────────────────────────────
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", rate: 64.0 },
    { code: "EUR", name: "Euro", symbol: "€", rate: 70.0 },
    { code: "ZAR", name: "South African Rand", symbol: "R", rate: 3.4 },
    { code: "MZN", name: "Metical", symbol: "MT", rate: 1.0 },
  ];

  for (const currency of currencies) {
    await prisma.currencyRate.upsert({
      where: { code: currency.code },
      create: currency,
      update: { rate: currency.rate },
    });
  }
  console.log("Currency rates seeded");

  // ── Content Manager admin ────────────────────────────────────────────────
  const existingManager = await prisma.adminUser.findFirst({
    where: { email: "manager@ecommerce.mz" },
  });
  if (!existingManager) {
    const managerHash = await bcrypt.hash("Manager123", 12);
    await prisma.adminUser.create({
      data: {
        name: "Content Manager",
        email: "manager@ecommerce.mz",
        passwordHash: managerHash,
        // All bits through MOST_SEARCHED_EDIT except ORDERS_EDIT(4)
        permissions: BigInt(32763),
        isActive: true,
      },
    });
    console.log("Content Manager created: manager@ecommerce.mz / Manager123");
  } else {
    console.log("Content Manager already exists");
  }

  // ── Level 1 subcategories ────────────────────────────────────────────────
  const womenCat = await prisma.category.findUnique({
    where: { slug: "women" },
  });
  const menCat = await prisma.category.findUnique({ where: { slug: "men" } });
  const kidsCat = await prisma.category.findUnique({ where: { slug: "kids" } });
  if (!womenCat || !menCat || !kidsCat) {
    throw new Error("Root categories not found — run seed on a fresh database");
  }

  const level1Categories = [
    {
      name: "Dresses",
      slug: "dresses",
      position: 0,
      parentId: womenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Tops",
      slug: "tops-women",
      position: 1,
      parentId: womenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Pants",
      slug: "pants-women",
      position: 2,
      parentId: womenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Shoes",
      slug: "shoes-women",
      position: 3,
      parentId: womenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Accessories",
      slug: "accessories-women",
      position: 4,
      parentId: womenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "T-Shirts",
      slug: "t-shirts",
      position: 0,
      parentId: menCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Jeans",
      slug: "jeans",
      position: 1,
      parentId: menCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Jackets",
      slug: "jackets",
      position: 2,
      parentId: menCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Shoes",
      slug: "shoes-men",
      position: 3,
      parentId: menCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Tops",
      slug: "tops-kids",
      position: 0,
      parentId: kidsCat.id,
      genderScope: "kids" as const,
    },
    {
      name: "Bottoms",
      slug: "bottoms-kids",
      position: 1,
      parentId: kidsCat.id,
      genderScope: "kids" as const,
    },
  ];

  for (const cat of level1Categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { ...cat, level: 1, isActive: true },
      update: {},
    });
  }
  console.log("Level 1 subcategories seeded");

  // ── Level 2 subcategories ────────────────────────────────────────────────
  const dressesCat = await prisma.category.findUnique({
    where: { slug: "dresses" },
  });
  const shoesWomenCat = await prisma.category.findUnique({
    where: { slug: "shoes-women" },
  });
  const jeansCat = await prisma.category.findUnique({
    where: { slug: "jeans" },
  });
  const shoesMenCat = await prisma.category.findUnique({
    where: { slug: "shoes-men" },
  });
  if (!dressesCat || !shoesWomenCat || !jeansCat || !shoesMenCat) {
    throw new Error("Level 1 categories not found — re-run seed");
  }

  const level2Categories = [
    {
      name: "Midi Dresses",
      slug: "midi-dresses",
      position: 0,
      parentId: dressesCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Mini Dresses",
      slug: "mini-dresses",
      position: 1,
      parentId: dressesCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Maxi Dresses",
      slug: "maxi-dresses",
      position: 2,
      parentId: dressesCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Heels",
      slug: "heels",
      position: 0,
      parentId: shoesWomenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Sneakers (Women)",
      slug: "sneakers-women",
      position: 1,
      parentId: shoesWomenCat.id,
      genderScope: "women" as const,
    },
    {
      name: "Slim Fit",
      slug: "slim-fit-jeans",
      position: 0,
      parentId: jeansCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Straight Fit",
      slug: "straight-fit-jeans",
      position: 1,
      parentId: jeansCat.id,
      genderScope: "men" as const,
    },
    {
      name: "Sneakers (Men)",
      slug: "sneakers-men",
      position: 0,
      parentId: shoesMenCat.id,
      genderScope: "men" as const,
    },
  ];

  for (const cat of level2Categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { ...cat, level: 2, isActive: true },
      update: {},
    });
  }
  console.log("Level 2 subcategories seeded");

  // ── Size guide — Women's Dresses ─────────────────────────────────────────
  const existingGuide = await prisma.sizeGuide.findFirst({
    where: { name: "Women's Dresses" },
  });
  if (!existingGuide) {
    await prisma.sizeGuide.create({
      data: {
        name: "Women's Dresses",
        description:
          "Measure bust (fullest part), waist (narrowest), and hips (fullest part, ~20 cm below waist). All in cm.\n\n" +
          "| Size | Bust | Waist | Hips |\n" +
          "|------|------|-------|------|\n" +
          "| XS   |  80  |  60   |  87  |\n" +
          "| S    |  84  |  64   |  91  |\n" +
          "| M    |  88  |  68   |  95  |\n" +
          "| L    |  94  |  74   | 101  |\n" +
          "| XL   | 100  |  80   | 107  |\n" +
          "| XXL  | 108  |  88   | 115  |",
        images: [],
      },
    });
    console.log("Size guide 'Women's Dresses' created");
  } else {
    console.log("Size guide 'Women's Dresses' already exists");
  }

  // ── Attribute definitions ────────────────────────────────────────────────
  const topsWomenCat = await prisma.category.findUnique({
    where: { slug: "tops-women" },
  });
  const tShirtsCat = await prisma.category.findUnique({
    where: { slug: "t-shirts" },
  });
  const pantsWomenCat = await prisma.category.findUnique({
    where: { slug: "pants-women" },
  });
  const heelsCat = await prisma.category.findUnique({
    where: { slug: "heels" },
  });

  const attrDefs = [
    {
      slug: "material",
      name: "Material",
      position: 0,
      categoryIds: [dressesCat.id, topsWomenCat?.id, tShirtsCat?.id].filter(
        (id): id is string => id !== null && id !== undefined,
      ),
      options: [
        { label: "Cotton", value: "cotton", position: 0 },
        { label: "Satin", value: "satin", position: 1 },
        { label: "Linen", value: "linen", position: 2 },
        { label: "Silk", value: "silk", position: 3 },
        { label: "Polyester", value: "polyester", position: 4 },
        { label: "Chiffon", value: "chiffon", position: 5 },
      ],
    },
    {
      slug: "fit",
      name: "Fit",
      position: 1,
      categoryIds: [jeansCat.id, dressesCat.id, pantsWomenCat?.id].filter(
        (id): id is string => id !== null && id !== undefined,
      ),
      options: [
        { label: "Slim", value: "slim", position: 0 },
        { label: "Regular", value: "regular", position: 1 },
        { label: "Relaxed", value: "relaxed", position: 2 },
        { label: "Skinny", value: "skinny", position: 3 },
        { label: "Wrap", value: "wrap", position: 4 },
      ],
    },
    {
      slug: "neckline",
      name: "Neckline",
      position: 2,
      categoryIds: [dressesCat.id, topsWomenCat?.id].filter(
        (id): id is string => id !== null && id !== undefined,
      ),
      options: [
        { label: "V-Neck", value: "v_neck", position: 0 },
        { label: "Round Neck", value: "round_neck", position: 1 },
        { label: "Off-Shoulder", value: "off_shoulder", position: 2 },
        { label: "Halter", value: "halter", position: 3 },
        { label: "Square Neck", value: "square_neck", position: 4 },
      ],
    },
    {
      slug: "heel-height",
      name: "Heel Height",
      position: 3,
      categoryIds: [heelsCat?.id].filter(
        (id): id is string => id !== null && id !== undefined,
      ),
      options: [
        { label: "Flat (0–2 cm)", value: "flat", position: 0 },
        { label: "Low (2–5 cm)", value: "low", position: 1 },
        { label: "Mid (5–8 cm)", value: "mid", position: 2 },
        { label: "High (8–12 cm)", value: "high", position: 3 },
        { label: "Extra High (12+)", value: "extra_high", position: 4 },
      ],
    },
  ];

  for (const def of attrDefs) {
    const existing = await prisma.attributeDefinition.findFirst({
      where: { slug: def.slug },
    });
    if (!existing) {
      const created = await prisma.attributeDefinition.create({
        data: {
          name: def.name,
          slug: def.slug,
          position: def.position,
          isActive: true,
          inputType: "multi_select",
          options: { create: def.options },
        },
      });
      await prisma.attributeDefinitionCategory.createMany({
        data: def.categoryIds.map((categoryId) => ({
          attributeDefinitionId: created.id,
          categoryId,
        })),
        skipDuplicates: true,
      });
      console.log(`Attribute definition '${def.name}' created`);
    } else {
      console.log(`Attribute definition '${def.name}' already exists`);
    }
  }

  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
