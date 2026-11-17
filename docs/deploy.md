# Deploying Balance of Terror (M4)

Generic deployment notes — no cloud-specific manifests (owner decision). The stack is:

```
browser (React client) ──► reverse proxy (TLS termination) ──► @bot/server (Fastify+WS) ──► Postgres 16
```

## 1. Components

| Component | Where it runs | Notes |
|---|---|---|
| Client (`packages/client`) | Any static host OR behind the same proxy | `vite build` output is static files; it talks to the server same-origin (`/auth`, `/games`, `/ws`) — serve both from one origin or set `VITE_WS_URL`. |
| Server (`packages/server`) | Node 20+ (developed on 25), containerized via `packages/server/Dockerfile` | Stateless except Postgres; safe to run 1+ replicas only behind sticky sessions for WS (single replica recommended at this scale). |
| Postgres 16 | Managed or `postgres:16-alpine` | Migrations run automatically at boot (`migrations/0001`–`0003`). |

`docker compose up` at the repo root runs server + Postgres with healthchecks
(`wget` on `/healthz`, `pg_isready`) and a named volume `pgdata`.

## 2. Environment variables

| Var | Required | Default | Meaning |
|---|---|---|---|
| `PORT` | no | `8080` | Listen port (1–65535; validated at boot). |
| `DATABASE_URL` | for `REPO=pg` | — | `postgres://user:pass@host:5432/db`. Boot fails fast with a clear FATAL if unreachable. |
| `REPO` | no | auto | `pg` forces Postgres (requires `DATABASE_URL`); `memory` forces the in-memory repo (dev only — data is lost on restart). Auto: pg when `DATABASE_URL` is set, else memory. |
| `CORS_ORIGIN` | no | `http://localhost:5173,http://localhost:4173` | Comma-separated browser origins allowed for REST CORS **and** the WS origin check. Set to your client origin(s) in production. |
| `TOKEN_TTL_HOURS` | no | `720` | Session lifetime. |
| `TRUST_PROXY` | no | off | `true` when behind a reverse proxy: Fastify honours `X-Forwarded-For` so rate limits and logs see real client IPs. Only enable when the proxy strips client-supplied forwarded headers. |
| `EMAIL_API_URL` / `EMAIL_API_KEY` | no | — | SendGrid-compatible email API (A-23). When unset, email is **log-only** (password-reset links appear in the server log — fine for local dev, not for production). |
| `EMAIL_FROM` | no | `no-reply@balanceofterror.local` | From address for outbound email. |
| `CLIENT_URL` | no | `http://localhost:5173` | Base URL baked into password-reset links (`<CLIENT_URL>/#/reset/<token>`). |
| `LOG_REQUESTS` | no | off | Per-request logging. |

## 3. TLS

Terminate TLS at a reverse proxy (Caddy, nginx, Traefik, or a cloud load balancer) and
proxy plain HTTP to the server on `PORT`. Recommendations:

- **Caddy** (automatic HTTPS): `reverse_proxy localhost:8080` — Caddy handles
  `X-Forwarded-For`; set `TRUST_PROXY=true`.
- **nginx**: `proxy_pass http://localhost:8080;` with `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` for the `/ws` WebSocket route.
- Never expose the server directly on a public interface without the proxy; the WS
  origin check and CORS allow-list assume a fixed set of client origins.

## 4. Security posture (A-25)

- `@fastify/helmet` security headers on every response. The CSP allows `style-src
  'unsafe-inline'` because the Vite dev server injects inline styles and the client
  uses inline SVG styling; `script-src` stays `'self'`. When serving only the **built**
  client you can tighten this to nonced styles — the tradeoff is dev-server convenience
  vs. XSS surface; revisit before public launch.
- JSON body limit 16 kb; rate limits: `/auth/*` 20/min, forgot/reset 5/min, global 1000/min per IP.
- Passwords: scrypt (N=16384). Sessions + reset tokens: opaque, SHA-256 hashed at rest.
- Boot env validation (`validateConfig`) fails fast listing every offending variable.
- Container runs as the unprivileged `node` user.

## 5. Migrations & backups

- Migrations apply in filename order inside a transaction at boot; `schema_migrations`
  tracks applied versions. Zero-downtime expectations: M4 schema changes are additive
  (new nullable column, new table) — safe to run one server version while another boots.
- Back up Postgres with your platform's snapshot tooling (or `pg_dump` cron); the only
  state that matters lives there (users, sessions, games, turns).

## 6. Health checks

- `GET /healthz` → `200 {ok:true}` when the repo is reachable, `503 {ok:false}` when the
  DB check fails (memory repo always reports ok). Used by the compose healthcheck and
  suitable for proxy health checks.
- Graceful shutdown: SIGTERM/SIGINT stop accepting, close WS clients, drain Fastify,
  end the pg pool, exit 0.

## 7. Balance analysis

`npm run sim -- -n 10000 --seed 42 --out sim-report.md` (`packages/sim`) runs 10k
headless bot games with per-turn invariant assertions and writes a distribution report
(win rates, end reasons, length histogram, degenerate-pattern flags). Use it after any
ruleset change decision; the ruleset itself is frozen — the sim reports, it does not tune.
