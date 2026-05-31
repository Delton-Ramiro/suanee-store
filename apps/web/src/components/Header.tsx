"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search,
  Heart,
  User,
  ShoppingBag,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { MegaMenu } from "@/components/MegaMenu";
import { useCart, cartStore } from "@/lib/stores/cartStore";
import { useFavorites, favoritesStore } from "@/lib/stores/favoritesStore";
import { useAuth } from "@/lib/auth";
import { ordersStore } from "@/lib/stores/ordersStore";
import { searchStore } from "@/lib/stores/searchStore";
import { loginStore } from "@/lib/stores/loginStore";

/* ─── Icon sizes ──────────────────────────────────────────────── */
const iconCls = "w-[22px] h-[22px] stroke-[1.5]";

/* ─── Utility icon button (link) ─────────────────────────────── */
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

/* ─── Utility icon button (action) ───────────────────────────── */
function IconBtnAction({
  onClick,
  label,
  badge,
  children,
}: {
  onClick: () => void;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex items-center justify-center text-brand hover:text-primary transition-colors duration-150"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/* ─── Component ───────────────────────────────────────────────── */
export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: tree } = useCategoryTree();
  const { items: cartItems } = useCart();
  const { items: favoriteItems } = useFavorites();
  const { user, signOut } = useAuth();

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const favoriteCount = favoriteItems.length;

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
                href={`/categorias/${cat.slug}`}
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
              <IconBtnAction onClick={searchStore.open} label="Pesquisar">
                <Search className={iconCls} />
              </IconBtnAction>

              <IconBtnAction
                onClick={favoritesStore.open}
                label="Favoritos"
                badge={favoriteCount}
              >
                <Heart className={iconCls} />
              </IconBtnAction>

              {user ? (
                <>
                  <IconBtnAction
                    onClick={ordersStore.open}
                    label="As minhas compras"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-brand/20"
                      />
                    ) : (
                      <span className="w-5.5 h-5.5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center uppercase leading-none">
                        {user.name.charAt(0)}
                      </span>
                    )}
                  </IconBtnAction>
                  <IconBtnAction onClick={signOut} label="Terminar sessão">
                    <LogOut className={iconCls} />
                  </IconBtnAction>
                </>
              ) : (
                <IconBtnAction onClick={loginStore.open} label="Entrar">
                  <User className={iconCls} />
                </IconBtnAction>
              )}

              {/* Separator */}
              <span className="w-px h-5 bg-brand/20" aria-hidden="true" />

              <IconBtnAction
                onClick={cartStore.open}
                label="Carrinho de compras"
                badge={cartCount}
              >
                <ShoppingBag className={iconCls} />
              </IconBtnAction>
            </div>
          </div>

          {/* Mobile — icons + hamburger */}
          <div className="flex md:hidden ml-auto items-center gap-3">
            <IconBtnAction onClick={searchStore.open} label="Pesquisar">
              <Search className="w-[20px] h-[20px] stroke-[1.5]" />
            </IconBtnAction>
            <IconBtnAction
              onClick={cartStore.open}
              label="Carrinho"
              badge={cartCount}
            >
              <ShoppingBag className="w-[20px] h-[20px] stroke-[1.5]" />
            </IconBtnAction>
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
            className="fixed top-[98px] inset-x-0 bottom-0 z-30 bg-black/30 animate-[fade-in_0.2s_ease_both]"
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
                      href={`/categorias/${cat.slug}`}
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
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        ordersStore.open();
                      }}
                      className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                    >
                      <User className="w-4 h-4" />
                      As minhas compras
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                    >
                      <LogOut className="w-4 h-4" />
                      Terminar sessão
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); loginStore.open(); }}
                    className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                  >
                    <User className="w-4 h-4" />
                    Entrar / Criar conta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    favoritesStore.open();
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-brand hover:text-primary transition-colors duration-150"
                >
                  <Heart className="w-4 h-4" />
                  Favoritos
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
