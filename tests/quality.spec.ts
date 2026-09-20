import { expect, test } from '@playwright/test';
import { createQualityController, initialQuality, pixelRatio, QUALITY } from '../src/experience/quality';

test('quality obeys capability caps and pixel budgets', () => {
  expect(initialQuality(2, 8, 16384, 1920)).toBe('low');
  expect(initialQuality(8, 8, 2048, 1920)).toBe('low');
  expect(initialQuality(8, 8, 16384, 390)).toBe('medium');
  expect(initialQuality(8, 8, 16384, 1920)).toBe('high');
  for (const tier of ['low', 'medium', 'high'] as const) {
    const ratio = pixelRatio({ width: 3840, height: 2160, dpr: 4 }, tier);
    expect(3840 * 2160 * ratio ** 2).toBeLessThanOrEqual(QUALITY[tier].pixels + 1);
  }
});

test('sustained pressure downgrades, cooldown prevents oscillation, idle recovery respects initial cap', () => {
  const policy = createQualityController('medium');
  for (let i = 0; i < 140; i++) policy.sample(40, 2, .04, false);
  expect(policy.tier).toBe('low');
  for (let i = 0; i < 600; i++) policy.sample(16.7, 2, .0167, false);
  expect(policy.tier).toBe('low');
  for (let i = 0; i < 2000; i++) policy.sample(16.7, 2, .0167, true);
  expect(policy.tier).toBe('low');
  for (let i = 0; i < 2000; i++) policy.sample(16.7, 2, .0167, false);
  expect(policy.tier).toBe('medium');
  for (let i = 0; i < 4000; i++) policy.sample(16.7, 2, .0167, false);
  expect(policy.tier).toBe('medium');
});
