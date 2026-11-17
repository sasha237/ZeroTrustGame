# Lighthouse report

- Date: 2026-09-29
- Target: `http://localhost:4178/` (static build of `packages/client/dist`, hot-seat mode screen, headless Chrome at `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`)
- Command: `npm run lh`

| Category | Score |
|---|---|
| performance | 78 |
| accessibility | 90 |
| best-practices | 100 |
| seo | 91 |

## Notable audit details

- First Contentful Paint: n/a
- Largest Contentful Paint: 2.1 s
- Total Blocking Time: 0 ms
- Cumulative Layout Shift: 0

## Owed / caveats

- Scores are against a **local static preview over plain HTTP** — no TLS, no CDN,
  no compression beyond what the tiny static server does. Performance on a real
  deployment (see `docs/deploy.md`, TLS-terminating proxy + gzip/brotli) will differ.
- The audited page is the **mode screen**; in-game screens (SVG graph) are heavier
  and not represented here.
- axe/Lighthouse accessibility findings worth acting on should be copied into
  `docs/a11y.md`.
