// Verify the layout fixes: bubble swap, danger 2x2 alignment, sparkline alignment.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Hot-seat (one device)' }).click();

// Play two turns so history sparklines have several points.
async function playTurn() {
  await page.getByRole('button', { name: 'Increase level' }).first().click();
  await page.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
  await page.getByRole('button', { name: /I am Terrorist/ }).click();
  await page.getByRole('button', { name: 'Increase level' }).first().click();
  await page.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
  await page.getByRole('button', { name: 'Resolve the turn' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}
await playTurn();
await playTurn();
await playTurn();

const report = await page.evaluate(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
  };
  const out = {};

  // 2. Bubbles: legitimacy under stability (left column), security above mobilization (right column).
  const bubbles = {};
  for (const g of document.querySelectorAll('.bubble')) {
    const label = g.querySelector('.bubble-label').textContent.trim();
    const r = rect(g.querySelector('circle'));
    bubbles[label] = r;
  }
  out.bubbles = bubbles;

  // 3. Danger gauges: stability top == security top; legitimacy top == mobilization top.
  const gauges = Array.from(document.querySelectorAll('.gauge')).map((g) => ({
    label: g.querySelector('.gauge-label').textContent.trim(),
    ...rect(g),
  }));
  out.gauges = gauges;

  // 4. Sparklines: same left/right edges, fully inside the rail.
  const rail = document.querySelector('.rail-section');
  const railRect = rect(rail);
  const sparks = Array.from(document.querySelectorAll('.sparkline')).map((s) => rect(s));
  out.spark = {
    rail: railRect,
    lefts: sparks.map((s) => s.left),
    rights: sparks.map((s) => s.right),
    allSameLeft: sparks.every((s) => Math.abs(s.left - sparks[0].left) < 0.5),
    allSameRight: sparks.every((s) => Math.abs(s.right - sparks[0].right) < 0.5),
    insideRail: sparks.every((s) => s.left >= railRect.left - 0.5 && s.right <= railRect.right + 0.5),
  };
  return out;
});
console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: 'e2e/screenshots/layout-check.png' });
await browser.close();
