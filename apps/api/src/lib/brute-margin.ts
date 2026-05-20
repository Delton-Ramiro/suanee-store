import type { Decimal } from "@prisma/client/runtime/library";

type NumericLike = number | string | Decimal | null | undefined;

export type SupplierMarginSource = {
  priceWithDelivery: NumericLike;
  deliveryTax: NumericLike;
  otherCosts: NumericLike;
  proposedPrice: NumericLike;
  currencyRate?: { rate: NumericLike } | null;
};

function toNumber(value: NumericLike): number {
  return Number(value ?? 0);
}

export function calculateSupplierMargin(source: SupplierMarginSource): number {
  const proposedPrice = toNumber(source.proposedPrice);
  if (proposedPrice <= 0) return 0;

  const currencyRate = toNumber(source.currencyRate?.rate ?? 0);
  const landedCost = toNumber(source.priceWithDelivery) * currencyRate;
  const deliveryTax = toNumber(source.deliveryTax);
  const otherCosts = toNumber(source.otherCosts);

  return Math.round((proposedPrice - landedCost - deliveryTax - otherCosts) * 100) / 100;
}
