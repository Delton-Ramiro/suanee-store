import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  ProductStatus,
  SizeSystem,
  StockStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.resolve(__dirname, "../../../test_data");

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
]);

type ColorSeed = { name: string; slug: string; hexCode: string };

const COLOR_PALETTE: ColorSeed[] = [
  { name: "Preto", slug: "seed-preto", hexCode: "#111111" },
  { name: "Branco", slug: "seed-branco", hexCode: "#F5F5F5" },
  { name: "Bege", slug: "seed-bege", hexCode: "#D8C3A5" },
  { name: "Azul Marinho", slug: "seed-azul-marinho", hexCode: "#1F2A44" },
  { name: "Cinzento", slug: "seed-cinzento", hexCode: "#6B7280" },
  { name: "Castanho", slug: "seed-castanho", hexCode: "#7A5230" },
];

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hashIndex(value: string, modulo: number): number {
  let acc = 0;
  for (const ch of value) acc = (acc * 31 + ch.charCodeAt(0)) >>> 0;
  return acc % modulo;
}

function prettyNameFromKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function cleanedBaseName(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const parts = base.split("_");
  const last = parts[parts.length - 1];
  if (last && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(last)) {
    return parts.slice(0, -1).join("_");
  }
  return base;
}

function groupKeyFromFilename(filename: string): string {
  const cleaned = cleanedBaseName(filename);
  const tokens = cleaned.split(/[_-]+/).filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0]}_${tokens[1]}`;
  return tokens[0] ?? cleaned;
}

function colorFromFilename(filename: string): string {
  const cleaned = cleanedBaseName(filename).toUpperCase();

  if (cleaned.includes("_24") || cleaned.endsWith("24")) return "seed-preto";
  if (cleaned.includes("_31") || cleaned.endsWith("31")) return "seed-branco";
  if (cleaned.includes("_32") || cleaned.endsWith("32")) return "seed-bege";
  if (cleaned.includes("_33") || cleaned.endsWith("33"))
    return "seed-azul-marinho";
  if (
    cleaned.includes("_21") ||
    cleaned.endsWith("21") ||
    cleaned.includes("L1")
  ) {
    return "seed-branco";
  }
  if (cleaned.includes("_20") || cleaned.endsWith("20")) return "seed-bege";
  if (cleaned.includes("_22") || cleaned.endsWith("22")) return "seed-castanho";

  return (
    COLOR_PALETTE[hashIndex(cleaned, COLOR_PALETTE.length)]?.slug ??
    "seed-preto"
  );
}

async function ensureColor(seed: ColorSeed) {
  const existing = await prisma.color.findFirst({
    where: {
      OR: [{ slug: seed.slug }, { hexCode: seed.hexCode }],
    },
  });

  if (existing) return existing;

  return prisma.color.create({ data: seed });
}

async function ensureSize(data: {
  name: string;
  slug: string;
  label: string;
  sizeSystem: SizeSystem;
  position: number;
}) {
  const existing = await prisma.size.findUnique({ where: { slug: data.slug } });
  if (existing) return existing;
  return prisma.size.create({ data });
}

function pickRootCategory(
  roots: Array<{ id: string; name: string; slug: string }>,
  aliases: string[],
): { id: string; name: string; slug: string } {
  const loweredAliases = aliases.map((a) => a.toLowerCase());
  const found = roots.find((root) => {
    const slug = root.slug.toLowerCase();
    const name = root.name.toLowerCase();
    return loweredAliases.some(
      (alias) => slug.includes(alias) || name.includes(alias),
    );
  });

  if (found) return found;
  return roots[0];
}

async function ensureSubCategory(input: {
  rootId: string;
  name: string;
  slug: string;
  position: number;
  genderScope?: "women" | "men" | "kids" | "unisex";
}) {
  const existing = await prisma.category.findUnique({
    where: { slug: input.slug },
  });
  if (existing) return existing;

  return prisma.category.create({
    data: {
      parentId: input.rootId,
      level: 1,
      name: input.name,
      slug: input.slug,
      position: input.position,
      isActive: true,
      genderScope: input.genderScope,
    },
  });
}

async function main() {
  console.log("🌱 Seeding products from test_data...");

  const allEntries = await fs.readdir(TEST_DATA_DIR);
  const imageFiles = allEntries.filter((entry) =>
    IMAGE_EXTENSIONS.has(path.extname(entry).toLowerCase()),
  );

  if (imageFiles.length === 0) {
    throw new Error(`No image files found in ${TEST_DATA_DIR}`);
  }

  const grouped = new Map<string, string[]>();
  for (const file of imageFiles) {
    const key = groupKeyFromFilename(file);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(file);
  }

  const roots = await prisma.category.findMany({
    where: { level: 0, isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  if (roots.length === 0) {
    throw new Error(
      "No root categories found (level 0). Please register main categories first.",
    );
  }

  const womenRoot = pickRootCategory(roots, ["women", "mulher", "feminino"]);
  const menRoot = pickRootCategory(roots, ["men", "homem", "masculino"]);
  const unisexRoot = pickRootCategory(roots, ["unisex", "unissex"]);

  const subWomenFootwear = await ensureSubCategory({
    rootId: womenRoot.id,
    name: "Calçado Feminino",
    slug: "seed-calcado-feminino",
    position: 1,
    genderScope: "women",
  });

  const subMenTops = await ensureSubCategory({
    rootId: menRoot.id,
    name: "Tops Masculinos",
    slug: "seed-tops-masculinos",
    position: 2,
    genderScope: "men",
  });

  const subUnisexCasual = await ensureSubCategory({
    rootId: unisexRoot.id,
    name: "Casual Unissexo",
    slug: "seed-casual-unissexo",
    position: 3,
    genderScope: "unisex",
  });

  const brand = await prisma.brand.upsert({
    where: { slug: "seed-atelier" },
    create: { name: "Seed Atelier", slug: "seed-atelier", status: "published" },
    update: {},
  });

  const colorBySlug = new Map<string, { id: string; slug: string }>();
  for (const seed of COLOR_PALETTE) {
    const color = await ensureColor(seed);
    colorBySlug.set(seed.slug, { id: color.id, slug: color.slug });
  }

  const apparelSizes = await Promise.all([
    ensureSize({
      name: "S",
      slug: "s",
      label: "S",
      sizeSystem: SizeSystem.universal,
      position: 0,
    }),
    ensureSize({
      name: "M",
      slug: "m",
      label: "M",
      sizeSystem: SizeSystem.universal,
      position: 1,
    }),
    ensureSize({
      name: "L",
      slug: "l",
      label: "L",
      sizeSystem: SizeSystem.universal,
      position: 2,
    }),
  ]);

  const footwearSizes = await Promise.all([
    ensureSize({
      name: "38",
      slug: "38",
      label: "38",
      sizeSystem: SizeSystem.EU,
      position: 10,
    }),
    ensureSize({
      name: "39",
      slug: "39",
      label: "39",
      sizeSystem: SizeSystem.EU,
      position: 11,
    }),
    ensureSize({
      name: "40",
      slug: "40",
      label: "40",
      sizeSystem: SizeSystem.EU,
      position: 12,
    }),
    ensureSize({
      name: "41",
      slug: "41",
      label: "41",
      sizeSystem: SizeSystem.EU,
      position: 13,
    }),
  ]);

  let createdOrUpdated = 0;

  const sortedGroups = [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (let index = 0; index < sortedGroups.length; index += 1) {
    const [key, files] = sortedGroups[index]!;
    const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));

    const isFootwear = /^SH|^SJ/i.test(key);
    const isUnisex = /^XJ/i.test(key);

    const categoryId = isFootwear
      ? subWomenFootwear.id
      : isUnisex
        ? subUnisexCasual.id
        : subMenTops.id;

    const rootCategoryId = isFootwear
      ? womenRoot.id
      : isUnisex
        ? unisexRoot.id
        : menRoot.id;

    const sizePool = isFootwear ? footwearSizes : apparelSizes;

    const productSlug = `seed-${slugify(key)}`;
    const productName = prettyNameFromKey(key);

    const firstColorSlug = colorFromFilename(sortedFiles[0] ?? key);
    const firstColorId =
      colorBySlug.get(firstColorSlug)?.id ?? colorBySlug.get("seed-preto")!.id;

    const basePrice = Number((3500 + index * 180).toFixed(2));
    const product = await prisma.product.upsert({
      where: { slug: productSlug },
      create: {
        brandId: brand.id,
        name: productName,
        slug: productSlug,
        description: `Produto de teste criado automaticamente com ${sortedFiles.length} imagem(ns).`,
        basePrice,
        stockStatus: StockStatus.in_stock,
        status: ProductStatus.published,
        isVisible: true,
        mainColorId: firstColorId,
        deliveryEstimate: "3-7 dias úteis",
      },
      update: {
        brandId: brand.id,
        name: productName,
        description: `Produto de teste criado automaticamente com ${sortedFiles.length} imagem(ns).`,
        basePrice,
        stockStatus: StockStatus.in_stock,
        status: ProductStatus.published,
        isVisible: true,
        mainColorId: firstColorId,
        deliveryEstimate: "3-7 dias úteis",
      },
      select: { id: true, slug: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.productCategory.deleteMany({ where: { productId: product.id } });
      await tx.productSize.deleteMany({ where: { productId: product.id } });
      await tx.productVariant.deleteMany({ where: { productId: product.id } });
      await tx.productMedia.deleteMany({ where: { productId: product.id } });

      await tx.productCategory.createMany({
        data: [
          { productId: product.id, categoryId: rootCategoryId },
          { productId: product.id, categoryId },
        ],
        skipDuplicates: true,
      });

      await tx.productSize.createMany({
        data: sizePool.map((size) => ({
          productId: product.id,
          sizeId: size.id,
        })),
        skipDuplicates: true,
      });

      const uniqueColorIds = Array.from(
        new Set(
          sortedFiles.map((file) => {
            const slug = colorFromFilename(file);
            return colorBySlug.get(slug)?.id ?? firstColorId;
          }),
        ),
      );

      for (
        let variantIndex = 0;
        variantIndex < uniqueColorIds.length;
        variantIndex += 1
      ) {
        const colorId = uniqueColorIds[variantIndex]!;
        const sizeId = sizePool[variantIndex % sizePool.length]!.id;

        await tx.productVariant.create({
          data: {
            productId: product.id,
            colorId,
            sizeId,
            sku: `SEED-${slugify(product.slug).toUpperCase()}-${variantIndex + 1}`,
            stockQuantity: 10 + variantIndex * 3,
            price: basePrice,
            position: variantIndex,
          },
        });
      }

      for (
        let mediaIndex = 0;
        mediaIndex < sortedFiles.length;
        mediaIndex += 1
      ) {
        const filename = sortedFiles[mediaIndex]!;
        const slug = colorFromFilename(filename);
        const colorId = colorBySlug.get(slug)?.id ?? firstColorId;

        await tx.productMedia.create({
          data: {
            productId: product.id,
            colorId,
            url: `/test_data/${filename}`,
            mediaType: "image",
            isPrimary: mediaIndex === 0,
            position: mediaIndex,
            isDeleted: false,
          },
        });
      }
    });

    createdOrUpdated += 1;
    console.log(
      `✓ ${productName} (${product.slug}) seeded with ${sortedFiles.length} media file(s)`,
    );
  }

  console.log(
    `\nDone. ${createdOrUpdated} product group(s) seeded from ${imageFiles.length} image file(s).`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Product seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
