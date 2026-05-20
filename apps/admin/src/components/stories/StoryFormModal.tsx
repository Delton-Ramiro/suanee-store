"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  ImagePlus,
  X,
  ZoomIn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import { apiFetch } from "@/lib/api";
import {
  useAdminProducts,
  type AdminProduct,
} from "@/lib/hooks/useAdminProducts";
import type { Story } from "@/lib/hooks/useStories";

/* ── Types ────────────────────────────────────────────────────────────────── */

type SlideProduct = { id: string; name: string; imageUrl: string | null };

type SlideItem = {
  mediaUrl: string;
  mediaType: "image" | "video";
  products: SlideProduct[];
  uploading?: boolean;
};

export type StoryFormPayload = {
  name: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  slides: {
    mediaUrl: string;
    mediaType: "image" | "video";
    position: number;
    productIds: string[];
  }[];
};

interface StoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: StoryFormPayload) => Promise<void>;
  initial?: Story;
  loading?: boolean;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Slide product picker ─────────────────────────────────────────────────── */

function SlideProductPicker({
  slideIndex,
  products,
  onToggle,
}: {
  slideIndex: number;
  products: SlideProduct[];
  onToggle: (slideIndex: number, product: SlideProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useAdminProducts({
    search: search || undefined,
    limit: 10,
  });

  const resultItems = data?.items ?? [];
  const selectedIds = new Set(products.map((p) => p.id));

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  function handleToggle(item: AdminProduct) {
    const imageUrl = item.media?.[0]?.url ?? null;
    onToggle(slideIndex, { id: item.id, name: item.name, imageUrl });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Dropdown trigger */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-card border border-border rounded-lg text-sm font-figtree hover:border-accent transition-colors"
        >
          <span className="text-text-label text-sm font-figtree">
            Digite o nome do produto
          </span>
          <ChevronDown size={18} className="text-text-muted shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border-light rounded-lg shadow-card overflow-hidden">
            {/* Search input */}
            <div className="px-3 py-2 border-b border-border-light">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar produto…"
                className="w-full bg-transparent outline-none text-s text-text-dark font-figtree placeholder:text-text-label"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="max-h-55 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-5">
                  <span className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                </div>
              ) : resultItems.length === 0 ? (
                <p className="text-s text-text-muted font-figtree px-3 py-4 text-center">
                  Sem resultados
                </p>
              ) : (
                resultItems.map((item) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggle(item)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors ${
                        checked ? "bg-navy/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-navy border-navy" : "border-border"
                        }`}
                      >
                        {checked && (
                          <svg
                            width="10"
                            height="8"
                            viewBox="0 0 10 8"
                            fill="none"
                          >
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>

                      {/* Product thumbnail */}
                      {item.media?.[0]?.url ? (
                        <Image
                          src={item.media[0].url}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-md object-cover shrink-0 border border-border-light"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-bg border border-border-light shrink-0" />
                      )}

                      <span className="text-s text-text-dark font-figtree flex-1 min-w-0 truncate">
                        {item.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected products */}
      {products.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-2.5">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-md object-cover shrink-0 border border-border-light"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-bg border border-border-light shrink-0" />
              )}
              <span className="text-s text-text-dark font-figtree flex-1 min-w-0 truncate">
                {product.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main modal ───────────────────────────────────────────────────────────── */

export default function StoryFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: StoryFormModalProps) {
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);
  const pendingUrlsRef = useRef<Set<string>>(new Set());

  /* ── Init / reset ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    pendingUrlsRef.current = new Set();
    setName(initial?.name ?? "");
    setIsActive(initial?.isActive ?? true);
    setThumbnail(initial?.thumbnailUrl ?? null);
    setLightboxIndex(null);
    setDragOverIndex(null);

    if (initial?.slides && initial.slides.length > 0) {
      setSlides(
        [...initial.slides]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            mediaUrl: s.mediaUrl,
            mediaType: s.mediaType as "image" | "video",
            products: s.products.map((sp) => ({
              id: sp.product.id,
              name: sp.product.name,
              imageUrl: sp.product.media?.[0]?.url ?? null,
            })),
          })),
      );
    } else {
      setSlides([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  /* ── Thumbnail upload ────────────────────────────────────────────────────── */
  async function handleThumbnailFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setThumbnailUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { publicUrl } = await apiFetch<{ publicUrl: string }>(
        "/admin/media/upload",
        {
          method: "POST",
          body: JSON.stringify({
            context: "story-thumbnail",
            filename: file.name,
            contentType: file.type,
            data: base64,
          }),
        },
      );
      setThumbnail(publicUrl);
      pendingUrlsRef.current.add(publicUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar imagem",
      );
    } finally {
      setThumbnailUploading(false);
    }
  }

  /* ── Slide upload ────────────────────────────────────────────────────────── */
  async function handleSlideFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const mediaType: "image" | "video" = file.type.startsWith("video/")
      ? "video"
      : "image";

    setSlides((prev) => [
      ...prev,
      { mediaUrl: "", mediaType, products: [], uploading: true },
    ]);

    try {
      const base64 = await fileToBase64(file);
      const { publicUrl } = await apiFetch<{ publicUrl: string }>(
        "/admin/media/upload",
        {
          method: "POST",
          body: JSON.stringify({
            context: "story-slide",
            filename: file.name,
            contentType: file.type,
            data: base64,
          }),
        },
      );
      setSlides((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.uploading);
        if (idx !== -1)
          next[idx] = { mediaUrl: publicUrl, mediaType, products: [] };
        return next;
      });
      pendingUrlsRef.current.add(publicUrl);
    } catch (err) {
      setSlides((prev) => prev.filter((s) => !s.uploading));
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar ficheiro",
      );
    }
  }

  function removeSlide(index: number) {
    const s = slides[index];
    if (s?.mediaUrl) {
      apiFetch("/admin/media/delete", {
        method: "POST",
        body: JSON.stringify({ url: s.mediaUrl }),
      }).catch(() => {});
      pendingUrlsRef.current.delete(s.mediaUrl);
    }
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setLightboxIndex(null);
  }

  /* ── Drag / drop slide reorder ───────────────────────────────────────────── */
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
    setSlides((prev) => {
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

  /* ── Product toggle ──────────────────────────────────────────────────────── */
  function handleProductToggle(slideIndex: number, product: SlideProduct) {
    setSlides((prev) => {
      const next = [...prev];
      const slide = { ...next[slideIndex] };
      const already = slide.products.find((p) => p.id === product.id);
      slide.products = already
        ? slide.products.filter((p) => p.id !== product.id)
        : [...slide.products, product];
      next[slideIndex] = slide;
      return next;
    });
  }

  /* ── Submit / close ──────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const readySlides = slides.filter((s) => s.mediaUrl && !s.uploading);
    if (readySlides.length === 0) return;

    await onSubmit({
      name: name.trim(),
      thumbnailUrl: thumbnail,
      isActive,
      slides: readySlides.map((s, i) => ({
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        position: i,
        productIds: s.products.map((p) => p.id),
      })),
    });
    pendingUrlsRef.current.clear();
  }

  function handleClose() {
    const orphans = Array.from(pendingUrlsRef.current);
    orphans.forEach((url) => {
      apiFetch("/admin/media/delete", {
        method: "POST",
        body: JSON.stringify({ url }),
      }).catch(() => {});
    });
    pendingUrlsRef.current.clear();
    onClose();
  }

  const filledSlides = slides.filter((s) => s.mediaUrl && !s.uploading);
  const canSubmit = name.trim() && filledSlides.length > 0;

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={isEdit ? "Editar story" : "Imagem do produto"}
        maxWidth="max-w-[920px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* ── Top: thumbnail + slides | name details ─────────────────────── */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* LEFT: thumbnail + slides grid */}
            <div className="flex flex-col gap-4 w-full md:w-75 min-w-0">
              {/* Imagem principal */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-primary font-figtree">
                  Imagem principal
                </label>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-bg border border-border group">
                  {thumbnail ? (
                    <Image
                      fill
                      src={thumbnail}
                      alt="Thumbnail"
                      className="object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <ImagePlus size={32} className="text-text-label" />
                      <span className="text-s font-figtree text-text-label">
                        Nenhuma imagem selecionada
                      </span>
                    </div>
                  )}

                  {thumbnailUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                      <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}

                  {!thumbnailUploading && (
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/90 text-text-dark border border-border-light shadow-sm hover:bg-navy hover:text-white transition-colors"
                    >
                      <ImagePlus size={16} />
                      <span className="text-xs font-figtree font-medium">
                        Procurar
                      </span>
                    </button>
                  )}
                </div>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleThumbnailFile}
                />
              </div>
            </div>

            {/* RIGHT: name / details */}
            <div className="flex flex-col gap-4 flex-1 shrink-0">
              <h3 className="text-[16px] font-bold text-text-dark font-figtree">
                Detalhes
              </h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-primary font-figtree">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Vendas da semana"
                  maxLength={100}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-text-dark font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* isActive toggle — only on edit */}
              {isEdit && (
                <Toggle
                  label="Estado da story"
                  value={isActive}
                  onChange={setIsActive}
                />
              )}
            </div>
          </div>

          {/* Slides grid */}
          <div className="flex flex-wrap gap-2.5">
            {slides.map((slide, i) => (
              <div
                key={i}
                draggable={!slide.uploading}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`relative w-24 h-24 rounded-xl overflow-hidden border border-border-light bg-bg shrink-0 group cursor-grab active:cursor-grabbing transition-opacity select-none ${
                  dragOverIndex === i ? "opacity-40 scale-95" : "opacity-100"
                }`}
              >
                {slide.uploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="w-6 h-6 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
                  </div>
                ) : slide.mediaType === "video" ? (
                  <video
                    src={slide.mediaUrl}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <Image
                    fill
                    src={slide.mediaUrl}
                    alt={`Slide ${i + 1}`}
                    className="object-cover"
                    sizes="96px"
                  />
                )}

                {!slide.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 bg-black/25 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-text-dark hover:bg-white transition-colors"
                      title="Ver"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-danger hover:bg-white transition-colors"
                      title="Remover"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Slide number badge */}
                <span className="absolute top-1 left-1 bg-navy/70 text-white text-2xs font-figtree font-medium rounded px-1 pointer-events-none">
                  {i + 1}
                </span>
              </div>
            ))}

            {/* Add slide button */}
            <button
              type="button"
              onClick={() => slideInputRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-accent flex flex-col items-center justify-center gap-1 hover:text-accent transition-colors shrink-0"
            >
              <ImagePlus size={20} className="text-accent" />
              <span className="text-xs font-figtree text-center text-accent leading-tight px-1">
                Adicionar imagem
              </span>
            </button>

            <input
              ref={slideInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="hidden"
              onChange={handleSlideFile}
            />
          </div>

          {/* ── Produtos associados ─────────────────────────────────────────── */}
          {filledSlides.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-border-light pt-4">
              <h3 className="text-[16px] font-bold text-text-dark font-figtree">
                Produtos associados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                {filledSlides.map((slide, orderedIdx) => {
                  /* find its real index in slides[] for product toggle */
                  const globalIdx = slides.indexOf(slide);
                  return (
                    <div key={orderedIdx} className="flex flex-col gap-3">
                      {/* Slide thumbnail */}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border-light bg-bg shrink-0">
                        {slide.mediaType === "video" ? (
                          <video
                            src={slide.mediaUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <Image
                            fill
                            src={slide.mediaUrl}
                            alt={`Slide ${orderedIdx + 1}`}
                            className="object-cover"
                            sizes="64px"
                          />
                        )}
                      </div>

                      <label className="text-sm font-bold text-primary font-figtree">
                        Produto
                      </label>

                      <SlideProductPicker
                        slideIndex={globalIdx}
                        products={slide.products}
                        onToggle={handleProductToggle}
                      />
                      <div className="border-b border-b-0.5 border-accent md:hidden"></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 border-t border-border-light pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-semibold font-figtree text-text-body border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="px-5 py-2.5 text-sm font-semibold font-figtree bg-navy text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "A guardar…" : isEdit ? "Atualizar" : "Criar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && open && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          {/* Prev */}
          <button
            type="button"
            className="absolute left-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null));
            }}
            disabled={lightboxIndex === 0}
          >
            <ChevronLeft size={22} />
          </button>

          {/* Media */}
          <div
            className="max-w-[80vw] max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {slides[lightboxIndex]?.mediaType === "video" ? (
              <video
                src={slides[lightboxIndex].mediaUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : (
              <Image
                src={slides[lightboxIndex]?.mediaUrl}
                alt={`Slide ${lightboxIndex + 1}`}
                width={1920}
                height={1080}
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: "80vw",
                  maxHeight: "80vh",
                }}
              />
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            className="absolute right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) =>
                i !== null ? Math.min(slides.length - 1, i + 1) : null,
              );
            }}
            disabled={lightboxIndex === slides.length - 1}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </>
  );
}
