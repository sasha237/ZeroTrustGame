import type { ServerMessage } from './types';

export interface SocketHandlers {
  onMessage: (message: ServerMessage) => void;
  /** Called when the socket drops (before auto-reconnect). */
  onDrop: () => void;
  /** Called when the socket is back open — refetch state here. */
  onResume: () => void;
}

const RETRY_MS = 2000;

/**
 * Auto-reconnecting game socket. Reconnects with a fixed delay; the screen shows a
 * "reconnecting…" banner between onDrop and onResume and refetches via REST on resume.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly handlers: SocketHandlers,
  ) {
    this.open();
  }

  private open(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (event) => {
      try {
        this.handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onopen = () => this.handlers.onResume();
    ws.onclose = () => {
      if (this.closedByUser) return;
      this.handlers.onDrop();
      this.retryTimer = setTimeout(() => this.open(), RETRY_MS);
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  close(): void {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }
}

export function gameSocketUrl(gameId: string, token: string): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  const base = configured ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  return `${base}/ws/${gameId}?token=${encodeURIComponent(token)}`;
}

export function observerSocketUrl(token: string): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  const base = configured ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  return `${base}/ws?observe=${encodeURIComponent(token)}`;
}
