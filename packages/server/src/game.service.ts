import { randomBytes, randomUUID } from 'node:crypto';
import {
  deserializeState,
  getInitialState,
  resolveTurn,
  rulesetV1_3,
  serializeState,
  validateOrders,
  type Orders,
  type Side,
} from '@bot/engine';
import type { Repository } from './repo.js';
import type { GamePlayerRow, GameView, ResolvedTurn, UserRow } from './types.js';
import { WsHub } from './ws.js';

/** Business-rule failure mapped to an HTTP status by the routes. */
export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 8-char Crockford base32 code from 40 random bits (5 bytes -> 8 chars). */
export function generateInviteCode(): string {
  const bytes = randomBytes(5);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out.slice(0, 8);
}

export function isSide(value: unknown): value is Side {
  return value === 'state' || value === 'terrorist';
}

const OTHER: Record<Side, Side> = { state: 'terrorist', terrorist: 'state' };

export class GameService {
  constructor(
    private readonly repo: Repository,
    private readonly hub: WsHub,
  ) {}

  // --- invite codes ---

  private async freshInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateInviteCode();
      if (!(await this.repo.findGameByInviteCode(code))) return code;
    }
    throw new ServiceError(500, 'could not allocate an invite code');
  }

  // --- game lifecycle ---

  async createGame(user: UserRow, side: Side): Promise<GameView> {
    const code = await this.freshInviteCode();
    const game = await this.repo.createGame(randomUUID(), rulesetV1_3.version, code, user.id);
    await this.repo.addGamePlayer(game.id, user.id, side);
    return this.getGameView(user.id, game.id);
  }

  async joinGame(user: UserRow, rawCode: string): Promise<GameView> {
    const code = rawCode.trim().toUpperCase();
    if (code.length !== 8) throw new ServiceError(404, 'unknown invite code');
    const game = await this.repo.findGameByInviteCode(code);
    if (!game) throw new ServiceError(404, 'unknown invite code');
    const players = await this.repo.getGamePlayers(game.id);
    if (players.some((p) => p.userId === user.id)) {
      throw new ServiceError(409, 'you are already in this game');
    }
    if (game.status !== 'open') throw new ServiceError(409, 'game is no longer open');
    const creatorSide = players[0]?.side;
    if (!creatorSide) throw new ServiceError(500, 'game has no creator');
    await this.repo.addGamePlayer(game.id, user.id, OTHER[creatorSide]);
    await this.repo.setGameStatus(game.id, 'active', null, null);
    const initial = getInitialState(rulesetV1_3);
    await this.repo.createTurn(game.id, initial.turn, serializeState(initial));
    this.pushGameToPlayers(game.id);
    return this.getGameView(user.id, game.id);
  }

  // --- orders ---

  async submitOrders(user: UserRow, gameId: string, orders: Orders): Promise<GameView> {
    const game = await this.repo.findGameById(gameId);
    if (!game) throw new ServiceError(404, 'unknown game');
    const players = await this.repo.getGamePlayers(gameId);
    const me = players.find((p) => p.userId === user.id);
    if (!me) throw new ServiceError(403, 'you are not a player in this game');
    if (game.status !== 'active') throw new ServiceError(409, 'game is not active');

    const turnRow = await this.repo.getCurrentTurn(gameId);
    if (!turnRow || turnRow.resolvedAt) throw new ServiceError(409, 'no turn awaiting orders');
    const myCurrent = me.side === 'state' ? turnRow.stateOrders : turnRow.terroristOrders;
    if (myCurrent) throw new ServiceError(409, 'orders already submitted for this turn');

    // Server-side authority: clients cannot be trusted.
    const state = deserializeState(turnRow.stateAfter);
    const errors = validateOrders(rulesetV1_3, state, me.side, orders);
    if (errors.length > 0) throw new ServiceError(422, errors.join('; '));

    await this.repo.setOrders(gameId, turnRow.turn, me.side, orders);

    const updated = await this.repo.getTurn(gameId, turnRow.turn);
    if (!updated) throw new ServiceError(500, 'turn row missing after submit');

    if (updated.stateOrders && updated.terroristOrders) {
      const summary = resolveTurn(rulesetV1_3, state, updated.stateOrders, updated.terroristOrders);
      await this.repo.resolveTurnRow(gameId, turnRow.turn, summary, serializeState(summary.state), new Date());
      if (summary.state.status === 'finished') {
        await this.repo.setGameStatus(gameId, 'finished', summary.state.result, new Date());
        this.hub.broadcast(gameId, { type: 'game-over', result: summary.state.result! });
      } else {
        await this.repo.createTurn(gameId, summary.state.turn, serializeState(summary.state));
        this.hub.broadcast(gameId, { type: 'reveal', turn: turnRow.turn, summary, state: summary.state });
      }
    } else {
      // Only notify that a side locked in — never the content.
      this.hub.broadcast(gameId, { type: 'orders-submitted', side: me.side, turn: turnRow.turn });
    }
    this.pushGameToPlayers(gameId);
    return this.getGameView(user.id, gameId);
  }

  // --- views ---

  async getGameView(viewerUserId: string | null, gameId: string): Promise<GameView> {
    const game = await this.repo.findGameById(gameId);
    if (!game) throw new ServiceError(404, 'unknown game');
    const players = await this.repo.getGamePlayers(gameId);
    const turns = await this.repo.getTurns(gameId);
    const current = turns[turns.length - 1] ?? null;

    const history: ResolvedTurn[] = [];
    for (const row of turns) {
      if (!row.resolvedAt || !row.summary || !row.stateOrders || !row.terroristOrders) continue;
      history.push({
        turn: row.turn,
        orders: { state: row.stateOrders, terrorist: row.terroristOrders },
        summary: row.summary,
        stateAfter: deserializeState(row.stateAfter),
      });
    }

    const me: GamePlayerRow | undefined = players.find((p) => p.userId === viewerUserId);
    const opponent: GamePlayerRow | undefined = me
      ? players.find((p) => p.userId !== viewerUserId)
      : undefined;

    let you: GameView['you'] = null;
    if (me) {
      let submitted = false;
      let myOrders: Orders | null = null;
      if (game.status === 'active' && current && !current.resolvedAt) {
        myOrders = me.side === 'state' ? current.stateOrders : current.terroristOrders;
        submitted = myOrders !== null;
      }
      you = { userId: me.userId, side: me.side, submitted, orders: myOrders };
    }

    const pendingOpponentOrders =
      game.status === 'active' && current && !current.resolvedAt
        ? opponent
          ? me?.side === 'state'
            ? current.terroristOrders
            : current.stateOrders
          : null
        : null;

    return {
      id: game.id,
      rulesetVersion: game.rulesetVersion,
      status: game.status,
      inviteCode: me && game.status === 'open' ? game.inviteCode : null,
      result: game.result,
      turn: current?.turn ?? 0,
      players: players.map((p) => ({ userId: p.userId, displayName: p.displayName, side: p.side })),
      you,
      opponent: opponent
        ? {
            userId: opponent.userId,
            displayName: opponent.displayName,
            side: opponent.side,
            connected: this.hub.isConnected(gameId, opponent.userId),
            submitted: pendingOpponentOrders !== null,
          }
        : null,
      // The position only changes at resolution, so the current snapshot is public;
      // pending orders are the only hidden data and they never leave this function.
      state: current && game.status !== 'open' ? deserializeState(current.stateAfter) : null,
      history,
    };
  }

  async getHistory(gameId: string): Promise<ResolvedTurn[]> {
    const game = await this.repo.findGameById(gameId);
    if (!game) throw new ServiceError(404, 'unknown game');
    const turns = await this.repo.getTurns(gameId);
    return turns
      .filter((row) => row.resolvedAt && row.summary && row.stateOrders && row.terroristOrders)
      .map((row) => ({
        turn: row.turn,
        orders: { state: row.stateOrders!, terrorist: row.terroristOrders! },
        summary: row.summary!,
        stateAfter: deserializeState(row.stateAfter),
      }));
  }

  // --- observer access (M3 / A-19) ---

  /** Player-only: creates the observer token once, then returns it unchanged. */
  async getOrCreateObserverToken(user: UserRow, gameId: string): Promise<string> {
    const game = await this.repo.findGameById(gameId);
    if (!game) throw new ServiceError(404, 'unknown game');
    const players = await this.repo.getGamePlayers(gameId);
    if (!players.some((p) => p.userId === user.id)) {
      throw new ServiceError(403, 'only a player can create an observer link');
    }
    if (game.observerToken) return game.observerToken;
    const token = generateInviteCode();
    await this.repo.setObserverToken(gameId, token);
    return token;
  }

  /** Resolves an observer token to the PUBLIC game view — never any pending orders. */
  async getObserverView(token: string): Promise<GameView> {
    const game = await this.repo.findGameByObserverToken(token);
    if (!game) throw new ServiceError(404, 'unknown observer token');
    return this.getGameView(null, game.id);
  }

  /** Validates an observer token and returns its game id, or null. */
  async resolveObserverToken(token: string): Promise<string | null> {
    const game = await this.repo.findGameByObserverToken(token);
    return game ? game.id : null;
  }

  /** Sends each player their own view (own pending orders differ per player). */
  private async pushGameToPlayers(gameId: string): Promise<void> {
    for (const player of await this.repo.getGamePlayers(gameId)) {
      const view = await this.getGameView(player.userId, gameId);
      this.hub.send(gameId, player.userId, { type: 'game', game: view });
    }
    // Observers receive the public view: same data as the observe endpoint.
    const publicView = await this.getGameView(null, gameId);
    this.hub.sendPublic(gameId, { type: 'game', game: publicView });
  }
}
