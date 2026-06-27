/**
 * Injects a test order with 3 products into the database.
 *
 * Prerequisites:
 *   - Run `npm run db:seed` (creates users + base data) or
 *     `npm run db:seed:products` (creates seed products) first.
 *
 * Run:
 *   npm run db:seed:order
 */

import { PrismaClient, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🛒 Seeding test order...");

  // ── 1. Resolve or create a test user ─────────────────────────────────────
  let user = await prisma.user.findFirst({
    where: { email: "testuser@suanee.mz" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "testuser@suanee.mz",
        name: "Test User",
      },
    });
    console.log(`  ✓ Created user: ${user.email}`);
  } else {
    console.log(`  ↩ Using existing user: ${user.email}`);
  }

  // ── 2. Resolve or create a conversation (required by Order) ──────────────
  let conversation = await prisma.conversation.findFirst({
    where: { userId: user.id },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { userId: user.id },
    });
    console.log("  ✓ Created conversation");
  } else {
    console.log("  ↩ Using existing conversation");
  }

  // ── 3. Pick 3 distinct published products that each have at least 1 variant
  const products = await prisma.product.findMany({
    where: {
      status: "published",
      isVisible: true,
      variants: { some: {} },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      basePrice: true,
      variants: {
        take: 1,
        orderBy: { position: "asc" },
        select: { id: true, price: true },
      },
    },
  });

  if (products.length < 3) {
    throw new Error(
      `Need at least 3 published products with variants — found ${products.length}. ` +
        "Run `npm run db:seed:products` first.",
    );
  }

  // ── 4. Build order items ──────────────────────────────────────────────────
  const items = products.map((p, i) => {
    const variant = p.variants[0]!;
    const unitPrice = Number(variant.price ?? p.basePrice);
    return {
      productId: p.id,
      productVariantId: variant.id,
      quantity: i + 1,      // 1, 2, 3
      unitPrice,
      name: p.name,         // for logging only
    };
  });

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const shippingCost = 250; // MZN
  const total = subtotal + shippingCost;

  // ── 5. Create the order inside a transaction ──────────────────────────────
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: user!.id,
        conversationId: conversation!.id,
        status: OrderStatus.paid,
        subtotal,
        shippingCost,
        total,
        paidAt: new Date(),
        items: {
          create: items.map(({ productId, productVariantId, quantity, unitPrice }) => ({
            productId,
            productVariantId,
            quantity,
            unitPrice,
          })),
        },
      },
      include: { items: true },
    });
    return created;
  });

  console.log(`\n✅ Order created: ${order.id}`);
  console.log(`   Status  : ${order.status}`);
  console.log(`   Subtotal: MZN ${subtotal.toLocaleString("pt-PT")}`);
  console.log(`   Shipping: MZN ${shippingCost.toLocaleString("pt-PT")}`);
  console.log(`   Total   : MZN ${total.toLocaleString("pt-PT")}`);
  console.log(`   Items   :`);
  for (const item of items) {
    console.log(
      `     • ${item.name} × ${item.quantity}  @ MZN ${item.unitPrice.toLocaleString("pt-PT")}`,
    );
  }
}

main()
  .catch((err) => {
    console.error("❌ Order seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
