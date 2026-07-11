export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || `${path} failed`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AuthUser = { userId: string; name: string; image?: string };

export async function fetchMe(): Promise<{ authenticated: boolean; user?: AuthUser }> {
  return api("/api/auth/me");
}

export async function devLogin(name?: string): Promise<void> {
  await api("/api/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function logout(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
}
