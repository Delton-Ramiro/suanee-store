"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Save } from "lucide-react";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCreateBrand } from "@/lib/hooks/useBrands";
import ImageUpload from "@/components/ui/ImageUpload";
import TextInput from "@/components/ui/TextInput";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { slugify } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageBrands } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function NewBrandPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowBrandManagement = canManageBrands(user);
  const { mutateAsync: createBrand, isPending } = useCreateBrand();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedL0, setSelectedL0] = useState<string[]>([]);
  const [selectedL1, setSelectedL1] = useState<string[]>([]);

  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const l0Options = (l0Cats ?? []).map((c) => ({ value: c.id, label: c.name }));
  const l1Options = (l1Cats ?? []).map((c) => {
    const parent = (l0Cats ?? []).find((p) => p.id === c.parentId);
    return {
      value: c.id,
      label: parent ? `${c.name} (${parent.name})` : c.name,
    };
  });

  async function submit(status: "draft" | "published") {
    if (!name.trim()) return;
    await createBrand({
      name: name.trim(),
      slug: slugify(name.trim()),
      logoUrl: logoUrl ?? undefined,
      status,
      categoryIds: [...selectedL0, ...selectedL1],
    });
    router.push("/brands");
  }

  if (!allowBrandManagement) {
    return <AccessDeniedState message="A sua role não pode gerir marcas." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          Gestão de marcas
        </h2>
      </div>

      {/* ── Two-column form ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_400px] gap-6 items-start">
        {/* ── Left: Details ───────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-5">
          <h3 className="text-[16px] font-bold text-text-dark font-lato">
            Detalhes da marca
          </h3>

          <TextInput
            label="Nome"
            value={name}
            onChange={setName}
            placeholder="Ex: Nike"
          />

          <MultiSelectDropdown
            label="Vende produtos para categoria"
            options={l0Options}
            selected={selectedL0}
            onChange={setSelectedL0}
            placeholder="Selecionar categorias principais…"
            searchable
          />

          <MultiSelectDropdown
            label="Vende produtos para subcategoria"
            options={l1Options}
            selected={selectedL1}
            onChange={setSelectedL1}
            placeholder="Selecionar subcategorias…"
            searchable
          />

          {/* ── Assigned pills ─────────────────────────────────────── */}
          {(selectedL0.length > 0 || selectedL1.length > 0) && (
            <div className="flex flex-col gap-3">
              {selectedL0.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-text-dark font-figtree">
                    Valores atribuídos a categoria principal
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {l0Options
                      .filter((o) => selectedL0.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-medium font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedL0(
                                selectedL0.filter((id) => id !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                            aria-label={`Remover ${opt.label}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {selectedL1.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-text-dark font-figtree">
                    Valores atribuídos a subcategoria secundária
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {l1Options
                      .filter((o) => selectedL1.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-medium font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedL1(
                                selectedL1.filter((id) => id !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                            aria-label={`Remover ${opt.label}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-4 mt-1 border-t border-border-light">
            <button
              type="button"
              disabled={isPending || !name.trim()}
              onClick={() => submit("draft")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-body text-sm font-semibold font-figtree hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={15} />
              {isPending ? "A guardar…" : "Guardar rascunho"}
            </button>
            <button
              type="button"
              disabled={isPending || !name.trim()}
              onClick={() => submit("published")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "A publicar…" : "Publicar"}
            </button>
          </div>
        </div>

        {/* ── Right: Image ────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-4">
          <h3 className="text-[16px] font-bold text-text-dark font-lato">
            Imagem da marca
          </h3>
          <p className="text-s text-text-muted font-figtree -mt-2">
            Imagem principal
          </p>
          <ImageUpload
            imageUrl={logoUrl}
            onChange={setLogoUrl}
            context="brand"
          />
        </div>
      </div>
    </div>
  );
}
