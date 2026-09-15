# Asset inventory and visual direction

## Phase 1 decision

Keep the existing “Deep Dive” direction: thin editorial typography, dark navy reading surfaces, cyan highlights at the surface, and restrained mint accents at depth. The hero introduces the studio immediately; the featured section repeats the same bioluminescent language. Graphics support readable content, and visitors can pause them. Audio is silent until requested.

The current abstract graphics are authored CSS/SVG/Canvas treatments. They are not photographs, client screenshots, finished 3D creatures, or evidence of shipped client work. No stock or generated client imagery has been substituted for missing material.

## Current inventory

| Asset | Source | Use and status |
|---|---|---|
| Inter Variable, Latin WOFF2 | Installed `@fontsource-variable/inter`, OFL license distributed with package | Self-hosted heading/body font; preloaded; verified by browser tests. |
| JetBrains Mono Variable, Latin WOFF2 | Installed `@fontsource-variable/jetbrains-mono`, OFL license distributed with package | Self-hosted labels and controls; verified by browser tests. |
| Ocean gradient, wave paths, light rays, caustic approximation | Existing component CSS/SVG, revised dark palette | Hero concept retained; static form works without JS. |
| Bubble sprites | Runtime-generated Canvas 2D radial gradients | Cached by size; DPR capped at 2; no external image assets. |
| Skill radar and beacon | Component SVG/CSS | Decorative, hidden from assistive technology. |
| Six project tile placeholders | `ProjectsMidnight.astro` | Numbered abstract placeholders, descriptions explicitly provisional; no case-study links or unverified dates. |
| Luminara featured preview | `FeaturedAbyss.astro` | Explicit concept preview. No award, conversion, or engagement claims. |
| Ambient audio | Runtime-generated brown noise, filtered and faded | Opt-in; no downloaded music or third-party recording. |
| `public/favicon.svg`, `public/favicon.ico` | Existing repository | Retained; brand replacement/approval still needed. |

## Exact content to supply

For **Luminara / Luminara Wellness, Horizon, Cosmo Health, Svayam Semi, CREO Spaces, and Eye Candy**, supply or correct:

1. Publication permission and whether the entry is client work, an internal concept, or should be removed.
2. Approved project/client name, completion year, studio role, services, and a short factual description.
3. A real live URL or enough approved material for a local case-study route. Until then, tiles remain noninteractive previews.
4. Original project screenshots/renders, source filenames, rights holder, and credit requirements. Prefer a landscape cover with room for 16:10 cropping; supply an alternative crop when mobile composition differs.
5. For each image: meaningful alt text, or confirmation that it is decorative; identify any visible client/customer personal data to omit.
6. For any claimed outcome: exact value, measurement period, methodology/source, and approval to publish. No metric is required to tell a useful project story.

For the flagship, also supply the problem, constraints, process, final result, and before/after media if available. The current abstract featured image remains the fallback until approved imagery exists.

Supply an approved SVG studio mark/favicon and a social sharing image with title-safe composition if desired. Current icons are retained repository assets, not a newly approved identity.

## Phase 2 handoff

Start with one hero composition: a legible VennStack title in front of a restrained surface-to-depth light field, with one recognizable authored silhouette. Use the same silhouette/lighting language in the featured scene. Keep project proof as HTML/media. Test the combined scene budget before adding creatures, fluid effects, volumetric passes, or more assets.

Use AVIF/WebP with responsive sizes for project media and reserve dimensions to avoid layout shifts. Introduce compressed 3D assets only with explicit ownership, download/resident-memory budgets, a static poster, and a disposal owner. These are future implementation requirements; Phase 1 includes no Three.js/WebGL dependency.

Asset approval is pending the owner's material. This inventory records what exists and the proposed direction; it does not claim owner approval.
