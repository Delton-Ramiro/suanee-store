"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Save } from "lucide-react";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCreateSize } from "@/lib/hooks/useSizes";
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

export default function NewSizePage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowSizeManagement = canManageSizes(user);
  const { mutateAsync: createSize, isPending } = useCreateSize();

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>("universal");
  const [selectedL0, setSelectedL0] = useState<string[]>([]);
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [selectedL2, setSelectedL2] = useState<string[]>([]);

  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { data: l2Cats } = useCategories({ level: 2 });

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

  const allSelected = [...selectedL0, ...selectedL1, ...selectedL2];
  const allOptions = [...l0Options, ...l1Options, ...l2Options];

  async function submit() {
    if (!name.trim() || !label.trim()) return;
    await createSize({
      name: name.trim(),
      label: label.trim(),
      sizeSystem,
      categoryIds: allSelected,
    });
    router.push("/sizes");
  }

  if (!allowSizeManagement) {
    return <AccessDeniedState message="A sua role não pode gerir tamanhos." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          Gestão de tamanhos
        </h2>
      </div>

      {/* ── Form card ───────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-5 max-w-2xl">
        <h3 className="text-[16px] font-bold text-primary font-lato">
          Novo tamanho
        </h3>

        {/* Name */}
        <TextInput
          label="Nome"
          value={name}
          onChange={setName}
          placeholder="Ex: Extra Large"
        />

        {/* Label */}
        <TextInput
          label="Etiqueta"
          value={label}
          onChange={setLabel}
          placeholder="Ex: XL"
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
                onClick={() => setSizeSystem(s.value as SizeSystem)}
                className={`px-4 py-1.5 rounded-lg text-s font-semibold font-inter transition-colors border ${
                  sizeSystem === s.value
                    ? "bg-navy text-white border-navy"
                    : "bg-card text-text-body border-border hover:bg-surface-hover"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category associations */}
        <MultiSelectDropdown
          label="Categoria principal"
          options={l0Options}
          selected={selectedL0}
          onChange={setSelectedL0}
          placeholder="Selecionar categorias principais…"
          searchable
        />

        <MultiSelectDropdown
          label="Subcategoria (nível 1)"
          options={l1Options}
          selected={selectedL1}
          onChange={setSelectedL1}
          placeholder="Selecionar subcategorias…"
          searchable
        />

        <MultiSelectDropdown
          label="Subcategoria (nível 2)"
          options={l2Options}
          selected={selectedL2}
          onChange={setSelectedL2}
          placeholder="Selecionar subcategorias de nível 2…"
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
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedL2(
                              selectedL2.filter((id) => id !== opt.value),
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-1 border-t border-border-light">
          <button
            type="button"
            onClick={() => router.push("/sizes")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-body text-sm font-semibold font-figtree hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending || !name.trim() || !label.trim()}
            onClick={submit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            {isPending ? "A guardar…" : "Guardar tamanho"}
          </button>
        </div>
      </div>
    </div>
  );
}
