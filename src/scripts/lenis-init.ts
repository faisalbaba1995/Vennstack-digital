import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
export type LenisRuntime = { lenis: Lenis; dispose: () => void };
export function initLenis(): LenisRuntime {
  const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false });
  const sync = () => ScrollTrigger.update();
  lenis.on('scroll', sync);
  let disposed = false;
  return { lenis, dispose() { if (!disposed) { disposed = true; lenis.off('scroll', sync); lenis.destroy(); } } };
}
