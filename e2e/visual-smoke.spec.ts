import { expect, test } from '@playwright/test';

const runId = Date.now();
const PASSWORD = 'e2e-password-123';

/**
 * Visual smoke (artifacts only — NO pixel-diff assertions; those are future work).
 * Screenshots land in e2e/screenshots/ and are gitignored.
 */
test.describe('visual smoke', () => {
  test('key screens across modes and locales', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Mode screen + hot-seat planning (EN).
    await page.goto('/');
    await page.screenshot({ path: 'e2e/screenshots/vs-01-mode.png', fullPage: true });
    await page.getByRole('button', { name: 'Hot-seat (one device)' }).click();
    await expect(page.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/vs-02-hotseat-planning.png', fullPage: true });

    // Help modal.
    await page.getByRole('button', { name: 'Help' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/vs-03-help-modal.png', fullPage: true });
    await page.keyboard.press('Escape');

    // RU locale.
    await page.getByRole('button', { name: 'РУ' }).click();
    await expect(page.getByRole('button', { name: 'ОТДАТЬ ПРИКАЗЫ' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/vs-04-planning-ru.png', fullPage: true });
    await ctx.close();

    // Online: planning screen (A side) + observer view.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await pageA.goto('/');
    await pageA.getByRole('button', { name: 'Online (two devices)' }).click();
    await pageA.getByRole('button', { name: 'No account yet? Create one' }).click();
    await pageA.getByLabel('Email').fill(`vis-a-${runId}@e2e.test`);
    await pageA.getByLabel('Password').fill(PASSWORD);
    await pageA.getByRole('button', { name: 'Create account' }).click();
    await expect(pageA.getByText('Signed in as')).toBeVisible();
    await pageA.locator('.side-option.terrorist').click();
    await pageA.getByRole('button', { name: 'Create game', exact: true }).click();
    const code = (await pageA.locator('.invite-code').innerText()).trim();

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto('/');
    await pageB.getByRole('button', { name: 'Online (two devices)' }).click();
    await pageB.getByRole('button', { name: 'No account yet? Create one' }).click();
    await pageB.getByLabel('Email').fill(`vis-b-${runId}@e2e.test`);
    await pageB.getByLabel('Password').fill(PASSWORD);
    await pageB.getByRole('button', { name: 'Create account' }).click();
    await pageB.getByPlaceholder('8-character code').fill(code);
    await pageB.getByRole('button', { name: 'Join game' }).click();
    await expect(pageB.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();
    await expect(pageA.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible({ timeout: 20_000 });
    await pageA.screenshot({ path: 'e2e/screenshots/vs-05-online-planning.png', fullPage: true });

    // Resolve turn 1, then observer view (read-only + replay scrubber).
    await pageA.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
    await pageB.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
    await expect(pageA.getByRole('heading', { name: 'Orders revealed' })).toBeVisible();

    const [obsResp] = await Promise.all([
      pageA.waitForResponse((r) => r.url().includes('/observer-link') && r.request().method() === 'POST'),
      pageA.getByRole('button', { name: 'Copy observer link' }).click(),
    ]);
    const { token } = (await obsResp.json()) as { token: string };
    const link = `http://localhost:4173/#/observe/${token}`;

    const ctxObs = await browser.newContext();
    const pageObs = await ctxObs.newPage();
    await pageObs.goto(link);
    await expect(pageObs.getByText('OBSERVING', { exact: true })).toBeVisible();
    await expect(pageObs.getByText('Turn 1 of 1')).toBeVisible();
    await pageObs.screenshot({ path: 'e2e/screenshots/vs-06-observer.png', fullPage: true });

    await ctxA.close();
    await ctxB.close();
    await ctxObs.close();
  });
});
