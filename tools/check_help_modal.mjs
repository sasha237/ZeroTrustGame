// One-off visual check of the effect tables in both popups:
//  - help modal (.help-table): two-level header, values only in cells, no h-scroll
//  - policy card (.policy-card table): same structure
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const hotSeat = page.getByRole('button', { name: /hot.?seat/i }).first();
if (await hotSeat.count()) await hotSeat.click();

function tableMetrics(tableSel) {
  return page.evaluate((sel) => {
    const table = document.querySelector(sel);
    if (!table) return null;
    const headerRows = table.querySelectorAll('thead tr');
    const valCells = Array.from(table.querySelectorAll('tbody td.val'));
    const badCells = valCells
      .map((td) => td.textContent.trim())
      .filter((txt) => txt !== '—' && !/^[▲▼]?\d+$/.test(txt) && !/^L\d+$/.test(txt));
    return {
      headerRowCount: headerRows.length,
      subHeaders: Array.from(headerRows[1]?.querySelectorAll('th') ?? []).map((th) => th.textContent.trim()),
      valueCellCount: valCells.length,
      badCells,
    };
  }, tableSel);
}

// 1. Help modal.
await page.getByRole('button', { name: /help|помощь|\?/i }).first().click();
await page.waitForSelector('.modal .help-table', { timeout: 5000 });
const help = await tableMetrics('.help-table');
const scroll = await page.evaluate(() => {
  const body = document.querySelector('.modal-body');
  return { hasHorizontalScroll: body.scrollWidth > body.clientWidth };
});
await page.screenshot({ path: 'e2e/screenshots/help-modal-check.png' });
console.log('help:', JSON.stringify({ ...help, ...scroll }));

// 2. Policy card: close modal, hover a state policy node.
await page.keyboard.press('Escape');
await page.waitForSelector('.pnode.state', { timeout: 5000 });
await page.hover('.pnode.state');
await page.waitForSelector('.policy-card table', { timeout: 5000 });
const card = await tableMetrics('.policy-card table');
const cardScroll = await page.evaluate(() => {
  const card = document.querySelector('.policy-card');
  return { hasHorizontalScroll: card.scrollWidth > card.clientWidth, width: card.clientWidth };
});
await page.screenshot({ path: 'e2e/screenshots/policy-card-check.png' });
console.log('card:', JSON.stringify({ ...card, ...cardScroll }));

await browser.close();
