// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Only repository-authored SVG sources are rasterized; no remote image domains.
  image: { dangerouslyProcessSVG: true },
});
