import type { GameResult, GameState, Orders, Side, TurnSummary } from '@bot/engine';
export type { GameResult, GameState, Orders, Side, TurnSummary } from '@bot/engine';

/** DB row shapes (repository layer). */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: Date;
}

export interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

/** A-24 password reset tokens: SHA-256 hash at rest, 1h TTL, single use (used_at). */
export interface PasswordResetRow {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export type GameStatus = 'open' | 'active' | 'finished';

export interface GameRow {
  id: string;
  rulesetVersion: string;
  status: GameStatus;
  inviteCode: string;
  /** Unguessable token for no-login observer access (M3/A-19); null until generated. */
  observerToken: string | null;
  createdBy: string;
  result: GameResult | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface GamePlayerRow {
  gameId: string;
  userId: string;
  side: Side;
  displayName: string | null;
}

export interface TurnRow {
  gameId: string;
  turn: number;
  stateOrders: Orders | null;
  terroristOrders: Orders | null;
  summary: TurnSummary | null;
  /** serializeState snapshot; updated to the post-resolution state once resolved. */
  stateAfter: string;
  resolvedAt: Date | null;
}

/** What the REST API and WS hub expose. Client mirrors this shape. */
export interface PlayerInfo {
  userId: string;
  displayName: string | null;
  side: Side;
}

export interface OpponentInfo extends PlayerInfo {
  connected: boolean;
  /** True once they have locked in orders for the current turn (content stays hidden). */
  submitted: boolean;
}

export interface ResolvedTurn {
  turn: number;
  orders: Record<Side, Orders>;
  summary: TurnSummary;
  stateAfter: GameState;
}

export interface YouInfo {
  userId: string;
  side: Side;
  submitted: boolean;
  /** Your own pending orders for the current turn (null once resolved). */
  orders: Orders | null;
}

export interface GameView {
  id: string;
  rulesetVersion: string;
  status: GameStatus;
  /** Only for players, and only while the game is open. */
  inviteCode: string | null;
  result: GameResult | null;
  turn: number;
  players: PlayerInfo[];
  you: YouInfo | null;
  opponent: OpponentInfo | null;
  /** null while the game is open (not started yet). */
  state: GameState | null;
  history: ResolvedTurn[];
}

/** WS protocol messages (server -> client). */
export type ServerMessage =
  | { type: 'game'; game: GameView }
  | { type: 'orders-submitted'; side: Side; turn: number }
  | { type: 'reveal'; turn: number; summary: TurnSummary; state: GameState }
  | { type: 'game-over'; result: GameResult }
  | { type: 'presence'; side: Side; connected: boolean };
