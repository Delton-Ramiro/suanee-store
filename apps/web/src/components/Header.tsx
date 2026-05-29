"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Heart, User, ShoppingBag, Menu, X } from "lucide-react";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { MegaMenu } from "@/components/MegaMenu";

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
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: tree } = useCategoryTree();
  const categories = (tree ?? [])
    .filter((c) => !!c?.slug && !!c?.name)
    .sort((a, b) => a.position - b.position);

  const openCategory = categories.find((c) => c.id === openCategoryId) ?? null;

  const scheduleClose = useCallback(() => {
    closeTimeout.current = setTimeout(() => setOpenCategoryId(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
  }, []);

  const openMenu = useCallback(
    (id: string) => {
      cancelClose();
      setOpenCategoryId(id);
    },
    [cancelClose],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
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
            className="font-bold text-[22px] tracking-[0.04em] text-brand uppercase leading-none shrink-0"
            onClick={() => setOpenCategoryId(null)}
          >
            SUANEE
          </Link>

          {/* Center — first-level categories */}
          <nav
            className="hidden md:flex flex-1 items-center justify-center pr-10 xl:pr-14 gap-1"
            aria-label="Categorias"
          >
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/produtos?categoria=${encodeURIComponent(cat.slug)}`}
                onMouseEnter={() => openMenu(cat.id)}
                onMouseLeave={scheduleClose}
              className="text-sm font-medium whitespace-nowrap transition-colors duration-150 px-3 py-1.5 rounded-md text-brand hover:text-primary"
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

      {/* ── Mega menu panel (desktop only) ───────────────────────── */}
      {openCategory && openCategory.children.length > 0 && (
        <div className="hidden md:block">
          {/* Dark backdrop — covers page below the menu */}
          <div
            className="fixed top-[98px] inset-x-0 bottom-0 z-30 bg-black/30"
            onClick={() => setOpenCategoryId(null)}
          />
          {/* Panel */}
          <div
            className="fixed top-[98px] left-0 right-0 z-40"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <MegaMenu
              key={openCategory.id}
              category={openCategory}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            />
          </div>
        </div>
      )}

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
