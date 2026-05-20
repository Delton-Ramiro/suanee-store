"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import type { CurrencyRate } from "@/lib/hooks/useCurrency";

interface CurrencyFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    code: string;
    name: string;
    symbol: string;
    rate: number;
  }) => Promise<void>;
  initial?: CurrencyRate;
  loading?: boolean;
}

export default function CurrencyFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: CurrencyFormModalProps) {
  const isEdit = !!initial;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? "");
      setName(initial?.name ?? "");
      setSymbol(initial?.symbol ?? "");
      setRate(initial ? String(initial.rate) : "");
    }
  }, [open, initial]);

  const parsedRate = parseFloat(rate);
  const isValid =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    symbol.trim().length > 0 &&
    !isNaN(parsedRate) &&
    parsedRate > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    await onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      rate: parsedRate,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar câmbio" : "Criar câmbio"}
      maxWidth="max-w-[480px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Code + Symbol side by side */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Código"
            id="currency-code"
            value={code}
            onChange={(v) =>
              setCode(
                v
                  .replace(/[^A-Za-z]/g, "")
                  .slice(0, 10)
                  .toUpperCase(),
              )
            }
            placeholder="Ex: USD"
            autoFocus
            maxLength={10}
          />
          <FormField
            label="Símbolo"
            id="currency-symbol"
            value={symbol}
            onChange={(v) => setSymbol(v.slice(0, 10))}
            placeholder="Ex: $"
            maxLength={10}
          />
        </div>

        <FormField
          label="Nome"
          id="currency-name"
          value={name}
          onChange={setName}
          placeholder="Ex: Dólar Americano"
          maxLength={50}
        />

        {/* Rate field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="currency-rate"
            className="text-s font-semibold text-text-dark font-figtree"
          >
            Taxa (para MZN)
          </label>
          <div className="relative">
            <input
              id="currency-rate"
              type="number"
              min="0"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Ex: 63.50"
              className="w-full bg-bg border border-border-light rounded-lg px-4 py-2.5 pr-16 text-sm text-text-dark font-inter placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-s text-text-muted font-inter pointer-events-none">
              MZN
            </span>
          </div>
          {parsedRate > 0 && symbol.trim().length > 0 && (
            <p className="text-[12px] text-text-muted font-figtree">
              1 {code || "—"} = {parsedRate.toFixed(4)} MZN
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading || !isValid}
            className="bg-navy text-white text-md font-bold font-figtree px-6 py-2.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "A guardar..." : isEdit ? "Atualizar" : "Publicar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
