// Neon design check: planning screen (both sides), help modal, mode screen.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'e2e/screenshots/neon-mode.png' });

await page.getByRole('button', { name: 'Hot-seat (one device)' }).click();
await page.waitForSelector('.pnode.state', { timeout: 5000 });
await page.screenshot({ path: 'e2e/screenshots/neon-planning-state.png' });

// Hover a node for the neon stepper/pnode glow.
await page.hover('.pnode.state.mine');
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/screenshots/neon-hover.png' });

// Terrorist side: submit empty and hand over to see the red cluster art.
await page.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
await page.getByRole('button', { name: /I am Collective/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: 'e2e/screenshots/neon-planning-terrorist.png' });

// Help modal.
await page.getByRole('button', { name: 'Help' }).click();
await page.waitForSelector('.modal .help-table', { timeout: 5000 });
await page.screenshot({ path: 'e2e/screenshots/neon-help.png' });
await browser.close();
