import type { QualityTier, Viewport } from './scene-contract';

export const QUALITY = {
  low: { dpr: 1, pixels: 600_000, particles: 80, bloom: false },
  medium: { dpr: 1.25, pixels: 1_000_000, particles: 160, bloom: true },
  high: { dpr: 1.5, pixels: 1_500_000, particles: 240, bloom: true },
} as const;
const tiers: QualityTier[] = ['low', 'medium', 'high'];
export function initialQuality(cores: number, memory: number, maxTexture: number, width: number): QualityTier {
  if (cores < 4 || memory < 4 || maxTexture < 4096) return 'low';
  return cores >= 8 && memory >= 8 && width >= 1000 ? 'high' : 'medium';
}
export function pixelRatio(viewport: Viewport, tier: QualityTier) {
  return Math.min(Math.max(.1, viewport.dpr), QUALITY[tier].dpr,
    Math.sqrt(QUALITY[tier].pixels / Math.max(1, viewport.width * viewport.height)));
}

/** Timed hysteresis uses active-frame time, so a hidden tab cannot earn promotion. */
export function createQualityController(initial: QualityTier) {
  let tier = initial, pressure = 0, calm = 0, cooldown = 0, age = 0;
  return {
    get tier() { return tier; },
    reset(next: QualityTier) { tier = next; pressure = calm = 0; cooldown = 10; },
    sample(frameMs: number, submitMs: number, delta: number, interacting: boolean) {
      if (!Number.isFinite(frameMs) || delta <= 0) return tier;
      const dt = Math.min(delta, .1);
      age += dt; cooldown = Math.max(0, cooldown - dt);
      if (age < 2) return tier; // Exclude initial shader compilation and page entry.
      const overloaded = frameMs > 28 || submitMs > 8;
      pressure = overloaded ? pressure + dt : Math.max(0, pressure - dt * 2);
      calm = !interacting && frameMs < 19 && submitMs < 4 ? calm + dt : 0;
      const index = tiers.indexOf(tier);
      if (pressure >= 2 && cooldown === 0 && index > 0) {
        tier = tiers[index - 1]; pressure = calm = 0; cooldown = 10;
      } else if (calm >= 30 && cooldown === 0 && index < tiers.indexOf(initial)) {
        tier = tiers[index + 1]; pressure = calm = 0; cooldown = 10;
      }
      return tier;
    },
  };
}
