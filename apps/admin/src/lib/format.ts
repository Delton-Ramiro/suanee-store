/** Formats an ISO date string as DD-MM-YYYY */
export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** Formats an ISO date string as DD-MM-YYYY HH:MM */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Formats a numeric price with pt-MZ locale */
export function formatPrice(value: number | string) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Returns a short display ID like #AB12 */
export function shortId(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

/** Converts a display name to a URL-safe slug */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
