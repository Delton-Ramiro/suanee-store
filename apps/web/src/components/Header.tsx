"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Heart, User, ShoppingBag, Menu, X } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

type NavCategory = {
  id: string;
  name: string;
  slug: string;
  position: number;
};

/* ─── Icon sizes ──────────────────────────────────────────────── */
const iconCls = "w-[22px] h-[22px] stroke-[1.5]";

/* ─── Utility icon button ─────────────────────────────────────── */
function IconBtn({
  href,
  label,
  badge,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex items-center justify-center text-brand hover:text-primary transition-colors duration-150"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ─── Component ───────────────────────────────────────────────── */
export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState<NavCategory[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/catalog/categories`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as NavCategory[];
        if (!ignore) {
          setCategories(
            (Array.isArray(data) ? data : [])
              .filter((c) => !!c?.slug && !!c?.name)
              .sort((a, b) => a.position - b.position),
          );
        }
      } catch {
        // silent
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      {/* ── Desktop / Tablet nav ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-nav h-[98px]">
        <div className="container-web h-full flex items-center gap-4">
          {/* Left — logo */}
          <Link
            href="/"
            className="font-bold text-[34px] tracking-[0.06em] text-brand uppercase leading-none shrink-0"
          >
            SUANEE
          </Link>

          {/* Center — first-level categories */}
          <nav
            className="hidden md:flex flex-1 items-center justify-center pr-10 xl:pr-14 gap-4 lg:gap-6 xl:gap-7"
            aria-label="Categorias"
          >
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/produtos?categoria=${encodeURIComponent(cat.slug)}`}
                className="text-sm font-medium text-brand hover:text-primary whitespace-nowrap transition-colors duration-150"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Right — utility links + icons */}
          <div className="hidden md:flex ml-auto shrink-0 flex-col items-end gap-2">
            {/* Top row — helper text */}
            <div className="flex items-center gap-4 text-[13px] font-medium text-brand">
              <Link
                href="/ajuda"
                className="hover:text-primary transition-colors duration-150"
              >
                ajuda
              </Link>
              <Link
                href="/conta/encomendas"
                className="hover:text-primary transition-colors duration-150"
              >
                encomenda e devoluções
              </Link>
            </div>

            {/* Bottom row — action icons */}
            <div className="flex items-center gap-4">
              <IconBtn href="/pesquisa" label="Pesquisar">
                <Search className={iconCls} />
              </IconBtn>

              <IconBtn href="/favoritos" label="Favoritos">
                <Heart className={iconCls} />
              </IconBtn>

              <IconBtn href="/conta" label="A minha conta">
                <User className={iconCls} />
              </IconBtn>

              {/* Separator */}
              <span className="w-px h-5 bg-brand/20" aria-hidden="true" />

              <IconBtn href="/carrinho" label="Carrinho de compras">
                <ShoppingBag className={iconCls} />
              </IconBtn>
            </div>
          </div>

          {/* Mobile — icons + hamburger */}
          <div className="flex md:hidden ml-auto items-center gap-3">
            <IconBtn href="/pesquisa" label="Pesquisar">
              <Search className="w-[20px] h-[20px] stroke-[1.5]" />
            </IconBtn>
            <IconBtn href="/carrinho" label="Carrinho">
              <ShoppingBag className="w-[20px] h-[20px] stroke-[1.5]" />
            </IconBtn>
            <button
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((v) => !v)}
              className="flex items-center justify-center text-brand hover:text-primary transition-colors duration-150"
            >
              {mobileOpen ? (
                <X className="w-[22px] h-[22px]" />
              ) : (
                <Menu className="w-[22px] h-[22px]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu drawer ───────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-[98px] left-0 right-0 z-50 bg-white border-t border-border md:hidden shadow-nav">
            <div className="container-web py-6 flex flex-col gap-4">
              {/* First-level categories */}
              {categories.length > 0 && (
                <div className="flex flex-col gap-3 pb-4 border-b border-border">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/produtos?categoria=${encodeURIComponent(cat.slug)}`}
                      onClick={() => setMobileOpen(false)}
                      className="text-base font-medium text-brand hover:text-primary transition-colors duration-150"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Helper links */}
              <div className="flex flex-col gap-3 pb-4 border-b border-border">
                <Link
                  href="/ajuda"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                >
                  Ajuda
                </Link>
                <Link
                  href="/conta/encomendas"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                >
                  Encomendas e devoluções
                </Link>
              </div>

              {/* Account shortcuts */}
              <div className="flex flex-col gap-3">
                <Link
                  href="/conta"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                >
                  <User className="w-4 h-4" />A minha conta
                </Link>
                <Link
                  href="/favoritos"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                >
                  <Heart className="w-4 h-4" />
                  Favoritos
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
