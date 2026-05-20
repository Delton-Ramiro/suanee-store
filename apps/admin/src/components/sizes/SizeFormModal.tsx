"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { useCategories } from "@/lib/hooks/useCategories";
import type { Size } from "@/lib/hooks/useSizes";

const SIZE_SYSTEMS = [
  { value: "universal", label: "Universal" },
  { value: "EU", label: "EU" },
  { value: "US", label: "US" },
  { value: "UK", label: "UK" },
  { value: "IT", label: "IT" },
] as const;

type SizeSystem = "EU" | "US" | "UK" | "IT" | "universal";

export type SizeFormPayload = {
  name: string;
  label: string;
  sizeSystem: SizeSystem;
  categoryIds: string[];
};

interface SizeFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: SizeFormPayload) => Promise<void>;
  initial?: Size;
  loading?: boolean;
}

export default function SizeFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: SizeFormModalProps) {
  const isEdit = !!initial;

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

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setLabel(initial?.label ?? "");
    setSizeSystem(initial?.sizeSystem ?? "universal");
    if (initial?.sizeCategories) {
      const allCatIds = initial.sizeCategories.map((sc) => sc.category.id);
      const l0Ids = (l0Cats ?? []).map((c) => c.id);
      const l1Ids = (l1Cats ?? []).map((c) => c.id);
      setSelectedL0(allCatIds.filter((id) => l0Ids.includes(id)));
      setSelectedL1(allCatIds.filter((id) => l1Ids.includes(id)));
      setSelectedL2(
        allCatIds.filter((id) => !l0Ids.includes(id) && !l1Ids.includes(id)),
      );
    } else {
      setSelectedL0([]);
      setSelectedL1([]);
      setSelectedL2([]);
    }
  }, [open, initial, l0Cats, l1Cats]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !label.trim()) return;
    await onSubmit({
      name: name.trim(),
      label: label.trim(),
      sizeSystem,
      categoryIds: [...selectedL0, ...selectedL1, ...selectedL2],
    });
  }

  const allSelected = [...selectedL0, ...selectedL1, ...selectedL2];
  const allL0Options = l0Options;
  const allL1Options = l1Options;
  const allL2Options = l2Options;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Detalhes do tamanho" : "Criar tamanho"}
      maxWidth="max-w-[640px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Nome"
            value={name}
            onChange={setName}
            placeholder="Ex: Extra Large"
          />
          <TextInput
            label="Etiqueta"
            value={label}
            onChange={setLabel}
            placeholder="Ex: XL"
          />
        </div>

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

        {/* Category dropdowns */}
        <MultiSelectDropdown
          label="Categoria principal"
          options={allL0Options}
          selected={selectedL0}
          onChange={setSelectedL0}
          placeholder="Selecionar categorias principais…"
          searchable
        />
        <MultiSelectDropdown
          label="Subcategoria (nível 1)"
          options={allL1Options}
          selected={selectedL1}
          onChange={setSelectedL1}
          placeholder="Selecionar subcategorias…"
          searchable
        />
        <MultiSelectDropdown
          label="Subcategoria (nível 2)"
          options={allL2Options}
          selected={selectedL2}
          onChange={setSelectedL2}
          placeholder="Selecionar subcategorias de nível 2…"
          searchable
        />

        {/* Assigned pills */}
        {allSelected.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-light pt-4">
            {selectedL0.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-s font-semibold text-text-body font-figtree">
                  Categoria principal
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allL0Options
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
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
            {selectedL1.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-s font-semibold text-text-body font-figtree">
                  Subcategoria (nível 1)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allL1Options
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
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
            {selectedL2.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-s font-semibold text-text-body font-figtree">
                  Subcategoria (nível 2)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allL2Options
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
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 mt-1 border-t border-border-light">
          <button
            type="submit"
            disabled={loading || !name.trim() || !label.trim()}
            className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar..." : isEdit ? "Atualizar" : "Criar tamanho"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
