import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

test('records a repeatable local baseline and review screenshots @baseline', async ({ page, browser }, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    (window as any).__baseline = { lcpMs: null, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) (window as any).__baseline.lcpMs = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) (window as any).__baseline.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect.poll(() => page.evaluate(() => window.__vennDiagnostics?.().renderer?.frames ?? 0)).toBeGreaterThan(5);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const measurements = await page.evaluate(async () => {
    const intervals: number[] = [];
    const submit: number[] = [], bloom: number[] = [];
    let previous = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (time: number) => {
        intervals.push(time - previous);
        const diagnostics = window.__vennDiagnostics?.().renderer;
        if (diagnostics) {
          submit.push(diagnostics.frameMs);
          if (diagnostics.bloomEnabled) bloom.push(Number(diagnostics.bloomMs));
        }
        previous = time;
        if (intervals.length >= 120) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    intervals.shift();
    intervals.sort((a, b) => a - b);
    submit.sort((a, b) => a - b); bloom.sort((a, b) => a - b);
    return {
      ...(window as any).__baseline,
      frameMedianMs: intervals[Math.floor(intervals.length * .5)],
      frameP95Ms: intervals[Math.floor(intervals.length * .95)],
      submitP95Ms: submit[Math.floor(submit.length * .95)] ?? null,
      bloomSubmitP95Ms: bloom[Math.floor(bloom.length * .95)] ?? null,
      sceneMediaBytes: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(entry => /\.(avif|webp|png|svg|glb|ktx2|woff2)(\?|$)/.test(entry.name)).reduce((sum, entry) => sum + entry.transferSize, 0),
      resourcesBytes: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((sum, entry) => sum + entry.transferSize, 0),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      userAgent: navigator.userAgent,
      renderer: window.__vennDiagnostics?.().renderer,
    };
  });
  const assets = 'tests/.artifacts/default/_astro';
  const jsGzipBytes = readdirSync(assets).filter((name) => name.endsWith('.js')).reduce((sum, name) => sum + gzipSync(readFileSync(join(assets, name))).byteLength, 0);
  expect(jsGzipBytes).toBeLessThanOrEqual(350_000);
  expect(measurements.sceneMediaBytes).toBeLessThanOrEqual(1_500_000);
  expect(measurements.renderer?.pixelCount).toBeLessThanOrEqual(1_500_000);
  expect(measurements.renderer?.particles).toBeLessThanOrEqual(240);
  expect(measurements.renderer?.drawCalls).toBeLessThanOrEqual(7);
  expect(measurements.cls).toBeLessThanOrEqual(.1);
  expect(errors).toEqual([]);
  const baselinePath = testInfo.outputPath('baseline.json');
  writeFileSync(baselinePath, JSON.stringify({ ...measurements, browserVersion: browser.version(), jsGzipBytes, profile: 'Local HTTP, cold context, no CPU/network throttle; 120 idle frames. Frame submission timings are CPU measurements, not GPU timings. Not field Web Vitals.' }, null, 2));
  await testInfo.attach('baseline.json', { path: baselinePath, contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('hero.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.screenshot({ path: testInfo.outputPath('full-page.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  expect(errors).toEqual([]);
});
