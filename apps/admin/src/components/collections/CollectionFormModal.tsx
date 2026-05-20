"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import ImageUpload from "@/components/ui/ImageUpload";
import Toggle from "@/components/ui/Toggle";
import { slugify } from "@/lib/format";
import {
  useCreateCollection,
  useUpdateCollection,
  type Collection,
} from "@/lib/hooks/useCollections";

/* ── Props ─────────────────────────────────────────────────────────────────── */

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pass a collection to enable edit mode, omit for create mode. */
  collection?: Collection | null;
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function CollectionFormModal({
  open,
  onClose,
  collection,
}: Props) {
  const isEdit = !!collection;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const isPending = createCollection.isPending || updateCollection.isPending;

  /* Populate form when editing */
  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setSlug(collection.slug);
      setSlugManual(true);
      setCoverImageUrl(collection.coverImageUrl);
      setIsActive(collection.isActive);
    } else {
      setName("");
      setSlug("");
      setSlugManual(false);
      setCoverImageUrl(null);
      setIsActive(true);
    }
  }, [collection, open]);

  /* Auto-generate slug from name unless user typed manually */
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      coverImageUrl: coverImageUrl || null,
      isActive,
    };
    try {
      if (isEdit) {
        await updateCollection.mutateAsync({
          id: collection!.id,
          data: payload,
        });
      } else {
        await createCollection.mutateAsync(payload);
      }
      onClose();
    } catch {
      /* toast handled in hook */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar coleção" : "Criar coleção"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Cover image */}
        <div className="flex flex-col gap-1.5">
          <label className="text-s font-medium text-text-body font-figtree">
            Imagem de categoria
          </label>
          <ImageUpload
            imageUrl={coverImageUrl}
            onChange={setCoverImageUrl}
            context="collection"
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-s font-bold text-text-body font-figtree">
            Nome da coleção
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Verão 2025"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree focus:outline-none focus:border-accent transition-colors placeholder:text-text-label"
          />
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-1.5">
          <label className="text-s font-medium text-text-body font-figtree">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            placeholder="verao-2025"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-inter focus:outline-none focus:border-accent transition-colors placeholder:text-text-label"
          />
          <p className="text-[12px] text-text-subtle font-figtree">
            Gerado automaticamente a partir do nome. Editável manualmente.
          </p>
        </div>

        {/* Active toggle */}
        <div className="border-t border-border-light pt-4">
          <Toggle label="Visível" value={isActive} onChange={setIsActive} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border text-text-body text-sm font-bold font-figtree hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !name.trim() || !slug.trim()}
            className="px-6 py-2.5 rounded-lg bg-navy text-white text-md font-bold font-figtree hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isPending ? "A guardar…" : isEdit ? "Guardar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
