import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('concept preview is responsive, labelled and accessible with responsive local media', async ({ page }, testInfo) => {
  await page.goto('/work/luminara/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('quieter');
  await expect(page.locator('.case-study__notice')).toContainText('not a published client case study');
  await expect(page.locator('picture source[type="image/avif"]')).toHaveAttribute('srcset', /480w.*800w.*1200w.*1600w/);
  await expect(page.locator('picture source[type="image/webp"]')).toHaveAttribute('srcset', /480w/);
  await expect.poll(() => page.locator('picture img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer)).toBeNull();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('case-study.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('concept route works without JavaScript and links return to real homepage anchors', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/work/luminara/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Publication status', exact: true }).click();
  await expect(page.locator('#evidence')).toBeInViewport();
  await page.getByRole('link', { name: 'Discuss a project' }).click();
  await expect(page.locator('#contact')).toBeInViewport();
  await context.close();
});

test('repeated actual route transitions release the scene and restore one renderer', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
    await page.getByRole('link', { name: 'Luminara — concept preview →', exact: true }).click();
    await expect(page).toHaveURL(/\/work\/luminara\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-experience', 'reading');
    await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer)).toBeNull();
    expect(await page.evaluate(() => window.__vennDiagnostics?.().lastDisposed)).toMatchObject({ geometries: 0, textures: 0, programs: 0, renderTargets: 0 });
    await page.getByRole('link', { name: 'All project previews' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-experience', 'ocean');
    await expect(page.locator('#ocean-canvas')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});
