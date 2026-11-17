import type {
  GamePlayerRow,
  GameResult,
  GameRow,
  GameStatus,
  PasswordResetRow,
  SessionRow,
  TurnRow,
  UserRow,
} from './types.js';
import type { Orders, Side } from '@bot/engine';

/**
 * Storage boundary for the game service. The memory implementation backs all tests;
 * the pg implementation backs production (Docker compose).
 */
export interface Repository {
  // --- users ---
  createUser(email: string, passwordHash: string, displayName: string | null): Promise<UserRow>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  findUserById(id: string): Promise<UserRow | null>;

  // --- sessions ---
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionRow>;
  /** Returns the session only if it exists and has not expired. */
  findActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<void>;
  /** A-24: revoke every session of a user on password reset. */
  deleteSessionsForUser(userId: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;

  // --- password resets (A-24) ---
  createPasswordReset(id: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findPasswordResetByTokenHash(tokenHash: string): Promise<PasswordResetRow | null>;
  markPasswordResetUsed(id: string, usedAt: Date): Promise<void>;

  // --- games ---
  createGame(id: string, rulesetVersion: string, inviteCode: string, createdBy: string): Promise<GameRow>;
  findGameById(id: string): Promise<GameRow | null>;
  findGameByInviteCode(code: string): Promise<GameRow | null>;
  findGameByObserverToken(token: string): Promise<GameRow | null>;
  setObserverToken(id: string, token: string): Promise<void>;
  setGameStatus(id: string, status: GameStatus, result: GameResult | null, endedAt: Date | null): Promise<void>;

  // --- players ---
  addGamePlayer(gameId: string, userId: string, side: Side): Promise<void>;
  getGamePlayers(gameId: string): Promise<GamePlayerRow[]>;

  // --- turns ---
  createTurn(gameId: string, turn: number, stateAfter: string): Promise<void>;
  getCurrentTurn(gameId: string): Promise<TurnRow | null>;
  getTurn(gameId: string, turn: number): Promise<TurnRow | null>;
  /** Stores one side's orders for a turn. */
  setOrders(gameId: string, turn: number, side: Side, orders: Orders): Promise<void>;
  /** Stores the resolution outcome and advances the snapshot to the post-turn state. */
  resolveTurnRow(
    gameId: string,
    turn: number,
    summary: unknown,
    stateAfter: string,
    resolvedAt: Date,
  ): Promise<void>;
  /** All turns with their (post-reveal, public) orders and summaries, ascending. */
  getTurns(gameId: string): Promise<TurnRow[]>;
}
