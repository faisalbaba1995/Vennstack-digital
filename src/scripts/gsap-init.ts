import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

let ctx: gsap.Context | null = null;

// Ocean depth zone color stops
const DEPTH_ZONES = [
  { scroll: 0,    bgTop: '#0077B6', bgBot: '#023E8A', accent: '72,202,228' },
  { scroll: 0.15, bgTop: '#023E8A', bgBot: '#03045E', accent: '0,180,216' },
  { scroll: 0.40, bgTop: '#03045E', bgBot: '#010A26', accent: '125,249,255' },
  { scroll: 0.70, bgTop: '#010A26', bgBot: '#000000', accent: '57,255,20' },
  { scroll: 1,    bgTop: '#000000', bgBot: '#000000', accent: '57,255,20' },
];

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);

  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;

  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);

  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`;
}

function getZoneColors(progress: number) {
  let i = 0;
  for (; i < DEPTH_ZONES.length - 1; i++) {
    if (progress <= DEPTH_ZONES[i + 1].scroll) break;
  }
  const zone = DEPTH_ZONES[i];
  const next = DEPTH_ZONES[Math.min(i + 1, DEPTH_ZONES.length - 1)];
  const localT = (progress - zone.scroll) / (next.scroll - zone.scroll || 1);
  const t = Math.max(0, Math.min(1, localT));

  return {
    bgTop: lerpColor(zone.bgTop, next.bgTop, t),
    bgBot: lerpColor(zone.bgBot, next.bgBot, t),
    accent: zone.accent,
  };
}

export function initGSAP(lenis?: Lenis) {
  gsap.registerPlugin(ScrollTrigger);

  // Cleanup previous
  if (ctx) {
    ctx.revert();
    ScrollTrigger.killAll();
  }

  // Sync Lenis with GSAP ScrollTrigger
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  ctx = gsap.context(() => {
    // ---- Ocean Background Gradient ----
    const oceanBg = document.getElementById('ocean-bg');
    if (oceanBg) {
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        onUpdate: (self) => {
          const colors = getZoneColors(self.progress);
          oceanBg.style.background = `linear-gradient(180deg, ${colors.bgTop} 0%, ${colors.bgBot} 100%)`;
          document.documentElement.style.setProperty('--accent-rgb', colors.accent);
        }
      });
    }

    // ---- Light rays fade with depth ----
    const lightRays = document.querySelector('.light-rays');
    if (lightRays) {
      gsap.to(lightRays, {
        opacity: 0,
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: '30% top',
          scrub: true,
        }
      });
    }

    // ---- Section reveal animations ----
    const revealEls = document.querySelectorAll('.reveal-up');
    revealEls.forEach((el) => {
      gsap.fromTo(el,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            end: 'top 50%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    // ---- Stagger reveal for groups ----
    const staggerGroups = document.querySelectorAll('.reveal-stagger');
    staggerGroups.forEach((group) => {
      const children = group.querySelectorAll('.reveal-stagger-item');
      gsap.fromTo(children,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: group,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    // ---- Float-in from sides ----
    const floatLeftEls = document.querySelectorAll('.reveal-left');
    floatLeftEls.forEach((el) => {
      gsap.fromTo(el,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    const floatRightEls = document.querySelectorAll('.reveal-right');
    floatRightEls.forEach((el) => {
      gsap.fromTo(el,
        { x: 60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    // ---- Scale-up reveal for featured sections ----
    const scaleEls = document.querySelectorAll('.reveal-scale');
    scaleEls.forEach((el) => {
      gsap.fromTo(el,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    });

    // ---- Parallax elements ----
    const parallaxEls = document.querySelectorAll('[data-parallax]');
    parallaxEls.forEach((el) => {
      const speed = parseFloat((el as HTMLElement).dataset.parallax || '0.2');
      gsap.to(el, {
        yPercent: speed * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    });

    // Show depth HUD after loader
    const depthHud = document.getElementById('depth-hud');
    if (depthHud) {
      setTimeout(() => depthHud.classList.add('is-visible'), 2500);
    }

    // Show audio toggle after loader
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) {
      setTimeout(() => audioToggle.classList.add('is-visible'), 2800);
    }
  });

  // Cleanup on Astro page swap
  document.addEventListener('astro:before-swap', () => {
    if (ctx) {
      ctx.revert();
      ScrollTrigger.killAll();
    }
  }, { once: true });
}
