import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

// Standalone production measurement: run after the regression workers have exited.
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
  if (!file.startsWith(`${root}/`) || !existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  response.end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) });
try {
  const rows = [];
  for (const [name, cores, width, height, dpr] of [['high', 8, 1440, 1000, 1], ['medium', 4, 390, 844, 2.625], ['low', 2, 390, 844, 2.625]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    await page.addInitScript(cores => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: cores });
      Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    }, cores);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => (window.__vennDiagnostics?.().renderer?.frames ?? 0) > 90);
    const measurements = await page.evaluate(async () => {
      const samples = [];
      for (let i = 0; i < 180; i++) {
        await new Promise(done => requestAnimationFrame(done));
        samples.push(window.__vennDiagnostics().renderer);
      }
      const percentile = (key, p) => {
        const values = samples.map(sample => sample[key]).sort((a, b) => a - b);
        return values[Math.floor(values.length * p)];
      };
      return { renderer: samples.at(-1), frameMedianMs: percentile('frameIntervalMs', .5), frameP95Ms: percentile('frameIntervalMs', .95), submitP95Ms: percentile('frameMs', .95), bloomSubmitP95Ms: percentile('bloomMs', .95) };
    });
    rows.push({ requestedTier: name, capabilityOverrides: { cores, memoryGB: 8 }, viewport: { width, height, dpr }, ...measurements });
    await context.close();
  }
  const evidence = { browserVersion: browser.version(), profile: 'Production dist, standalone local HTTP, one context at a time, no CPU/network throttle, 90 warm-up frames then 180 samples. Capability hints overridden to exercise all tiers; not physical-device results. Submission measurements are CPU, not GPU.', rows };
  mkdirSync('tests/.artifacts/phase2-review', { recursive: true });
  writeFileSync('tests/.artifacts/phase2-review/tiers.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
