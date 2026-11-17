import type { Repository } from './repo.js';
import type { GamePlayerRow, GameResult, GameRow, GameStatus, PasswordResetRow, SessionRow, TurnRow, UserRow } from './types.js';
import type { Orders, Side } from '@bot/engine';

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** In-memory repository. Single-process, sequential access — used by all tests. */
export function createMemoryRepository(): Repository {
  const users = new Map<string, UserRow>();
  const usersByEmail = new Map<string, string>();
  const sessions = new Map<string, SessionRow>();
  const passwordResets = new Map<string, PasswordResetRow>();
  const games = new Map<string, GameRow>();
  const gamePlayers = new Map<string, GamePlayerRow[]>();
  const turns = new Map<string, TurnRow[]>();

  return {
    async createUser(email, passwordHash, displayName) {
      const row: UserRow = {
        id: crypto.randomUUID(),
        email,
        passwordHash,
        displayName,
        createdAt: new Date(),
      };
      users.set(row.id, row);
      usersByEmail.set(email, row.id);
      return clone(row);
    },
    async findUserByEmail(email) {
      const id = usersByEmail.get(email);
      return id ? clone(users.get(id)!) : null;
    },
    async findUserById(id) {
      const row = users.get(id);
      return row ? clone(row) : null;
    },

    async createSession(userId, tokenHash, expiresAt) {
      const row: SessionRow = { id: crypto.randomUUID(), userId, tokenHash, createdAt: new Date(), expiresAt };
      sessions.set(row.id, row);
      return clone(row);
    },
    async findActiveSessionByTokenHash(tokenHash, now) {
      for (const row of sessions.values()) {
        if (row.tokenHash === tokenHash) {
          return row.expiresAt > now ? clone(row) : null;
        }
      }
      return null;
    },
    async deleteSession(id) {
      sessions.delete(id);
    },
    async deleteSessionsForUser(userId) {
      for (const [id, row] of sessions) {
        if (row.userId === userId) sessions.delete(id);
      }
    },
    async updateUserPassword(userId, passwordHash) {
      const row = users.get(userId);
      if (!row) throw new Error(`user ${userId} not found`);
      row.passwordHash = passwordHash;
    },

    async createPasswordReset(id, userId, tokenHash, expiresAt) {
      passwordResets.set(id, { id, userId, tokenHash, createdAt: new Date(), expiresAt, usedAt: null });
    },
    async findPasswordResetByTokenHash(tokenHash) {
      for (const row of passwordResets.values()) {
        if (row.tokenHash === tokenHash) return clone(row);
      }
      return null;
    },
    async markPasswordResetUsed(id, usedAt) {
      const row = passwordResets.get(id);
      if (!row) throw new Error(`password reset ${id} not found`);
      row.usedAt = usedAt;
    },

    async createGame(id, rulesetVersion, inviteCode, createdBy) {
      const row: GameRow = {
        id,
        rulesetVersion,
        status: 'open',
        inviteCode,
        observerToken: null,
        createdBy,
        result: null,
        endedAt: null,
        createdAt: new Date(),
      };
      games.set(id, row);
      gamePlayers.set(id, []);
      return clone(row);
    },
    async findGameById(id) {
      const row = games.get(id);
      return row ? clone(row) : null;
    },
    async findGameByInviteCode(code) {
      for (const row of games.values()) {
        if (row.inviteCode === code) return clone(row);
      }
      return null;
    },
    async findGameByObserverToken(token) {
      for (const row of games.values()) {
        if (row.observerToken === token) return clone(row);
      }
      return null;
    },
    async setObserverToken(id, token) {
      const row = games.get(id);
      if (!row) throw new Error(`game ${id} not found`);
      row.observerToken = token;
    },
    async setGameStatus(id, status: GameStatus, result: GameResult | null, endedAt: Date | null) {
      const row = games.get(id);
      if (!row) throw new Error(`game ${id} not found`);
      row.status = status;
      row.result = result;
      row.endedAt = endedAt;
    },

    async addGamePlayer(gameId, userId, side: Side) {
      const players = gamePlayers.get(gameId);
      if (!players) throw new Error(`game ${gameId} not found`);
      players.push({ gameId, userId, side, displayName: null });
    },
    async getGamePlayers(gameId) {
      return clone(gamePlayers.get(gameId) ?? []);
    },

    async createTurn(gameId, turn, stateAfter) {
      const list = turns.get(gameId) ?? [];
      list.push({ gameId, turn, stateOrders: null, terroristOrders: null, summary: null, stateAfter, resolvedAt: null });
      turns.set(gameId, list);
    },
    async getCurrentTurn(gameId) {
      const list = turns.get(gameId) ?? [];
      const row = list[list.length - 1];
      return row ? clone(row) : null;
    },
    async getTurn(gameId, turn) {
      const row = (turns.get(gameId) ?? []).find((t) => t.turn === turn);
      return row ? clone(row) : null;
    },
    async setOrders(gameId, turn, side: Side, orders: Orders) {
      const row = (turns.get(gameId) ?? []).find((t) => t.turn === turn);
      if (!row) throw new Error(`turn ${turn} of game ${gameId} not found`);
      if (side === 'state') row.stateOrders = clone(orders);
      else row.terroristOrders = clone(orders);
    },
    async resolveTurnRow(gameId, turn, summary: unknown, stateAfter: string, resolvedAt: Date) {
      const row = (turns.get(gameId) ?? []).find((t) => t.turn === turn);
      if (!row) throw new Error(`turn ${turn} of game ${gameId} not found`);
      row.summary = clone(summary) as TurnRow['summary'];
      row.stateAfter = stateAfter;
      row.resolvedAt = resolvedAt;
    },
    async getTurns(gameId) {
      return clone(turns.get(gameId) ?? []);
    },
  };
}
