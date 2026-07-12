const ZONES = [
  { name: 'SURFACE',        minDepth: 0,    maxDepth: 200 },
  { name: 'SUNLIGHT ZONE',  minDepth: 200,  maxDepth: 500 },
  { name: 'TWILIGHT ZONE',  minDepth: 500,  maxDepth: 1000 },
  { name: 'MIDNIGHT ZONE',  minDepth: 1000, maxDepth: 4000 },
  { name: 'THE ABYSS',      minDepth: 4000, maxDepth: 6000 },
  { name: 'HADAL ZONE',     minDepth: 6000, maxDepth: 11000 },
];

const MAX_DEPTH = 11000; // Mariana Trench depth

let currentDepth = 0;
let displayDepth = 0;
let rafId: number | null = null;

function getZoneName(depth: number): string {
  for (const zone of ZONES) {
    if (depth >= zone.minDepth && depth < zone.maxDepth) return zone.name;
  }
  return ZONES[ZONES.length - 1].name;
}

function formatDepth(depth: number): string {
  if (depth >= 1000) {
    return Math.floor(depth).toLocaleString();
  }
  return Math.floor(depth).toString();
}

export function initDepthTracker() {
  const depthValue = document.getElementById('depth-value');
  const depthZone = document.getElementById('depth-zone');
  const depthPressure = document.getElementById('depth-pressure');

  if (!depthValue || !depthZone || !depthPressure) return;

  function updateDepthFromScroll() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = Math.max(0, Math.min(1, window.scrollY / scrollHeight));
    currentDepth = scrollProgress * MAX_DEPTH;
  }

  function animate() {
    // Smooth interpolation for display
    displayDepth += (currentDepth - displayDepth) * 0.08;

    if (Math.abs(displayDepth - currentDepth) < 0.5) {
      displayDepth = currentDepth;
    }

    depthValue!.textContent = formatDepth(displayDepth);
    depthZone!.textContent = getZoneName(displayDepth);
    depthPressure!.style.width = `${(displayDepth / MAX_DEPTH) * 100}%`;

    rafId = requestAnimationFrame(animate);
  }

  window.addEventListener('scroll', updateDepthFromScroll, { passive: true });
  updateDepthFromScroll();
  rafId = requestAnimationFrame(animate);

  // Cleanup
  document.addEventListener('astro:before-swap', () => {
    window.removeEventListener('scroll', updateDepthFromScroll);
    if (rafId) cancelAnimationFrame(rafId);
  }, { once: true });
}

export function getCurrentDepth(): number {
  return currentDepth;
}
