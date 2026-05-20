"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface ImageUploadProps {
  imageUrl: string | null;
  onChange: (url: string) => void;
  disabled?: boolean;
  context?: string;
}

export default function ImageUpload({
  imageUrl,
  onChange,
  disabled = false,
  context = "category",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      // Convert to base64 and upload via API (avoids R2 CORS restrictions)
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

      onChange(publicUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar imagem",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-bg border border-border group">
      {/* Image (or empty state) */}
      {imageUrl ? (
        <Image
          fill
          src={imageUrl}
          alt="Pré-visualização"
          className="object-cover"
          sizes="100vw"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-muted">
          <ImagePlus size={36} className="text-text-label" />
          <span className="text-s font-figtree text-text-label">
            Nenhuma imagem selecionada
          </span>
        </div>
      )}

      {/* Upload overlay */}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl z-10">
          <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Procurar button — always visible when not uploading */}
      {!disabled && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="Procurar imagem"
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/90 text-text-dark border border-border-light shadow-sm hover:bg-navy hover:text-white cursor-pointer transition-colors"
        >
          <ImagePlus size={16} />
          <span className="text-xs font-figtree font-medium">Procurar</span>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
