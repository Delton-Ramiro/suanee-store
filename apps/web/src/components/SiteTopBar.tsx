"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type TopBarData = {
  id: string;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  timerMode: "duration" | "deadline" | null;
  timerSeconds: number | null;
  timerDeadline: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const TOP_BAR_H = 40;

function startKey(id: string) {
  return `top_bar_start_${id}`;
}

function setTopBarVar(px: number) {
  document.documentElement.style.setProperty("--topbar-h", `${px}px`);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "";
  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const ss = String(s).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const hh = String(h).padStart(2, "0");
  if (totalSecs < 60) return `:${ss}`;
  if (totalSecs < 3600) return `${mm}:${ss}`;
  if (d > 0) return `${d}d ${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}`;
}

function useCountdown(bar: TopBarData, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!bar.timerMode) return;

    function getRemaining(): number {
      if (bar.timerMode === "deadline" && bar.timerDeadline) {
        return new Date(bar.timerDeadline).getTime() - Date.now();
      }
      if (bar.timerMode === "duration" && bar.timerSeconds) {
        let start = parseInt(localStorage.getItem(startKey(bar.id)) ?? "0", 10);
        if (!start) {
          start = Date.now();
          localStorage.setItem(startKey(bar.id), String(start));
        }
        return start + bar.timerSeconds * 1000 - Date.now();
      }
      return -1;
    }

    const initial = getRemaining();
    if (initial <= 0) {
      onExpireRef.current();
      return;
    }
    setRemaining(initial);

    const id = setInterval(() => {
      const r = getRemaining();
      if (r <= 0) {
        clearInterval(id);
        setRemaining(0);
        onExpireRef.current();
      } else {
        setRemaining(r);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [bar.id, bar.timerMode, bar.timerSeconds, bar.timerDeadline]);

  return remaining;
}

function TopBarItem({
  bar,
  onDismiss,
}: {
  bar: TopBarData;
  onDismiss: () => void;
}) {
  const remaining = useCountdown(bar, onDismiss);

  return (
    <div className="relative flex items-center justify-center h-full px-10">
      <p className="text-sm font-figtree font-medium text-center leading-snug">
        {bar.text}
        {bar.timerMode && remaining !== null && remaining > 0 && (
          <span className="ml-3 font-mono text-xs opacity-90 tracking-wide">
            {formatCountdown(remaining)}
          </span>
        )}
        {bar.linkUrl && (
          <a
            href={bar.linkUrl}
            className="ml-2 underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap"
          >
            {bar.linkLabel || "Ver mais"}
          </a>
        )}
      </p>
      <button
        onClick={onDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
        aria-label="Fechar barra"
      >
        <X size={14} className="text-white" />
      </button>
    </div>
  );
}

export default function SiteTopBar() {
  const [bars, setBars] = useState<TopBarData[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/catalog/top-bars/active`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<TopBarData[]>) : []))
      .then((data) => {
        const visible = Array.isArray(data) ? data : [];
        setBars(visible);
        setTopBarVar(visible.length * TOP_BAR_H);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTopBarVar(bars.length * TOP_BAR_H);
  }, [bars.length]);

  function dismiss(id: string) {
    setBars((prev) => prev.filter((b) => b.id !== id));
  }

  if (bars.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-10 bg-brand text-white"
      style={{ top: 0, height: bars.length * TOP_BAR_H }}
    >
      {bars.map((bar) => (
        <div key={bar.id} style={{ height: TOP_BAR_H }}>
          <TopBarItem bar={bar} onDismiss={() => dismiss(bar.id)} />
        </div>
      ))}
    </div>
  );
}
