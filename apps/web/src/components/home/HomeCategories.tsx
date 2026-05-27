import { ChevronRight } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HomeCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
};

// ─── Layout tokens — bash.com measured values ────────────────────────────────
// bash.com: body = 1208px, wide card = 800px, narrow = 391px, gap = 16px
// Row height: scales from mobile up to bash.com's 400px at desktop
const ROW_H = "h-[180px] sm:h-[220px] md:h-[320px] lg:h-[340px] xl:h-[400px]";
// 16px gap — matches bash.com's 12-column grid gutters
const GAP = "gap-4";
// Wide cell: 8/12 cols ≈ 66.7% (flex-grow 2)
const WIDE = "flex-[2_2_0%]";
// Narrow cell: 4/12 cols ≈ 33.3% (flex-grow 1)
const NARR = "flex-[1_1_0%]";

// ─── Individual card ─────────────────────────────────────────────────────────

function Card({
  name,
  slug,
  imageUrl,
  className = "",
}: HomeCategory & { className?: string }) {
  return (
    <Link
      href={`/produtos?categoria=${encodeURIComponent(slug)}`}
      className={`group relative block overflow-hidden rounded-[10px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] bg-muted-bg ${className}`}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-in-out scale-[1.04] group-hover:scale-[1.08]"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
      <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-5 xl:bottom-6 xl:left-6 flex items-center gap-1.5">
        <span className="font-medium leading-none text-white text-h6 sm:text-h5 md:text-h4 lg:text-h3 xl:text-h2">
          {name}
        </span>
        <ChevronRight className="shrink-0 text-white w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 xl:w-7 xl:h-7 mt-px" />
      </div>
    </Link>
  );
}

// ─── Row type A: wide | narrow ────────────────────────────────────────────────

function RowA({ items }: { items: HomeCategory[] }) {
  if (items.length === 1)
    return (
      <div className={ROW_H}>
        <Card {...items[0]} className="h-full w-full" />
      </div>
    );
  return (
    <div className={`flex ${GAP} ${ROW_H}`}>
      <Card {...items[0]} className={`${WIDE} h-full`} />
      <Card {...items[1]} className={`${NARR} h-full`} />
    </div>
  );
}

// ─── Row type B: narrow | wide ────────────────────────────────────────────────

function RowB({ items }: { items: HomeCategory[] }) {
  if (items.length === 1)
    return (
      <div className={ROW_H}>
        <Card {...items[0]} className="h-full w-full" />
      </div>
    );
  return (
    <div className={`flex ${GAP} ${ROW_H}`}>
      <Card {...items[0]} className={`${NARR} h-full`} />
      <Card {...items[1]} className={`${WIDE} h-full`} />
    </div>
  );
}

// ─── Row type C: stacked-pair (narrow) | side-by-side (wide) ─────────────────

function RowC({ items }: { items: HomeCategory[] }) {
  if (items.length === 1)
    return (
      <div className={ROW_H}>
        <Card {...items[0]} className="h-full w-full" />
      </div>
    );

  if (items.length === 2)
    return (
      <div className={`flex ${GAP} ${ROW_H}`}>
        <Card {...items[0]} className="flex-1 h-full" />
        <Card {...items[1]} className="flex-1 h-full" />
      </div>
    );

  if (items.length === 3)
    return (
      <div className={`flex ${GAP} ${ROW_H}`}>
        <div className={`${NARR} flex flex-col ${GAP} h-full`}>
          <Card {...items[0]} className="flex-1" />
          <Card {...items[1]} className="flex-1" />
        </div>
        <Card {...items[2]} className={`${WIDE} h-full`} />
      </div>
    );

  // 4 items — the full C pattern
  return (
    <div className={`flex ${GAP} ${ROW_H}`}>
      <div className={`${NARR} flex flex-col ${GAP} h-full`}>
        <Card {...items[0]} className="flex-1" />
        <Card {...items[1]} className="flex-1" />
      </div>
      <div className={`${WIDE} flex ${GAP} h-full`}>
        <Card {...items[2]} className="flex-1 h-full" />
        <Card {...items[3]} className="flex-1 h-full" />
      </div>
    </div>
  );
}

// ─── Row builder ─────────────────────────────────────────────────────────────
// Pattern: A(2) → B(2) → C(4) → repeat

const ROW_COMPONENTS = [RowA, RowB, RowC] as const;
const ROW_SIZES = [2, 2, 4] as const;

function buildRows(cats: HomeCategory[]) {
  const rows: {
    Row: (typeof ROW_COMPONENTS)[number];
    items: HomeCategory[];
  }[] = [];
  let i = 0,
    step = 0;
  while (i < cats.length) {
    const idx = step % 3;
    rows.push({
      Row: ROW_COMPONENTS[idx],
      items: cats.slice(i, i + ROW_SIZES[idx]),
    });
    i += ROW_SIZES[idx];
    step++;
  }
  return rows;
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function HomeCategories({
  categories,
}: {
  categories: HomeCategory[];
}) {
  const rows = buildRows(categories);
  if (rows.length === 0) return null;

  return (
    <section className="py-4 lg:py-6">
      <div className={`flex flex-col ${GAP}`}>
        {rows.map(({ Row, items }, i) => (
          <Row key={i} items={items} />
        ))}
      </div>
    </section>
  );
}
