"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { useCategories } from "@/lib/hooks/useCategories";
import { useSize, useUpdateSize } from "@/lib/hooks/useSizes";
import TextInput from "@/components/ui/TextInput";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { useAuth } from "@/lib/auth";
import { canManageSizes } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

const SIZE_SYSTEMS = [
  { value: "universal", label: "Universal" },
  { value: "EU", label: "EU" },
  { value: "US", label: "US" },
  { value: "UK", label: "UK" },
  { value: "IT", label: "IT" },
] as const;

type SizeSystem = "EU" | "US" | "UK" | "IT" | "universal";

export default function SizeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const allowSizeManagement = canManageSizes(user);
  const router = useRouter();

  const { data: size, isLoading } = useSize(id);
  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { data: l2Cats } = useCategories({ level: 2 });
  const { mutateAsync: updateSize, isPending } = useUpdateSize();

  if (!allowSizeManagement) {
    return <AccessDeniedState message="A sua role não pode gerir tamanhos." />;
  }

  const [editing, setEditing] = useState(false);

  /* ── Form state ─────────────────────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>("universal");
  const [selectedL0, setSelectedL0] = useState<string[]>([]);
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [selectedL2, setSelectedL2] = useState<string[]>([]);

  /* ── Options ────────────────────────────────────────────────────────────── */
  const l0Options = (l0Cats ?? []).map((c) => ({ value: c.id, label: c.name }));
  const l1Options = (l1Cats ?? []).map((c) => {
    const parent = (l0Cats ?? []).find((p) => p.id === c.parentId);
    return {
      value: c.id,
      label: parent ? `${c.name} (${parent.name})` : c.name,
    };
  });
  const l2Options = (l2Cats ?? []).map((c) => {
    const parent = (l1Cats ?? []).find((p) => p.id === c.parentId);
    return {
      value: c.id,
      label: parent ? `${c.name} (${parent.name})` : c.name,
    };
  });

  /* ── Populate form ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!size || !l0Cats || !l1Cats || !l2Cats) return;
    setName(size.name);
    setLabel(size.label);
    setSizeSystem(size.sizeSystem);
    const assignedIds = size.sizeCategories.map((sc) => sc.category.id);
    setSelectedL0(
      l0Cats.filter((c) => assignedIds.includes(c.id)).map((c) => c.id),
    );
    setSelectedL1(
      l1Cats.filter((c) => assignedIds.includes(c.id)).map((c) => c.id),
    );
    setSelectedL2(
      l2Cats.filter((c) => assignedIds.includes(c.id)).map((c) => c.id),
    );
  }, [size, l0Cats, l1Cats, l2Cats]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCancelEdit() {
    setEditing(false);
    if (size) {
      setName(size.name);
      setLabel(size.label);
      setSizeSystem(size.sizeSystem);
      const assignedIds = size.sizeCategories.map((sc) => sc.category.id);
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
      setSelectedL2(
        (l2Cats ?? [])
          .filter((c) => assignedIds.includes(c.id))
          .map((c) => c.id),
      );
    }
  }

  async function save() {
    if (!name.trim() || !label.trim()) return;
    await updateSize({
      id,
      data: {
        name: name.trim(),
        label: label.trim(),
        sizeSystem,
        categoryIds: [...selectedL0, ...selectedL1, ...selectedL2],
      },
    });
    setEditing(false);
  }

  const allSelected = [...selectedL0, ...selectedL1, ...selectedL2];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-text-muted font-figtree text-sm">
        A carregar…
      </div>
    );
  }

  if (!size) {
    return (
      <div className="flex items-center justify-center py-32 text-danger font-figtree text-sm">
        Tamanho não encontrado.
      </div>
    );
  }

  return (
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
              disabled={isPending || !name.trim() || !label.trim()}
              onClick={save}
              className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "A guardar…" : "Guardar"}
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

      {/* ── Details card ───────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-5 max-w-2xl">
        <h3 className="text-[16px] font-bold text-primary font-lato">
          Detalhes do tamanho
        </h3>

        <TextInput
          label="Nome"
          value={name}
          onChange={setName}
          disabled={!editing}
        />

        <TextInput
          label="Etiqueta"
          value={label}
          onChange={setLabel}
          disabled={!editing}
        />

        {/* Size system */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-primary font-figtree">
            Sistema de tamanhos
          </label>
          <div className="flex flex-wrap gap-2">
            {SIZE_SYSTEMS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => editing && setSizeSystem(s.value as SizeSystem)}
                disabled={!editing}
                className={`px-4 py-1.5 rounded-lg text-s font-semibold font-inter transition-colors border ${
                  sizeSystem === s.value
                    ? "bg-navy text-white border-navy"
                    : "bg-card text-text-body border-border hover:bg-surface-hover"
                } disabled:cursor-default`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category dropdowns */}
        <MultiSelectDropdown
          label="Categoria principal"
          options={l0Options}
          selected={selectedL0}
          onChange={setSelectedL0}
          placeholder="Selecionar categorias principais…"
          disabled={!editing}
          searchable
        />

        <MultiSelectDropdown
          label="Subcategoria (nível 1)"
          options={l1Options}
          selected={selectedL1}
          onChange={setSelectedL1}
          placeholder="Selecionar subcategorias…"
          disabled={!editing}
          searchable
        />

        <MultiSelectDropdown
          label="Subcategoria (nível 2)"
          options={l2Options}
          selected={selectedL2}
          onChange={setSelectedL2}
          placeholder="Selecionar subcategorias de nível 2…"
          disabled={!editing}
          searchable
        />

        {/* Assigned pills */}
        {allSelected.length > 0 && (
          <div className="flex flex-col gap-3">
            {selectedL0.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-primary font-figtree">
                  Valores atribuídos a categoria principal
                </span>
                <div className="flex flex-wrap gap-1.5 border-b pb-4 pt-2 border-b-accent/30">
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
                              setSelectedL0(
                                selectedL0.filter((i) => i !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                            aria-label={`Remover ${opt.label}`}
                          >
                            <X size={12} />
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
                  Valores atribuídos a subcategoria (nível 1)
                </span>
                <div className="flex flex-wrap gap-1.5 border-b pb-4 pt-2 border-b-accent/30">
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
                              setSelectedL1(
                                selectedL1.filter((i) => i !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                            aria-label={`Remover ${opt.label}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                </div>
              </div>
            )}
            {selectedL2.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-primary font-figtree">
                  Valores atribuídos a subcategoria (nível 2)
                </span>
                <div className="flex flex-wrap gap-1.5 pb-2 pt-2">
                  {l2Options
                    .filter((o) => selectedL2.includes(o.value))
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
                              setSelectedL2(
                                selectedL2.filter((i) => i !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                            aria-label={`Remover ${opt.label}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions (edit mode inside card) */}
        {editing && (
          <div className="flex items-center justify-end gap-3 pt-4 mt-1 border-t border-border-light">
            <button
              type="button"
              disabled={isPending || !name.trim() || !label.trim()}
              onClick={save}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
