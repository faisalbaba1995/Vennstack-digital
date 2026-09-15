export type DepthStop = Readonly<{ id: string; depth: number; zone: string; top: string; bottom: string; accent: string }>;

export const DEPTH_STOPS: readonly DepthStop[] = [
  { id: 'hero', depth: 0, zone: 'SURFACE', top: '#07364d', bottom: '#062a43', accent: '#9defff' },
  { id: 'about', depth: 200, zone: 'SUNLIGHT ZONE', top: '#082e49', bottom: '#08233d', accent: '#8ce9ff' },
  { id: 'skills', depth: 500, zone: 'TWILIGHT ZONE', top: '#09253e', bottom: '#071a32', accent: '#81e8ff' },
  { id: 'projects', depth: 1000, zone: 'MIDNIGHT ZONE', top: '#081b31', bottom: '#061326', accent: '#75e7ff' },
  { id: 'featured', depth: 4000, zone: 'THE ABYSS', top: '#071426', bottom: '#040b18', accent: '#75f3d1' },
  { id: 'contact', depth: 6000, zone: 'HADAL ZONE', top: '#050d1c', bottom: '#020711', accent: '#8cf5d7' },
  { id: 'footer', depth: 11000, zone: 'CHALLENGER DEEP', top: '#030916', bottom: '#01040b', accent: '#9cf8dc' },
] as const;

export type DepthGeometry = ReadonlyArray<Readonly<{ y: number; stop: DepthStop }>>;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function measureDepthGeometry(): DepthGeometry {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (maxScroll === 0) return [{ y: 0, stop: DEPTH_STOPS[0] }];
  let previous = 0;
  return DEPTH_STOPS.map((stop, index) => {
    const element = document.getElementById(stop.id);
    const rawY = element ? element.getBoundingClientRect().top + window.scrollY : (index / (DEPTH_STOPS.length - 1)) * maxScroll;
    const y = index === 0 ? 0 : clamp(Math.max(previous, rawY), 0, maxScroll);
    previous = y;
    return { y, stop };
  });
}

export function sampleDepth(scrollY: number, geometry: DepthGeometry) {
  if (!geometry.length) return { depth: 0, progress: 0, zone: DEPTH_STOPS[0], next: DEPTH_STOPS[0], mix: 0 };
  let upperIndex = geometry.length - 1;
  for (let i = 0; i < geometry.length - 1; i++) if (scrollY < geometry[i + 1].y) { upperIndex = i; break; }
  const lowerIndex = Math.min(geometry.length - 1, upperIndex + 1);
  const upper = geometry[upperIndex];
  const lower = geometry[lowerIndex];
  const mix = clamp((scrollY - upper.y) / Math.max(1, lower.y - upper.y));
  const depth = upper.stop.depth + (lower.stop.depth - upper.stop.depth) * mix;
  return { depth, progress: clamp(depth / 11000), zone: upper.stop, next: lower.stop, mix };
}

export function mixHex(a: string, b: string, amount: number): string {
  const values = [a, b].map((hex) => Number.parseInt(hex.slice(1), 16));
  const channels = [16, 8, 0].map((shift) => Math.round(((values[0] >> shift) & 255) + (((values[1] >> shift) & 255) - ((values[0] >> shift) & 255)) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
