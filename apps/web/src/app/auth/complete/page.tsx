"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { syncWithServer } from "@/lib/sync";

export default function AuthComplete() {
  const called = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(async ({ data: { session }, error: sessionErr }) => {
      if (sessionErr || !session) {
        setError(sessionErr?.message ?? "Sessão Supabase não encontrada após troca de código.");
        return;
      }

      try {
        const { accessToken, refreshToken } = await apiFetch<{
          accessToken: string;
          refreshToken: string;
        }>("/auth/supabase", {
          method: "POST",
          body: JSON.stringify({ accessToken: session.access_token }),
        });

        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);

        // Merge anonymous cart/favorites into user account before navigating
        await syncWithServer(accessToken).catch(() => {});

        window.location.replace("/");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao verificar sessão no servidor.");
      }
    });
  }, []);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white border border-border rounded-lg max-w-lg w-full p-6 flex flex-col gap-4 shadow-card">
          <p className="font-bold text-danger">Erro na autenticação</p>
          <p className="text-sm font-mono text-text-muted break-all">{error}</p>
          <a href="/login" className="text-sm text-primary hover:underline">
            ← Voltar ao login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
        <p className="text-sm font-medium text-text-muted">A concluir autenticação…</p>
      </div>
    </main>
  );
}
