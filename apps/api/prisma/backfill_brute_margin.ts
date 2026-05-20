import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function calculateSupplierMargin(source: {
  priceWithDelivery: unknown;
  deliveryTax: unknown;
  otherCosts: unknown;
  proposedPrice: unknown;
  currencyRate?: { rate: unknown } | null;
}): number {
  const proposedPrice = Number(source.proposedPrice ?? 0);
  if (proposedPrice <= 0) return 0;

  const currencyRate = Number(source.currencyRate?.rate ?? 0);
  const landedCost = Number(source.priceWithDelivery ?? 0) * currencyRate;
  const deliveryTax = Number(source.deliveryTax ?? 0);
  const otherCosts = Number(source.otherCosts ?? 0);

  return (
    Math.round((proposedPrice - landedCost - deliveryTax - otherCosts) * 100) /
    100
  );
}

async function main() {
  console.log("Backfilling brute margin snapshots…");

  const orders = await prisma.order.findMany({
    where: {
      paidAt: { not: null },
      status: { in: ["paid", "in_process", "in_transit", "delivered"] },
    },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          product: {
            select: {
              suppliers: {
                where: { isDefault: true },
                include: { currencyRate: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  for (const order of orders) {
    let orderBruteMargin = 0;

    for (const item of order.items) {
      const supplier = item.product.suppliers[0] ?? null;
      const itemMargin = supplier
        ? calculateSupplierMargin(supplier) * item.quantity
        : 0;

      orderBruteMargin += itemMargin;

      await prisma.orderItem.update({
        where: { id: item.id },
        data: { bruteMargin: itemMargin },
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { bruteMargin: orderBruteMargin },
    });
  }

  console.log(`Backfilled ${orders.length} orders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
