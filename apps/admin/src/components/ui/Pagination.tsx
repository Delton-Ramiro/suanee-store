interface PaginationProps {
  /** Current 1-based page number */
  page: number;
  /** Total number of known pages */
  total: number;
  onPageChange: (page: number) => void;
}

/** Builds a windowed page list with ellipsis markers.
 *  e.g. page=7, total=24 → [1, '…', 5, 6, 7, 8, 9, '…', 24]
 */
function buildPages(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [];
  const WING = 2; // pages each side of current
  const lo = Math.max(2, page - WING);
  const hi = Math.min(total - 1, page + WING);

  pages.push(1);
  if (lo > 2) pages.push("…");
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (hi < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export default function Pagination({
  page,
  total,
  onPageChange,
}: PaginationProps) {
  if (total <= 1) return null;

  const btnBase =
    "w-8 h-8 rounded-md text-sm font-medium font-inter transition-colors";
  const btnActive = "bg-navy text-white font-semibold";
  const btnInactive =
    "bg-card border border-border text-text-dark hover:bg-surface-hover";

  return (
    <div className="flex justify-center items-center gap-1.5 py-6">
      {buildPages(page, total).map((p, i) =>
        p === "…" ? (
          <span
            key={`ellipsis-${i}`}
            className="w-8 h-8 flex items-center justify-center text-text-muted text-sm font-inter select-none"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
          >
            {p}
          </button>
        ),
      )}
    </div>
  );
}
