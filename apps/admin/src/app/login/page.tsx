"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AdminUser } from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        admin?: AdminUser;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Credenciais inválidas");
        return;
      }
      login(data.token!, data.admin!);
      router.replace("/dashboard");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-120 shrink-0 relative overflow-hidden px-14 py-12"
        style={{
          background: "linear-gradient(145deg, #101c48 0%, #023337 100%)",
        }}
      >
        {/* Decorative background circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -left-32 w-72 h-72 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute bottom-32 left-8 w-3 h-3 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-2 h-2 rounded-full bg-white/10 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            {/* Logomark */}
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-black text-[24px] tracking-[0.1em] text-white uppercase font-figtree">
              SUANEE
            </span>
          </div>
          <p className="text-s text-white/45 font-figtree leading-relaxed max-w-[220px]">
            Painel de administração
          </p>
        </div>

        {/* Feature cards */}
        <div className="relative z-10 space-y-4">
          {[
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ),
              heading: "Controle total",
              body: "Gerencie produtos, encomendas e clientes num só lugar.",
            },
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              ),
              heading: "Dados em tempo real",
              body: "Acompanhe receita, stock e análises ao vivo.",
            },
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              ),
              heading: "Segurança por função",
              body: "Permissões granulares por administrador.",
            },
          ].map(({ icon, heading, body }) => (
            <div
              key={heading}
              className="flex gap-4 p-4 rounded-2xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-4.5 h-4.5 stroke-white"
                >
                  {icon}
                </svg>
              </div>
              <div>
                <p className="text-white text-s font-bold font-lato leading-snug">
                  {heading}
                </p>
                <p className="text-white/50 text-[12px] font-figtree leading-relaxed mt-0.5">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xxs text-white/25 font-figtree">
          © {new Date().getFullYear()} Suanee · Todos os direitos reservados
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-100">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <span className="font-black text-[26px] tracking-[0.08em] text-navy uppercase font-figtree">
              SUANEE
            </span>
          </div>

          <h1 className="text-[26px] font-black text-text-dark font-lato tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-text-muted font-figtree">
            Inicie sessão para aceder ao painel.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-s font-bold text-text-dark font-lato mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@suanee.com"
                className="w-full h-11 px-4 rounded-xl border border-border bg-card text-sm text-text-dark placeholder:text-text-label font-figtree outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
              />
            </div>

            <div>
              <label className="block text-s font-bold text-text-dark font-lato mb-1.5">
                Palavra-passe
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl border border-border bg-card text-sm text-text-dark placeholder:text-text-label font-figtree outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
              />
            </div>

            {error && (
              <p className="text-s text-danger font-figtree">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full h-11 bg-navy rounded-xl text-white text-sm font-bold font-lato tracking-wide hover:bg-primary transition-colors disabled:opacity-80 disabled:cursor-not-allowed overflow-hidden"
            >
              {/* Shimmer sweep while loading */}
              {loading && (
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              )}

              <span className="relative flex items-center justify-center gap-2">
                {loading && (
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-80"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}
                {loading ? "A entrar…" : "Entrar"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
