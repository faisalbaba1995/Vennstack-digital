interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wobbleSpeed: number;
  wobbleAmount: number;
  wobbleOffset: number;
  opacity: number;
  glowIntensity: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctxCanvas: CanvasRenderingContext2D | null = null;
let bubbles: Bubble[] = [];
let rafId: number | null = null;
let scrollProgress = 0;

const CONFIG = {
  maxBubbles: 120,
  minRadius: 1,
  maxRadius: 5,
  minSpeed: 0.2,
  maxSpeed: 1.2,
  // Fewer bubbles at depth
  surfaceDensity: 1.0,
  abyssDensity: 0.15,
};

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createBubble(canvasWidth: number, canvasHeight: number, startFromBottom = true): Bubble {
  const radius = random(CONFIG.minRadius, CONFIG.maxRadius);
  return {
    x: random(0, canvasWidth),
    y: startFromBottom ? canvasHeight + radius : random(0, canvasHeight),
    radius,
    speed: random(CONFIG.minSpeed, CONFIG.maxSpeed) * (1 + (1 - radius / CONFIG.maxRadius) * 0.5),
    wobbleSpeed: random(0.01, 0.03),
    wobbleAmount: random(10, 30),
    wobbleOffset: random(0, Math.PI * 2),
    opacity: random(0.15, 0.5) * (radius / CONFIG.maxRadius),
    glowIntensity: random(0.1, 0.4),
  };
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctxCanvas?.scale(dpr, dpr);
}

function updateScrollProgress() {
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = Math.max(0, Math.min(1, window.scrollY / scrollHeight));
}

function animate(time: number) {
  if (!ctxCanvas || !canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  ctxCanvas.clearRect(0, 0, width, height);

  // Density based on depth
  const density = CONFIG.surfaceDensity - (CONFIG.surfaceDensity - CONFIG.abyssDensity) * scrollProgress;
  const activeBubbleCount = Math.floor(CONFIG.maxBubbles * density);

  // Add new bubbles if needed
  while (bubbles.length < activeBubbleCount) {
    bubbles.push(createBubble(width, height, true));
  }

  // Remove excess bubbles gradually
  if (bubbles.length > activeBubbleCount + 10) {
    bubbles.splice(activeBubbleCount, bubbles.length - activeBubbleCount);
  }

  // Color shifts with depth
  const r = Math.round(72 + (125 - 72) * scrollProgress);
  const g = Math.round(202 + (249 - 202) * scrollProgress);
  const b = Math.round(228 + (255 - 228) * scrollProgress);

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];

    // Move upward
    bubble.y -= bubble.speed;

    // Wobble
    bubble.x += Math.sin(time * 0.001 * bubble.wobbleSpeed + bubble.wobbleOffset) * bubble.wobbleAmount * 0.02;

    // Remove if off screen
    if (bubble.y < -bubble.radius * 2) {
      bubbles[i] = createBubble(width, height, true);
      continue;
    }

    // Draw bubble
    ctxCanvas.beginPath();
    ctxCanvas.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);

    // Glow effect
    const glowOpacity = bubble.opacity * (0.5 + Math.sin(time * 0.002 + bubble.wobbleOffset) * 0.2);
    ctxCanvas.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.3})`;
    ctxCanvas.shadowColor = `rgba(${r}, ${g}, ${b}, ${bubble.glowIntensity})`;
    ctxCanvas.shadowBlur = bubble.radius * 3;
    ctxCanvas.fill();

    // Inner bright core
    ctxCanvas.beginPath();
    ctxCanvas.arc(bubble.x, bubble.y, bubble.radius * 0.6, 0, Math.PI * 2);
    ctxCanvas.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.6})`;
    ctxCanvas.shadowBlur = 0;
    ctxCanvas.fill();
  }

  // Reset shadow for performance
  ctxCanvas.shadowBlur = 0;

  rafId = requestAnimationFrame(animate);
}

export function initBubbles() {
  canvas = document.getElementById('bubble-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  ctxCanvas = canvas.getContext('2d');
  if (!ctxCanvas) return;

  // Initialize
  resizeCanvas();
  bubbles = [];
  for (let i = 0; i < CONFIG.maxBubbles * 0.5; i++) {
    bubbles.push(createBubble(window.innerWidth, window.innerHeight, false));
  }

  // Event listeners
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // Start animation
  rafId = requestAnimationFrame(animate);

  // Cleanup
  document.addEventListener('astro:before-swap', () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('scroll', updateScrollProgress);
    bubbles = [];
  }, { once: true });
}
