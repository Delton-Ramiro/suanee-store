"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus } from "lucide-react";
import {
  useCategories,
  useCategory,
  useCreateCategory,
} from "@/lib/hooks/useCategories";
import ImageUpload from "@/components/ui/ImageUpload";
import Toggle from "@/components/ui/Toggle";
import { slugify } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageCategories } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Select ───────────────────────────────────────────────────────────────── */

function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Selecionar…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-s font-medium text-text-body font-figtree">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── TextInput ────────────────────────────────────────────────────────────── */

function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors placeholder:text-text-label"
      />
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function NewCategoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowCategoryManagement = canManageCategories(user);
  const searchParams = useSearchParams();
  const parentId = searchParams.get("parentId");

  // Full tree: root (L1) categories with nested children
  const { data: allCats } = useCategories();
  // Fetch param-supplied parent for pre-population
  const { data: parentCat, isLoading: parentLoading } = useCategory(parentId);

  // ── Toggle-driven level state ───────────────────────────────────────────
  // L1 mode:  isPrincipal=true
  // L2 mode:  isPrincipal=false, isSecundaria=true
  // L3 mode:  isPrincipal=false, isSecundaria=false
  const [isPrincipal, setIsPrincipal] = useState(true);
  const [isSecundaria, setIsSecundaria] = useState(false);

  // Parent selections
  const [selectedL1, setSelectedL1] = useState(""); // id of chosen L1 parent
  const [selectedL2, setSelectedL2] = useState(""); // id of chosen L2 parent

  // Form fields
  const [name, setName] = useState("");
  const [position, setPosition] = useState("0");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Pre-populate when coming from a "Adicionar sub-categoria" button
  useEffect(() => {
    if (!parentCat) return;
    if (parentCat.level === 0) {
      // Creating L2 under this L1 (API level 0 = principal)
      setIsPrincipal(false);
      setIsSecundaria(true);
      setSelectedL1(parentCat.id);
    } else if (parentCat.level === 1) {
      // Creating L3 under this L2 (API level 1 = secundária)
      setIsPrincipal(false);
      setIsSecundaria(false);
      setSelectedL1(parentCat.parent?.id ?? "");
      setSelectedL2(parentCat.id);
    }
  }, [parentCat]);

  // UI uses 1, 2, 3 for readability; subtract 1 before sending to API
  const level = isPrincipal ? 1 : isSecundaria ? 2 : 3;
  const effectiveParentId =
    level === 3 ? selectedL2 : level === 2 ? selectedL1 : undefined;

  // Dropdown data — allCats is a tree: L1 roots with .children (L2)
  const l1Cats = allCats ?? []; // L1 root categories
  const selectedL1Cat = l1Cats.find((c) => c.id === selectedL1) ?? null;
  const l2Children = selectedL1Cat?.children ?? []; // L2 children of chosen L1

  // ── Toggle handlers ─────────────────────────────────────────────────────
  function handlePrincipalToggle(v: boolean) {
    if (!v) {
      // L1 → L2 mode
      setIsPrincipal(false);
      setIsSecundaria(true);
      setImageUrl(null); // image only editable at L1
    } else {
      // Any → L1 mode: reset everything
      setIsPrincipal(true);
      setIsSecundaria(false);
      setSelectedL1("");
      setSelectedL2("");
    }
  }

  function handleSecundariaToggle(v: boolean) {
    if (!v) {
      // L2 → L3 mode
      setIsSecundaria(false);
      setSelectedL2(""); // clear L2 selection
    } else {
      // L3 → L2 mode
      setIsSecundaria(true);
      setSelectedL2("");
    }
  }

  function handleL1Change(id: string) {
    setSelectedL1(id);
    setSelectedL2(""); // reset L2 when L1 changes
  }

  // ── Mutation ─────────────────────────────────────────────────────────────
  const createCategory = useCreateCategory();

  if (!allowCategoryManagement) {
    return (
      <AccessDeniedState message="A sua role não pode gerir categorias." />
    );
  }

  const canSubmit =
    !createCategory.isPending &&
    name.trim().length > 0 &&
    (level === 1 ? imageUrl !== null : true) &&
    (level >= 2 ? selectedL1 !== "" : true) &&
    (level === 3 ? selectedL2 !== "" : true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      // API uses 0-indexed levels: 0 = principal, 1 = secundária, 2 = terciária
      const apiLevel = level - 1;

      // Build hierarchical slug: l0[-l1][-name]
      const slugParts: string[] = [];
      if (level >= 2 && selectedL1Cat)
        slugParts.push(slugify(selectedL1Cat.name));
      if (level === 3) {
        const selectedL2Cat = l2Children.find((c) => c.id === selectedL2);
        if (selectedL2Cat) slugParts.push(slugify(selectedL2Cat.name));
      }
      slugParts.push(slugify(name.trim()));

      await createCategory.mutateAsync({
        name: name.trim(),
        slug: slugParts.join("-"),
        level: apiLevel,
        parentId: effectiveParentId,
        position: level <= 2 ? parseInt(position) || 0 : 0,
        isActive: true,
        imageUrl: level === 1 ? imageUrl : undefined,
      });
      router.push("/categories");
    } catch {
      /* toast handled in hook */
    }
  }

  if (parentId && parentLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted font-figtree">
        A carregar…
      </div>
    );
  }

  const positionOptions = Array.from({ length: 21 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 flex-1 min-h-0"
    >
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-[22px] font-bold text-primary font-figtree tracking-[0.04em]">
          Adicionar categoria
        </h2>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed min-w-[176px] justify-center"
        >
          {createCategory.isPending ? "A publicar…" : "Publicar"}
        </button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-stretch flex-1 min-h-0">
        {/* LEFT — details ─────────────────────────────────────────────── */}
        <div className="bg-card rounded-lg shadow-sm border border-border-light p-6 flex flex-col gap-4 h-full">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Detalhes da categoria
          </h3>

          {/* ① L2/L3: Categoria principal dropdown */}
          {level >= 2 && (
            <Select
              label="Categoria principal"
              value={selectedL1}
              onChange={handleL1Change}
              options={l1Cats.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecionar categoria principal…"
            />
          )}

          {/* ② L3: Categoria secundária dropdown */}
          {level === 3 && (
            <Select
              label="Categoria secundária"
              value={selectedL2}
              onChange={setSelectedL2}
              options={l2Children.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecionar categoria secundária…"
              disabled={!selectedL1 || l2Children.length === 0}
            />
          )}

          {/* ③ Name — always visible */}
          <TextInput
            label={
              level === 1
                ? "Nome da categoria principal"
                : level === 2
                  ? "Nome da categoria secundária"
                  : "Nome da categoria terciária"
            }
            value={name}
            onChange={setName}
            placeholder="Nome da categoria"
          />

          {/* ④ Exhibition index — L1 and L2 only */}
          {level <= 2 && (
            <Select
              label="Índice de exibição"
              value={position}
              onChange={setPosition}
              options={positionOptions}
            />
          )}

          {/* ⑤ Toggles */}
          <div className="flex flex-col gap-1 pt-2">
            {/* Principal toggle: ON at L1 (clickable), OFF at L2/L3 (clickable) */}
            <Toggle
              label="Principal"
              value={isPrincipal}
              onChange={handlePrincipalToggle}
            />
            {/* Secundária toggle: appears at L2 (ON, clickable) and L3 (OFF, clickable) */}
            {!isPrincipal && (
              <Toggle
                label="Secundária"
                value={isSecundaria}
                onChange={handleSecundariaToggle}
              />
            )}
          </div>
        </div>

        {/* RIGHT — image ───────────────────────────────────────────────── */}
        <div className="bg-card rounded-lg shadow-sm border border-border-light p-6 flex flex-col gap-4 h-full">
          <h3 className="text-lg  font-bold text-text-dark font-figtree leading-snug">
            Imagem da categoria
          </h3>
          <p className="text-md font-bold text-primary font-figtree -mt-2">
            Imagem principal
          </p>

          {level === 1 ? (
            /* L1 — editable upload */
            <>
              <ImageUpload
                imageUrl={imageUrl}
                onChange={setImageUrl}
                context="category"
              />
              {!imageUrl && (
                <p className="text-[12px] text-text-label font-figtree">
                  Obrigatório para publicar
                </p>
              )}
            </>
          ) : (
            /* L2/L3 — readonly: show L1 parent's image for reference */
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-bg border border-border">
              {selectedL1Cat?.imageUrl ? (
                <Image
                  fill
                  src={selectedL1Cat.imageUrl}
                  alt={selectedL1Cat.name}
                  className="object-cover"
                  sizes="100vw"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-muted">
                  <ImagePlus size={36} className="text-text-label" />
                  <span className="text-s font-figtree text-text-label text-center px-4">
                    {selectedL1
                      ? "Sem imagem associada"
                      : "Selecione uma categoria principal"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
