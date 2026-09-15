import { expect, test } from '@playwright/test';

test('pause and hidden-page lifecycle stop canvas drawing and CSS animation', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(0);
  await page.locator('#effects-toggle').click();
  const pausedDraws = await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBe(pausedDraws);
  expect(await page.locator('.god-ray').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('html').getAttribute('class')).not.toContain('lenis');
  await page.locator('#effects-toggle').click();
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(pausedDraws);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'paused');
  const hiddenDraws = await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBe(hiddenDraws);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(hiddenDraws);
});

test.describe('motion preference', () => {
  test('reduced motion is honored at startup and when the OS setting changes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('[data-effects-label]')).toContainText(/reduced|resume|enable/i);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  });

  test('explicit pause persists across reloads', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const toggle = page.locator('#effects-toggle');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect(page.locator('#effects-status')).toContainText(/paused/i);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  });
});

test('rapid audio toggles settle safely and report failures', async ({ page }) => {
  await page.addInitScript(() => {
    class MockAudioContext {
      state = 'running'; sampleRate = 8; currentTime = 0; destination = {};
      addEventListener() {}
      suspend() { this.state = 'suspended'; return Promise.resolve(); }
      createBuffer() { return { getChannelData: () => new Float32Array(80) }; }
      createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} }; }
      createGain() { return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
      createOscillator() { return { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      close() { this.state = 'closed'; return Promise.resolve(); }
    }
    Object.defineProperty(window, 'AudioContext', { value: MockAudioContext });
  });
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('/');
  const toggle = page.locator('#audio-toggle');
  await toggle.click({ clickCount: 7, delay: 20 });
  await expect(page.locator('#audio-status')).toContainText(/on|off|playing|stopped/i);
  expect(errors).toEqual([]);
});

test('audio initialization errors leave a usable off state', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: class { constructor() { throw new Error('mock denied'); } } });
  });
  await page.goto('/');
  await page.locator('#audio-toggle').click();
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#audio-status')).toContainText(/unavailable|off|error/i);
});

test('repeated lifecycle events do not duplicate audio mounts', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__audioContexts = 0;
    Object.defineProperty(window, 'AudioContext', { value: class {
      state = 'running'; sampleRate = 8; currentTime = 0; destination = {};
      addEventListener() {}
      suspend() { this.state = 'suspended'; return Promise.resolve(); }
      constructor() { (window as any).__audioContexts++; }
      createBuffer() { return { getChannelData: () => new Float32Array(80) }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
      createGain() { return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createBiquadFilter() { return { frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
      createOscillator() { return { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
      resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    }});
  });
  await page.goto('/');
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  await page.locator('#audio-toggle').click();
  expect(await page.evaluate(() => (window as any).__audioContexts)).toBe(1);
  await page.reload();
  await expect(page.locator('#audio-toggle')).toBeVisible();
});
