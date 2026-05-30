"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "./supabase";
import { apiFetch } from "./api";
import { loadFromServer } from "./sync";
import { cartStore } from "./stores/cartStore";
import { favoritesStore } from "./stores/favoritesStore";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<AuthUser>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((u) => {
        setUser(u);
        setAccessToken(token);
        loadFromServer(token).catch(() => {}); // background sync
      })
      .catch(async () => {
        // Access token expired — try to rotate with the refresh token
        const stored = localStorage.getItem("refresh_token");
        if (!stored) {
          localStorage.removeItem("access_token");
          return;
        }
        try {
          const { accessToken: newAccess, refreshToken: newRefresh } =
            await apiFetch<{ accessToken: string; refreshToken: string }>(
              "/auth/refresh",
              { method: "POST", body: JSON.stringify({ refreshToken: stored }) },
            );
          localStorage.setItem("access_token", newAccess);
          localStorage.setItem("refresh_token", newRefresh);
          const u = await apiFetch<AuthUser>("/auth/me", {
            headers: { Authorization: `Bearer ${newAccess}` },
          });
          setUser(u);
          setAccessToken(newAccess);
          loadFromServer(newAccess).catch(() => {}); // background sync
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    // Page navigates away — no further code runs here
  };

  const signOut = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    cartStore.setItems([]);
    favoritesStore.setItems([]);
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
