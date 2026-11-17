import type { GameResult, GameState, Orders, Side, TurnSummary } from '@bot/engine';

/** Mirror of the server view model (packages/server/src/types.ts). Keep in sync. */
export interface PlayerInfo {
  userId: string;
  displayName: string | null;
  side: Side;
}

export interface OpponentInfo extends PlayerInfo {
  connected: boolean;
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
  orders: Orders | null;
}

export interface GameView {
  id: string;
  rulesetVersion: string;
  status: 'open' | 'active' | 'finished';
  inviteCode: string | null;
  result: GameResult | null;
  turn: number;
  players: PlayerInfo[];
  you: YouInfo | null;
  opponent: OpponentInfo | null;
  state: GameState | null;
  history: ResolvedTurn[];
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
}

/** Mirror of the server WS protocol. */
export type ServerMessage =
  | { type: 'game'; game: GameView }
  | { type: 'orders-submitted'; side: Side; turn: number }
  | { type: 'reveal'; turn: number; summary: TurnSummary; state: GameState }
  | { type: 'game-over'; result: GameResult }
  | { type: 'presence'; side: Side; connected: boolean };
