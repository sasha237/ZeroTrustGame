// Runs Lighthouse (headless, installed Chrome) against the hot-seat client and writes
// docs/lighthouse.md. Usage: npm run lh
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const safeTmp = path.join(ROOT, '.lh-tmp');

// chrome-launcher gets EPERM under the Cyrillic user-profile temp dirs on this box
// (codepage-garbled paths); point TMP/TEMP at a project-local ASCII dir instead.
if (process.platform === 'win32') {
  try {
    mkdirSync(safeTmp, { recursive: true });
    process.env.TMP = process.env.TEMP = safeTmp;
  } catch {
    /* keep system default */
  }
}

const require = createRequire(import.meta.url);
// lighthouse v12 is ESM-only; require() returns the module namespace — unwrap .default.
const lighthouseModule = require('lighthouse');
const lighthouse = lighthouseModule.default ?? lighthouseModule;
const chromeLauncher = require('chrome-launcher');

const CHROME_PATH = process.env.CHROME_PATH ?? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 4178;
const URL_UNDER_TEST = `http://localhost:${PORT}/`;

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), String(PORT)], {
    stdio: 'pipe',
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('static server did not start')), 10_000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('serving')) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    server.on('error', reject);
  });

  const chrome = await chromeLauncher.launch({
    chromePath: CHROME_PATH,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const result = await lighthouse(URL_UNDER_TEST, {
      port: chrome.port,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      quiet: true,
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
    });

    const scores = Object.fromEntries(
      Object.entries(result.lhr.categories).map(([key, cat]) => [key, Math.round(cat.score * 100)]),
    );
    console.log('Lighthouse scores:', scores);

    const audits = result.lhr.audits;
    const lines = [
      '# Lighthouse report',
      '',
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Target: \`${URL_UNDER_TEST}\` (static build of \`packages/client/dist\`, hot-seat mode screen, headless Chrome at \`${CHROME_PATH}\`)`,
      `- Command: \`npm run lh\``,
      '',
      '| Category | Score |',
      '|---|---|',
      ...Object.entries(scores).map(([k, v]) => `| ${k} | ${v} |`),
      '',
      '## Notable audit details',
      '',
      `- First Contentful Paint: ${audits['first-content-paint']?.displayValue ?? 'n/a'}`,
      `- Largest Contentful Paint: ${audits['largest-contentful-paint']?.displayValue ?? 'n/a'}`,
      `- Total Blocking Time: ${audits['total-blocking-time']?.displayValue ?? 'n/a'}`,
      `- Cumulative Layout Shift: ${audits['cumulative-layout-shift']?.displayValue ?? 'n/a'}`,
      '',
      '## Owed / caveats',
      '',
      '- Scores are against a **local static preview over plain HTTP** — no TLS, no CDN,',
      '  no compression beyond what the tiny static server does. Performance on a real',
      '  deployment (see `docs/deploy.md`, TLS-terminating proxy + gzip/brotli) will differ.',
      '- The audited page is the **mode screen**; in-game screens (SVG graph) are heavier',
      '  and not represented here.',
      '- axe/Lighthouse accessibility findings worth acting on should be copied into',
      '  `docs/a11y.md`.',
      '',
    ];
    await writeFile(path.join(ROOT, 'docs/lighthouse.md'), lines.join('\n'), 'utf8');
    console.log('docs/lighthouse.md written');
  } finally {
    // Windows keeps Chrome profile files locked briefly after taskkill; kill() itself
    // can throw EPERM while removing its temp dir, which must not mask the audit result.
    try {
      await chrome.kill();
    } catch (cleanupErr) {
      console.warn('chrome kill cleanup:', cleanupErr?.message ?? cleanupErr);
    }
    for (let i = 0; i < 10; i++) {
      let left = [];
      try {
        left = (await readdir(safeTmp)).filter((d) => d.startsWith('lighthouse.'));
      } catch { /* dir gone */ }
      if (left.length === 0) break;
      for (const d of left) {
        try {
          await rm(path.join(safeTmp, d), { recursive: true, force: true, maxRetries: 3 });
        } catch { /* still locked; retry after delay */ }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    server.kill();
  }
}

main().catch((err) => {
  console.error('FATAL:', err?.stack ?? err);
  process.exit(1);
});
