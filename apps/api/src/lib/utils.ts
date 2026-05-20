import { nanoid } from "nanoid";

/**
 * Generates a readable SKU: {BRAND_CODE}-{CAT_CODE}-{NANOID8}
 * e.g. NIK-SNK-X4f9mK2p
 */
export function generateSku(brandName: string, categoryName: string): string {
  const brandCode = brandName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  const catCode = categoryName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  return `${brandCode}-${catCode}-${nanoid(8)}`;
}

/**
 * Offset-based pagination result — for admin list endpoints.
 * Run count + findMany in parallel, pass results here.
 */
export function offsetPaginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): { items: T[]; total: number; page: number; totalPages: number } {
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Cursor-based pagination encoder/decoder
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, "base64url").toString("utf8");
}

/**
 * Build a cursor-paginated result
 */
export function paginate<T extends { id: string }>(
  items: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore
    ? encodeCursor(result[result.length - 1]!.id)
    : null;
  return { items: result, nextCursor };
}
