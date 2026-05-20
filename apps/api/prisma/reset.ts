import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("⚠️  Erasing database…");

  await prisma.$executeRaw`
    TRUNCATE TABLE
      story_slide_products,
      story_slides,
      stories,
      messages,
      conversations,
      order_items,
      orders,
      favorites,
      cart_items,
      product_competitors,
      product_suppliers,
      product_attributes,
      product_sizes,
      product_media,
      product_variants,
      product_categories,
      products,
      attribute_options,
      attribute_definitions,
      size_guides,
      size_categories,
      sizes,
      colors,
      collections,
      brand_categories,
      brands,
      categories,
      admin_audit_logs,
      admin_users,
      visitor_sessions,
      refresh_tokens,
      users,
      most_searched,
      currency_rates
    RESTART IDENTITY CASCADE
  `;

  console.log("✅ All tables erased");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
