const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      "ngrok-skip-browser-warning": "true",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const err = new ApiError(
      res.status,
      (body.error as string) ?? `Erro ${res.status}`,
      body.details as string[] | undefined,
    );
    // Spread all body fields (e.g. `violations`) onto the error so callers can inspect them.
    Object.assign(err, body);
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Deduplicates concurrent refresh attempts — only one token rotation in-flight at a time.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;
    if (!refreshToken) throw new Error("No refresh token");
    const { accessToken: newAccess, refreshToken: newRefresh } =
      await apiFetch<{ accessToken: string; refreshToken: string }>(
        "/auth/refresh",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
      );
    localStorage.setItem("access_token", newAccess);
    localStorage.setItem("refresh_token", newRefresh);
    return newAccess;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** apiFetch with the stored access token injected. Auto-refreshes once on 401. */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;
  if (!token) return Promise.reject(new Error("Not authenticated"));

  try {
    return await apiFetch<T>(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        return await apiFetch<T>(path, {
          ...init,
          headers: { Authorization: `Bearer ${newToken}`, ...(init?.headers ?? {}) },
        });
      } catch {
        throw e;
      }
    }
    throw e;
  }
}
