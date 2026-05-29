"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { SelectOption } from "./MultiSelectDropdown";

export type { SelectOption };

interface SingleSelectDropdownProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  /** When true the trigger is shown but the dropdown cannot be opened */
  disabled?: boolean;
}

export default function SingleSelectDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
  disabled = false,
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  /* Close on outside click */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    onChange?.(opt.value);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-primary font-figtree">
        {label}
      </label>

      <div ref={wrapperRef} className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card text-primary text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
        >
          <span className={!selected ? "text-text-label" : ""}>
            {selected ? selected.label : value || placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${open && !disabled ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown panel */}
        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg">
            <div className="max-h-48 overflow-y-auto">
              {options.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-text-muted font-figtree">
                  Sem opções disponíveis
                </p>
              ) : (
                options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        opt.disabled
                          ? "cursor-default opacity-50"
                          : isSelected
                            ? "bg-navy/5 cursor-pointer"
                            : "hover:bg-surface-hover cursor-pointer"
                      }`}
                    >
                      {/* Radio-style indicator */}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "bg-navy border-navy" : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <Check
                            size={10}
                            strokeWidth={3}
                            className="text-white"
                          />
                        )}
                      </div>
                      <span className="flex flex-col min-w-0">
                        <span className="text-sm text-primary font-figtree leading-tight">
                          {opt.label}
                        </span>
                        {opt.hint && (
                          <span className="text-[11px] text-text-muted font-figtree leading-tight mt-0.5">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
