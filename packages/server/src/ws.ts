import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ServerMessage } from './types.js';

/**
 * Per-game socket registry. One socket per (game, user) — a reconnect replaces the
 * previous socket. Broadcasts reach both players' sockets.
 *
 * Presence translation (userId -> side) is wired by the app via onPresence.
 */
export class WsHub {
  private slots = new Map<string, WebSocket>();

  /** Wired by the app so presence messages carry the game side. */
  onPresence: ((gameId: string, userId: string, connected: boolean) => void) | null = null;

  private static key(gameId: string, userId: string): string {
    return `${gameId}:${userId}`;
  }

  add(gameId: string, userId: string, socket: WebSocket): void {
    const key = WsHub.key(gameId, userId);
    const existing = this.slots.get(key);
    if (existing && existing !== socket) {
      try {
        existing.close(4000, 'replaced by a newer connection');
      } catch {
        /* already closing */
      }
    }
    this.slots.set(key, socket);
    socket.on('close', () => {
      if (this.slots.get(key) === socket) {
        this.slots.delete(key);
        this.onPresence?.(gameId, userId, false);
      }
    });
    socket.on('error', () => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    });
    this.onPresence?.(gameId, userId, true);
  }

  /** Observer socket: no userId, no presence. Returns nothing; stored under an internal key. */
  addObserver(gameId: string, socket: WebSocket): void {
    const key = `${gameId}:observer:${randomBytes(4).toString('hex')}`;
    this.slots.set(key, socket);
    socket.on('close', () => {
      if (this.slots.get(key) === socket) this.slots.delete(key);
    });
    socket.on('error', () => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    });
  }

  /** Sends a message to every observer socket of the game. */
  sendPublic(gameId: string, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    const prefix = `${gameId}:observer:`;
    for (const [key, socket] of this.slots) {
      if (!key.startsWith(prefix)) continue;
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  }

  send(gameId: string, userId: string, message: ServerMessage): void {
    const socket = this.slots.get(WsHub.key(gameId, userId));
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  broadcast(gameId: string, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const [key, socket] of this.slots) {
      if (!key.startsWith(`${gameId}:`)) continue;
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  }

  isConnected(gameId: string, userId: string): boolean {
    const socket = this.slots.get(WsHub.key(gameId, userId));
    return !!socket && socket.readyState === socket.OPEN;
  }

  closeAll(): void {
    for (const socket of this.slots.values()) {
      try {
        socket.close(1001, 'server shutdown');
      } catch {
        /* ignore */
      }
    }
    this.slots.clear();
  }
}
