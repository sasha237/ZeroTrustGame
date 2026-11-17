import type { Repository } from './repo.js';
import type { GamePlayerRow, GameResult, GameRow, GameStatus, SessionRow, TurnRow, UserRow } from './types.js';
import type { Orders, Side } from '@bot/engine';
import type pg from 'pg';

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: Date;
}

interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
}

interface GameRecord {
  id: string;
  ruleset_version: string;
  status: GameStatus;
  invite_code: string;
  observer_token: string | null;
  created_by: string;
  result: GameResult | null;
  ended_at: Date | null;
  created_at: Date;
}

interface PlayerRecord {
  game_id: string;
  user_id: string;
  side: Side;
  display_name: string | null;
}

interface TurnRecord {
  game_id: string;
  turn: number;
  state_orders: Orders | null;
  terrorist_orders: Orders | null;
  summary: TurnRow['summary'];
  state_after: string;
  resolved_at: Date | null;
}

interface PasswordResetRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

function toUser(r: UserRecord): UserRow {
  return { id: r.id, email: r.email, passwordHash: r.password_hash, displayName: r.display_name, createdAt: r.created_at };
}
function toSession(r: SessionRecord): SessionRow {
  return { id: r.id, userId: r.user_id, tokenHash: r.token_hash, createdAt: r.created_at, expiresAt: r.expires_at };
}
function toGame(r: GameRecord): GameRow {
  return {
    id: r.id,
    rulesetVersion: r.ruleset_version,
    status: r.status,
    inviteCode: r.invite_code,
    observerToken: r.observer_token,
    createdBy: r.created_by,
    result: r.result,
    endedAt: r.ended_at,
    createdAt: r.created_at,
  };
}
function toPlayer(r: PlayerRecord): GamePlayerRow {
  return { gameId: r.game_id, userId: r.user_id, side: r.side, displayName: r.display_name };
}
function toTurn(r: TurnRecord): TurnRow {
  return {
    gameId: r.game_id,
    turn: r.turn,
    stateOrders: r.state_orders,
    terroristOrders: r.terrorist_orders,
    summary: r.summary,
    stateAfter: r.state_after,
    resolvedAt: r.resolved_at,
  };
}

export function createPgRepository(pool: pg.Pool): Repository {
  return {
    async createUser(email, passwordHash, displayName) {
      const { rows } = await pool.query<UserRecord>(
        'INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING *',
        [crypto.randomUUID(), email, passwordHash, displayName],
      );
      return toUser(rows[0]);
    },
    async findUserByEmail(email) {
      const { rows } = await pool.query<UserRecord>('SELECT * FROM users WHERE email = $1', [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findUserById(id) {
      const { rows } = await pool.query<UserRecord>('SELECT * FROM users WHERE id = $1', [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async createSession(userId, tokenHash, expiresAt) {
      const { rows } = await pool.query<SessionRecord>(
        'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [crypto.randomUUID(), userId, tokenHash, expiresAt],
      );
      return toSession(rows[0]);
    },
    async findActiveSessionByTokenHash(tokenHash, now) {
      const { rows } = await pool.query<SessionRecord>(
        'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2',
        [tokenHash, now],
      );
      return rows[0] ? toSession(rows[0]) : null;
    },
    async deleteSession(id) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
    },
    async deleteSessionsForUser(userId) {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    },
    async updateUserPassword(userId, passwordHash) {
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
    },

    async createPasswordReset(id, userId, tokenHash, expiresAt) {
      await pool.query(
        'INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
        [id, userId, tokenHash, expiresAt],
      );
    },
    async findPasswordResetByTokenHash(tokenHash) {
      const { rows } = await pool.query<PasswordResetRecord>(
        'SELECT * FROM password_resets WHERE token_hash = $1',
        [tokenHash],
      );
      return rows[0]
        ? {
            id: rows[0].id,
            userId: rows[0].user_id,
            tokenHash: rows[0].token_hash,
            createdAt: rows[0].created_at,
            expiresAt: rows[0].expires_at,
            usedAt: rows[0].used_at,
          }
        : null;
    },
    async markPasswordResetUsed(id, usedAt) {
      await pool.query('UPDATE password_resets SET used_at = $2 WHERE id = $1', [id, usedAt]);
    },

    async createGame(id, rulesetVersion, inviteCode, createdBy) {
      const { rows } = await pool.query<GameRecord>(
        "INSERT INTO games (id, ruleset_version, invite_code, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [id, rulesetVersion, inviteCode, createdBy],
      );
      return toGame(rows[0]);
    },
    async findGameById(id) {
      const { rows } = await pool.query<GameRecord>('SELECT * FROM games WHERE id = $1', [id]);
      return rows[0] ? toGame(rows[0]) : null;
    },
    async findGameByInviteCode(code) {
      const { rows } = await pool.query<GameRecord>('SELECT * FROM games WHERE invite_code = $1', [code]);
      return rows[0] ? toGame(rows[0]) : null;
    },
    async findGameByObserverToken(token) {
      const { rows } = await pool.query<GameRecord>('SELECT * FROM games WHERE observer_token = $1', [token]);
      return rows[0] ? toGame(rows[0]) : null;
    },
    async setObserverToken(id, token) {
      await pool.query('UPDATE games SET observer_token = $2 WHERE id = $1', [id, token]);
    },
    async setGameStatus(id, status, result, endedAt) {
      await pool.query('UPDATE games SET status = $2, result = $3, ended_at = $4 WHERE id = $1', [
        id,
        status,
        result ? JSON.stringify(result) : null,
        endedAt,
      ]);
    },

    async addGamePlayer(gameId, userId, side) {
      await pool.query('INSERT INTO game_players (game_id, user_id, side) VALUES ($1, $2, $3)', [gameId, userId, side]);
    },
    async getGamePlayers(gameId) {
      const { rows } = await pool.query<PlayerRecord>(
        `SELECT gp.game_id, gp.user_id, gp.side, u.display_name
         FROM game_players gp JOIN users u ON u.id = gp.user_id WHERE gp.game_id = $1`,
        [gameId],
      );
      return rows.map(toPlayer);
    },

    async createTurn(gameId, turn, stateAfter) {
      await pool.query(
        'INSERT INTO turns (game_id, turn, state_after) VALUES ($1, $2, $3)',
        [gameId, turn, stateAfter],
      );
    },
    async getCurrentTurn(gameId) {
      const { rows } = await pool.query<TurnRecord>(
        'SELECT * FROM turns WHERE game_id = $1 ORDER BY turn DESC LIMIT 1',
        [gameId],
      );
      return rows[0] ? toTurn(rows[0]) : null;
    },
    async getTurn(gameId, turn) {
      const { rows } = await pool.query<TurnRecord>(
        'SELECT * FROM turns WHERE game_id = $1 AND turn = $2',
        [gameId, turn],
      );
      return rows[0] ? toTurn(rows[0]) : null;
    },
    async setOrders(gameId, turn, side, orders) {
      const column = side === 'state' ? 'state_orders' : 'terrorist_orders';
      await pool.query(`UPDATE turns SET ${column} = $3 WHERE game_id = $1 AND turn = $2`, [
        gameId,
        turn,
        JSON.stringify(orders),
      ]);
    },
    async resolveTurnRow(gameId, turn, summary, stateAfter, resolvedAt) {
      await pool.query(
        'UPDATE turns SET summary = $3, state_after = $4, resolved_at = $5 WHERE game_id = $1 AND turn = $2',
        [gameId, turn, JSON.stringify(summary), stateAfter, resolvedAt],
      );
    },
    async getTurns(gameId) {
      const { rows } = await pool.query<TurnRecord>(
        'SELECT * FROM turns WHERE game_id = $1 ORDER BY turn ASC',
        [gameId],
      );
      return rows.map(toTurn);
    },
  };
}
