import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Returns descendant category IDs (excluding the provided root ID)
 * using a single recursive CTE query.
 */
export async function getCategoryDescendantIds(
  rootCategoryId: string,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH RECURSIVE category_tree AS (
      SELECT c.id
      FROM categories c
      WHERE c.id = ${rootCategoryId}

      UNION ALL

      SELECT c2.id
      FROM categories c2
      INNER JOIN category_tree ct ON c2."parentId" = ct.id
    )
    SELECT id
    FROM category_tree
    WHERE id <> ${rootCategoryId}
  `);

  return rows.map((r) => r.id);
}
