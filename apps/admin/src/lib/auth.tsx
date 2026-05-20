"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import type { RoleKey } from "@ecommerce/types";
import { apiFetch } from "@/lib/api";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleKey: RoleKey | null;
  permissions: number;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  deleteCookie(TOKEN_KEY);
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    loading: true,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as AdminUser) : null;
    if (!token) {
      setState({ token: null, user, loading: false });
      return;
    }

    setState({ token, user, loading: true });

    apiFetch<AdminUser>("/admin/auth/me")
      .then((freshUser) => {
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        setState({ token, user: freshUser, loading: false });
      })
      .catch(() => {
        clearStoredAuth();
        setState({ token: null, user: null, loading: false });
        router.replace("/login");
      });
  }, [router]);

  const login = useCallback((token: string, user: AdminUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setCookie(TOKEN_KEY, token, 1); // 1 day — matches 8h JWT; cookie is just for middleware
    setState({ token, user, loading: false });
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setState({ token: null, user: null, loading: false });
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
