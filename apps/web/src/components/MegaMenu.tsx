"use client";

import Link from "next/link";
import type { CategoryL0, CategoryL1 } from "@/lib/hooks/useCategoryTree";

interface MegaMenuProps {
  category: CategoryL0;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/* ── Column — L1 bold header + L2/L3 links ───────────────────────────────── */

function CategoryColumn({ l1 }: { l1: CategoryL1 }) {
  const children = l1.children ?? [];

  return (
    <div className="min-w-[140px] max-w-[190px] flex-1">
      <Link
        href={`/produtos?categoria=${l1.slug}`}
        className="block font-bold text-[13px] text-brand hover:text-primary mb-3 leading-snug"
      >
        {l1.name}
      </Link>

      <div className="flex flex-col">
        {children.map((l2) =>
          (l2.children ?? []).length > 0 ? (
            /* L2 has L3 children — sub-header + links */
            <div key={l2.id} className="mt-2 first:mt-0">
              <Link
                href={`/produtos?categoria=${l2.slug}`}
                className="block font-semibold text-[12px] text-brand hover:text-primary mb-0.5"
              >
                {l2.name}
              </Link>
              {(l2.children ?? []).map((l3) => (
                <Link
                  key={l3.id}
                  href={`/produtos?categoria=${l3.slug}`}
                  className="block text-[13px] text-text-muted hover:text-primary py-[2px] leading-snug"
                >
                  {l3.name}
                </Link>
              ))}
            </div>
          ) : (
            <Link
              key={l2.id}
              href={`/produtos?categoria=${l2.slug}`}
              className="block text-[13px] text-text-muted hover:text-primary py-[2px] leading-snug"
            >
              {l2.name}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

/* ── MegaMenu ─────────────────────────────────────────────────────────────── */

export function MegaMenu({ category, onMouseEnter, onMouseLeave }: MegaMenuProps) {
  const l1List = category.children ?? [];
  if (!l1List.length) return null;

  return (
    <div
      className="w-full bg-white border-t-2 border-accent shadow-[0_4px_20px_rgba(0,0,0,0.08)] max-h-[60vh] overflow-y-auto no-scrollbar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="container-web py-5">
        <div className="flex flex-wrap gap-x-8 gap-y-6 pb-2">
          {l1List.map((l1) => (
            <CategoryColumn key={l1.id} l1={l1} />
          ))}
        </div>
      </div>
    </div>
  );
}
