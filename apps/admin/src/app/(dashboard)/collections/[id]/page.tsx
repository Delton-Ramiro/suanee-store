"use client";

import Image from "next/image";
import {
  use,
  useState,
  useCallback,
  useTransition,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Pencil,
  CirclePlus,
  Trash2,
  ChevronDown,
  Search,
  X,
  Check,
} from "lucide-react";
import {
  useCollection,
  useCollectionProducts,
  useUpdateCollection,
  useAddProductsToCollection,
  useRemoveProductFromCollection,
  useCollectionNextPosition,
  type CollectionProduct,
} from "@/lib/hooks/useCollections";
import {
  useAdminProducts,
  type AdminProduct,
} from "@/lib/hooks/useAdminProducts";
import { useCategories } from "@/lib/hooks/useCategories";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import SearchBar from "@/components/ui/SearchBar";
import TabPill from "@/components/ui/TabPill";
import Pagination from "@/components/ui/Pagination";
import ImageUpload from "@/components/ui/ImageUpload";
import Toggle from "@/components/ui/Toggle";
import CopyId from "@/components/ui/CopyId";
import SingleSelectDropdown from "@/components/ui/SingleSelectDropdown";
import { buildPositionOptions } from "@/lib/positions";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageCollections } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── TextInput ────────────────────────────────────────────────────────────── */

function TextInput({
  label,
  value,
  onChange,
  disabled = false,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-s font-medium text-text-body font-figtree">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default ${mono ? "font-mono" : "font-figtree"}`}
      />
    </div>
  );
}

/* ── ProductPickerDropdown ────────────────────────────────────────────────── */

function ProductPickerDropdown({
  collectionId,
  alreadyInCollection,
}: {
  collectionId: string;
  alreadyInCollection: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addProducts = useAddProductsToCollection();

  const { data, isLoading } = useAdminProducts({
    limit: 20,
    search: search || undefined,
  });
  const products = (data?.items ?? []).filter(
    (p) => !alreadyInCollection.has(p.id),
  );

  /* Close on outside click */
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

  /* Focus input when opened */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!selected.size) return;
    await addProducts.mutateAsync({
      collectionId,
      productIds: Array.from(selected),
    });
    setSelected(new Set());
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-10 px-4 bg-navy text-white text-s font-bold font-lato rounded-lg hover:bg-primary transition-colors"
      >
        <CirclePlus size={16} />
        Adicionar produto
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-95 bg-card border border-border-light rounded-xl shadow-card z-50 flex flex-col overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-light">
            <Search size={15} className="text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procure pelo nome do produto…"
              className="flex-1 text-s font-figtree text-text-dark placeholder:text-text-label bg-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-text-muted hover:text-text-dark"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Product list — scrollable, footer stays pinned below */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ maxHeight: "288px" }}
          >
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="skeleton w-4 h-4 rounded" />
                  <div className="skeleton w-9 h-9 rounded-lg" />
                  <div className="skeleton h-3.5 flex-1 rounded" />
                </div>
              ))
            ) : products.length === 0 ? (
              <p className="text-center text-text-muted font-figtree text-s py-8">
                {search
                  ? `Nenhum resultado para "${search}"`
                  : "Todos os produtos já foram adicionados."}
              </p>
            ) : (
              products.map((p) => {
                const checked = selected.has(p.id);
                const thumb = p.media?.[0]?.url;
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                      checked ? "bg-navy/5" : "hover:bg-surface-hover"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? "bg-navy border-navy" : "border-border"
                      }`}
                    >
                      {checked && (
                        <Check
                          size={10}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </div>
                    {/* Thumbnail */}
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-surface-hover border border-border-light shrink-0">
                      {thumb ? (
                        <Image
                          fill
                          src={thumb}
                          alt={p.name}
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <div className="w-full h-full bg-bg" />
                      )}
                    </div>
                    {/* Name + price */}
                    <div className="flex-1 min-w-0">
                      <p className="text-s font-figtree text-text-dark truncate">
                        {p.name}
                      </p>
                      <p className="text-xxs font-inter text-text-muted">
                        {formatPrice(p.basePrice)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border-light bg-bg">
            <span className="text-[12px] text-text-muted font-figtree">
              {selected.size > 0
                ? `${selected.size} selecionado(s)`
                : "Selecione produtos"}
            </span>
            <button
              onClick={handleAdd}
              disabled={!selected.size || addProducts.isPending}
              className="px-4 py-1.5 rounded-lg bg-navy text-white text-s font-bold font-lato hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addProducts.isPending ? "A adicionar…" : "Adicionar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 10;
type ViewType = "all" | "available" | "importation" | "draft";

const VIEW_TABS: { id: ViewType; label: string }[] = [
  { id: "all", label: "Todos produtos" },
  { id: "available", label: "Entrega imediata" },
  { id: "importation", label: "Por importação" },
  { id: "draft", label: "Rascunho" },
];

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const allowCollectionManagement = canManageCollections(user);
  const { id } = use(params);
  const [, startTransition] = useTransition();

  const [isEditing, setIsEditing] = useState(false);

  /* Edit state */
  const [editName, setEditName] = useState("");
  const [editCoverImageUrl, setEditCoverImageUrl] = useState<string | null>(
    null,
  );
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPosition, setEditPosition] = useState<number>(0);
  const [editIsCategorized, setEditIsCategorized] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>("");

  /* Remove confirmation */
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  /* Products state */
  const [view, setView] = useState<ViewType>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: collection, isLoading: colLoading } = useCollection(id, {
    enabled: allowCollectionManagement,
  });
  const updateCollection = useUpdateCollection();
  const removeProduct = useRemoveProductFromCollection();
  const { data: categories = [] } = useCategories({ level: 0 });
  const { data: nextPositionData } = useCollectionNextPosition(
    isEditing ? (editIsCategorized ? (editCategoryId || null) : null) : undefined,
  );

  const positionOptions = isEditing && nextPositionData
    ? buildPositionOptions({
        occupiedPositions: nextPositionData.occupiedPositions,
        nextPosition: nextPositionData.nextPosition,
        currentPosition: collection?.position ?? undefined,
        startFrom: 1,
      })
    : [];

  if (!allowCollectionManagement) {
    return <AccessDeniedState message="A sua role não pode gerir coleções." />;
  }

  const { data: prodData, isLoading: prodsLoading } = useCollectionProducts(
    id,
    {
      page,
      limit: PAGE_SIZE,
      view,
      search: search || undefined,
      sortOrder,
    },
    { enabled: allowCollectionManagement },
  );

  const products = prodData?.items ?? [];
  const total = prodData?.total ?? 0;
  const totalPages = prodData?.totalPages ?? 1;

  const alreadyInCollection = new Set(products.map((p) => p.id));

  /* Sync form when collection loads */
  useEffect(() => {
    if (collection) {
      setEditName(collection.name);
      setEditCoverImageUrl(collection.coverImageUrl);
      setEditIsActive(collection.isActive);
      setEditPosition(collection.position ?? 0);
      setEditIsCategorized(!!collection.categoryId);
      setEditCategoryId(collection.categoryId ?? "");
    }
  }, [collection]);

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  async function handleSave() {
    if (!collection) return;
    try {
      await updateCollection.mutateAsync({
        id,
        data: {
          name: editName.trim(),
          slug: collection.slug,
          coverImageUrl: editCoverImageUrl || null,
          isActive: editIsActive,
          position: editPosition,
          categoryId: editIsCategorized && editCategoryId ? editCategoryId : null,
        },
      });
      setIsEditing(false);
    } catch {
      /* toast handled in hook */
    }
  }

  function handleCancel() {
    if (collection) {
      setEditName(collection.name);
      setEditCoverImageUrl(collection.coverImageUrl);
      setEditIsActive(collection.isActive);
      setEditPosition(collection.position ?? 0);
      setEditIsCategorized(!!collection.categoryId);
      setEditCategoryId(collection.categoryId ?? "");
    }
    setIsEditing(false);
  }

  /* ── Columns ──────────────────────────────────────────────────────────── */
  const columns: TableColumn<CollectionProduct>[] = [
    {
      key: "nr",
      header: "Nr. produto",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "produto",
      header: "Produto",
      render: (item) => {
        const thumb = item.media?.[0]?.url;
        return (
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-surface-hover border border-border-light">
              {thumb ? (
                <Image
                  fill
                  src={thumb}
                  alt={item.name}
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <div className="w-full h-full bg-surface-hover" />
              )}
            </div>
            <span className="text-text-dark text-sm font-medium font-figtree line-clamp-2">
              {item.name}
            </span>
          </div>
        );
      },
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "preco",
      header: "Preço",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="font-inter text-text-dark text-s">
          {formatPrice(item.basePrice)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[180px]",
      render: (item) => {
        if (confirmRemoveId === item.id) {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  removeProduct.mutate({
                    collectionId: id,
                    productId: item.id,
                  });
                  setConfirmRemoveId(null);
                }}
                className="px-3 py-1.5 rounded-md bg-danger text-white text-s font-bold font-figtree hover:opacity-90 transition-opacity"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="px-3 py-1.5 rounded-md border border-border text-text-body text-s font-bold font-figtree hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-3">
            <Link
              href={`/products/${item.id}`}
              className="text-accent text-sm font-medium hover:underline"
            >
              Editar
            </Link>
            {isEditing && (
              <button
                onClick={() => setConfirmRemoveId(item.id)}
                className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                aria-label="Remover da coleção"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  /* ── Skeleton ─────────────────────────────────────────────────────────── */
  if (colLoading) {
    return (
      <div className="flex flex-col gap-6 flex-1">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-48 rounded" />
          <div className="skeleton h-11 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="bg-card rounded-lg border border-border-light p-6 flex flex-col gap-4">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton w-full aspect-square rounded-xl" />
          </div>
          <div className="bg-card rounded-lg border border-border-light p-6 flex flex-col gap-5">
            <div className="skeleton h-6 w-44 rounded" />
            {[80, 60, 70].map((w, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div
                  className="skeleton h-3.5 rounded"
                  style={{ width: `${w * 0.4}%` }}
                />
                <div className="skeleton h-10 rounded-lg w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <p className="text-text-muted font-figtree">Coleção não encontrada.</p>
        <Link
          href="/collections"
          className="text-accent hover:underline text-sm font-figtree"
        >
          Voltar às coleções
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          {collection.name}
        </h2>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 border border-border text-text-body text-sm font-bold font-figtree px-5 py-2.5 rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updateCollection.isPending}
                onClick={handleSave}
                className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {updateCollection.isPending ? "A publicar…" : "Publicar"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 border border-navy text-navy text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:bg-navy/5 transition-colors"
            >
              <Pencil size={15} />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column detail ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Cover image card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Imagem da coleção
          </h3>
          <p className="text-md font-bold text-primary font-lato">
            Imagem de capa
          </p>
          <ImageUpload
            imageUrl={isEditing ? editCoverImageUrl : collection.coverImageUrl}
            onChange={setEditCoverImageUrl}
            disabled={!isEditing}
            context="collection"
          />
        </div>

        {/* Details card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Detalhes da coleção
          </h3>

          <TextInput
            label="Nome"
            value={isEditing ? editName : collection.name}
            onChange={setEditName}
            disabled={!isEditing}
          />

          {/* Category association */}
          <div className="flex flex-col gap-2">
            <Toggle
              label="Associar a categoria"
              value={isEditing ? editIsCategorized : !!collection.categoryId}
              onChange={isEditing ? (v) => {
                setEditIsCategorized(v);
                if (!v) setEditCategoryId("");
              } : undefined}
              disabled={!isEditing}
            />
            {(isEditing ? editIsCategorized : !!collection.categoryId) && (
              <div className="relative">
                <select
                  value={isEditing ? editCategoryId : (collection.categoryId ?? "")}
                  onChange={(e) => isEditing && setEditCategoryId(e.target.value)}
                  disabled={!isEditing}
                  className="w-full appearance-none px-3 py-2.5 pr-10 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
                >
                  <option value="">Selecionar categoria…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                  <ChevronDown size={16} />
                </div>
              </div>
            )}
          </div>

          <SingleSelectDropdown
            label="Índice de exibição"
            options={
              isEditing
                ? positionOptions
                : [
                    {
                      value: String(collection.position ?? 0),
                      label: String(collection.position ?? 0),
                    },
                  ]
            }
            value={String(isEditing ? editPosition : (collection.position ?? 0))}
            onChange={(v) => isEditing && setEditPosition(Number(v))}
            disabled={!isEditing}
          />

          <Toggle
            label="Visível"
            value={isEditing ? editIsActive : collection.isActive}
            onChange={isEditing ? setEditIsActive : undefined}
            disabled={!isEditing}
          />

          {isEditing && (
            <div className="border-t border-border-light pt-4 mt-2 flex justify-end">
              <button
                type="button"
                disabled={updateCollection.isPending}
                onClick={handleSave}
                className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {updateCollection.isPending ? "A publicar..." : "Publicar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Products section ────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <TabPill
            tabs={VIEW_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              count: tab.id === view ? total : undefined,
            }))}
            activeTab={view}
            onTabChange={(id) => {
              setView(id as ViewType);
              setPage(1);
              setSearch("");
            }}
          />
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome"
              className="w-full sm:w-66"
            />
            {isEditing && (
              <ProductPickerDropdown
                collectionId={id}
                alreadyInCollection={alreadyInCollection}
              />
            )}
            <button
              onClick={() => {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                setPage(1);
              }}
              className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Ordenar"
            >
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-2 pt-4">
          <DataTable
            columns={columns}
            rows={products}
            keyExtractor={(p) => p.id}
            loading={prodsLoading}
            emptyMessage="Nenhum produto nesta coleção."
          />
        </div>

        {!prodsLoading && total > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
              de {total}
            </span>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </div>
  );
}
