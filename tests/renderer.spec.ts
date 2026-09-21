import { expect, test } from '@playwright/test';

test('WebGL draws, releases resources on remount, and recovers a real lost context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(2);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer)).toMatchObject({ bloomEnabled: true, renderTargets: 2 });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(2);
    const diagnostics = await page.evaluate(() => window.__vennDiagnostics!());
    expect(diagnostics.lastDisposed).toMatchObject({ status: 'disposed', geometries: 0, textures: 0, programs: 0 });
    expect(diagnostics.renderer!.geometries).toBeLessThanOrEqual(4);
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
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => /renderer.*\.js/.test(entry.name)))).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const before = await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames)).toBe(before);
});

test('a blocked renderer chunk preserves the static composition', async ({ page }) => {
  await page.route(/renderer.*\.js/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'failed');
  await expect(page.locator('.hero__currents')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore our work' })).toBeVisible();
});

test('shader compilation failure leaves visible content and releases allocated resources', async ({ page }) => {
  await page.addInitScript(() => {
    const source = WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource = function (shader, code) {
      source.call(this, shader, `${code}\n invalid_glsl!`);
    };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'failed');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => window.__vennDiagnostics?.().lastDisposed)).toMatchObject({ geometries: 0, textures: 0, programs: 0 });
});

test('limited capability selects a bounded scene without bloom', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 }));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
  const scene = await page.evaluate(() => window.__vennDiagnostics?.().renderer);
  expect(scene).toMatchObject({ quality: 'low', particles: 80, renderTargets: 0, bloomEnabled: false });
  expect(scene!.pixelCount).toBeLessThanOrEqual(600_000);
});

test('real frame pressure triggers a bounded quality downgrade', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 4 });
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      const start = performance.now(); while (performance.now() - start < 12) { /* Deliberate test-only load. */ }
      return draw.apply(this, args);
    };
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.quality), { timeout: 30_000 }).toBe('low');
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.renderTargets)).toBe(0);
});

test('unrecoverable context loss releases resources and stays static after visibility changes', async ({ page }) => {
  await page.addInitScript(() => {
    const getExtension = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (this: WebGL2RenderingContext, name: string) {
      const extension = (getExtension as (name: string) => any).call(this, name);
      return name === 'WEBGL_lose_context' && extension
        ? { loseContext: () => extension.loseContext(), restoreContext() {} } : extension;
    } as typeof getExtension;
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
  await page.evaluate(() => (document.querySelector('#ocean-canvas') as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'failed');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await page.evaluate(() => window.__vennDiagnostics?.().ticking)).toBe(false);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().lastDisposed)).toMatchObject({ geometries: 0, textures: 0, programs: 0 });
  await expect(page.locator('h1')).toBeVisible();
});

test('a hidden lost context waits for visibility before recovery', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    (document.querySelector('#ocean-canvas') as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'lost');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.recoveries)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready');
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.recoveries)).toBe(1);
});
