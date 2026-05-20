"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ImagePlus, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import type { SizeGuide, SizeGuideImage } from "@/lib/hooks/useSizes";

const MAX_IMAGES = 6;

export type SizeGuideFormPayload = {
  name: string;
  description?: string;
  images: SizeGuideImage[];
};

interface SizeGuideFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: SizeGuideFormPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: SizeGuide;
  loading?: boolean;
}

interface ImageItem {
  url: string;
  uploading?: boolean;
}

export default function SizeGuideFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  loading,
}: SizeGuideFormModalProps) {
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** URLs uploaded in this modal session that haven't been saved yet */
  const pendingUrlsRef = useRef<Set<string>>(new Set());

  /* Sync form when modal opens */
  useEffect(() => {
    if (!open) return;
    // Reset the pending set on each open — previous session is done
    pendingUrlsRef.current = new Set();
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setConfirmDelete(false);
    setLightboxIndex(null);
    if (initial?.images && initial.images.length > 0) {
      setImages(
        [...initial.images]
          .sort((a, b) => a.position - b.position)
          .map((img) => ({ url: img.url })),
      );
    } else {
      setImages([]);
    }
  }, [open, initial]);

  function handleAddClick() {
    if (images.length >= MAX_IMAGES) return;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Append an uploading placeholder
    setImages((prev) => [...prev, { url: "", uploading: true }]);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { publicUrl } = await apiFetch<{ publicUrl: string }>(
        "/admin/media/upload",
        {
          method: "POST",
          body: JSON.stringify({
            context: "size-guide",
            filename: file.name,
            contentType: file.type,
            data: base64,
          }),
        },
      );

      // Replace the uploading placeholder with the real URL
      setImages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.uploading);
        if (idx !== -1) next[idx] = { url: publicUrl };
        return next;
      });
      pendingUrlsRef.current.add(publicUrl);
    } catch (err) {
      // Remove the uploading placeholder on failure
      setImages((prev) => prev.filter((s) => !s.uploading));
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar imagem",
      );
    }
  }

  function removeImage(index: number) {
    const removed = images[index];
    if (removed?.url && pendingUrlsRef.current.has(removed.url)) {
      // Immediately clean up from R2 — fire-and-forget
      apiFetch("/admin/media/delete", {
        method: "POST",
        body: JSON.stringify({ url: removed.url }),
      }).catch(() => {
        /* best-effort */
      });
      pendingUrlsRef.current.delete(removed.url);
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
    setLightboxIndex(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: SizeGuideImage[] = images
      .filter((img) => img.url && !img.uploading)
      .map((img, i) => ({ url: img.url, position: i }));
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      images: payload,
    });
    // Saved successfully — these URLs are no longer pending
    pendingUrlsRef.current.clear();
  }

  /** Called when the user dismisses the modal without saving */
  function handleClose() {
    const orphans = Array.from(pendingUrlsRef.current);
    if (orphans.length > 0) {
      // Fire-and-forget cleanup of each uploaded-but-not-saved image
      orphans.forEach((url) => {
        apiFetch("/admin/media/delete", {
          method: "POST",
          body: JSON.stringify({ url }),
        }).catch(() => {
          /* best-effort */
        });
      });
      pendingUrlsRef.current.clear();
    }
    onClose();
  }

  const filledImages = images.filter((img) => img.url && !img.uploading);

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={isEdit ? "Detalhes do guia" : "Criar guia de tamanhos"}
        maxWidth="max-w-[640px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-primary font-figtree">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Guia de calçado feminino"
              maxLength={100}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-text-dark font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-primary font-figtree">
              Notas{" "}
              <span className="text-text-label font-normal">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do guia…"
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text-dark font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Images */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-primary font-figtree">
              Imagens ilustrativas{" "}
              <span className="text-text-label font-normal">
                ({images.filter((i) => !i.uploading).length}/{MAX_IMAGES})
              </span>
            </label>

            <div className="flex flex-wrap gap-2.5">
              {/* Uploaded / uploading thumbnails */}
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative w-24 h-24 rounded-xl overflow-hidden border border-border-light bg-bg shrink-0 group"
                >
                  {img.uploading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="w-6 h-6 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <Image
                        fill
                        src={img.url}
                        alt={`Imagem ${i + 1}`}
                        className="object-cover cursor-pointer"
                        sizes="96px"
                        onClick={() => setLightboxIndex(i)}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 bg-black/25 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-text-dark hover:bg-white transition-colors"
                          title="Ver imagem"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-danger hover:bg-white transition-colors"
                          title="Remover"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* "Adicionar imagem" button — always visible when below limit */}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={handleAddClick}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-accent flex flex-col items-center justify-center gap-1 text-text-label hover:border-accent hover:text-accent transition-colors shrink-0"
                >
                  <ImagePlus size={20} />
                  <span className="text-xs font-figtree text-center text-accent leading-tight px-1">
                    Adicionar imagem
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border-light">
            {isEdit && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-s text-text-body font-figtree">
                    Tens a certeza?
                  </span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={loading}
                    className="text-s font-semibold text-danger hover:underline disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-s text-text-muted hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-s font-semibold text-danger hover:underline"
                >
                  Eliminar guia
                </button>
              )
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A guardar..." : isEdit ? "Atualizar" : "Criar guia"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && filledImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-200 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={22} />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((p) => (p !== null ? p - 1 : null));
              }}
              className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Image */}
          <Image
            src={filledImages[lightboxIndex]!.url}
            alt="Imagem ampliada"
            width={1920}
            height={1080}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            style={{ width: "auto", height: "auto" }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightboxIndex < filledImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((p) => (p !== null ? p + 1 : null));
              }}
              className="absolute right-4 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-s font-inter">
            {lightboxIndex + 1} / {filledImages.length}
          </div>
        </div>
      )}
    </>
  );
}
