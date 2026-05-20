"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";
import Toggle from "@/components/ui/Toggle";
import { slugify } from "@/lib/format";
import { useCreateCollection } from "@/lib/hooks/useCollections";
import { useAuth } from "@/lib/auth";
import { canManageCollections } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── TextInput ────────────────────────────────────────────────────────────── */

function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
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
      {hint && (
        <p className="text-[12px] text-text-subtle font-figtree">{hint}</p>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function NewCollectionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowCollectionManagement = canManageCollections(user);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState<number>(0);

  const createCollection = useCreateCollection();

  /* Auto-generate slug silently from name */
  useEffect(() => {
    setSlug(slugify(name));
  }, [name]);

  const canSubmit = !createCollection.isPending && name.trim().length > 0;

  if (!allowCollectionManagement) {
    return <AccessDeniedState message="A sua role não pode gerir coleções." />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createCollection.mutateAsync({
        name: name.trim(),
        slug: slug.trim() || slugify(name.trim()),
        coverImageUrl: coverImageUrl || null,
        isActive,
        position,
      });
      router.push("/collections");
    } catch {
      /* toast handled in hook */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-bold text-primary font-figtree tracking-[0.04em]">
          Adicionar coleção
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/collections")}
            className="flex items-center gap-2 border border-border text-text-body text-sm font-bold font-figtree px-5 py-2.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="collection-form"
            disabled={!canSubmit}
            className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {createCollection.isPending ? "A criar…" : "Criar coleção"}
          </button>
        </div>
      </div>

      {/* Form — details LEFT, image RIGHT (matches Figma) */}
      <form
        id="collection-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6"
      >
        {/* Details card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Detalhes da coleção
          </h3>

          <TextInput
            label="Nome da coleção"
            value={name}
            onChange={setName}
            placeholder="ex: Verão 2025"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-s font-medium text-text-body font-figtree">
              Índice de exibição
            </label>
            <div className="relative">
              <select
                value={String(position)}
                onChange={(e) => setPosition(Number(e.target.value))}
                className="w-full appearance-none px-3 py-2.5 pr-10 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors"
              >
                {Array.from({ length: 21 }, (_, i) => (
                  <option key={i} value={String(i)}>
                    {i}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className="border-t border-border-light pt-4 mt-2">
            <Toggle label="Visível" value={isActive} onChange={setIsActive} />
          </div>
        </div>

        {/* Image card */}
        <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text-dark font-figtree leading-snug">
            Imagem de capa
          </h3>
          <p className="text-md font-bold text-primary font-lato">
            Imagem principal
          </p>
          <ImageUpload
            imageUrl={coverImageUrl}
            onChange={setCoverImageUrl}
            context="collection"
          />
        </div>
      </form>
    </div>
  );
}
