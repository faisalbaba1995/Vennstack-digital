import gsap from 'gsap';
import { DEPTH_STOPS, measureDepthGeometry, type DepthGeometry } from '../experience/depth-model';
import { initAudio } from './audio-controller';
import type { OceanScene, SceneDiagnostics } from '../experience/scene-contract';
import { initDepthTracker } from './depth-tracker';
import { initGSAP, revealAll } from './gsap-init';
import { initLenis, type LenisRuntime } from './lenis-init';

const PAUSE_KEY = 'vennstack-effects-paused';
declare global { interface Window { __vennDiagnostics?: () => { ticking: boolean; mounted: boolean; renderer: SceneDiagnostics | null; lastDisposed: SceneDiagnostics | null }; } }
let lastDisposed: SceneDiagnostics | null = null;
let disposeCurrent: (() => void) | null = null;

function readPaused() { try { return localStorage.getItem(PAUSE_KEY) === 'true'; } catch { return false; } }
function writePaused(value: boolean) { try { localStorage.setItem(PAUSE_KEY, String(value)); } catch { /* Storage can be unavailable. */ } }

export function mountExperience(): () => void {
  disposeCurrent?.();
  const root = document.documentElement;
  const reading = root.dataset.experience === 'reading';
  const measure = () => reading ? [{ y: 0, stop: DEPTH_STOPS[4] }] : measureDepthGeometry();
  const abort = new AbortController();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const effectsButton = document.getElementById('effects-toggle') as HTMLButtonElement | null;
  const effectsLabel = effectsButton?.querySelector<HTMLElement>('[data-effects-label]');
  const effectsStatus = document.getElementById('effects-status');
  const depthHud = document.getElementById('depth-hud');
  const audio = initAudio();
  let geometry: DepthGeometry = measure();
  const depth = initDepthTracker(() => geometry);
  let scene: OceanScene | null = null;
  let loading = false, graphicsFailed = false, contextLost = false;
  const viewport = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio });
  root.dataset.renderer = 'static';
  window.__vennDiagnostics = () => ({ ticking, mounted: !disposed, renderer: scene?.diagnostics() ?? null, lastDisposed });
  let lenisRuntime: LenisRuntime | null = null;
  let gsapRuntime: ReturnType<typeof initGSAP> | null = null;
  let explicitlyPaused = readPaused(), suspended = document.hidden, ticking = false, disposed = false, lastTime = 0;

  function isFullMotion() { return !reading && !media.matches && !explicitlyPaused; }
  function tick(timeSeconds: number) {
    if (suspended || disposed) return;
    // Reconcile at the clock boundary too: some browsers update matches before
    // delivering the media-query change event. Stop the clock and reveal content.
    if (!isFullMotion()) { applyPreference('Reduced motion preference is active.'); return; }
    const time = timeSeconds * 1000;
    lenisRuntime?.lenis.raf(time);
    const state = depth.update(window.scrollY);
    scene?.update(time, lastTime ? Math.max(0, (time - lastTime) / 1000) : 0, state);
    lastTime = time;
  }
  function startTicker() { if (!ticking && !disposed && !suspended && !graphicsFailed && !contextLost && isFullMotion()) { ticking = true; lastTime = 0; gsap.ticker.add(tick); } }
  function stopTicker() { if (ticking) { ticking = false; gsap.ticker.remove(tick); } }
  function paintPreferences(message = '') {
    const full = isFullMotion();
    root.dataset.motion = media.matches ? 'reduced' : !full || suspended || graphicsFailed || contextLost ? 'paused' : 'full';
    root.dataset.effects = full && !suspended && !graphicsFailed && !contextLost ? 'running' : 'paused';
    if (effectsButton) {
      effectsButton.hidden = false; effectsButton.classList.add('is-visible');
      effectsButton.setAttribute('aria-pressed', String(!full));
      effectsButton.disabled = media.matches;
    }
    if (effectsLabel) effectsLabel.textContent = media.matches ? 'Reduced motion' : full ? 'Pause effects' : 'Resume effects';
    if (effectsStatus) effectsStatus.textContent = message;
  }
  function disableMotion() {
    stopTicker(); lenisRuntime?.dispose(); lenisRuntime = null; gsapRuntime?.dispose(); gsapRuntime = null;
    scene?.pause(); revealAll(); depth.update();
  }
  function enableMotion() {
    if (!isFullMotion() || disposed) return;
    if (graphicsFailed || contextLost) { revealAll(); return; }
    if (!scene && !loading && !suspended) {
      loading = true; root.dataset.renderer = 'loading';
      void import('../experience/renderer').then(({ createOceanScene }) => {
        if (disposed || !isFullMotion() || suspended) { loading = false; return; }
        const canvas = document.getElementById('ocean-canvas') as HTMLCanvasElement | null;
        if (!canvas) throw new Error('Missing graphics surface');
        scene = createOceanScene(canvas, { onStatus(status) {
          if (disposed) return;
          root.dataset.renderer = status;
          if (status === 'lost') { contextLost = true; disableMotion(); paintPreferences('Graphics interrupted; content remains available.'); }
          if (status === 'failed') {
            graphicsFailed = true; disableMotion(); root.dataset.renderer = 'failed';
            scene?.dispose(); lastDisposed = scene?.diagnostics() ?? null; scene = null;
            root.dataset.renderer = 'failed'; paintPreferences('Graphics unavailable; content remains available.');
          }
          if (status === 'ready' && contextLost) { contextLost = false; applyPreference(); }
          if (status === 'ready' && (suspended || !isFullMotion())) scene?.pause();
        } });
        scene.resize(viewport()); root.dataset.renderer = 'ready'; loading = false;
      }).catch(() => {
        if (disposed) return;
        loading = false; graphicsFailed = true; disableMotion();
        scene?.dispose(); lastDisposed = scene?.diagnostics() ?? lastDisposed; scene = null;
        const canvas = document.getElementById('ocean-canvas');
        if (canvas) canvas.replaceWith(canvas.cloneNode(false));
        root.dataset.renderer = 'failed'; paintPreferences('Graphics unavailable; content remains available.');
      });
    }
    scene?.resume();
    gsapRuntime ??= initGSAP();
    lenisRuntime ??= initLenis();
    if (!suspended) { lenisRuntime.lenis.start(); startTicker(); }
    gsapRuntime.refresh();
  }
  function applyPreference(message = '') {
    paintPreferences(message);
    if (isFullMotion()) enableMotion(); else disableMotion();
  }
  function refreshGeometry() {
    if (disposed || suspended) return;
    geometry = measure(); scene?.resize(viewport()); depth.update(); gsapRuntime?.refresh();
  }
  function onVisibility() {
    suspended = document.hidden;
    if (!suspended) refreshGeometry();
    if (suspended) { stopTicker(); scene?.pause(); lenisRuntime?.lenis.stop(); }
    else if (isFullMotion()) { lenisRuntime?.lenis.start(); startTicker(); }
    applyPreference();
    if (suspended) scene?.pause();
    gsapRuntime?.setPaused(suspended);
  }

  effectsButton?.addEventListener('click', () => {
    explicitlyPaused = !explicitlyPaused; writePaused(explicitlyPaused);
    applyPreference(explicitlyPaused ? 'Visual effects paused.' : media.matches ? 'Reduced motion preference is active.' : 'Visual effects resumed.');
  }, { signal: abort.signal });
  media.addEventListener('change', () => applyPreference(media.matches ? 'Reduced motion preference is active.' : ''), { signal: abort.signal });
  window.addEventListener('resize', refreshGeometry, { passive: true, signal: abort.signal });
  window.addEventListener('scroll', () => { if (!ticking) depth.update(); }, { passive: true, signal: abort.signal });
  window.addEventListener('orientationchange', refreshGeometry, { passive: true, signal: abort.signal });
  window.addEventListener('pagehide', (event) => { suspended = true; stopTicker(); lenisRuntime?.lenis.stop(); if (!(event as PageTransitionEvent).persisted) dispose(); }, { signal: abort.signal });
  window.addEventListener('pageshow', () => { suspended = document.hidden; refreshGeometry(); if (!suspended && isFullMotion()) { lenisRuntime?.lenis.start(); startTicker(); } }, { signal: abort.signal });
  document.addEventListener('visibilitychange', onVisibility, { signal: abort.signal });
  document.addEventListener('astro:before-swap', () => dispose(), { once: true, signal: abort.signal });
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(refreshGeometry) : null;
  resizeObserver?.observe(document.body);
  void document.fonts?.ready.then(refreshGeometry).catch(() => {});
  if (depthHud) depthHud.hidden = false;
  gsap.ticker.lagSmoothing(0);
  try { applyPreference(); depth.update(); }
  catch (error) { dispose(); root.dataset.motion = 'paused'; revealAll(); throw error; }

  function dispose() {
    if (disposed) return; disposed = true; stopTicker(); abort.abort(); resizeObserver?.disconnect();
    lenisRuntime?.dispose(); gsapRuntime?.dispose(); scene?.dispose(); lastDisposed = scene?.diagnostics() ?? lastDisposed; audio.dispose();
    lenisRuntime = null; gsapRuntime = null; scene = null;
    root.dataset.motion = 'paused';
    if (depthHud) depthHud.hidden = true;
    if (effectsButton) effectsButton.hidden = true;
    if (disposeCurrent === dispose) disposeCurrent = null;
  }
  disposeCurrent = dispose;
  return dispose;
}
