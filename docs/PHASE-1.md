# Phase 1 implementation record

## Scope and ownership

Implemented the Phase 1 engineering work from `VENNSTACK-AUDIT.md` while retaining Astro, GSAP, Lenis, and Canvas 2D. The primary agent owned architecture, shared layout/styles, dependencies, integration fixes, and final verification. Three Sol agents had separate initial ownership: components/contact, runtime/depth/audio, and tests/CI. After their usage limit, the primary agent completed integration and resolved findings.

## Changes

| Audit item | Result |
|---|---|
| Dependencies and runtime | Astro 7.3.2, reviewed lockfile updates, Node 22.23.1 pinned in `.nvmrc`; check/lint/browser tooling installed. |
| Entry and navigation | Mandatory loader removed, semantic HTML visible by default, silent entry, top Work/Studio/Contact navigation, skip link and visible focus. |
| Contact | Build-time Web3Forms configuration; missing key renders a mailto fallback. Native no-JS POST remains available when configured. Enhanced submission has pending/success/error states, timeout, duplicate prevention, abort cleanup, preserved fields, and retry recovery. |
| Content honesty | Removed fabricated outcome/award/studio metrics, unconfigured social links, and misleading case-study CTA. Project copy is provisional; flagship is a concept preview. |
| Runtime lifecycle | A single experience-owned GSAP ticker advances Lenis, particles, and depth. `autoRaf` is disabled. Owned listeners, ResizeObserver, audio graph, canvas cache, and GSAP context are disposed on lifecycle changes. No global ScrollTrigger kill or footer interval. |
| Motion and sound | Runtime OS preference changes and persistent pause supported; native scrolling and visible content in static mode. CSS animation and particle drawing pause while hidden. Audio starts only on a click, fades at the edges, tracks actual context state, and handles rapid toggles/failure. |
| Depth | Seven measured section anchors share numeric depth and interpolated palette; zero-scroll/collapsed geometry guarded; resize/fonts/restored-scroll updates included. HUD is decorative and hidden without JS. |
| Typography/accessibility | Self-hosted fonts, opaque text tokens, dark reading surfaces, stronger form borders/focus, logical headings/landmarks, decorative graphics hidden, mobile reflow and reduced-motion path. |
| Repeatability | Production fixture browser tests, axe smoke checks, type check, lint, CI workflow, baseline capture, and asset inventory. |

## Runtime contract for Phase 2

`mountExperience()` owns start, pause, resize, route changes, and disposal. The clock provides elapsed milliseconds and bounded delta seconds. `measureDepthGeometry()` and `sampleDepth()` provide section, next section, blend, normalized progress, and physical metaphor depth. The HUD, palette, and particle density consume that same sample.

A future renderer should expose `update(time, delta, depthState)`, `resize(viewport, quality)`, `pause()`, and idempotent `dispose()`. Its own RAF is prohibited while mounted under the experience clock. Import it after HTML entry, catch initialization/context failures, and retain the CSS/static fallback. It must own and release its resources; route persistence must not retain stale DOM references. Reduced motion starts with static content and native scrolling. Scene effects cannot own link behavior, focus, or form state.

## External inputs and launch checks

| Exact input | Current fallback / next step |
|---|---|
| `PUBLIC_WEB3FORMS_ACCESS_KEY` | Empty by default. Provide the public form key tied to a verified recipient inbox, set at build time, then rebuild. No private provider token is needed. |
| Recipient mailbox and confirmation of `hello@vennstack.studio` | Existing address retained as mailto. Confirm it is monitored, or supply the replacement address for `ContactBeacon.astro`. |
| Controlled delivery result | Mocked provider responses cover UI behavior. After configuration, send one clearly labeled test enquiry and verify receipt, reply-to, spam handling, and provider domain settings. Real delivery has not been claimed. |
| Approved project content/media/rights | See `ASSETS.md` for six named entries and exact fields. Current honest previews remain until material is supplied. |
| Approved social destinations | Supply exact full URLs if these should return. None are published currently. |
| Production site URL and hosting target | Needed for canonical/share URLs, deployment headers, and production response checks in a later release step. No deployment occurred. |

## Device validation matrix

Automated checks here use local Chrome on macOS 12.7.6 x86_64, with desktop and Pixel 7 viewport/touch emulation. Emulation does not establish Android GPU, thermal, Safari, or assistive-technology behavior.

| Target | Required checks | Status |
|---|---|---|
| Local Chrome desktop + Pixel 7 emulation | Build interactions, keyboard, axe, reduced/no JS, fonts, 320px reflow, audio errors, lifecycle and depth | Automated suite; results recorded below. |
| Pixel 6a, installed stable Android Chrome | Touch scroll, software keyboard, pause, rotation, 10-minute idle/scroll thermal run | Named proposed mid-range acceptance device; physical device unavailable here. Record OS/browser versions when run. |
| iPhone 13, installed stable iOS Safari + VoiceOver | Navigation, forms, viewport/keyboard, preference changes, audio resume, screen reader tasks | Physical device/manual validation pending. |
| M1 MacBook Air, Safari + Chrome | 60Hz scroll, background tabs, back/forward, 200%/400% zoom | Physical device/manual validation pending. |
| Keyboard and assistive technology | Read headings/landmarks, reach Work and Contact, submit invalid/valid form, hear status once, operate sound/pause | Keyboard smoke automated; actual screen reader pass pending. |

The baseline script records local LCP candidate, CLS, resource transfer bytes, 120 idle frame intervals, and gzipped JS size. Run it alone with one worker for comparison. No field p75 INP/LCP/CLS, Lighthouse score, or sustained-device performance is inferred from these samples.

## Verification results

Final verification on 15 September 2026:

- `npm run check`: 27 files, 0 errors, 0 warnings, 0 hints.
- `npm run lint`: passed.
- `npm run build`: static production build passed; one page generated.
- `npm test`: 48/48 Playwright tests passed across desktop Chrome and Pixel 7 emulation. This includes axe WCAG A/AA smoke scans, keyboard focus, 320px reflow, no-JS and blocked-script fallbacks, reduced-motion startup/runtime changes, explicit effect pause, hidden-tab suspension, canvas failure, depth anchors/resize/restored scroll, audio races/failure/remount, configured contact success/errors/timeout/retry/interruption, and native no-JS form POST.
- `npm audit --audit-level=high`: 0 vulnerabilities.

Quiet single-worker local baseline, Chrome 153 emulation on macOS 12.7.6 x86_64:

| Profile | LCP candidate | CLS | Median / p95 idle frame interval | Resource transfer | JS gzip |
|---|---:|---:|---:|---:|---:|
| Desktop 1280×720, DPR 1 | 1,828 ms | 0 | 16.7 / 33.4 ms | 288,053 B | 58,672 B |
| Pixel 7 emulation 412×839, DPR 2.625 | 580 ms | 0 | 16.7 / 33.4 ms | 288,053 B | 58,672 B |

The JavaScript result is below the Phase 1 starting budget of 350 KB gzip. These are unthrottled local observations over 120 idle frames. The p95 interval needs physical-device tracing before it becomes an acceptance result; the mobile profile emulates viewport, touch, DPR, and user agent, not the device CPU/GPU or thermal behavior. LCP is a local candidate rather than field p75 data, and no INP value is asserted because this sample does not contain a representative interaction population.

The full-page screenshots were reviewed at desktop and mobile sizes. Content is present in every section, project and featured placeholders are labeled honestly, the fallback contact route is clear, and no horizontal clipping was observed after the reveal-transform containment fix. Repeated fixed navigation in Playwright’s stitched mobile full-page artifact is a capture behavior; the live page has one fixed header.
