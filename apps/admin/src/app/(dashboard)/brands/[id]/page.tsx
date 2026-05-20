"use client";

import { use, useState, useEffect, useCallback } from "react";
import { Pencil, X, Save } from "lucide-react";
import { useCategories } from "@/lib/hooks/useCategories";
import { useBrand, useUpdateBrand } from "@/lib/hooks/useBrands";
import ImageUpload from "@/components/ui/ImageUpload";
import TextInput from "@/components/ui/TextInput";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { slugify } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageBrands } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";
import { apiFetch } from "@/lib/api";
import CategoryAffectedProductsModal, {
  type AffectedProduct,
} from "@/components/ui/CategoryAffectedProductsModal";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type PendingRemoval = {
  categoryLabel: string;
  total: number;
  products: AffectedProduct[];
};

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const allowBrandManagement = canManageBrands(user);

  const { data: brand, isLoading } = useBrand(id);
  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { mutateAsync: updateBrand, isPending } = useUpdateBrand();

  if (!allowBrandManagement) {
    return <AccessDeniedState message="A sua role não pode gerir marcas." />;
  }

  const [editing, setEditing] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedL0, setSelectedL0] = useState<string[]>([]);
  const [selectedL1, setSelectedL1] = useState<string[]>([]);

  // Pill-removal check state
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );

  const l0Options = (l0Cats ?? []).map((c) => ({ value: c.id, label: c.name }));
  const l1Options = (l1Cats ?? []).map((c) => {
    const parent = (l0Cats ?? []).find((p) => p.id === c.parentId);
    return {
      value: c.id,
      label: parent ? `${c.name} (${parent.name})` : c.name,
    };
  });

  // Populate form when brand loads
  useEffect(() => {
    if (!brand || !l0Cats || !l1Cats) return;
    setName(brand.name);
    setLogoUrl(brand.logoUrl ?? null);
    const assignedIds = brand.brandCategories.map((bc) => bc.category.id);
    setSelectedL0(
      l0Cats.filter((c) => assignedIds.includes(c.id)).map((c) => c.id),
    );
    setSelectedL1(
      l1Cats.filter((c) => assignedIds.includes(c.id)).map((c) => c.id),
    );
  }, [brand, l0Cats, l1Cats]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCancelEdit() {
    setEditing(false);
    if (brand) {
      setName(brand.name);
      setLogoUrl(brand.logoUrl ?? null);
      const assignedIds = brand.brandCategories.map((bc) => bc.category.id);
      setSelectedL0(
        (l0Cats ?? [])
          .filter((c) => assignedIds.includes(c.id))
          .map((c) => c.id),
      );
      setSelectedL1(
        (l1Cats ?? [])
          .filter((c) => assignedIds.includes(c.id))
          .map((c) => c.id),
      );
    }
  }

  const handleRemovePill = useCallback(
    async (categoryId: string, level: 0 | 1, label: string) => {
      setCheckingId(categoryId);
      try {
        const result = await apiFetch<{
          total: number;
          products: AffectedProduct[];
        }>(`/admin/brands/${id}/categories/${categoryId}/affected-products`);
        if (result.total === 0) {
          if (level === 0)
            setSelectedL0((prev) => prev.filter((v) => v !== categoryId));
          else setSelectedL1((prev) => prev.filter((v) => v !== categoryId));
        } else {
          setPendingRemoval({ categoryLabel: label, ...result });
        }
      } finally {
        setCheckingId(null);
      }
    },
    [id],
  );

  async function save(status: "draft" | "published") {
    if (!name.trim()) return;
    await updateBrand({
      id,
      data: {
        name: name.trim(),
        slug: slugify(name.trim()),
        logoUrl,
        status,
        categoryIds: [...selectedL0, ...selectedL1],
      },
    });
    setEditing(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-text-muted font-figtree text-sm">
        A carregar…
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex items-center justify-center py-32 text-danger font-figtree text-sm">
        Marca não encontrada.
      </div>
    );
  }

  return (
    <>
      {pendingRemoval && (
        <CategoryAffectedProductsModal
          categoryLabel={pendingRemoval.categoryLabel}
          total={pendingRemoval.total}
          products={pendingRemoval.products}
          onClose={() => setPendingRemoval(null)}
        />
      )}

      <div className="flex flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isPending}
                className="flex items-center gap-2 border border-border text-text-body text-sm font-bold font-figtree px-5 py-2.5 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || !name.trim()}
                onClick={() => save("draft")}
                className="flex items-center gap-2 border border-border text-text-body text-sm font-bold font-figtree px-5 py-2.5 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "A guardar…" : "Guardar rascunho"}
              </button>
              <button
                type="button"
                disabled={isPending || !name.trim()}
                onClick={() => save("published")}
                className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "A guardar…" : "Publicar"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 border border-navy text-navy text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:bg-navy/5 transition-colors"
            >
              <Pencil size={15} />
              Editar
            </button>
          )}
        </div>

        {/* ── Two-column layout ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
          {/* ── Left: Details ───────────────────────────────────────────── */}
          <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-5">
            <h3 className="text-[16px] font-bold text-primary font-lato">
              Detalhes da marca
            </h3>

            <TextInput
              label="Nome"
              value={name}
              onChange={setName}
              disabled={!editing}
            />

            <MultiSelectDropdown
              label="Vende produtos para categoria principal"
              options={l0Options}
              selected={selectedL0}
              onChange={setSelectedL0}
              placeholder="Selecionar categorias principais…"
              disabled={!editing}
              searchable
            />

            <MultiSelectDropdown
              label="Vende produtos para subcategoria secundária"
              options={l1Options}
              selected={selectedL1}
              onChange={setSelectedL1}
              placeholder="Selecionar subcategorias…"
              disabled={!editing}
              searchable
            />

            {/* ── Assigned pills ─────────────────────────────────────── */}
            {(selectedL0.length > 0 || selectedL1.length > 0) && (
              <div className="flex flex-col gap-3">
                {selectedL0.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-primary font-figtree">
                      Valores atribuídos a categoria principal
                    </span>
                    <div className="flex flex-wrap gap-1.5 border-b pb-6 pt-2 border-b-accent">
                      {l0Options
                        .filter((o) => selectedL0.includes(o.value))
                        .map((opt) => (
                          <span
                            key={opt.value}
                            className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-medium font-figtree px-2.5 py-1 rounded-full"
                          >
                            {opt.label}
                            {editing && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemovePill(opt.value, 0, opt.label)
                                }
                                disabled={checkingId === opt.value}
                                className="ml-0.5 hover:opacity-70 transition-opacity disabled:opacity-40"
                                aria-label={`Remover ${opt.label}`}
                              >
                                {checkingId === opt.value ? (
                                  <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <X size={12} />
                                )}
                              </button>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                {selectedL1.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-primary font-figtree">
                      Valores atribuídos a subcategoria secundária
                    </span>
                    <div className="flex flex-wrap gap-1.5 border-b pb-6 pt-2 border-b-accent">
                      {l1Options
                        .filter((o) => selectedL1.includes(o.value))
                        .map((opt) => (
                          <span
                            key={opt.value}
                            className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-medium font-figtree px-2.5 py-1 rounded-full"
                          >
                            {opt.label}
                            {editing && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemovePill(opt.value, 1, opt.label)
                                }
                                disabled={checkingId === opt.value}
                                className="ml-0.5 hover:opacity-70 transition-opacity disabled:opacity-40"
                                aria-label={`Remover ${opt.label}`}
                              >
                                {checkingId === opt.value ? (
                                  <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <X size={12} />
                                )}
                              </button>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Action buttons (edit mode) ─────────────────────────── */}
            {editing && (
              <div className="flex items-center justify-end gap-3 pt-4 mt-1">
                <button
                  type="button"
                  disabled={isPending || !name.trim()}
                  onClick={() => save("draft")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-body text-sm font-semibold font-figtree hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={15} />
                  {isPending ? "A guardar…" : "Guardar rascunho"}
                </button>
                <button
                  type="button"
                  disabled={isPending || !name.trim()}
                  onClick={() => save("published")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "A publicar…" : "Publicar"}
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Image ────────────────────────────────────────────── */}
          <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-4">
            <h3 className="text-[16px] font-bold text-primary font-lato">
              Imagem da marca
            </h3>
            <p className="text-s text-text-muted font-figtree -mt-2">
              Imagem principal
            </p>
            <ImageUpload
              imageUrl={logoUrl}
              onChange={setLogoUrl}
              context="brand"
              disabled={!editing}
            />
          </div>
        </div>
      </div>
    </>
  );
}
