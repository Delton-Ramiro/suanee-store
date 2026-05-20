"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Loader2 } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional metadata — pass a hex color string to show a color swatch at the end of the row */
  meta?: string;
};

interface ApiSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Initial options shown before any search (keep small, ~10) */
  options: SelectOption[];
  /** Called when the user types and there are no local matches. Must return options. */
  onSearch?: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  searchPlaceholder?: string;
}

export default function ApiSearchSelect({
  value,
  onChange,
  options,
  onSearch,
  placeholder = "Selecionar…",
  disabled = false,
  clearable = false,
  searchPlaceholder = "Pesquisar…",
}: ApiSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** null = use (filtered) initial options; array = overridden by API response */
  const [apiResults, setApiResults] = useState<SelectOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef("");
  // Use refs so triggerSearch is stable and never recreated on prop changes
  const optionsRef = useRef(options);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    optionsRef.current = options;
  });
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  /* ── Merged option pool: initial + any API-returned (for label lookup) ── */
  const allKnown = apiResults
    ? [
        ...options,
        ...apiResults.filter((r) => !options.some((o) => o.value === r.value)),
      ]
    : options;

  /* Always make sure the selected item has a label even if not in current list */
  const selectedOption = allKnown.find((o) => o.value === value);

  /* Which options to display in the dropdown */
  const displayOptions = (() => {
    const q = query.trim().toLowerCase();
    if (apiResults !== null) {
      // We got API results — optionally filter them client-side too
      return q
        ? apiResults.filter((o) => o.label.toLowerCase().includes(q))
        : apiResults;
    }
    // Local filter over initial options
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
  })();

  /* ── Search logic ───────────────────────────────────────────────────────── */
  // No deps — reads options/onSearch via refs so this function is never recreated,
  // which prevents the useEffect below from re-firing and causing an infinite loop.
  const triggerSearch = useCallback(async (q: string) => {
    if (!onSearchRef.current || q.trim().length < 2) return;
    // Only call API if there are no local matches
    const localMatches = optionsRef.current.filter((o) =>
      o.label.toLowerCase().includes(q.trim().toLowerCase()),
    );
    if (localMatches.length > 0) {
      setApiResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await onSearchRef.current(q.trim());
      // Only apply if the query hasn't changed while the request was in flight
      if (latestQueryRef.current === q) {
        setApiResults(results);
      }
    } finally {
      if (latestQueryRef.current === q) setSearching(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    latestQueryRef.current = q;

    if (!q || q.length < 2) {
      setApiResults(null);
      setSearching(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSearch(q), 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, triggerSearch]);

  /* ── Close on outside click ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function closeDropdown() {
    setOpen(false);
    setQuery("");
    setApiResults(null);
    setSearching(false);
  }

  function handleSelect(optValue: string) {
    onChange(optValue);
    closeDropdown();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) closeDropdown();
          else setOpen(true);
        }}
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
          <div className="px-3 py-2 border-b border-border-light flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="flex-1 text-s text-text-dark font-figtree bg-transparent outline-none placeholder:text-text-label"
            />
            {searching && (
              <Loader2
                size={14}
                className="text-text-muted animate-spin shrink-0"
              />
            )}
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {displayOptions.length === 0 ? (
              <p className="px-3 py-3 text-s text-text-muted font-figtree text-center">
                {searching ? "A pesquisar…" : "Sem opções disponíveis"}
              </p>
            ) : (
              displayOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm font-figtree hover:bg-surface-hover transition-colors ${
                    opt.value === value
                      ? "bg-navy/5 text-navy font-semibold"
                      : "text-text-dark"
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
                  <span className="flex-1">{opt.label}</span>
                  {opt.meta && (
                    <span
                      className="w-4 h-4 rounded-full border border-border-light shrink-0"
                      style={{ backgroundColor: opt.meta }}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
