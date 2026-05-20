"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  /** When true the option is shown but cannot be selected */
  disabled?: boolean;
  /** Small sub-label shown below the option label when disabled */
  hint?: string;
};

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  disabled = false,
  searchable = true,
  searchPlaceholder = "Pesquisar…",
  clearable = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const visibleOptions =
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        )
      : options;

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSelect(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  function handleTriggerClick() {
    if (disabled) return;
    if (open) setQuery("");
    setOpen((o) => !o);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleTriggerClick}
        className="w-full flex items-center justify-between px-3 h-12 rounded-xl border border-border bg-card text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
      >
        <span className={selectedOption ? "text-text-dark" : "text-text-label"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              onClick={handleClear}
              className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-surface-hover text-text-muted hover:text-danger transition-colors cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          {searchable && (
            <div className="px-3 py-2 border-b border-border-light">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="w-full text-s text-text-dark font-figtree bg-transparent outline-none placeholder:text-text-label"
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-3 text-s text-text-muted font-figtree text-center">
                Sem opções disponíveis
              </p>
            ) : (
              visibleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm font-figtree transition-colors ${
                    opt.disabled
                      ? "cursor-not-allowed opacity-40"
                      : opt.value === value
                        ? "bg-navy/5 text-navy font-semibold hover:bg-navy/5"
                        : "text-text-dark hover:bg-surface-hover"
                  }`}
                >
                  <span
                    className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-full border transition-colors ${
                      opt.value === value
                        ? "bg-navy border-navy"
                        : "border-border"
                    }`}
                  >
                    {opt.value === value && (
                      <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                        <path
                          d="M1 3.5L3 5.5L7 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block">{opt.label}</span>
                    {opt.hint && (
                      <span className="block text-xxs text-text-muted font-normal">
                        {opt.hint}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
