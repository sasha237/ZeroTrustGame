# Zero Trust («Нулевое доверие»)

Двухпользовательская пошаговая стратегия с одновременным вскрытием приказов: **Мегакорпорация** против **Хакерского коллектив**.

![Zero Trust](docs/screenshot.png)

## Суть игры

- У каждой стороны — два показателя опасности и экономика «бюджет + резерв»: у Корпорации **Стабильность бизнеса** и **Доверие публики**, у Коллектива — **Анонимность** и **Размер сообщества**.
- Каждый ход обе стороны тайно выбирают до 3 изменений уровней политик (19 политик на сторону); приказы вскрываются одновременно, эффекты и содержание применяются **в конце того же хода**.
- Проигрыш: показатель в критической зоне (≤10 два хода подряд или ≤30 четыре хода подряд) либо банкротство (расходы превысили бюджет + резерв).
- Лимит 50 ходов: ничья разрешается судейски — по сумме собственных показателей опасности.
- Баланс правил (v1.3.0) измерен автосимуляцией на 16 000 партиях: **50/50** побед в решённых партиях (отчёт: `packages/sim/sim-report-v13.md`).

## Режимы

- **Hot-seat** — одно устройство на двоих, без сервера.
- **Online** — аккаунты по email, игра по 8-символьному инвайт-коду, WebSocket-рассылка вскрытий.
- **Наблюдатель** — shareable-ссылка без аккаунта (`#/observe/<token>`).
- **Повтор** — интерактивная перемотка ходов.
- **CSV-экспорт** — дебрифинг партии для Excel/Sheets.

## Технологии

| Слой | Стек |
|---|---|
| Монорепозиторий | npm workspaces, TypeScript strict (ESM/NodeNext) |
| Движок правил (`packages/engine`) | чистый TS, без зависимостей и I/O — детерминированные resolve/validate/preview/replay |
| Клиент (`packages/client`) | React 18 + Vite, SVG-граф, i18n EN/RU, неоновая киберпанк-тема |
| Сервер (`packages/server`) | Fastify 5, WebSocket, CORS, rate-limit, helmet, scrypt-аутентификация, PostgreSQL 16 |
| Симуляция (`packages/sim`) | сидируемые бот-партии с инвариантными проверками (баланс-инструмент) |
| Тесты | Vitest (131 тест), Playwright (e2e, установленный Chrome) |
| Деплой | Docker Compose (сервер + Postgres, healthcheck'и, не-root контейнер) |

## Структура репозитория

```
├── packages/
│   ├── engine/      # правила v1.2.0 (заморожены) + v1.3.0 (боевые), 39 тестов
│   ├── client/      # React+Vite UI: hot-seat, online, observer, replay, i18n
│   ├── server/      # Fastify API + WS, миграции, Dockerfile, 52 теста
│   └── sim/         # headless-балансировка, 12 тестов
├── e2e/             # Playwright-спеки (не входят в npm test)
├── docs/            # deploy.md, a11y.md, lighthouse.md
├── tools/           # скрипты: симуляция баланса, PG-smoke, lighthouse, проверки UI
├── docker-compose.yml
└── package.json     # рабочие скрипты (см. ниже)
```

## Требования

- **Node.js 20+** и **npm 10+** (движок использует `structuredClone` — минимум Node 17).
- Для e2e — установленный Chrome (Playwright подключается через `channel: 'chrome'`, браузер не скачивается).
- Для продакшн-деплоя — Docker с Compose plugin.
- **Windows:** npm-скрипты проекта рассчитаны на bash. Если `npm install` падает с ошибкой о `script-shell`, выполните:
  ```bash
  npm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"
  ```

## Быстрый старт (разработка)

```bash
npm install          # ставит зависимости всех workspace-пакетов
npm run dev          # клиент (Vite) на http://localhost:5173 — hot-seat работает сразу
npm run dev:server   # сервер на :8080 (in-memory repo, без Postgres)
```

Для online-режима запустите оба процесса; Vite проксирует `/api` и `/ws` на `:8080`.

## Сборка и запуск в продакшне

```bash
npm run build        # engine → server → client → sim (порядок важен)
```

Дальше два пути:

**Вариант A — Docker Compose (рекомендуется).** Сервер собирается из `packages/server/Dockerfile` (не-root пользователь `node`), поднимается вместе с Postgres 16; миграции (`packages/server/migrations/`) применяются автоматически при старте, у обоих контейнеров healthcheck'и:

```bash
docker compose up --build
# API: http://localhost:8080/healthz
```

Клиентская статика (`packages/client/dist`) отдаётся отдельно — см. `docs/deploy.md` (reverse proxy: `/api` и `/ws` → сервер, всё остальное → статика; TLS на прокси).

**Вариант B — без Docker.** Нужен Postgres 16 (или `REPO=memory` для проверки):

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/zerotrust npm start
node tools/serve-static.mjs   # отдаёт packages/client/dist на :8090
```

## Переменные окружения сервера

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `8080` | порт HTTP/WS |
| `DATABASE_URL` | — | если задана — Postgres-репозиторий + миграции при старте; иначе in-memory |
| `REPO` | авто (`pg` при заданной `DATABASE_URL`) | принудительный выбор репозитория: `memory` / `pg` |
| `CORS_ORIGIN` | `http://localhost:5173, http://localhost:4173` | разрешённые origin (REST CORS + проверка WS Origin), через запятую |
| `TOKEN_TTL_HOURS` | `720` (30 дней) | срок жизни сессионного токена |
| `LOG_REQUESTS` | выкл. | `1` — логировать запросы |
| `TRUST_PROXY` | выкл. | `true`/`1` — доверять заголовкам прокси (Rate limit / IP за TLS-терминирующим прокси) |
| `CLIENT_URL` | `http://localhost:5173` | база для ссылок сброса пароля |
| `EMAIL_API_URL`, `EMAIL_API_KEY` | — | HTTP-провайдер писем (SendGrid-стиль). Без них — log-only режим |
| `EMAIL_FROM` | `no-reply@balanceofterror.local` | отправитель писем |

Конфигурация валидируется при старте: ошибка — fail-fast с понятным сообщением.

## Тестирование и проверки

```bash
npm test             # 131 тест: engine 39 + client 25 + server 52 + sim 12
npm run typecheck    # strict tsc по всем пакетам
npm run test:e2e     # Playwright (нужен Chrome и запущенные dev/статик-серверы)
npm run sim -- -n 10000 --seed 42 --out sim-report.md   # баланс-симуляция
npm run lh           # Lighthouse (переопределяет TMP из-за EPERM на Windows)
```

## Деплой

Архитектура, TLS, reverse proxy и эксплуатация — в [`docs/deploy.md`](docs/deploy.md). Кратко: TLS терминирует reverse proxy (nginx/traefik), прокси маршрутизирует `/api/*` и `/ws` в контейнер сервера, статику — в CDN/статик-сервер; `TRUST_PROXY=true` при такой схеме; Postgres — managed или compose-volume с бэкапами.

## Лицензия

MIT
