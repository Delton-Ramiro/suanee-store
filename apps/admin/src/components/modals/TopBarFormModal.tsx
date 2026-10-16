"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import TextInput from "@/components/ui/TextInput";
import Toggle from "@/components/ui/Toggle";
import DateTimePicker from "@/components/ui/DateTimePicker";
import type { TopBar, TopBarPayload } from "@/lib/hooks/useTopBars";

interface TopBarFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: TopBarPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: TopBar;
  loading?: boolean;
}

type TimerMode = "none" | "duration" | "deadline";

export default function TopBarFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  loading,
}: TopBarFormModalProps) {
  const isEdit = !!initial;

  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [timerMode, setTimerMode] = useState<TimerMode>("none");
  const [timerSeconds, setTimerSeconds] = useState("");
  const [timerDeadline, setTimerDeadline] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(initial?.text ?? "");
    setLinkUrl(initial?.linkUrl ?? "");
    setLinkLabel(initial?.linkLabel ?? "");
    setIsActive(initial?.isActive ?? false);

    if (initial?.timerMode === "duration") {
      setTimerMode("duration");
      setTimerSeconds(initial.timerSeconds ? String(initial.timerSeconds) : "");
      setTimerDeadline(null);
    } else if (initial?.timerMode === "deadline" && initial.timerDeadline) {
      setTimerMode("deadline");
      const parsed = new Date(initial.timerDeadline);
      setTimerDeadline(isNaN(parsed.getTime()) ? null : parsed);
      setTimerSeconds("");
    } else {
      setTimerMode("none");
      setTimerSeconds("");
      setTimerDeadline(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const payload: TopBarPayload = {
      text: text.trim(),
      linkUrl: linkUrl.trim() || null,
      linkLabel: linkLabel.trim() || null,
      isActive,
      timerMode: timerMode === "none" ? null : timerMode,
      timerSeconds: timerMode === "duration" ? (parseInt(timerSeconds, 10) || null) : null,
      timerDeadline: timerMode === "deadline" && timerDeadline
        ? timerDeadline.toISOString()
        : null,
    };

    await onSubmit(payload);
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

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar barra" : "Criar barra de anúncio"}
      maxWidth="max-w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Live preview */}
        {text.trim() && (
          <div className="w-full bg-navy text-white text-sm font-figtree font-medium py-2.5 px-4 rounded-lg flex items-center justify-between gap-3">
            <span className="truncate">{text.trim()}</span>
            {linkUrl.trim() && (
              <span className="underline opacity-80 text-xs shrink-0">
                {linkLabel.trim() || "Ver mais"}
              </span>
            )}
          </div>
        )}

        {/* Text */}
        <TextInput
          label="Texto do anúncio"
          value={text}
          onChange={setText}
          placeholder="Ex: Envio grátis em compras acima de 2.000 MZN"
        />

        {/* Link */}
        <TextInput
          label="Link (opcional)"
          value={linkUrl}
          onChange={setLinkUrl}
          placeholder="https://exemplo.com/promocao"
        />
        <TextInput
          label="Texto do link (opcional)"
          value={linkLabel}
          onChange={setLinkLabel}
          placeholder="Ver mais"
        />

        {/* Timer */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-primary font-figtree">
            Temporizador (opcional)
          </label>

          {/* Mode selector */}
          <div className="flex gap-2">
            {(["none", "duration", "deadline"] as TimerMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTimerMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-figtree border transition-colors ${
                  timerMode === m
                    ? "bg-navy text-white border-navy"
                    : "bg-card text-text-body border-border hover:bg-surface-hover"
                }`}
              >
                {m === "none" ? "Nenhum" : m === "duration" ? "Duração" : "Data limite"}
              </button>
            ))}
          </div>

          {/* Duration input */}
          {timerMode === "duration" && (
            <div className="flex flex-col gap-1">
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(e.target.value)}
                  placeholder="Ex: 3600"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm font-figtree text-text-dark placeholder:text-text-subtle focus:outline-none focus:border-accent transition-colors pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-figtree font-medium pointer-events-none">
                  seg
                </span>
              </div>
              <p className="text-xs text-text-muted font-figtree">
                Conta a partir da 1ª visita do utilizador — persiste ao recarregar a página.
              </p>
            </div>
          )}

          {/* Deadline date picker */}
          {timerMode === "deadline" && (
            <div className="flex flex-col gap-1">
              <DateTimePicker
                value={timerDeadline}
                onChange={setTimerDeadline}
                placeholder="Selecionar data e hora limite"
                minDate={new Date()}
              />
              <p className="text-xs text-text-muted font-figtree">
                O contador calcula automaticamente o tempo restante até esta data.
              </p>
            </div>
          )}
        </div>

        {/* isActive */}
        <div className="border-t border-border-light pt-3">
          <Toggle
            label="Barra activa"
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
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-figtree text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} />
              Eliminar
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
              disabled={loading || !text.trim()}
              className="px-5 py-2.5 text-sm font-semibold font-figtree bg-navy text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "A guardar…" : isEdit ? "Guardar" : "Criar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>

    <ConfirmModal
      open={confirmOpen}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={async () => {
        setConfirmOpen(false);
        await handleDelete();
      }}
      loading={deleting}
    />
    </>
  );
}
