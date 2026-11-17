// Cyberpunk reskin check: EN + RU titles, side names, indicators, policy card, help modal.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });

for (const lang of ['en', 'ru']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Hot-seat (one device)' }).click();
  if (lang === 'ru') await page.getByRole('button', { name: 'РУ' }).click();

  await page.hover('.pnode.terrorist');
  await page.waitForSelector('.policy-card', { timeout: 5000 });
  const card = await page.evaluate(() => ({
    title: document.querySelector('.policy-card h3')?.textContent.trim(),
    blurb: document.querySelector('.policy-card .blurb')?.textContent.trim(),
  }));
  const bubbles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bubble-label:not(.sub)')).map((b) => b.textContent.trim()),
  );
  console.log(lang, 'card:', JSON.stringify(card));
  console.log(lang, 'bubbles:', JSON.stringify(bubbles));
  await page.screenshot({ path: `e2e/screenshots/reskin-${lang}.png` });
  await page.keyboard.press('Escape');

  // Help modal.
  await page.getByRole('button', { name: lang === 'ru' ? 'Справка' : 'Help' }).first().click();
  await page.waitForSelector('.modal .help-table', { timeout: 5000 });
  const help = await page.evaluate(() => {
    const cell = document.querySelector('.help-table .policy-cell');
    const sub = Array.from(document.querySelectorAll('.help-table thead tr:nth-child(2) th')).map((th) => th.textContent.trim());
    return { title: cell?.querySelector('strong')?.textContent.trim(), sub };
  });
  console.log(lang, 'help:', JSON.stringify(help));
  await page.screenshot({ path: `e2e/screenshots/reskin-help-${lang}.png` });
  await page.close();
}
await browser.close();
