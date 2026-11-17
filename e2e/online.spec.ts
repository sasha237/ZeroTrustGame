import { expect, test } from '@playwright/test';

const runId = Date.now();
const EMAIL_A = `alice-${runId}@e2e.test`;
const EMAIL_B = `bob-${runId}@e2e.test`;
const PASSWORD = 'e2e-password-123';

async function register(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Online (two devices)' }).click();
  await page.getByRole('button', { name: 'No account yet? Create one' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Signed in as')).toBeVisible();
}

/** Two-player online game through the UI + observer link + CSV download. */
test.describe('online', () => {
  test('register, create/join, hidden orders, reveal, observer, replay, CSV export', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await register(pageA, EMAIL_A);
    await register(pageB, EMAIL_B);

    // A creates a game as State; invite code shown.
    await pageA.locator('.side-option.state').click();
    await pageA.getByRole('button', { name: 'Create game', exact: true }).click();
    const codeBox = pageA.locator('.invite-code');
    await expect(codeBox).toBeVisible();
    const code = (await codeBox.innerText()).trim();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

    // B joins with the code; both land in planning.
    await pageB.getByPlaceholder('8-character code').fill(code);
    await pageB.getByRole('button', { name: 'Join game' }).click();
    await expect(pageB.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();
    // A's lobby polls and transitions to the game automatically.
    await expect(pageA.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible({ timeout: 20_000 });

    // A submits first -> waiting screen; B must NOT see A's orders (hidden information).
    await pageA.getByRole('button', { name: 'Increase level' }).first().click();
    await pageA.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
    await expect(pageA.getByText('Orders locked in')).toBeVisible();
    // A's waiting screen shows live opponent status; B keeps planning (no leak of A's orders).
    await expect(pageA.getByText('Your opponent is still planning')).toBeVisible();
    await expect(pageB.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();

    // B submits -> both see the reveal.
    await pageB.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
    await expect(pageA.getByRole('heading', { name: 'Orders revealed' })).toBeVisible();
    await expect(pageB.getByRole('heading', { name: 'Orders revealed' })).toBeVisible();

    // A copies the observer link; observer (third context, no account) watches read-only.
    const [obsResp] = await Promise.all([
      pageA.waitForResponse((r) => r.url().includes('/observer-link') && r.request().method() === 'POST'),
      pageA.getByRole('button', { name: 'Copy observer link' }).click(),
    ]);
    const { token } = (await obsResp.json()) as { token: string };
    expect(token).toBeTruthy();
    const link = `http://localhost:4173/#/observe/${token}`;

    const ctxObs = await browser.newContext();
    const pageObs = await ctxObs.newPage();
    await pageObs.goto(link);
    await expect(pageObs.getByText('OBSERVING', { exact: true })).toBeVisible();
    // Read-only: no steppers; replay scrubber present for the resolved turn.
    await expect(pageObs.getByRole('button', { name: 'Increase level' })).toHaveCount(0);
    await expect(pageObs.getByRole('slider')).toBeVisible();
    await expect(pageObs.getByText('Turn 1 of 1')).toBeVisible();
    await pageObs.screenshot({ path: 'e2e/screenshots/06-observer.png', fullPage: true });

    // CSV export triggers a download with a sensible filename.
    const [download] = await Promise.all([
      pageA.waitForEvent('download'),
      pageA.getByRole('button', { name: /Export CSV/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^balance-of-terror-[0-9a-f-]+\.csv$/);

    await ctxA.close();
    await ctxB.close();
    await ctxObs.close();
  });
});
