import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const REVEAL_SELECTOR = '.reveal-up,.reveal-left,.reveal-right,.reveal-scale,.reveal-stagger-item';

export function initGSAP() {
  gsap.registerPlugin(ScrollTrigger);
  const context = gsap.context(() => {
    const groups: Array<[string, gsap.TweenVars]> = [
      ['.reveal-up', { y: 42 }],
      ['.reveal-left', { x: -42 }],
      ['.reveal-right', { x: 42 }],
      ['.reveal-scale', { scale: .94 }],
    ];
    for (const [selector, from] of groups) {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.dataset.revealed === 'true' || element.matches(':focus-within')) return;
        gsap.fromTo(element, { ...from, opacity: 0 }, {
          x: 0, y: 0, scale: 1, opacity: 1,
          duration: .7, ease: 'power2.out', overwrite: 'auto',
          // Release inline transforms so component hover styles retain ownership.
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: element, start: 'top 88%', once: true,
            onEnter: () => { element.dataset.revealed = 'true'; },
          },
        });
      });
    }
    document.querySelectorAll<HTMLElement>('.reveal-stagger').forEach((group) => {
      const children = group.querySelectorAll<HTMLElement>('.reveal-stagger-item:not([data-revealed="true"])');
      if (!children.length) return;
      gsap.fromTo(children, { y: 28, opacity: 0 }, {
        y: 0, opacity: 1, duration: .6, stagger: .08, ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: group, start: 'top 88%', once: true,
          onEnter: () => children.forEach((child) => { child.dataset.revealed = 'true'; }),
        },
      });
    });
  }, document.body);

  const revealFocused = (event: FocusEvent) => {
    if (!(event.target instanceof HTMLElement)) return;
    let element: HTMLElement | null = event.target;
    while (element) {
      if (element.matches(REVEAL_SELECTOR)) {
        gsap.getTweensOf(element).forEach((tween) => tween.progress(1));
        element.dataset.revealed = 'true';
      }
      element = element.parentElement;
    }
  };
  document.addEventListener('focusin', revealFocused);
  const suspendedTweens = new Set<gsap.core.Tween>();
  return {
    refresh: () => ScrollTrigger.refresh(),
    setPaused: (paused: boolean) => {
      if (paused) {
        context.getTweens().forEach((tween: gsap.core.Tween) => {
          if (!tween.paused() && tween.progress() < 1) {
            suspendedTweens.add(tween);
            tween.pause();
          }
        });
      } else {
        suspendedTweens.forEach((tween) => tween.resume());
        suspendedTweens.clear();
      }
    },
    dispose: () => {
      document.removeEventListener('focusin', revealFocused);
      suspendedTweens.clear();
      context.revert();
    },
  };
}

export function revealAll() {
  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((element) => {
    element.dataset.revealed = 'true';
    gsap.set(element, { clearProps: 'opacity,transform' });
  });
}
