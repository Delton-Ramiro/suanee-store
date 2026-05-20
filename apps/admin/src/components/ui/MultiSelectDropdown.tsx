"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
};

interface MultiSelectDropdownProps {
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Renders a search input inside the open dropdown panel */
  searchable?: boolean;
  searchPlaceholder?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = "Selecionar…",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Pesquisar…",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visibleOptions =
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        )
      : options;

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }

  function handleTriggerClick() {
    if (open) setQuery("");
    setOpen((o) => !o);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-primary font-figtree">
        {label}
      </label>

      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleTriggerClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card text-primary text-sm font-figtree focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
        >
          <span className={selected.length === 0 ? "text-text-label" : ""}>
            {selected.length === 0
              ? placeholder
              : `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown panel */}
        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg">
            {/* Search box */}
            {searchable && (
              <div className="px-3 py-2 border-b border-border-light">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  className="w-full text-s text-primary font-figtree bg-transparent outline-none placeholder:text-text-label"
                />
              </div>
            )}

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto">
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-2.5 text-s text-text-muted font-figtree">
                  Sem opções disponíveis
                </p>
              ) : (
                visibleOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${opt.disabled ? "cursor-default opacity-50" : "cursor-pointer hover:bg-surface-hover"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => !opt.disabled && toggle(opt.value)}
                      disabled={opt.disabled}
                      className="w-4 h-4 accent-navy rounded"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm text-primary font-figtree leading-tight">
                        {opt.label}
                      </span>
                      {opt.hint && (
                        <span className="text-xxs text-text-muted font-figtree leading-tight mt-0.5">
                          {opt.hint}
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
