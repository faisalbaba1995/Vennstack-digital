import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

test('records a repeatable local baseline and review screenshots @baseline', async ({ page }, testInfo) => {
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
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const measurements = await page.evaluate(async () => {
    const intervals: number[] = [];
    let previous = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (time: number) => {
        intervals.push(time - previous);
        previous = time;
        if (intervals.length >= 120) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    intervals.shift();
    intervals.sort((a, b) => a - b);
    return {
      ...(window as any).__baseline,
      frameMedianMs: intervals[Math.floor(intervals.length * .5)],
      frameP95Ms: intervals[Math.floor(intervals.length * .95)],
      resourcesBytes: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).reduce((sum, entry) => sum + entry.transferSize, 0),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      userAgent: navigator.userAgent,
    };
  });
  const assets = 'tests/.artifacts/default/_astro';
  const jsGzipBytes = readdirSync(assets).filter((name) => name.endsWith('.js')).reduce((sum, name) => sum + gzipSync(readFileSync(join(assets, name))).byteLength, 0);
  expect(jsGzipBytes).toBeLessThanOrEqual(350_000);
  expect(errors).toEqual([]);
  const baselinePath = testInfo.outputPath('baseline.json');
  writeFileSync(baselinePath, JSON.stringify({ ...measurements, jsGzipBytes, profile: 'Local HTTP, cold context, no CPU/network throttle; 120 idle frames. Not field Web Vitals.' }, null, 2));
  await testInfo.attach('baseline.json', { path: baselinePath, contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('hero.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.screenshot({ path: testInfo.outputPath('full-page.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  expect(errors).toEqual([]);
});
