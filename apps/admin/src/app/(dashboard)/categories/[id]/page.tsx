"use client";

import Image from "next/image";
import { use, useState, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CirclePlus, ArrowUpDown, ChevronDown, Pencil } from "lucide-react";
import {
  useCategories,
  useCategory,
  useCategoryProducts,
  useUpdateCategory,
  useCategoryNextPosition,
  type Category,
  type AdminProductListItem,
} from "@/lib/hooks/useCategories";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import SearchBar from "@/components/ui/SearchBar";
import TabPill from "@/components/ui/TabPill";
import Pagination from "@/components/ui/Pagination";
import ImageUpload from "@/components/ui/ImageUpload";
import Toggle from "@/components/ui/Toggle";
import CopyId from "@/components/ui/CopyId";
import SingleSelectDropdown from "@/components/ui/SingleSelectDropdown";
import { buildPositionOptions } from "@/lib/positions";
import { formatDate, formatPrice, slugify } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageCategories } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── TextInput ────────────────────────────────────────────────────────────── */

function TextInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
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
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
      />
    </div>
  );
}

/* ── SelectField (read-only or interactive select) ───────────────────────── */

function SelectField({
  label,
  displayValue,
  options,
  value,
  onChange,
}: {
  label: string;
  displayValue: string;
  options?: { value: string; label: string }[];
  value?: string;
  onChange?: (v: string) => void;
}) {
  const editable = !!(options && onChange);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-s font-medium text-text-body font-figtree">
        {label}
      </label>
      <div className="relative">
        <select
          disabled={!editable}
          value={editable ? (value ?? "") : "_val"}
          onChange={editable ? (e) => onChange!(e.target.value) : undefined}
          className="w-full appearance-none px-3 py-2.5 pr-10 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:cursor-default"
        >
          {editable ? (
            options!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ) : (
            <option value="_val">{displayValue}</option>
          )}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 10;
type TabType = "products" | "subcategories";
type ViewType = "all" | "available" | "importation" | "draft";

const TABS: { id: ViewType; label: string }[] = [
  { id: "all", label: "Todos produtos" },
  { id: "available", label: "Entrega imediata" },
  { id: "importation", label: "Por importação" },
  { id: "draft", label: "Rascunho" },
];

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const allowCategoryManagement = canManageCategories(user);
  const { id } = use(params);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [view, setView] = useState<ViewType>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [, startTransition] = useTransition();

  /* Edit form state */
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState("1");

  const { data: category, isLoading: catLoading } = useCategory(id);
  const { data: allCats } = useCategories();
  const updateCategory = useUpdateCategory();

  // When editing, derive next position for the currently selected scope
  const editLevel = category?.level ?? null;
  const editScopeParentId = isEditing ? editParentId : null;
  const { data: nextPositionData } = useCategoryNextPosition(
    isEditing ? editLevel : null,
    editScopeParentId,
  );

  if (!allowCategoryManagement) {
    return (
      <AccessDeniedState message="A sua role não pode gerir categorias." />
    );
  }

  /* Sync form when category loads or edit mode toggled */
  useEffect(() => {
    if (category) {
      setEditName(category.name);
      setEditIsActive(category.isActive);
      setEditImageUrl(category.imageUrl);
      setEditParentId(category.parentId ?? null);
      setEditPosition(String(category.position ?? 1));
    }
  }, [category]);

  /* Products data */
  const { data: prodData, isLoading: prodsLoading } = useCategoryProducts(
    activeTab === "products" ? id : null,
    {
      page,
      limit: PAGE_SIZE,
      view,
      search: search || undefined,
      sortOrder,
    },
  );

  /* Subcategories data */
  const { data: subData, isLoading: subsLoading } = useCategoryProducts(
    activeTab === "subcategories" ? id : null,
    { view: "subcategories" },
  );

  const products = prodData?.items ?? [];
  const productTotal = prodData?.total ?? 0;
  const productTotalPages = prodData?.totalPages ?? 1;

  const subcategories = subData?.subcategories ?? [];

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
      setPage(1);
    });
  }, []);

  async function handlePublish() {
    if (!category) return;
    try {
      const effectiveName = editName.trim() || category.name;

      // Resolve parent names for slug using editParentId where applicable
      const slugParts: string[] = [];
      if (category.level === 1) {
        // immediate parent is L0 — may have changed
        const l0Name =
          allCats?.find((c) => c.id === editParentId)?.name ??
          category.parent?.name;
        if (l0Name) slugParts.push(slugify(l0Name));
      } else if (category.level === 2) {
        // L0 grandparent stays fixed; L1 parent may have changed
        const l0Name = category.parent?.parent?.name ?? category.parent?.name;
        if (l0Name) slugParts.push(slugify(l0Name));
        const l1Parent = allCats
          ?.find(
            (c) =>
              c.id === (category.parent?.parent?.id ?? category.parent?.id),
          )
          ?.children?.find((c) => c.id === editParentId);
        const l1Name = l1Parent?.name ?? category.parent?.name;
        if (l1Name) slugParts.push(slugify(l1Name));
      }
      slugParts.push(slugify(effectiveName));

      await updateCategory.mutateAsync({
        id,
        data: {
          name: effectiveName,
          slug: slugParts.join("-"),
          isActive: editIsActive,
          position: parseInt(editPosition) || 1,
          imageUrl: editImageUrl,
          ...(category.level > 0 &&
            editParentId !== category.parentId && {
              parentId: editParentId ?? undefined,
            }),
        },
      });
      setIsEditing(false);
    } catch {
      /* toast handled in hook */
    }
  }

  function handleCancel() {
    if (category) {
      setEditName(category.name);
      setEditIsActive(category.isActive);
      setEditImageUrl(category.imageUrl);
      setEditParentId(category.parentId ?? null);
      setEditPosition(String(category.position ?? 1));
    }
    setIsEditing(false);
  }

  const level = category?.level ?? 0;
  const parent = category?.parent ?? null;
  const grandParent = parent?.parent ?? null;
  const l0Parent = level === 1 ? parent : level === 2 ? grandParent : null;
  const l1Parent = level === 2 ? parent : null;

  const targetParentId =
    isEditing && editParentId !== null
      ? editParentId
      : (category?.parentId ?? null);

  const rootSiblings = allCats ?? [];
  const level1Siblings = targetParentId
    ? (rootSiblings.find((c) => c.id === targetParentId)?.children ?? [])
    : [];
  const level2Siblings = targetParentId
    ? (rootSiblings
        .flatMap((c) => c.children ?? [])
        .find((c) => c.id === targetParentId)?.children ?? [])
    : [];

  const scopedSiblings = !category
    ? []
    : level === 0
      ? rootSiblings
      : level === 1
        ? level1Siblings
        : level2Siblings;

  const occupiedScopedPositions = new Set(
    scopedSiblings.filter((c) => c.id !== category?.id).map((c) => c.position),
  );

  const availablePositionOptions = nextPositionData
    ? buildPositionOptions({
        occupiedPositions: nextPositionData.occupiedPositions,
        nextPosition: nextPositionData.nextPosition,
        currentPosition: category?.position ?? undefined,
        startFrom: 1,
      })
    : // Fallback while API loads: derive from tree
      Array.from({ length: 21 }, (_, i) => i + 1)
        .filter(
          (i) =>
            i === (category?.position ?? -1) ||
            !occupiedScopedPositions.has(i),
        )
        .map((i) => ({ value: String(i), label: String(i) }));

  useEffect(() => {
    if (!isEditing || !category || availablePositionOptions.length === 0) return;
    const stillValid = availablePositionOptions.some(
      (opt) => opt.value === editPosition,
    );
    if (!stillValid) {
      // Prefer API-suggested next position if available, else fall back to first option
      const apiNext = nextPositionData?.nextPosition;
      const preferred = apiNext
        ? availablePositionOptions.find((o) => o.value === String(apiNext))
        : undefined;
      setEditPosition((preferred ?? availablePositionOptions[0]).value);
    }
  }, [isEditing, category, availablePositionOptions, editPosition, nextPositionData]);

  if (catLoading) {
    return (
      <div className="flex flex-col gap-6 flex-1">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-48 rounded" />
          <div className="skeleton h-11 w-36 rounded-lg" />
        </div>
        {/* Two-column card layout */}
        <div className="grid grid-cols-[320px_1fr] gap-6">
          {/* Details card */}
          <div className="bg-card rounded-lg border border-border-light p-6 flex flex-col gap-5">
            <div className="skeleton h-6 w-44 rounded" />
            {[80, 60, 70, 55].map((w, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div
                  className="skeleton h-3.5 rounded"
                  style={{ width: `${w * 0.4}%` }}
                />
                <div className="skeleton h-10 rounded-lg w-full" />
              </div>
            ))}
          </div>

          {/* Image card */}
          <div className="bg-card rounded-lg border border-border-light p-6 flex flex-col gap-4">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton w-full aspect-[4/3] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <p className="text-text-muted font-figtree">
          Categoria não encontrada.
        </p>
        <Link
          href="/categories"
          className="text-accent hover:underline text-sm font-figtree"
        >
          Voltar às categorias
        </Link>
      </div>
    );
  }

  const showSubcategoriesTab = level < 2; // only L0 and L1 have sub-categories

  /* ── Level title ────────────────────────────────────────────────────────────── */
  const detailTitle =
    level === 0
      ? "Detalhes da categoria"
      : `Detalhes da sub categoria ${category.name}`;

  const nameLabel =
    level === 0
      ? "Nome"
      : level === 1
        ? "Categoria secundária (esta)"
        : "Categoria terciária (esta)";

  /* ── Products table columns ───────────────────────────────────────────── */
  const productColumns: TableColumn<AdminProductListItem>[] = [
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
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.updatedAt)}
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
      headerClassName: "w-[80px]",
      render: (item) => (
        <Link
          href={`/products/${item.id}`}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </Link>
      ),
    },
  ];

  /* ── Subcategory table columns ────────────────────────────────────────── */
  const subColumns: TableColumn<Category>[] = [
    {
      key: "nr",
      header: "Nr. subcategoria",
      headerClassName: "w-[140px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "sub",
      header: "Subcategoria",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-surface-hover border border-border-light">
            {item.imageUrl ? (
              <Image
                fill
                src={item.imageUrl}
                alt={item.name}
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="w-full h-full bg-surface-hover" />
            )}
          </div>
          <span className="text-text-dark text-sm font-medium font-figtree">
            {item.name}
          </span>
        </div>
      ),
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
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "items",
      header: "Nr de itens",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="font-inter text-text-dark text-s">
          {item._count?.products ?? 0}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <Link
          href={`/categories/${item.id}`}
          className="text-accent text-sm font-medium hover:underline"
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Action button row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        {showSubcategoriesTab && !isEditing && (
          <button
            type="button"
            onClick={() => router.push(`/categories/new?parentId=${id}`)}
            className="flex items-center gap-2 border border-border text-text-dark text-sm font-bold font-figtree px-4 py-2.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <CirclePlus size={16} />
            Adicionar subcategoria
          </button>
        )}
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
              disabled={updateCategory.isPending}
              onClick={handlePublish}
              className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {updateCategory.isPending ? "A guardar…" : "Publicar"}
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

      {/* ── Top info section ──────────────────────────────────────────── */}
      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Image card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Imagem da categoria
          </h3>
          <p className="text-md font-bold text-primary font-lato">
            {level === 0
              ? "Imagem principal"
              : level === 1
                ? "Imagem da subcategoria"
                : "Imagem da categoria terciária"}
          </p>
          <ImageUpload
            imageUrl={isEditing ? editImageUrl : category.imageUrl}
            onChange={setEditImageUrl}
            disabled={!isEditing}
            context="category"
          />
        </div>

        {/* Details card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-text-darkfont-figtree leading-snug">
            {detailTitle}
          </h3>

          {/* L1: principal parent — editable in edit mode */}
          {level === 1 && (
            <SelectField
              label="Categoria principal (Parente)"
              displayValue={l0Parent?.name ?? "—"}
              {...(isEditing && {
                options: (allCats ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
                value: editParentId ?? "",
                onChange: setEditParentId,
              })}
            />
          )}

          {/* L2: principal grandparent read-only + secondary parent editable in edit mode */}
          {level === 2 && (
            <>
              <SelectField
                label="Categoria principal (Parente)"
                displayValue={l0Parent?.name ?? "—"}
              />
              <SelectField
                label="Categoria secundária"
                displayValue={l1Parent?.name ?? "—"}
                {...(isEditing && {
                  options: (
                    (allCats ?? []).find((c) => c.id === l0Parent?.id)
                      ?.children ?? []
                  ).map((c) => ({ value: c.id, label: c.name })),
                  value: editParentId ?? "",
                  onChange: setEditParentId,
                })}
              />
            </>
          )}

          {/* Name — always form-style input, disabled in view mode */}
          <TextInput
            label={nameLabel}
            value={isEditing ? editName : category.name}
            onChange={setEditName}
            disabled={!isEditing}
          />

          {/* Position — smart dropdown with gap filling */}
          <SingleSelectDropdown
            label="Índice de exibição"
            options={
              isEditing
                ? availablePositionOptions
                : [
                    {
                      value: String(category.position ?? 1),
                      label: String(category.position ?? 1),
                    },
                  ]
            }
            value={isEditing ? editPosition : String(category.position ?? 1)}
            onChange={isEditing ? setEditPosition : undefined}
            disabled={!isEditing}
          />

          {/* Toggles */}
          {level === 0 ? (
            /* L0: Principal indicator + Visível side by side */
            <div className="grid grid-cols-2 gap-6 pt-4 mt-2">
              <Toggle
                orientation="vertical"
                label="Principal"
                value={true}
                disabled
              />
              <Toggle
                orientation="vertical"
                label="Visível"
                value={isEditing ? editIsActive : category.isActive}
                onChange={isEditing ? setEditIsActive : undefined}
                disabled={!isEditing}
              />
            </div>
          ) : (
            /* L1 / L2: just Visível */
            <div className="border-t border-border-light pt-4 mt-2">
              <Toggle
                label="Visível"
                value={isEditing ? editIsActive : category.isActive}
                onChange={isEditing ? setEditIsActive : undefined}
                disabled={!isEditing}
              />
            </div>
          )}

          {isEditing && (
            <div className="border-t border-border-light pt-4 mt-2 flex justify-end">
              <button
                type="button"
                disabled={updateCategory.isPending}
                onClick={handlePublish}
                className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {updateCategory.isPending ? "A guardar…" : "Publicar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs + table ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <TabPill
            tabs={[
              {
                id: "products",
                label: "Todos produtos",
                count: activeTab === "products" ? productTotal : undefined,
              },
              ...(showSubcategoriesTab
                ? [
                    {
                      id: "subcategories",
                      label: "Subcategorias",
                      count:
                        activeTab === "subcategories"
                          ? subcategories.length
                          : undefined,
                    },
                  ]
                : []),
            ]}
            activeTab={activeTab}
            onTabChange={(id) => {
              setActiveTab(id as "products" | "subcategories");
              setPage(1);
              setSearch("");
            }}
          />

          {activeTab === "products" && (
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
              {/* Product view filter sub-tabs */}
              <div className="flex items-center gap-1">
                {TABS.slice(1).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setView(tab.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-figtree transition-colors ${
                      view === tab.id
                        ? "bg-navy/10 text-navy font-bold"
                        : "text-text-muted hover:bg-surface-hover"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Procure pelo nome"
                className="w-full sm:w-66"
              />
              <button
                onClick={() => {
                  setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                  setPage(1);
                }}
                className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="px-6 pb-2 pt-4">
          {activeTab === "products" ? (
            <DataTable
              columns={productColumns}
              rows={products}
              keyExtractor={(p) => p.id}
              loading={prodsLoading}
              emptyMessage="Nenhum produto nesta categoria."
            />
          ) : (
            <DataTable
              columns={subColumns}
              rows={subcategories}
              keyExtractor={(c) => c.id}
              loading={subsLoading}
              emptyMessage="Nenhuma subcategoria encontrada."
            />
          )}
        </div>

        {/* Range indicator (products tab only) */}
        {activeTab === "products" && !prodsLoading && productTotal > 0 && (
          <div className="px-6 pb-4 pt-1 text-right">
            <span className="text-s font-inter text-text-subtle">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, productTotal)} de {productTotal}
            </span>
          </div>
        )}
      </div>

      {/* Pagination (products tab only) */}
      {activeTab === "products" && (
        <Pagination
          page={page}
          total={productTotalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
