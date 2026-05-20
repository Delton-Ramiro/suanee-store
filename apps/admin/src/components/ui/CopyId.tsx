"use client";

import { useState, useRef } from "react";
import { shortId } from "@/lib/format";

interface CopyIdProps {
  id: string;
}

export default function CopyId({ id }: CopyIdProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleClick}
      title={id}
      className="font-inter text-text-muted hover:text-accent transition-colors cursor-pointer select-none"
    >
      {copied ? (
        <span className="text-success text-[12px]">Copiado!</span>
      ) : (
        <span className="text-s">{shortId(id)}…</span>
      )}
    </button>
  );
}
