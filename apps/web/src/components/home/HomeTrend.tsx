"use client";

import Link from "next/link";
import { HorizontalScroll } from "./shared/HorizontalScroll";
import { SectionHeading } from "./shared/SectionHeading";
import { CardOverlayLabel } from "./shared/CardOverlayLabel";

export type Collection = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  position: number;
  isActive: boolean;
};

// ─── Single collection card ───────────────────────────────────────────────────

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/colecoes/${collection.slug}`}
      className="relative overflow-hidden rounded-[10px] block h-full w-full shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] group"
    >
      {collection.coverImageUrl ? (
        <img
          src={collection.coverImageUrl}
          alt={collection.name}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-300" />
      )}
      <CardOverlayLabel name={collection.name} />
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HomeTrend({ collections }: { collections: Collection[] }) {
  if (!collections.length) return null;

  return (
    <section className="py-8 md:py-10">
      <SectionHeading
        title="Tendência"
        mobileSubtitle="As categorias que os outros mais têm comprado"
      />

      {/* Mobile: 2-column grid */}
      <div className="md:hidden grid grid-cols-2 gap-[5px]">
        {collections.map((col) => (
          <div key={col.id} className="relative h-[200px]">
            <CollectionCard collection={col} />
          </div>
        ))}
      </div>

      {/* Desktop: full-bleed horizontal scroll */}
      <HorizontalScroll wrapperClassName="hidden md:block" progressClassName="hidden md:block">
        {collections.map((col) => (
          <div key={col.id} className="relative flex-shrink-0 w-[300px] h-[480px]">
            <CollectionCard collection={col} />
          </div>
        ))}
      </HorizontalScroll>
    </section>
  );
}
