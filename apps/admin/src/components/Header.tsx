"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Package, User, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/orders": "Gestão de encomenda",
  "/clients": "Clientes",
  "/categories": "Categorias",
  "/categories/new": "Adicionar categoria",
  "/sizes": "Tamanhos",
  "/colors": "Cores",
  "/brands": "Marcas",
  "/filters": "Filtros",
  "/most-searched": "Mais procurados",
  "/chats": "Conversas",
  "/products": "Produtos",
  "/products/new": "Novo produto",
  "/collections": "Coleções",
  "/stories": "Stories",
  "/analytics": "Análises",
  "/admin/roles": "Role de admin",
  "/admin/roles/permissions-guide": "Guia de Permissões",
  "/admin/authority": "Controle de autoridade",
  "/admin/currencies": "Câmbio",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const key = "/" + segments.slice(0, i).join("/");
    if (PAGE_TITLES[key]) return PAGE_TITLES[key];
  }
  return "Admin";
}

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePrice: number;
  brand: { name: string };
  media: { url: string }[];
}

interface SearchClient {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface SearchResults {
  products: SearchProduct[];
  clients: SearchClient[];
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const title = getPageTitle(pathname);

  const { toggle } = useSidebar();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Fetch search results
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    apiFetch<SearchResults>(
      `/admin/search?q=${encodeURIComponent(debouncedQuery)}`,
    )
      .then((data) => {
        setResults(data);
        setOpen(true);
      })
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    inputRef.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const hasResults =
    results && (results.products.length > 0 || results.clients.length > 0);

  return (
    <header className="fixed top-0 left-0 md:left-[240px] right-0 z-30 h-header bg-white border-b border-border-light flex items-center gap-3 px-4 md:px-8">
      {/* Hamburger — mobile only */}
      <button
        onClick={toggle}
        className="flex md:hidden items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:bg-surface-hover transition-colors shrink-0"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      <h1
        className={`font-bold text-[18px] md:text-[20px] text-primary tracking-[0.04em] font-lato flex-1 truncate ${mobileSearchOpen ? "hidden sm:block" : ""}`}
      >
        {title}
      </h1>

      {/* Mobile search mode */}
      {mobileSearchOpen && (
        <div ref={wrapperRef} className="relative flex-1 sm:hidden">
          <div className="flex items-center bg-bg rounded-full border border-border-light focus-within:border-border w-full transition-colors">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => hasResults && setOpen(true)}
              className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-text-dark placeholder:text-[rgba(0,0,0,0.45)] font-lato"
              placeholder="Procure produtos e pessoas"
            />
            <span className="flex items-center justify-center w-9 h-9 mr-0.5 rounded-full text-text-muted">
              <Search
                size={18}
                className={loading ? "opacity-40 animate-pulse" : ""}
              />
            </span>
          </div>

          {open && hasResults && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border-light rounded-xl shadow-card overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
              {results!.products.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-2xs uppercase tracking-widest text-text-label font-lato">
                    Produtos
                  </p>
                  {results!.products.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={() => {
                        setOpen(false);
                        setQuery("");
                        setMobileSearchOpen(false);
                        router.push(`/products/${p.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                    >
                      {p.media[0]?.url ? (
                        <Image
                          src={p.media[0].url}
                          alt={p.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-border-light flex items-center justify-center shrink-0">
                          <Package size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-s text-text-dark font-figtree truncate">
                          {p.name}
                        </p>
                        <p className="text-xxs text-text-muted font-figtree">
                          {p.brand.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results!.clients.length > 0 && (
                <div
                  className={
                    results!.products.length > 0
                      ? "border-t border-border-light"
                      : ""
                  }
                >
                  <p className="px-4 pt-3 pb-1 text-2xs uppercase tracking-widest text-text-label font-lato">
                    Clientes
                  </p>
                  {results!.clients.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => {
                        setOpen(false);
                        setQuery("");
                        setMobileSearchOpen(false);
                        router.push(`/clients/${c.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                    >
                      {c.avatarUrl ? (
                        <Image
                          src={c.avatarUrl}
                          alt={c.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center shrink-0">
                          <User size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-s text-text-dark font-figtree truncate">
                          {c.name}
                        </p>
                        <p className="text-xxs text-text-muted font-figtree truncate">
                          {c.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {open && query && !loading && !hasResults && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border-light rounded-xl shadow-card px-4 py-4 z-50">
              <p className="text-s text-text-muted font-figtree text-center">
                Nenhum resultado para &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 md:gap-5 shrink-0">
        {/* Search */}
        <div ref={wrapperRef} className="relative hidden sm:block">
          <div className="flex items-center bg-bg rounded-full border border-border-light focus-within:border-border w-65 md:w-[320px] transition-colors">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => hasResults && setOpen(true)}
              className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-text-dark placeholder:text-[rgba(0,0,0,0.45)] font-lato"
              placeholder="Procure produtos e pessoas"
            />
            <span className="flex items-center justify-center w-9 h-9 mr-0.5 rounded-full text-text-muted">
              <Search
                size={18}
                className={loading ? "opacity-40 animate-pulse" : ""}
              />
            </span>
          </div>

          {/* Dropdown */}
          {open && hasResults && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border-light rounded-xl shadow-card overflow-hidden z-50">
              {results!.products.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-2xs uppercase tracking-widest text-text-label font-lato">
                    Produtos
                  </p>
                  {results!.products.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(`/products/${p.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                    >
                      {p.media[0]?.url ? (
                        <Image
                          src={p.media[0].url}
                          alt={p.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-border-light flex items-center justify-center shrink-0">
                          <Package size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-s text-text-dark font-figtree truncate">
                          {p.name}
                        </p>
                        <p className="text-xxs text-text-muted font-figtree">
                          {p.brand.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results!.clients.length > 0 && (
                <div
                  className={
                    results!.products.length > 0
                      ? "border-t border-border-light"
                      : ""
                  }
                >
                  <p className="px-4 pt-3 pb-1 text-2xs uppercase tracking-widest text-text-label font-lato">
                    Clientes
                  </p>
                  {results!.clients.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(`/clients/${c.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors text-left"
                    >
                      {c.avatarUrl ? (
                        <Image
                          src={c.avatarUrl}
                          alt={c.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-border-light flex items-center justify-center shrink-0">
                          <User size={14} className="text-text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-s text-text-dark font-figtree truncate">
                          {c.name}
                        </p>
                        <p className="text-xxs text-text-muted font-figtree truncate">
                          {c.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {open && query && !loading && !hasResults && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border-light rounded-xl shadow-card px-4 py-4 z-50">
              <p className="text-s text-text-muted font-figtree text-center">
                Nenhum resultado para &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Mobile: Search toggle */}
        <button
          onClick={() => {
            if (mobileSearchOpen) {
              setMobileSearchOpen(false);
              setOpen(false);
            } else {
              setMobileSearchOpen(true);
            }
          }}
          className="flex sm:hidden items-center justify-center w-9 h-9 rounded-full text-text-muted hover:bg-surface-hover transition-colors"
          aria-label={mobileSearchOpen ? "Fechar pesquisa" : "Pesquisar"}
        >
          {mobileSearchOpen ? <X size={20} /> : <Search size={20} />}
        </button>

        {/* Bell */}
        <button
          className={`items-center justify-center w-9 h-9 rounded-full text-text-muted hover:bg-surface-hover transition-colors ${mobileSearchOpen ? "hidden sm:flex" : "flex"}`}
          aria-label="Notificações"
        >
          <Bell size={20} />
        </button>

        {/* Avatar */}
        <div
          className={`relative w-9.5 h-9.5 rounded-full bg-navy items-center justify-center cursor-pointer shrink-0 overflow-hidden ${mobileSearchOpen ? "hidden sm:flex" : "flex"}`}
          aria-label="Conta"
        >
          {user?.avatarUrl ? (
            <Image
              fill
              src={user.avatarUrl}
              alt={user.name}
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <span className="text-white text-s font-bold uppercase font-lato">
              {user?.name?.[0] ?? "A"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
