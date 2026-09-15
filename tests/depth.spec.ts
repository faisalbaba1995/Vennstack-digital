import { expect, test } from '@playwright/test';
import { DEPTH_STOPS, mixHex, sampleDepth } from '../src/experience/depth-model';

test('depth interpolation handles anchors, boundaries, and collapsed geometry', () => {
  const geometry = DEPTH_STOPS.map((stop, index) => ({ stop, y: index * 100 }));
  for (const [index, stop] of DEPTH_STOPS.entries()) {
    const sample = sampleDepth(index * 100, geometry);
    expect(sample.depth).toBe(stop.depth);
    expect(sample.zone.id).toBe(stop.id);
  }
  expect(sampleDepth(-100, geometry).depth).toBe(0);
  expect(sampleDepth(10000, geometry).depth).toBe(11000);
  expect(sampleDepth(50, geometry).depth).toBe(100);
  expect(sampleDepth(0, []).depth).toBe(0);
  expect(sampleDepth(0, [{ stop: DEPTH_STOPS[0], y: 0 }]).progress).toBe(0);
  expect(Number.isFinite(sampleDepth(0, geometry.map(({ stop }) => ({ stop, y: 0 }))).depth)).toBe(true);
  expect(mixHex('#000000', '#ffffff', .5)).toBe('#808080');
});

test('native scrolling and resizing keep the HUD aligned with section anchors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const stop of DEPTH_STOPS.slice(1, -1)) {
    await page.locator(`#${stop.id}`).evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY + 1));
    await expect(page.locator('#depth-zone')).toHaveText(stop.zone);
    const value = Number((await page.locator('#depth-value').textContent())?.replaceAll(',', ''));
    // The final 5,000m spans a short scroll interval; one CSS pixel can be ~25m.
    expect(Math.abs(value - stop.depth)).toBeLessThan(50);
  }
  await page.setViewportSize({ width: 800, height: 650 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#depth-value')).toHaveText('11,000');
  await page.reload();
  await expect(page.locator('#depth-value')).toHaveText('11,000');
});

test('canvas failure preserves navigation and motion preferences', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await page.locator('#effects-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator('#contact h2')).toBeInViewport();
});
