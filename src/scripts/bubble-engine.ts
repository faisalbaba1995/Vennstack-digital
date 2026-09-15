type Bubble = { x: number; y: number; radius: number; speed: number; phase: number; opacity: number };
export function initBubbles() {
  const element = document.getElementById('bubble-canvas');
  if (!(element instanceof HTMLCanvasElement)) return null;
  const canvas: HTMLCanvasElement = element;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const bubbles: Bubble[] = [], sprites = new Map<number, HTMLCanvasElement>();
  let width = 0, height = 0;
  const makeBubble = (onscreen = false): Bubble => ({ x: Math.random() * width, y: onscreen ? Math.random() * height : height + 8, radius: 1 + Math.random() * 4, speed: 10 + Math.random() * 28, phase: Math.random() * Math.PI * 2, opacity: .25 + Math.random() * .5 });
  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr);
    canvas!.style.width = `${width}px`; canvas!.style.height = `${height}px`;
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function sprite(radius: number) {
    const key = Math.max(2, Math.round(radius * 2)), cached = sprites.get(key);
    if (cached) return cached;
    const image = document.createElement('canvas'); image.width = image.height = key * 6;
    const ctx = image.getContext('2d')!, center = image.width / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(190,248,255,.9)'); gradient.addColorStop(.3, 'rgba(120,225,245,.35)'); gradient.addColorStop(1, 'rgba(80,200,230,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, image.width, image.height); sprites.set(key, image); return image;
  }
  resize(); for (let i = 0; i < 70; i++) bubbles.push(makeBubble(true));
  return {
    resize,
    update(time: number, deltaSeconds: number, depthProgress: number) {
      context.clearRect(0, 0, width, height);
      const count = Math.round(70 - depthProgress * 54);
      while (bubbles.length < count) bubbles.push(makeBubble()); if (bubbles.length > count) bubbles.length = count;
      for (const bubble of bubbles) {
        bubble.y -= bubble.speed * Math.min(deltaSeconds, .05);
        if (bubble.y < -20) Object.assign(bubble, makeBubble());
        const image = sprite(bubble.radius), size = bubble.radius * 6; context.globalAlpha = bubble.opacity;
        const x = (bubble.x + Math.sin(time * .0006 + bubble.phase) * 12 + width) % width;
        context.drawImage(image, x - size / 2, bubble.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
    },
    clear() { context.clearRect(0, 0, width, height); },
    dispose() { bubbles.length = 0; sprites.clear(); context.clearRect(0, 0, width, height); },
  };
}
