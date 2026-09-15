import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function assertNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, results.violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
}

test('production page is immediately usable and has no mandatory loader', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#loader, [data-loader]')).toHaveCount(0);
  await expect(page.locator('a[href="mailto:hello@vennstack.studio"]')).toBeVisible();
});

test('semantic page remains usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4173' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('#contact')).toBeVisible();
  await expect(page.locator('#contact-form')).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(page.locator('#audio-toggle')).toBeHidden();
  await expect(page.locator('#effects-toggle')).toBeHidden();
  // axe needs JavaScript; audit the blocked-bundle fallback separately below.
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.locator('#contact h2')).toBeInViewport();
  await context.close();
});

test('blocked enhancement scripts fail open', async ({ page }) => {
  await page.route(/\.(?:m?js)(?:\?|$)/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(page.locator('#audio-toggle')).toBeHidden();
  await expect(page.locator('#effects-toggle')).toBeHidden();
  await assertNoAxeViolations(page);
});

test('desktop and mobile meet automated WCAG A/AA checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await assertNoAxeViolations(page);
});

test('content reflows at 320 CSS pixels without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('main')).toBeVisible();
});

test('skip link and keyboard focus are visible and usable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.locator('a[href="#main-content"]');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
  });
  expect(outline).toBe(true);
});

test('internal hash links resolve to existing targets', async ({ page }) => {
  await page.goto('/');
  const hashes = await page.locator('a[href^="#"]').evaluateAll((links) =>
    [...new Set(links.map((link) => link.getAttribute('href')).filter((href) => href && href.length > 1))],
  );
  expect(hashes.length).toBeGreaterThan(0);
  for (const hash of hashes) {
    expect(await page.locator(hash!).count(), `Missing target for ${hash}`).toBe(1);
  }
});

test('the intended webfonts are actually loaded', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const fontState = await page.evaluate(() => ({
    heading: Array.from(document.fonts).some((font) => font.family.replaceAll('"', '') === 'Inter Variable' && font.status === 'loaded'),
    mono: Array.from(document.fonts).some((font) => font.family.replaceAll('"', '') === 'JetBrains Mono Variable' && font.status === 'loaded'),
    resources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\.(?:woff2?|ttf)(?:\?|$)/.test(name)),
  }));
  expect(fontState.heading).toBe(true);
  expect(fontState.mono).toBe(true);
  expect(fontState.resources.length).toBeGreaterThan(0);
});
