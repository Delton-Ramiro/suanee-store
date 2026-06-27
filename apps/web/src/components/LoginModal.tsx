"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLoginModal, loginStore } from "@/lib/stores/loginStore";
import { useAuth } from "@/lib/auth";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.148 17.64 11.84 17.64 9.2Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export function LoginModal() {
  const isOpen = useLoginModal();
  const { user, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close when user logs in
  useEffect(() => {
    if (user && isOpen) loginStore.close();
  }, [user, isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") loginStore.close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setBusy(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Page navigates away — Google OAuth redirects out
    } catch {
      setError("Não foi possível iniciar a autenticação. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40"
        onClick={loginStore.close}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Entrar na conta"
        className="fixed inset-0 z-[71] flex items-center justify-center px-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white border border-border rounded-lg w-full max-w-[411px] p-6 flex flex-col items-center gap-6 shadow-card">
          {/* Close button */}
          <div className="w-full flex justify-end -mb-2">
            <button
              type="button"
              onClick={loginStore.close}
              aria-label="Fechar"
              className="text-text-muted hover:text-brand transition-colors"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Logo */}
          <p className="text-[34px] font-bold text-brand text-center tracking-wide leading-none">
            SUANEE
          </p>

          {/* Subtitle */}
          <p className="text-xs font-medium text-text-subtle text-center leading-snug">
            Por favor, insira a sua informação para realizar o login
          </p>

          {/* Error */}
          {error && (
            <p className="w-full text-center text-xs text-danger bg-danger/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full h-[50px] flex items-center justify-center gap-[9.6px] border border-[#f0f0f0] rounded-[15px] bg-white hover:bg-surface-hover active:scale-[0.98] transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span className="w-5 h-5 rounded-full border-2 border-[#595959]/30 border-t-[#595959] animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className="text-[13.5px] font-semibold text-[#595959]">
              {busy ? "A redirecionar…" : "Continue with Google"}
            </span>
          </button>

          {/* Skip */}
          <button
            type="button"
            onClick={loginStore.close}
            className="text-sm font-medium text-text-muted hover:text-brand transition-colors duration-150"
          >
            Continuar sem conta
          </button>
        </div>
      </div>
    </>
  );
}
