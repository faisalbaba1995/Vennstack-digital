# VennStack Studio

An Astro static portfolio with an optional ocean descent: GSAP reveals, Lenis scrolling, Canvas 2D particles, and opt-in synthesized audio. The HTML remains usable when JavaScript is disabled or unavailable.

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
- [Asset inventory and visual direction](docs/ASSETS.md)
- [Audit and phased roadmap](VENNSTACK-AUDIT.md)

`src/scripts/experience.ts` owns the experience lifecycle and its single Lenis/particle/depth ticker. `src/experience/depth-model.ts` owns section anchors and palette interpolation. Components own semantic content and local CSS. Phase 2 can add a renderer through the documented scene contract without making content depend on it.
