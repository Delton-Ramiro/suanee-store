"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TextInput from "@/components/ui/TextInput";
import Toggle from "@/components/ui/Toggle";
import { MOZAMBIQUE_PROVINCES, type MozambiqueProvince } from "@ecommerce/types";
import type { PickPoint } from "@/lib/hooks/usePickPoints";

interface PickPointFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    province: string,
    name: string,
    address: string,
    isActive: boolean,
  ) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: PickPoint;
  loading?: boolean;
  isDeleting?: boolean;
}

export default function PickPointFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  loading,
  isDeleting,
}: PickPointFormModalProps) {
  const isEdit = !!initial;
  const [province, setProvince] = useState<MozambiqueProvince>(MOZAMBIQUE_PROVINCES[0]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setProvince((initial?.province as MozambiqueProvince) ?? MOZAMBIQUE_PROVINCES[0]);
    setName(initial?.name ?? "");
    setAddress(initial?.address ?? "");
    setIsActive(initial?.isActive ?? true);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(province, name.trim(), address.trim(), isActive);
  }

  const canSubmit = province && name.trim().length > 0 && address.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar ponto de recolha" : "Novo ponto de recolha"}
      maxWidth="max-w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Province dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-primary font-figtree">
            Província
          </label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value as MozambiqueProvince)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-primary text-sm font-figtree focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
          >
            {MOZAMBIQUE_PROVINCES.map((p: MozambiqueProvince) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <TextInput
          label="Nome do ponto"
          value={name}
          onChange={setName}
          placeholder="Ex: Shoprite Maputo"
        />

        <TextInput
          label="Morada / Descrição"
          value={address}
          onChange={setAddress}
          placeholder="Ex: Av. 25 de Setembro, nº 420, Maputo"
        />

        {/* Active toggle */}
        <div className="border-t border-border-light pt-3">
          <Toggle
            label="Ponto activo"
            value={isActive}
            onChange={setIsActive}
            showText
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border-light pt-4">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-figtree text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} />
              {isDeleting ? "A eliminar…" : "Eliminar"}
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
