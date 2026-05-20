"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import NextImage from "next/image";
import {
  Image as ImageIcon,
  Plus,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type MediaDraft = {
  id: string; // local temp id (uuid) or existing media id
  url: string;
  mediaType: "image" | "video";
  isPrimary: boolean;
  uploading?: boolean;
  colorId?: string | null;
};

interface Props {
  items: MediaDraft[];
  onChange: (items: MediaDraft[]) => void;
  colorId?: string | null;
  label?: string;
  context?: string;
  maxItems?: number;
  disabled?: boolean;
}

/* ── Sortable thumbnail ────────────────────────────────────────────────────── */

function SortableThumb({
  item,
  onRemove,
  onPreview,
  disabled,
}: {
  item: MediaDraft;
  onRemove: () => void;
  onPreview: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative w-[98px] h-[98px] rounded-xl overflow-hidden border border-border-light bg-bg shrink-0 group cursor-grab active:cursor-grabbing"
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {item.uploading ? (
        <div className="w-full h-full flex items-center justify-center bg-surface-hover">
          <span className="w-5 h-5 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      ) : item.mediaType === "video" ? (
        <video
          src={item.url}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
      ) : (
        <NextImage
          fill
          src={item.url}
          alt=""
          className="object-cover"
          sizes="98px"
        />
      )}
      {!disabled && !item.uploading && (
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 bg-black/25 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-text-dark hover:bg-white transition-colors"
            title="Ver"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-danger hover:bg-white transition-colors"
            title="Remover"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */

let tempIdCounter = 0;
function tempId() {
  return `tmp-${++tempIdCounter}-${Math.random().toString(36).slice(2)}`;
}

export default function ProductMediaZone({
  items,
  onChange,
  colorId = null,
  label,
  context = "product",
  maxItems = 10,
  disabled = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const toUpload = Array.from(files).slice(0, maxItems - items.length);
    if (toUpload.length === 0) return;

    const placeholders: MediaDraft[] = toUpload.map((f) => ({
      id: tempId(),
      url: "",
      mediaType: f.type.startsWith("video/") ? "video" : "image",
      isPrimary: items.length === 0,
      uploading: true,
      colorId,
    }));

    const withPlaceholders = [...items, ...placeholders];
    onChange(withPlaceholders);

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]!;
      const placeholder = placeholders[i]!;
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
              context,
              filename: file.name,
              contentType: file.type,
              data: base64,
            }),
          },
        );

        onChange(
          withPlaceholders.map((item) =>
            item.id === placeholder.id
              ? { ...item, url: publicUrl, uploading: false }
              : item,
          ),
        );
      } catch (err) {
        onChange(withPlaceholders.filter((item) => item.id !== placeholder.id));
        toast.error(
          err instanceof Error ? err.message : "Erro ao carregar ficheiro",
        );
      }
    }
  }

  function remove(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    onChange(next);
    // Adjust lightbox index
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      if (prev >= next.length) return next.length > 0 ? next.length - 1 : null;
      if (prev > idx) return prev - 1;
      return prev;
    });
  }

  const canAdd = !disabled && items.length < maxItems;
  const mainItem = items.find((i) => !i.uploading) ?? items[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Label with optional color dot */}
      {label && (
        <span className="text-s font-semibold text-text-dark font-figtree">
          {label}
        </span>
      )}

      {/* Main preview area */}
      <div className="relative w-full h-[266px] bg-surface-hover rounded-xl overflow-hidden flex items-center justify-center">
        {mainItem ? (
          mainItem.uploading ? (
            <span className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          ) : mainItem.mediaType === "video" ? (
            <video
              src={mainItem.url}
              className="max-h-full max-w-[65%] object-contain"
              muted
              playsInline
            />
          ) : (
            <NextImage
              src={mainItem.url}
              alt=""
              width={560}
              height={266}
              className="max-h-full max-w-[65%] object-contain"
              style={{ width: "auto", height: "auto" }}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-label">
            <ImageIcon size={32} strokeWidth={1.5} />
            <span className="text-[12px] font-figtree">Sem imagem</span>
          </div>
        )}

        {/* Procurar button — bottom-left overlay */}
        {!disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-[6px] bg-card rounded-lg border border-border-light text-s font-figtree text-text-body hover:border-accent transition-colors shadow-sm"
          >
            <ImageIcon size={15} className="text-text-muted" />
            Procurar
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="flex gap-3 flex-wrap">
            {items.map((item, idx) => (
              <SortableThumb
                key={item.id}
                item={item}
                onRemove={() => remove(item.id)}
                onPreview={() => setLightboxIndex(idx)}
                disabled={disabled}
              />
            ))}

            {canAdd && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-[98px] h-[98px] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-accent hover:border-navy hover:text-navy transition-colors shrink-0"
              >
                <Plus size={20} />
                <span className="text-xxs font-figtree text-center leading-tight px-2">
                  Adicionar imagem
                </span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Lightbox */}
      {lightboxIndex !== null &&
        (() => {
          const item = items[lightboxIndex];
          if (!item || item.uploading || !item.url) return null;
          return (
            <div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
              onClick={() => setLightboxIndex(null)}
            >
              {/* Close */}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
              >
                <X size={20} />
              </button>

              {/* Prev */}
              <button
                type="button"
                disabled={lightboxIndex === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((p) => (p !== null ? p - 1 : null));
                }}
                className="absolute left-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={22} />
              </button>

              {/* Media */}
              <div
                className="max-w-[80vw] max-h-[80vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {item.mediaType === "video" ? (
                  <video
                    src={item.url}
                    controls
                    className="max-w-full max-h-[80vh] rounded-xl"
                  />
                ) : (
                  <NextImage
                    src={item.url}
                    alt=""
                    width={1920}
                    height={1080}
                    className="max-w-full max-h-[80vh] rounded-xl object-contain"
                    style={{
                      width: "auto",
                      height: "auto",
                      maxWidth: "80vw",
                      maxHeight: "80vh",
                    }}
                  />
                )}
              </div>

              {/* Delete in lightbox */}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(item.id);
                  }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/90 hover:bg-danger text-white text-s font-figtree transition-colors"
                >
                  <X size={15} />
                  Remover imagem
                </button>
              )}

              {/* Next */}
              <button
                type="button"
                disabled={lightboxIndex >= items.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((p) => (p !== null ? p + 1 : null));
                }}
                className="absolute right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors disabled:opacity-30"
              >
                <ChevronRight size={22} />
              </button>

              {/* Counter */}
              <span className="absolute bottom-4 right-4 text-white/60 text-[12px] font-figtree">
                {lightboxIndex + 1} / {items.length}
              </span>
            </div>
          );
        })()}
    </div>
  );
}
