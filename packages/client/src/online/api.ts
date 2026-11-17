import type { Orders, Side } from '@bot/engine';
import type { GameView, PublicUser } from './types';

const TOKEN_KEY = 'bot.token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (options.auth !== false && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: { error?: string } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, parsed.error ?? `request failed with ${res.status}`);
  }
  return parsed as T;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const api = {
  register(email: string, password: string, displayName?: string) {
    return request<{ token: string; user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
      auth: false,
    }).then((r) => {
      setToken(r.token);
      return r;
    });
  },
  login(email: string, password: string) {
    return request<{ token: string; user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }).then((r) => {
      setToken(r.token);
      return r;
    });
  },
  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
    }
  },
  me() {
    return request<{ user: PublicUser }>('/auth/me');
  },
  createGame(side: Side) {
    return request<{ game: GameView }>('/games', { method: 'POST', body: { side } });
  },
  joinGame(code: string) {
    return request<{ game: GameView }>('/games/join', { method: 'POST', body: { code } });
  },
  getGame(id: string) {
    return request<{ game: GameView }>(`/games/${id}`);
  },
  submitOrders(id: string, orders: Orders) {
    return request<{ game: GameView }>(`/games/${id}/orders`, { method: 'POST', body: orders });
  },
  observerLink(id: string) {
    return request<{ token: string }>(`/games/${id}/observer-link`, { method: 'POST' });
  },
  observe(token: string) {
    return request<{ game: GameView }>(`/observe/${encodeURIComponent(token)}`);
  },
  /** A-24: always resolves; the server answers identically for unknown emails. */
  forgot(email: string) {
    return request<{ ok: true }>('/auth/forgot', { method: 'POST', body: { email }, auth: false });
  },
  reset(token: string, password: string) {
    return request<{ ok: true }>('/auth/reset', { method: 'POST', body: { token, password }, auth: false });
  },
};

/** CSV export needs the raw bytes (and an auth header), so it goes through fetch directly. */
export async function exportCsv(gameId: string, observerToken?: string): Promise<Blob> {
  const url = observerToken ? `/games/${gameId}/export.csv?token=${encodeURIComponent(observerToken)}` : `/games/${gameId}/export.csv`;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (!observerToken && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = `request failed with ${res.status}`;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message);
  }
  return res.blob();
}

/** Triggers a browser download for a blob (fetch was needed for the Bearer header). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
