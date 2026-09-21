# VennStack Studio

An Astro static portfolio with an optional ocean descent: one Three.js renderer, GSAP reveals, Lenis scrolling, and opt-in synthesized audio. Semantic HTML and a static SVG composition remain usable without JavaScript, with reduced motion, or when graphics fail.

## Local development

Use the Node version in `.nvmrc` (22.23.1):

```sh
nvm use
npm ci
npm run dev -- --background
```

Manage the background server with `npm run astro -- dev status`, `npm run astro -- dev logs`, and `npm run astro -- dev stop`.

## Verification

```sh
npm run check
npm run lint
npm run build
npm test
npm audit --audit-level=high
```

Tests build two isolated production fixtures in `tests/.artifacts/`, serving the email fallback on port 4173 and a form with a fake test key on port 4174. Provider responses are intercepted; no test sends real enquiries. Fixtures never overwrite `dist/`.

On macOS, tests use installed Google Chrome when available. Otherwise run `npx playwright install chromium`. Override the executable with `PLAYWRIGHT_CHROME_EXECUTABLE` if necessary. CI installs its own Chromium.

For a less noisy local baseline, run `npm test -- --grep @baseline --workers=1`. Screenshots and JSON measurements are saved under `test-results/`. These are local lab measurements, not field Core Web Vitals or real-device certification.

## Contact configuration

Copy `.env.example` to `.env` and supply a Web3Forms access key associated with your verified recipient mailbox:

```dotenv
PUBLIC_WEB3FORMS_ACCESS_KEY=
```

An empty key produces an email CTA to the existing `hello@vennstack.studio` address, with no form pretending to submit. Confirm this mailbox or update `email` in `src/components/ContactBeacon.astro`. The key is a public form identifier embedded in HTML, not a server secret. Do not put private API tokens here.

A configured form supports native POST without JavaScript. Its enhancement prevents duplicate pending submissions, times out after 12 seconds, retains fields on errors, and announces success only after a successful provider response. Changes to build-time environment values require a rebuild. Real delivery still needs a controlled inbox check after the key is supplied.

## Implementation and next work

- [Phase 1 implementation, external inputs, and validation](docs/PHASE-1.md)
- [Phase 2 renderer, concept route, budgets and validation](docs/PHASE-2.md)
- [Asset inventory and visual direction](docs/ASSETS.md)
- [Audit and phased roadmap](VENNSTACK-AUDIT.md)

`src/scripts/experience.ts` owns the lifecycle and single GSAP clock. `src/experience/depth-model.ts` owns section anchors and palette interpolation. `renderer.ts`, `quality.ts` and `bloom.ts` own graphics, adaptive budgets and selective glow. Components own semantic content and local CSS. `/work/luminara/` is an explicitly labelled concept preview with responsive local media; it uses native scrolling and no WebGL.
