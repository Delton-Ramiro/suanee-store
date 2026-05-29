/**
 * ISR revalidation intervals (in seconds) for Next.js server components.
 * Centralised here so all fetch calls share the same values and can be
 * updated in one place.
 */
export const Revalidate = {
  /** Catalog data: categories, brands, collections (5 min) */
  catalog: 300,
  /** Stories — changes more often (2 min) */
  stories: 120,
} as const;
