"use client";

import Image from "next/image";
import { Permissions } from "@ecommerce/types";
import {
  Binoculars,
  ChevronDown,
  CircleUser,
  ExternalLink,
  House,
  Images,
  Layers,
  Library,
  LogOut,
  Maximize2,
  MessageCircle,
  Package,
  Palette,
  Settings,
  Shapes,
  ShoppingCart,
  SlidersVertical,
  SquaresExclude,
  Store,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/admin-access";
import { useSidebar } from "@/lib/sidebar-context";

const iconCls = "w-[18px] h-[18px] shrink-0";

/* ─── Nav helpers ───────────────────────────────────────────────── */
const STRUCTURE_ITEMS = [
  {
    href: "/categories",
    label: "Categorias",
    icon: Layers,
    permission: Permissions.CATEGORIES_EDIT,
  },
  {
    href: "/sizes",
    label: "Tamanhos",
    icon: Maximize2,
    permission: Permissions.SIZES_EDIT,
  },
  {
    href: "/colors",
    label: "Cores",
    icon: Palette,
    permission: Permissions.COLORS_EDIT,
  },
  {
    href: "/brands",
    label: "Marcas",
    icon: Tag,
    permission: Permissions.BRANDS_EDIT,
  },
  {
    href: "/filters",
    label: "Filtros",
    icon: SlidersVertical,
    permission: Permissions.FILTERS_EDIT,
  },
  {
    href: "/most-searched",
    label: "Mais procurados",
    icon: Binoculars,
    permission: Permissions.MOST_SEARCHED_EDIT,
  },
  {
    href: "/collections",
    label: "Coleções",
    icon: Library,
    permission: Permissions.COLLECTIONS_EDIT,
  },
  {
    href: "/stories",
    label: "Stories",
    icon: Images,
    permission: Permissions.STORIES_EDIT,
  },
  {
    href: "/admin/currencies",
    label: "Câmbio",
    icon: SquaresExclude,
    permission: Permissions.CURRENCY_EDIT,
  },
];

function navCls(active: boolean) {
  return [
    "flex items-center gap-[10px] px-3 py-[9px] rounded-lg text-sm transition-colors duration-150 w-full text-left",
    active
      ? "bg-navy text-white font-bold"
      : "text-text-nav hover:bg-surface-hover font-normal",
  ].join(" ");
}

function subNavCls(active: boolean) {
  return [
    "flex items-center px-3 py-[7px] rounded-lg text-s transition-colors duration-150",
    active
      ? "bg-navy text-white font-bold"
      : "text-text-muted hover:bg-surface-hover",
  ].join(" ");
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { open, close } = useSidebar();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const visibleStructureItems = STRUCTURE_ITEMS.filter((item) =>
    hasAdminPermission(user, item.permission),
  );
  const canViewDashboard = hasAdminPermission(user, Permissions.DASHBOARD_VIEW);
  const canViewOrders = hasAdminPermission(user, Permissions.ORDERS_VIEW);
  const canViewClients = hasAdminPermission(user, Permissions.CLIENTS_VIEW);
  const canViewChats = hasAdminPermission(user, Permissions.CHATS_VIEW);
  const canViewProducts = hasAdminPermission(user, Permissions.PRODUCTS_VIEW);
  const canManageAdmin = hasAdminPermission(user, Permissions.AUTHORITY_MANAGE);
  const catGroupActive = visibleStructureItems.some((item) =>
    isActive(item.href),
  );
  const [catOpen, setCatOpen] = useState(catGroupActive);

  function handleNav() {
    close();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 no-scrollbar flex flex-col w-[240px] h-screen bg-white border-r border-border-light overflow-y-auto overflow-x-hidden transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 shrink-0">
          <span className="font-black text-[23px] tracking-[0.06em] text-navy uppercase font-figtree">
            SUANEE
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-4 flex flex-col gap-[2px]">
          <p className="px-3 pt-1 pb-1.5 text-2xs uppercase tracking-[0.1em] text-text-label font-figtree">
            Menu principal
          </p>

          {canViewDashboard && (
            <Link
              href="/dashboard"
              onClick={handleNav}
              className={navCls(isActive("/dashboard"))}
            >
              <House className={iconCls} />
              Dashboard
            </Link>
          )}

          {canViewOrders && (
            <Link
              href="/orders"
              onClick={handleNav}
              className={navCls(isActive("/orders"))}
            >
              <ShoppingCart className={iconCls} />
              Gestão de encomenda
            </Link>
          )}

          {canViewClients && (
            <Link
              href="/clients"
              onClick={handleNav}
              className={navCls(isActive("/clients"))}
            >
              <Users className={iconCls} />
              Clientes
            </Link>
          )}

          {/* Categorias group */}
          {visibleStructureItems.length > 0 && (
            <>
              <button
                className={navCls(catGroupActive && !catOpen)}
                onClick={() => setCatOpen((v) => !v)}
              >
                <Shapes className={iconCls} />
                <span className="flex-1 text-left">Estrutura</span>
                <ChevronDown
                  className={`ml-auto w-4 h-4 text-text-label transition-transform duration-200 ${catOpen ? "rotate-180" : ""}`}
                />
              </button>

              {catOpen && (
                <div className="flex flex-col pl-4 mt-0.5 gap-[2px]">
                  {visibleStructureItems.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={handleNav}
                      className={subNavCls(pathname === href)}
                    >
                      <Icon className="w-3.75 h-3.75 shrink-0 mr-2" />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {canViewChats && (
            <Link
              href="/chats"
              onClick={handleNav}
              className={navCls(isActive("/chats"))}
            >
              <MessageCircle className={iconCls} />
              Conversas
            </Link>
          )}

          {canViewProducts && (
            <>
              <p className="px-3 pt-4 pb-1.5 text-2xs uppercase tracking-[0.1em] text-text-label font-lato">
                Produtos
              </p>

              <Link
                href="/products"
                onClick={handleNav}
                className={navCls(isActive("/products"))}
              >
                <Package className={iconCls} />
                Adicionar produtos
              </Link>
            </>
          )}

          {canManageAdmin && (
            <>
              <p className="px-3 pt-4 pb-1.5 text-2xs uppercase tracking-[0.1em] text-text-label font-lato">
                Admin
              </p>

              <Link
                href="/admin/roles"
                onClick={handleNav}
                className={navCls(isActive("/admin/roles"))}
              >
                <CircleUser className={iconCls} />
                Role de admin
              </Link>

              <Link
                href="/admin/authority"
                onClick={handleNav}
                className={navCls(isActive("/admin/authority"))}
              >
                <Settings className={iconCls} />
                Controle de autoridade
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border-light px-3 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-[10px] px-2 py-1.5">
            <div className="relative w-8 h-8 rounded-full bg-navy overflow-hidden flex items-center justify-center text-white shrink-0">
              {user?.avatarUrl ? (
                <Image
                  fill
                  src={user.avatarUrl}
                  alt={user.name}
                  className="object-cover"
                  sizes="32px"
                />
              ) : (
                <CircleUser className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-s text-text-dark truncate font-lato">
                {user?.name ?? "Admin"}
              </p>
              <p className="text-xxs text-text-label truncate font-lato">
                {user?.email ?? ""}
              </p>
            </div>
          </div>

          <Link
            href={process.env.NEXT_PUBLIC_STORE_URL ?? "https://suanee.com"}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-light text-s text-text-muted hover:bg-surface-hover hover:text-navy transition-colors duration-150 font-lato"
            target="blank"
          >
            <Store className={iconCls} />
            <span className="flex-1">Loja Suanee</span>
            <ExternalLink className={iconCls} />
          </Link>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-s text-danger hover:bg-danger/5 transition-colors duration-150 font-lato w-full text-left"
          >
            <LogOut className={iconCls} />
            Terminar sessão
          </button>
        </div>
      </aside>
    </>
  );
}
