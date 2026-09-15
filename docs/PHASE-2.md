# Phase 2 implementation

Implementation is in progress. This document distinguishes verified milestones from pending final acceptance.

## Ownership and architecture

One primary agent owns architecture, renderer, content, tests, integration and visual review. No subagents are used for this implementation.

Semantic Astro HTML loads before the optional renderer. `mountExperience` owns one GSAP ticker shared by Lenis, depth sampling and WebGL. The renderer never requests animation frames. It exposes update, resize, pause, resume, diagnostics and idempotent disposal through `scene-contract.ts`. The renderer chunk is dynamically imported only when motion is allowed and the page is visible. Audio remains separately opt-in.

No canvas navigation, focus, form state or links exist. The ocean gradient and original SVG intersecting-current silhouette remain available without JavaScript, with reduced motion and when graphics fail. Native scrolling and visible content are restored on graphics failure or context loss.

Visibility stops the experience clock and pauses reveals. Resume resets timing; simulation advances with bounded deltas rather than absolute wall time. Pending module imports check mount and preference state before allocating a renderer. Route disposal aborts listeners, disconnects the observer, releases scene resources and discards the canvas context. A fresh canvas node prevents accidental reuse of a discarded context during repeated mounts.

## Renderer lifecycle

The context-loss extension is cached while healthy because requesting it after context loss can return null. Context loss is prevented from becoming terminal by default; a restore request occurs after 500 ms, with a 4-second recovery deadline and at most two successful recoveries per scene. A terminal failure leaves semantic content visible. Disposal cancels pending recovery timers and removes both application and renderer listeners.

Resources currently owned: shared torus geometry and lit current material; point geometry and material; caustics plane geometry and shader; scene, camera and lights; renderer/context. Geometries and materials are disposed before renderer disposal, then the context is explicitly released. Diagnostics expose actual Three.js resource counters, frame count, CPU submission time, pixel count and recovery counts.

## Milestone evidence

- Foundation: production build, Astro check and ESLint passed. Six dedicated renderer checks passed across desktop and mobile Chrome, including real `WEBGL_lose_context`, repeated mounts, construction failure and reduced-motion changes.
- Foundation JavaScript: 189,922 bytes gzip across all output JS, including the deferred renderer; below 350,000 bytes.
- Minimal scene: 16 interaction/lifecycle checks passed initially. Two resource checks identified a retained internal PBR lookup texture. The current material now uses simpler Phong lighting; resource checks are being rerun.
- Initial visual review: currents and caustics were too prominent behind the subtitle. Their intensity was reduced and hero buttons now have opaque dark backgrounds.

Final quality thresholds, measurements, full regression results, final visual review and external-input inventory will be recorded after the remaining milestones pass.
