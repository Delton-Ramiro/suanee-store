const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  details?: string[];
  constructor(message: string, details?: string[]) {
    super(message);
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
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      details?: string[];
    };
    throw new ApiError(body.error ?? `Erro ${res.status}`, body.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
