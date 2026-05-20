"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import type { Color } from "@/lib/hooks/useColors";

interface ColorFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, hexCode: string) => Promise<void>;
  /** Pre-fill fields when editing an existing color */
  initial?: Color;
  loading?: boolean;
}

/** Strips the leading `#` for display; user always types without it */
function stripHash(hex: string) {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}

/** Ensures the value has exactly one leading `#` */
function addHash(hex: string) {
  const clean = hex.replace(/^#+/, "");
  return `#${clean}`;
}

export default function ColorFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: ColorFormModalProps) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [hex, setHex] = useState("");

  /* Sync fields when modal opens or initial data changes */
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setHex(initial ? stripHash(initial.hexCode) : "");
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(name.trim(), addHash(hex.trim().toUpperCase()));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar cor" : "Criar cor"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          label="Cor"
          id="color-name"
          value={name}
          onChange={setName}
          placeholder="Ex: Azul escuro"
          autoFocus
          maxLength={50}
        />

        <FormField
          label="Código"
          id="color-hex"
          value={hex}
          onChange={(v) => setHex(v.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6))}
          placeholder="Ex: 101C48"
          maxLength={6}
        />

        {/* Hex preview swatch */}
        {hex.length === 6 && (
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-border-light shrink-0"
              style={{ backgroundColor: addHash(hex) }}
              aria-hidden="true"
            />
            <span className="text-s text-text-muted font-figtree">
              #{hex.toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading || name.trim().length === 0 || hex.length !== 6}
            className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar..." : isEdit ? "Atualizar" : "Publicar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
