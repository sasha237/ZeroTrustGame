import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { WsHub } from '../src/ws.js';
import type { ServerMessage } from '../src/types.js';

/** Minimal socket stub: records sends, lets us drive close events. */
function fakeSocket() {
  const sent: string[] = [];
  const listeners = new Map<string, () => void>();
  const socket = {
    readyState: 1,
    OPEN: 1,
    send: (payload: string) => sent.push(payload),
    close: () => {
      socket.readyState = 3;
      listeners.get('close')?.();
    },
    on: (event: string, cb: () => void) => listeners.set(event, cb),
    sent,
  };
  return socket as unknown as WebSocket & { sent: string[] };
}

describe('WsHub observer slots (A-19)', () => {
  it('addObserver/sendPublic reach only observer sockets; broadcast reaches everyone', () => {
    const hub = new WsHub();
    const player = fakeSocket();
    const observer = fakeSocket();
    hub.add('g1', 'u1', player);
    hub.addObserver('g1', observer);

    const msg: ServerMessage = { type: 'orders-submitted', side: 'state', turn: 1 };
    hub.sendPublic('g1', msg);
    expect(observer.sent).toHaveLength(1);
    expect(player.sent).toHaveLength(0);

    hub.broadcast('g1', msg);
    expect(observer.sent).toHaveLength(2);
    expect(player.sent).toHaveLength(1);

    hub.send('g1', 'u1', msg);
    expect(player.sent).toHaveLength(2);
    expect(observer.sent).toHaveLength(2);

    expect(hub.isConnected('g1', 'u1')).toBe(true);
    hub.closeAll();
    expect(hub.isConnected('g1', 'u1')).toBe(false);
  });

  it('observer close removes the slot without firing presence', () => {
    const hub = new WsHub();
    const presence = vi.fn();
    hub.onPresence = presence;
    const observer = fakeSocket();
    hub.addObserver('g1', observer);
    observer.close();
    hub.sendPublic('g1', { type: 'game-over', result: { winner: 'draw', reasons: [] } });
    expect(observer.sent).toHaveLength(0);
    expect(presence).not.toHaveBeenCalled();
  });
});
