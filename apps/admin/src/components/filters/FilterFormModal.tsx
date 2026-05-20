"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import Toggle from "@/components/ui/Toggle";
import { useCategories } from "@/lib/hooks/useCategories";
import type {
  Filter,
  FilterPayload,
  FilterUpdatePayload,
  FilterOption,
} from "@/lib/hooks/useFilters";

/* ── helpers ──────────────────────────────────────────────────────────────── */

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/* ── Types ────────────────────────────────────────────────────────────────── */

type InputType = "multi_select" | "single_select" | "range" | "boolean";

const INPUT_TYPE_OPTIONS: {
  value: InputType;
  label: string;
  supported: boolean;
}[] = [
  { value: "multi_select", label: "Seleção múltipla", supported: true },
  { value: "single_select", label: "Seleção única", supported: false },
  { value: "range", label: "Intervalo", supported: false },
  { value: "boolean", label: "Sim / Não", supported: false },
];

export type FilterFormPayload = FilterPayload;
export type FilterFormUpdatePayload = FilterUpdatePayload & {
  isActive?: boolean;
};

interface FilterFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    payload: FilterFormPayload | FilterFormUpdatePayload,
  ) => Promise<void>;
  initial?: Filter;
  loading?: boolean;
}

/* ── Draft option tag ─────────────────────────────────────────────────────── */

type DraftOption = { id?: string; label: string; value: string };

function OptionTag({
  option,
  index,
  isDragOver,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  option: DraftOption;
  index: number;
  isDragOver: boolean;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={`relative inline-block mt-2.5 mr-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragOver ? "opacity-40 scale-95" : "opacity-100"
      }`}
    >
      <div className="bg-navy border border-border-light text-white text-md font-figtree font-normal rounded-[25px] px-4.5 py-1 whitespace-nowrap">
        {option.label}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 size-[18px] bg-navy rounded-full flex items-center justify-center text-white hover:text-navy hover:bg-surface-hover transition-colors z-10 shadow-sm"
        aria-label={`Remover ${option.label}`}
      >
        <X size={9} className="text-inherit" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ── Category pill ────────────────────────────────────────────────────────── */

function CategoryPill({
  label,
  variant,
  onRemove,
}: {
  label: string;
  variant: "l0" | "l1" | "l2";
  onRemove: () => void;
}) {
  const bg =
    variant === "l0"
      ? "bg-navy text-white"
      : variant === "l1"
        ? "bg-accent text-white"
        : "bg-primary/10 text-primary";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-medium font-figtree px-2.5 py-1 rounded-full ${bg}`}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label={`Remover ${label}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export default function FilterFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: FilterFormModalProps) {
  const isEdit = !!initial;

  /* ── form state ─────────────────────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [inputType, setInputType] = useState<InputType>("multi_select");
  const [isActive, setIsActive] = useState(true);

  const [options, setOptions] = useState<DraftOption[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [selectedL0, setSelectedL0] = useState<string[]>([]);
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [selectedL2, setSelectedL2] = useState<string[]>([]);

  const optionInputRef = useRef<HTMLInputElement>(null);

  /* ── category data ──────────────────────────────────────────────────────── */
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

  /* ── init / reset ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setInputType((initial?.inputType as InputType) ?? "multi_select");
    setIsActive(initial?.isActive ?? true);
    setOptionInput("");

    if (initial?.options) {
      setOptions(
        initial.options.map((o: FilterOption) => ({
          id: o.id,
          label: o.label,
          value: o.value,
        })),
      );
    } else {
      setOptions([]);
    }

    if (initial?.categories && initial.categories.length > 0) {
      const allIds = initial.categories.map((c) => c.categoryId);
      const l0Ids = new Set((l0Cats ?? []).map((c) => c.id));
      const l1Ids = new Set((l1Cats ?? []).map((c) => c.id));
      setSelectedL0(allIds.filter((id) => l0Ids.has(id)));
      setSelectedL1(allIds.filter((id) => l1Ids.has(id)));
      setSelectedL2(allIds.filter((id) => !l0Ids.has(id) && !l1Ids.has(id)));
    } else {
      setSelectedL0([]);
      setSelectedL1([]);
      setSelectedL2([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  /* ── option entry ───────────────────────────────────────────────────────── */
  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = optionInput.trim();
    if (!raw) return;
    const value = slugify(raw);
    if (options.some((o) => o.value === value)) {
      setOptionInput("");
      return;
    }
    setOptions((prev) => [...prev, { label: raw, value }]);
    setOptionInput("");
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── drag & drop reorder ────────────────────────────────────────────────── */
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(dropIndex: number) {
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    setOptions((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(from, 1);
      next.splice(dropIndex, 0, dragged);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  /* ── submit ─────────────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || options.length === 0) return;

    const categoryIds = [...selectedL0, ...selectedL1, ...selectedL2];
    if (categoryIds.length === 0) return;

    const payload = {
      name: trimmedName,
      inputType,
      isActive,
      categoryIds,
      options: options.map((o, i) => ({ ...o, position: i })),
    };

    await onSubmit(payload);
  }

  const allSelected = [...selectedL0, ...selectedL1, ...selectedL2];
  const canSubmit = name.trim() && options.length > 0 && allSelected.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar filtro" : "Criar filtro"}
      maxWidth="max-w-[600px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <TextInput
          label="Nome"
          value={name}
          onChange={setName}
          placeholder="Ex: Material"
        />

        {/* Input type dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-primary font-figtree">
            Tipo de atributo
          </label>
          <div className="relative">
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value as InputType)}
              className="w-full appearance-none bg-card border border-border rounded-lg px-3 py-2.5 text-sm font-figtree text-text-dark focus:outline-none focus:border-accent transition-colors pr-9"
            >
              {INPUT_TYPE_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={!opt.supported}
                >
                  {opt.label}
                  {!opt.supported ? " (em breve)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
          </div>
        </div>

        {/* Valores */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-primary font-figtree">
            Valores
          </label>
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors bg-card">
            <input
              ref={optionInputRef}
              type="text"
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={handleOptionKeyDown}
              placeholder="Escreva um valor e pressione Enter…"
              className="flex-1 bg-transparent outline-none text-sm text-text-dark font-figtree placeholder:text-text-label"
            />
          </div>
          {options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {options.map((opt, i) => (
                <OptionTag
                  key={opt.value + i}
                  option={opt}
                  index={i}
                  isDragOver={dragOverIndex === i}
                  onRemove={() => removeOption(i)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-text-label font-figtree">
              Ainda sem valores definidos.
            </p>
          )}
        </div>

        {/* Category selects */}
        <MultiSelectDropdown
          label="Categorias principais"
          options={l0Options}
          selected={selectedL0}
          onChange={setSelectedL0}
          placeholder="Selecionar categorias principais…"
          searchable
        />
        <MultiSelectDropdown
          label="Categorias Secundárias"
          options={l1Options}
          selected={selectedL1}
          onChange={setSelectedL1}
          placeholder="Selecionar subcategorias…"
          searchable
        />
        <MultiSelectDropdown
          label="Categorias Terciárias"
          options={l2Options}
          selected={selectedL2}
          onChange={setSelectedL2}
          placeholder="Selecionar subcategorias de nível 2…"
          searchable
        />

        {/* Selected category pills */}
        {allSelected.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-light pt-3">
            {selectedL0.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted font-figtree tracking-wide">
                  Principais
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {l0Options
                    .filter((o) => selectedL0.includes(o.value))
                    .map((opt) => (
                      <CategoryPill
                        key={opt.value}
                        label={opt.label}
                        variant="l0"
                        onRemove={() =>
                          setSelectedL0((prev) =>
                            prev.filter((id) => id !== opt.value),
                          )
                        }
                      />
                    ))}
                </div>
              </div>
            )}
            {selectedL1.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted font-figtree tracking-wide">
                  Secundárias
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {l1Options
                    .filter((o) => selectedL1.includes(o.value))
                    .map((opt) => (
                      <CategoryPill
                        key={opt.value}
                        label={opt.label}
                        variant="l1"
                        onRemove={() =>
                          setSelectedL1((prev) =>
                            prev.filter((id) => id !== opt.value),
                          )
                        }
                      />
                    ))}
                </div>
              </div>
            )}
            {selectedL2.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted font-figtree tracking-wide">
                  Terciárias
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {l2Options
                    .filter((o) => selectedL2.includes(o.value))
                    .map((opt) => (
                      <CategoryPill
                        key={opt.value}
                        label={opt.label}
                        variant="l2"
                        onRemove={() =>
                          setSelectedL2((prev) =>
                            prev.filter((id) => id !== opt.value),
                          )
                        }
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* isActive toggle — edit only */}
        {isEdit && (
          <div className="border-t border-border-light pt-3">
            <Toggle
              label="Filtro activo"
              value={isActive}
              onChange={setIsActive}
              showText
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border-light pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold font-figtree text-text-body border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="px-5 py-2.5 text-sm font-semibold font-figtree bg-navy text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar…" : isEdit ? "Guardar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
