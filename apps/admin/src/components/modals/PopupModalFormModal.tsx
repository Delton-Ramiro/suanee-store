"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import Toggle from "@/components/ui/Toggle";
import ImageUpload from "@/components/ui/ImageUpload";
import type { PopupModal, PopupModalPayload } from "@/lib/hooks/usePopupModals";

interface PopupModalFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: PopupModalPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: PopupModal;
  loading?: boolean;
}

export default function PopupModalFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  loading,
}: PopupModalFormModalProps) {
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setImageUrl(initial?.imageUrl ?? "");
    setRedirectUrl(initial?.redirectUrl ?? "");
    setIsActive(initial?.isActive ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !imageUrl) return;
    await onSubmit({
      name: name.trim(),
      imageUrl,
      redirectUrl: redirectUrl.trim() || null,
      isActive,
    });
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const canSubmit = name.trim() && imageUrl;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar modal" : "Criar modal"}
      maxWidth="max-w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Image */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-primary font-figtree">
            Imagem
          </label>
          <ImageUpload
            imageUrl={imageUrl || null}
            onChange={setImageUrl}
            context="collection"
          />
        </div>

        {/* Name */}
        <TextInput
          label="Nome"
          value={name}
          onChange={setName}
          placeholder="Ex: Promoção de Verão"
        />

        {/* Redirect URL */}
        <TextInput
          label="Link de redirecionamento (opcional)"
          value={redirectUrl}
          onChange={setRedirectUrl}
          placeholder="https://exemplo.com/promocao"
        />

        {/* isActive toggle */}
        <div className="border-t border-border-light pt-3">
          <Toggle
            label="Modal activo"
            value={isActive}
            onChange={setIsActive}
            showText
          />
          {isActive && (
            <p className="mt-1.5 text-xs text-text-muted font-figtree">
              Activar este modal irá desactivar todos os outros.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border-light pt-4">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-figtree text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} />
              {deleting ? "A eliminar…" : "Eliminar"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
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
        </div>
      </form>
    </Modal>
  );
}
