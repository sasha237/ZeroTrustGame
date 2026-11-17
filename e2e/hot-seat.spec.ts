import { expect, test } from '@playwright/test';

/** Hot-seat loop: mode screen → plan → handoff → plan → reveal → next turn, plus modal + i18n + panels. */
test.describe('hot-seat', () => {
  test('full turn loop, help modal focus management, RU locale, panels', async ({ page }) => {
    await page.goto('/');

    // Mode screen.
    await expect(page.getByRole('heading', { name: 'Zero Trust' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/01-mode.png', fullPage: true });
    await page.getByRole('button', { name: 'Hot-seat (one device)' }).click();

    // State planning: stepper increments the change counter.
    await expect(page.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FINANCES' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DANGER' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/02-hotseat-planning.png', fullPage: true });

    await page.getByRole('button', { name: 'Increase level' }).first().click();
    await expect(page.getByText('POLICY CHANGES 1/3')).toBeVisible();
    await page.getByRole('button', { name: 'SUBMIT ORDERS' }).click();

    // Handoff / privacy screen.
    await expect(page.getByRole('heading', { name: 'Pass the device' })).toBeVisible();
    await page.getByRole('button', { name: /I am Collective/ }).click();

    // Terrorist planning -> submit -> reveal.
    await page.getByRole('button', { name: 'SUBMIT ORDERS' }).click();
    await expect(page.getByRole('heading', { name: 'Orders revealed' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/03-reveal.png', fullPage: true });
    await page.getByRole('button', { name: 'Resolve the turn' }).click();
    await expect(page.getByText(/Turn 1 resolution/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Turn 2 planning visible for State again.
    await expect(page.getByRole('button', { name: 'SUBMIT ORDERS' })).toBeVisible();
    await expect(page.getByText('POLICY CHANGES 0/3')).toBeVisible();

    // Help modal: opens, focus trap active, Esc closes, focus returns to the help button.
    const helpButton = page.getByRole('button', { name: 'Help' });
    await helpButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/04-help-modal.png', fullPage: true });
    await expect(page.getByRole('button', { name: 'Close' }).first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(helpButton).toBeFocused();

    // RU locale.
    await page.getByRole('button', { name: 'РУ' }).click();
    await expect(page.getByRole('button', { name: 'ОТДАТЬ ПРИКАЗЫ' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/05-planning-ru.png', fullPage: true });
  });
});
