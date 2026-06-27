"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export default function TagInput({ value, onChange, disabled }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
      try {
        const res = await apiFetch<string[]>(`/catalog/tags/suggest?q=${encodeURIComponent(q.trim())}`);
        const filtered = (res ?? []).filter((t) => !value.includes(t));
        setSuggestions(filtered);
        setOpen(filtered.length > 0);
        setHighlightIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }, [value]);

  useEffect(() => {
    fetchSuggestions(input);
  }, [input, fetchSuggestions]);

  function addTag(tag: string) {
    const clean = tag.toLowerCase().trim().replace(/[,;]+/g, "").slice(0, 50);
    if (!clean || value.includes(clean)) { setInput(""); return; }
    onChange([...value, clean]);
    setInput("");
    setSuggestions([]);
    setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        addTag(suggestions[highlightIdx]!);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className="min-h-12 flex flex-wrap gap-1.5 px-3 py-2 rounded-xl border border-border bg-card focus-within:border-accent transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium font-figtree"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                className="text-accent/60 hover:text-accent transition-colors"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          disabled={disabled}
          placeholder={value.length === 0 ? "Adicionar tag…" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm font-figtree text-text-dark placeholder:text-text-label outline-none py-0.5 disabled:cursor-default"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => addTag(s)}
              className={`px-3 py-2 text-sm font-figtree cursor-pointer transition-colors ${
                i === highlightIdx ? "bg-surface-hover text-accent" : "text-text-dark hover:bg-surface-hover"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
