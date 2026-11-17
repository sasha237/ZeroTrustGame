import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Orders, PolicyChange } from '@bot/engine';
import { GameService, ServiceError, isSide } from '../game.service.js';
import { authUser } from './routes.auth.js';
import type { Repository } from '../repo.js';
import { toCsv } from '../csv.js';

/** Hand-written body guard — no `any` leaks past this point. */
export function parseOrders(body: unknown): Orders {
  if (typeof body !== 'object' || body === null) throw new ServiceError(400, 'body must be a JSON object');
  const { changes, agreeToDraw } = body as Record<string, unknown>;
  if (!Array.isArray(changes)) throw new ServiceError(400, 'changes must be an array');
  const parsed: PolicyChange[] = [];
  for (const item of changes) {
    if (typeof item !== 'object' || item === null) throw new ServiceError(400, 'each change must be an object');
    const { policy, delta } = item as Record<string, unknown>;
    if (typeof policy !== 'string' || policy.length === 0 || policy.length > 64) {
      throw new ServiceError(400, 'change.policy must be a non-empty string');
    }
    if (delta !== 1 && delta !== -1) throw new ServiceError(400, 'change.delta must be 1 or -1');
    parsed.push({ policy, delta });
  }
  if (agreeToDraw !== undefined && typeof agreeToDraw !== 'boolean') {
    throw new ServiceError(400, 'agreeToDraw must be a boolean');
  }
  return { changes: parsed, ...(agreeToDraw ? { agreeToDraw: true } : {}) };
}

/** Bearer auth that returns null instead of throwing (for optional-auth endpoints). */
async function optionalAuth(req: FastifyRequest, repo: Repository) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return await authUser(req, repo);
  } catch {
    return null;
  }
}

function queryParam(req: FastifyRequest, name: string): string | null {
  const value = (req.query as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function registerGameRoutes(app: FastifyInstance, repo: Repository, service: GameService): void {
  app.post('/games', async (req, reply) => {
    const user = await authUser(req, repo);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isSide(body.side)) throw new ServiceError(400, "side must be 'state' or 'terrorist'");
    const game = await service.createGame(user, body.side);
    return reply.status(201).send({ game });
  });

  app.post('/games/join', async (req, reply) => {
    const user = await authUser(req, repo);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.code !== 'string' || body.code.trim().length === 0) {
      throw new ServiceError(400, 'code is required');
    }
    const game = await service.joinGame(user, body.code);
    return reply.send({ game });
  });

  app.get('/games/:id', async (req) => {
    const user = await authUser(req, repo);
    const { id } = req.params as { id: string };
    const game = await service.getGameView(user.id, id);
    return { game };
  });

  app.post('/games/:id/orders', async (req, reply) => {
    const user = await authUser(req, repo);
    const { id } = req.params as { id: string };
    const orders = parseOrders(req.body);
    const game = await service.submitOrders(user, id, orders);
    return reply.send({ game });
  });

  app.post('/games/:id/observer-link', async (req) => {
    const user = await authUser(req, repo);
    const { id } = req.params as { id: string };
    const token = await service.getOrCreateObserverToken(user, id);
    return { token };
  });

  app.get('/games/:id/history', async (req) => {
    const { id } = req.params as { id: string };
    const user = await optionalAuth(req, repo);
    if (!user) {
      // No login: observer token grants access to resolved (public post-reveal) turns.
      const token = queryParam(req, 'token');
      const gameId = token ? await service.resolveObserverToken(token) : null;
      if (!gameId || gameId !== id) throw new ServiceError(401, 'authentication required');
      return { turns: await service.getHistory(id) };
    }
    return { turns: await service.getHistory(id) };
  });

  app.get('/games/:id/export.csv', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await optionalAuth(req, repo);
    let allowed = false;
    if (user) {
      const players = await repo.getGamePlayers(id);
      allowed = players.some((p) => p.userId === user.id);
    }
    if (!allowed) {
      const token = queryParam(req, 'token');
      const gameId = token ? await service.resolveObserverToken(token) : null;
      allowed = gameId === id;
    }
    if (!allowed) throw new ServiceError(user ? 403 : 401, user ? 'only players can export this game' : 'authentication required');
    const turns = await service.getHistory(id);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="balance-of-terror-${id}.csv"`)
      .send(toCsv(turns));
  });

  // Observer access (A-19): token-authenticated, no account required.
  app.get('/observe/:token', async (req) => {
    const { token } = req.params as { token: string };
    const game = await service.getObserverView(token);
    return { game };
  });
}
