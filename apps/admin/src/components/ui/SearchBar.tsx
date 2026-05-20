"use client";

import { Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounce?: number;
  /** Overrides the default width class (`w-66`). Pass e.g. `"w-full"` to stretch. */
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Procure...",
  debounce = 2000,
  className,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevPropValue = useRef(value);

  // Sync from parent when value changes externally (e.g. segment change resets search)
  useEffect(() => {
    if (value !== prevPropValue.current && value !== localValue) {
      setLocalValue(value);
    }
    prevPropValue.current = value;
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), debounce);
  }

  return (
    <div
      className={`flex items-center gap-2 bg-bg border border-border-light rounded-lg px-3 h-10 ${className ?? "w-full sm:w-66"}`}
    >
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-sm text-text-dark font-figtree placeholder:text-text-muted"
      />
      <span className="text-text-muted shrink-0">
        <Search size={18} />
      </span>
    </div>
  );
}
