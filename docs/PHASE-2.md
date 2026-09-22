# Phase 2 — WebGL and first concept route

## Architecture and ownership

One primary agent owns architecture, dependencies, renderer, content, tests, integration and visual review. No subagents were used for this implementation.

Astro serves semantic HTML immediately. `src/scripts/experience.ts` owns the only application animation clock: the existing GSAP ticker drives Lenis, depth sampling and `OceanScene.update`. The scene never creates a RAF loop. `scene-contract.ts` defines update, resize, pause, resume, diagnostics and idempotent disposal. The renderer module is dynamically imported only for the visible homepage when full motion is allowed. Audio stays separately opt-in.

`depth-model.ts` remains the shared source for section positions, palette interpolation and progress. The scene maps that progress to camera position, current color and intensity, fog density, directional lighting and caustics strength. Marine snow uses one bounded world-space point cloud. Two illuminated intersecting toruses provide the Venn composition. The caustics shader is a restrained procedural approximation, not a fluid simulation. The Canvas 2D bubble engine has been removed.

HTML owns every navigation link, focus target, control and form. A CSS ocean gradient and original inline SVG currents remain available without JS, with reduced motion, when explicitly paused, or after graphics failure. Startup with reduced motion does not request the renderer chunk. Visibility stops the clock and pauses reveals; resume resets frame timing. Simulation deltas are capped at 50 ms, while performance diagnostics retain actual frame intervals.

`/work/luminara/` is a semantic concept preview. It uses native scrolling, a fixed abyss palette, no WebGL, and no misleading depth HUD or maximum-depth stamp. Its navigation returns to real homepage anchors. It claims no client engagement, launch, award, delivered product or measured outcome.

## Quality policy

| Tier | DPR cap | Drawing pixel cap | Particles | Bloom |
|---|---:|---:|---:|---|
| Low | 1 | 600,000 | 80 | Off |
| Medium | 1.25 | 1,000,000 | 160 | Quarter width and height |
| High | 1.5 | 1,500,000 | 240 | Quarter width and height |

The effective DPR is the minimum of device DPR, tier cap and the square root of pixel budget divided by CSS viewport area. The scene requires WebGL2. Initial low quality applies below four logical cores, below 4 GB reported memory, or below a 4096-pixel maximum texture dimension. High requires at least eight cores, 8 GB and a viewport at least 1000 CSS pixels wide; other supported configurations start medium. Missing memory/core hints conservatively default to four. These hints select an initial budget, not a claimed hardware benchmark.

The first two active seconds are warm-up. Frame intervals over 28 ms or CPU submission over 8 ms accumulate pressure; healthy time removes pressure twice as fast. Two seconds of accumulated pressure drop one tier. Changes have a ten-second cooldown. Promotion requires 30 seconds below 19 ms frame interval and 4 ms submission, without recent depth movement; it never exceeds the initial capability tier. Paused time does not count toward recovery. Tests also inject actual draw-call pressure and check a real downgrade.

Bloom uses two RGBA16F targets: one bounded base target and one glow target at quarter width/height (one sixteenth of drawing pixels). Half-float precision prevents the visible banding found in the initial RGBA8 linear caustics pass. Only the two currents enter the glow pass. A nine-tap composite adds restrained glow; no depth buffers, external textures, multisampling or extra blur target are allocated. `EXT_color_buffer_float` and framebuffer completeness are checked; unsupported targets or a failed bloom pass fall back to direct rendering. Bloom is disabled for the mount if its extra CPU submission work exceeds 5 ms for two accumulated seconds after 60 frames. This is CPU instrumentation, not GPU timer-query evidence.

Colors enter Three.js through its color-managed `Color` API. Intermediate targets stay linear; final output converts once to sRGB. `NoToneMapping` avoids a second tone transform. Direct rendering uses the same output conversion. The scene deliberately uses simple Phong lighting: resource checks found a retained internal PBR lookup texture in the more complex material path, and the simpler material meets this scene's needs.

## Lifecycle and resource ownership

| Owner | Resources | Release |
|---|---|---|
| Experience | GSAP ticker callback, Lenis, scoped reveal context, audio controller, DOM listeners, body ResizeObserver | Remove ticker, dispose controllers, abort listeners, disconnect observer |
| Scene | Shared torus geometry/material, point geometry/material, caustics plane/shader, lights, scene and camera | Dispose all three geometries/materials, clear scene |
| Bloom | Two targets and their textures, fullscreen plane and shader | Dispose targets, geometry and material on downgrade, failure and scene disposal |
| Renderer | Programs, render lists, bindings, internal listeners, WebGL context | Renderer disposal, explicit context release, fresh canvas for the next mount |
| Recovery | Context listeners and one pending timer | Abort listeners and clear timer |

High/medium use at most four geometries, four programs, two textures, two targets and seven draw calls. Low uses three geometries/programs, zero textures/targets and four draws. Maximum target color storage is approximately 12.75 MB at the high pixel cap, excluding the default framebuffer and driver overhead. Tests inspect actual Three.js counters; they are not replaced with synthetic zeros after disposal.

The context-loss extension is cached while healthy. A lost context hides only the decorative canvas, stops the expensive experience and reveals all content with native scrolling. A restore attempt occurs after 500 ms, with a four-second deadline. Two recoveries per mount are allowed; further losses end in the static fallback. Recovery reconciles current visibility and motion preference before resuming. Constructor, shader, module-download and terminal recovery failures retain usable HTML. Pending imports cannot allocate a scene after route disposal. Repeated disposal is safe, and a discarded canvas is replaced rather than reused with a lost context.

## Media and exact external inputs

`ProjectMedia.astro` generates AVIF/WebP at 480/800/1200/1600 pixels, with PNG fallback, responsive sizes, explicit dimensions, required alt text and captions. Covers load eagerly; other instances default to lazy loading. The original `src/assets/luminara-concept.svg` exercises the pipeline without masquerading as project evidence. Astro SVG rasterization is enabled for this repository-authored source; no remote image domains are enabled.

Nothing external is needed to run the renderer or concept preview. To turn Luminara into a factual case study, supply:

1. Confirmation whether Luminara is client work or an internal concept, approved project/client name, and written publication permission.
2. Approved brief, audience, constraints, studio role, delivered scope, process and result. Provide dates only if approved and wanted; no date is currently claimed.
3. `src/assets/projects/luminara/cover.png` (at least 1600×1000); optional `process-01.png` and `result-desktop.png` (at least 1600 pixels wide), and `result-mobile.png` (at least 780 pixels wide). Lossless WebP originals can replace PNG. These are requested future paths, not existing assets.
4. For each file: rights holder, publication permission, credit, alt text, caption and crop instructions. Identify any personal data that must be removed.
5. An approved live URL if one exists. For any optional outcome claim: exact value, measurement period, method/source and permission to publish. Neither a URL nor a metric is required for a useful case study.

The existing contact form additionally needs `PUBLIC_WEB3FORMS_ACCESS_KEY` associated with a verified recipient and confirmation of `hello@vennstack.studio`, or its replacement. Until supplied, the honest email fallback remains. A controlled inbox-delivery check remains external; tests intercept provider traffic and send no real enquiries.

## Validation and measurements

Production build, Astro check (zero errors/warnings/hints) and ESLint pass. The dependency audit finding in `devalue` was fixed by updating it to 5.9.4; npm reports zero vulnerabilities. The final complete production regression run passed **76/76 tests in 5.9 minutes**, without retries, across desktop and mobile viewport profiles.

Coverage includes all Phase 1 accessibility, keyboard, contact success/error/timeout/native POST, audio, native scrolling, depth geometry and motion-preference checks; Phase 2 adds real WebGL context loss/recovery, terminal and hidden-tab recovery, actual invalid-GLSL failure, blocked renderer downloads, capability limits, injected draw-call pressure, hysteresis, repeated mounts and real route transitions, zero residual geometry/texture/program counts, responsive AVIF/WebP output, concept-route axe checks and no-JS navigation. High/medium resource tests explicitly enable those capability branches and assert bloom targets exist before checking their disposal. No test sends real contact submissions.

The production output totals **193,172 bytes gzip JavaScript**, including the deferred renderer, for both empty-key and configured-contact fixtures. This is below the **350,000-byte** budget with no exception. The bundler's 500 KB uncompressed chunk warning concerns the deferred Three.js chunk; it does not indicate a gzip budget violation. First-scene media/font transfer is **90,309 bytes**, below 1.5 MB. Total local resource transfer is **830,177 bytes** because the fixture server sends uncompressed JS. The original concept cover produces 2,672/4,640/7,045/9,376-byte AVIF variants at 480/800/1200/1600 pixels.

Final single-worker production baseline, Chrome **150.0.7871.125**, local HTTP, cold browser context, no CPU/network throttle, 120 sampled idle frames:

| Measurement | Desktop 1280×720, DPR 1 | Mobile viewport 412×839, DPR 2.625 |
|---|---:|---:|
| Local LCP candidate | 252 ms | 284 ms |
| CLS | 0 | 0 |
| Median frame interval | 16.7 ms | 16.7 ms |
| p95 frame interval | 16.8 ms | 16.8 ms |
| p95 CPU submission | 1.6 ms | 1.3 ms |
| Selected tier | Low | Low |
| Drawing pixels | 598,560 | 345,668 |

The browser reports two logical cores, so low-tier selection is intentional. The Playwright profile user agent names Chrome 153; the actual installed browser version above is recorded separately. These are lab observations, not field p75 Web Vitals, real Pixel hardware results or an INP claim.

An isolated production run after regression workers exited used one context at a time, 90 warm-up frames and 180 samples. Core/memory hints were overridden to exercise the tiers; actual WebGL capabilities were unchanged. All three retained their requested tiers:

| Tier / viewport | p95 frame interval | p95 CPU submission | p95 extra bloom submission | Target color storage |
|---|---:|---:|---:|---:|
| High, 1440×1000, DPR 1 | 19 ms | 0.8 ms | 0.5 ms | 12,240,000 bytes |
| Medium, 390×844, DPR 2.625 | 18 ms | 1.0 ms | 0.7 ms | 4,364,864 bytes |
| Low, 390×844, DPR 2.625 | 20 ms | 0.8 ms | Off | 0 |

The earlier visual-capture run overlapped other work and showed a noisier high-tier 78 ms p95 interval / 5.8 ms p95 bloom submission. The isolated run above resolves that measurement concern; it does not substitute for physical-device thermal testing. Raw samples and final tier results are saved in `tests/.artifacts/phase2-review/measurements.json` and `tiers.json`. Runtime pressure-based downgrade and bloom suppression remain enabled.

## Visual review

Reviewed desktop and mobile enhanced heroes, reduced-motion startup, no-JS pages, blocked-renderer fallback, project cards and the complete concept route. Evidence is in `tests/.artifacts/phase2-review/` (ignored generated artifacts), with baseline JSON/screenshots under `test-results/`.

Resolved findings: excessive light behind text was reduced; hero buttons gained opaque surfaces; the mobile camera was pulled back to keep both currents visible; RGBA8 caustic banding was eliminated using capability-checked half-float targets; the reading route received a consistent dark body background. The resulting hero preserves the intersecting-current silhouette across enhanced and static modes. Navigation, text and actions remain legible, concept notices are prominent, and the case layout reflows at narrow widths.

To reproduce screenshots, keep `node tests/support/prepare-and-serve.mjs` running and run `node tests/support/visual-review.mjs` in another terminal. For uncontended production tier measurements, run `npm run build` followed by `node tests/support/measure-tiers.mjs` after other browser tests exit; this starts and closes its own loopback server. Capability overrides in these tools only exercise quality branches in the test browser; they are not production controls.

## Remaining physical-device and manual validation

Physical iOS Safari and Android Chrome hardware, thermal runs, and assistive-technology sessions are not available in this workspace. Before production release, run a ten-minute foreground/scroll/visibility session on the intended low-end phone and iPhone; record chosen tier, frame intervals, memory trend, context recovery and thermal behavior. Test VoiceOver/Safari and NVDA/Firefox for skip link, headings, control announcements, concept navigation and a configured contact form. Check touch target comfort, browser zoom, battery impact and opt-in audio on actual devices. These checks do not require invented assets or credentials for the graphics path.
