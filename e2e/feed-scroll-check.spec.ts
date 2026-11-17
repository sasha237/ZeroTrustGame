// Temporary check: actions log must scroll internally instead of growing the page.
import { test, expect } from '@playwright/test';

test('events feed is height-bounded with internal scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /hot.?seat/i }).click();

  const feed = page.locator('.feed');
  await expect(feed).toBeVisible();

  // Feed must scroll internally once it has more content than its box.
  await page.evaluate(() => {
    const ul = document.querySelector('.feed') as HTMLElement;
    const filler = Array.from({ length: 120 }, () => {
      const li = document.createElement('li');
      li.className = 'feed-item';
      li.innerHTML = '<span class="feed-turn">T1</span><span class="feed-text">filler entry for scroll check</span>';
      return li;
    });
    ul.append(...filler);
  });

  const metrics = await page.evaluate(() => {
    const app = document.querySelector('.app') as HTMLElement;
    const rail = document.querySelector('.rail') as HTMLElement;
    const ul = document.querySelector('.feed') as HTMLElement;
    return {
      appScrollH: app.scrollHeight,
      appClientH: app.clientHeight,
      railH: rail.getBoundingClientRect().height,
      feedScrollH: ul.scrollHeight,
      feedClientH: ul.clientHeight,
      pageScrollH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
    };
  });

  console.log(JSON.stringify(metrics, null, 2));
  // Internal overflow, not page growth.
  expect(metrics.feedScrollH).toBeGreaterThan(metrics.feedClientH);
  expect(metrics.appScrollH).toBeLessThanOrEqual(metrics.appClientH + 1);
  expect(metrics.pageScrollH).toBeLessThanOrEqual(metrics.winH + 1);
});
