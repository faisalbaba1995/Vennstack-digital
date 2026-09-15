import { expect, test } from '@playwright/test';

test('WebGL draws, releases resources on remount, and recovers a real lost context', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(2);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(2);
    const diagnostics = await page.evaluate(() => window.__vennDiagnostics!());
    expect(diagnostics.lastDisposed).toMatchObject({ status: 'disposed', geometries: 0, textures: 0, programs: 0 });
    expect(diagnostics.renderer!.geometries).toBeLessThanOrEqual(3);
  }
  await page.evaluate(() => {
    const gl = (document.querySelector('#ocean-canvas') as HTMLCanvasElement).getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss extension unavailable');
    extension.loseContext();
  });
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'lost');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready');
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.recoveries)).toBe(1);
  expect(errors).toEqual([]);
});

test('construction failure preserves native navigation and semantic content', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.includes('webgl')) return null;
      return (getContext as any).call(this, type, ...args);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'failed');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => window.__vennDiagnostics?.().ticking)).toBe(false);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.locator('#contact')).toBeInViewport();
});

test('reduced startup avoids importing WebGL and runtime preference stops rendering', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer)).toBeNull();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const before = await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames)).toBe(before);
});
