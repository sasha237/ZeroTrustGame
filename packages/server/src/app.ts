import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import type { Config } from './config.js';
import type { Repository } from './repo.js';
import { authenticateBearer, hashToken } from './auth.js';
import { GameService, ServiceError } from './game.service.js';
import { WsHub } from './ws.js';
import { registerAuthRoutes } from './routes/routes.auth.js';
import { registerGameRoutes } from './routes/routes.games.js';
import { createEmailProvider } from './email.js';

export interface BuiltApp {
  app: FastifyInstance;
  service: GameService;
  hub: WsHub;
}

export interface BuildAppOptions {
  /** A-25 healthz: return false when a backing service is unreachable. */
  healthCheck?: () => Promise<boolean>;
}

export async function buildApp(repo: Repository, config: Config, options: BuildAppOptions = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger: config.logRequests ? undefined : { level: 'error' },
    bodyLimit: 16 * 1024, // A-25: keep JSON bodies small
    trustProxy: config.trustProxy, // A-25: correct client IPs behind a TLS-terminating proxy
  });
  const hub = new WsHub();
  const service = new GameService(repo, hub);
  const email = createEmailProvider(
    { apiUrl: config.emailApiUrl, apiKey: config.emailApiKey, from: config.emailFrom },
    (msg, meta) => app.log.info(meta ?? {}, msg),
  );

  await app.register(cors, { origin: config.corsOrigins });
  // A-25: security headers. CSP allows inline styles because the Vite dev server injects
  // them and the client uses inline SVG styles; everything else stays self/none.
  // Tradeoff documented in docs/deploy.md — tighten (nonces) if serving a built client.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await app.register(websocket);

  // A-25: liveness + readiness for reverse proxies and `docker compose` healthchecks.
  app.get('/healthz', async (_req, reply) => {
    const upstreamOk = options.healthCheck ? await options.healthCheck() : true;
    return reply.status(upstreamOk ? 200 : 503).send({ ok: upstreamOk });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ServiceError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status === 429) {
      return reply.status(429).send({ error: 'too many requests, slow down' });
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.status(status).send({ error: 'invalid request' });
    }
    req.log.error(err);
    return reply.status(500).send({ error: 'internal server error' });
  });

  registerAuthRoutes(app, repo, config.tokenTtlHours, email, config.clientUrl);
  registerGameRoutes(app, repo, service);

  // Presence messages carry the side; the hub needs userId -> side translation.
  hub.onPresence = (gameId, userId, connected) => {
    void repo.getGamePlayers(gameId).then((players) => {
      const player = players.find((p) => p.userId === userId);
      if (player) hub.broadcast(gameId, { type: 'presence', side: player.side, connected });
    });
  };

  app.get('/ws/:gameId', { websocket: true }, (socket: WebSocket, req) => {
    void handleSocket(socket, req).catch((err) => {
      req.log.error(err);
      try {
        socket.close(1011, 'internal error');
      } catch {
        /* ignore */
      }
    });
  });

  // Observer sockets (A-19): /ws?observe=<token> — no account required.
  app.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
    void handleObserverSocket(socket, req).catch((err) => {
      req.log.error(err);
      try {
        socket.close(1011, 'internal error');
      } catch {
        /* ignore */
      }
    });
  });

  type WsReq = { params: unknown; query: unknown; headers: unknown };

  function checkOrigin(socket: WebSocket, req: WsReq): boolean {
    const origin = (req.headers as Record<string, unknown>)['origin'];
    if (typeof origin === 'string' && !config.corsOrigins.includes(origin)) {
      socket.close(4403, 'origin not allowed');
      return false;
    }
    return true;
  }

  async function handleObserverSocket(socket: WebSocket, req: WsReq): Promise<void> {
    if (!checkOrigin(socket, req)) return;
    const observe = (req.query as Record<string, unknown>).observe;
    const token = typeof observe === 'string' ? observe : '';
    if (!token) {
      socket.close(4401, 'missing observer token');
      return;
    }
    const gameId = await service.resolveObserverToken(token);
    if (!gameId) {
      socket.close(4404, 'unknown observer token');
      return;
    }
    hub.addObserver(gameId, socket);
    // Hello: public view immediately (reconnect-safe). No pending orders, ever.
    const view = await service.getGameView(null, gameId);
    socket.send(JSON.stringify({ type: 'game', game: view }));
  }

  async function handleSocket(socket: WebSocket, req: WsReq): Promise<void> {
    if (!checkOrigin(socket, req)) return;
    const { gameId } = req.params as { gameId: string };
    const token = typeof (req.query as Record<string, unknown>).token === 'string'
      ? ((req.query as Record<string, unknown>).token as string)
      : '';
    if (!token) {
      socket.close(4401, 'missing token');
      return;
    }
    const ctx = await authenticateBearer(repo, token);
    if (!ctx) {
      socket.close(4401, 'invalid token');
      return;
    }
    const game = await repo.findGameById(gameId);
    if (!game) {
      socket.close(4404, 'unknown game');
      return;
    }
    const players = await repo.getGamePlayers(gameId);
    if (!players.some((p) => p.userId === ctx.user.id)) {
      socket.close(4403, 'not a player');
      return;
    }
    hub.add(gameId, ctx.user.id, socket);
    // Hello: full state recovery immediately on connect (reconnect-safe).
    const view = await service.getGameView(ctx.user.id, gameId);
    socket.send(JSON.stringify({ type: 'game', game: view }));
  }

  return { app, service, hub };
}
