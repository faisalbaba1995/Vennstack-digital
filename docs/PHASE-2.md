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

Bloom uses two RGBA8 targets: one bounded base target and one glow target at quarter width/height (one sixteenth of drawing pixels). Only the two currents enter the glow pass. A nine-tap composite adds restrained glow; no depth buffers, HDR targets, external textures, multisampling or extra blur target are allocated. Framebuffer completeness is checked. A failed bloom pass falls back to direct rendering. Bloom is disabled for the mount if its extra CPU submission work exceeds 5 ms for two accumulated seconds after 60 frames. This is CPU instrumentation, not GPU timer-query evidence.

Colors enter Three.js through its color-managed `Color` API. Intermediate targets stay linear; final output converts once to sRGB. `NoToneMapping` avoids a second tone transform. Direct rendering uses the same output conversion. The scene deliberately uses simple Phong lighting: resource checks found a retained internal PBR lookup texture in the more complex material path, and the simpler material meets this scene's needs.

## Lifecycle and resource ownership

| Owner | Resources | Release |
|---|---|---|
| Experience | GSAP ticker callback, Lenis, scoped reveal context, audio controller, DOM listeners, body ResizeObserver | Remove ticker, dispose controllers, abort listeners, disconnect observer |
| Scene | Shared torus geometry/material, point geometry/material, caustics plane/shader, lights, scene and camera | Dispose all three geometries/materials, clear scene |
| Bloom | Two targets and their textures, fullscreen plane and shader | Dispose targets, geometry and material on downgrade, failure and scene disposal |
| Renderer | Programs, render lists, bindings, internal listeners, WebGL context | Renderer disposal, explicit context release, fresh canvas for the next mount |
| Recovery | Context listeners and one pending timer | Abort listeners and clear timer |

High/medium use at most four geometries, four programs, two textures, two targets and seven draw calls. Low uses three geometries/programs, zero textures/targets and four draws. Maximum target color storage is approximately 6.375 MB at the high pixel cap, excluding the default framebuffer and driver overhead. Tests inspect actual Three.js counters; they are not replaced with synthetic zeros after disposal.

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

Final regression and visual-review results are being recorded. Earlier milestones passed foundation lifecycle checks, real context loss/recovery, zero remaining resource counters, 12 combined quality/renderer/baseline checks, and six case-study accessibility/no-JS/navigation checks. The dependency audit finding in `devalue` was fixed with a compatible update; npm reports zero vulnerabilities.

## Remaining physical-device and manual validation

Physical iOS Safari and Android Chrome hardware, thermal runs, and assistive-technology sessions are not available in this workspace. Before production release, run a ten-minute foreground/scroll/visibility session on the intended low-end phone and iPhone; record chosen tier, frame intervals, memory trend, context recovery and thermal behavior. Test VoiceOver/Safari and NVDA/Firefox for skip link, headings, control announcements, concept navigation and a configured contact form. Check touch target comfort, browser zoom, battery impact and opt-in audio on actual devices. These checks do not require invented assets or credentials for the graphics path.
