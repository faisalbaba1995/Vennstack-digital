import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) });
const output = 'tests/.artifacts/phase2-review';
mkdirSync(output, { recursive: true });
const evidence = [];
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  for (const mode of ['enhanced', 'reduced', 'static', 'failure']) {
    const context = await browser.newContext({ viewport, javaScriptEnabled: mode !== 'static', reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    if (mode === 'enhanced') await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
      Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    });
    if (mode === 'failure') await page.route(/renderer.*\.js/, route => route.abort());
    await page.goto('http://127.0.0.1:4173/');
    if (mode === 'enhanced') await page.waitForFunction(() => (window.__vennDiagnostics?.().renderer?.frames ?? 0) > 90);
    if (mode === 'failure') await page.waitForFunction(() => document.documentElement.dataset.renderer === 'failed');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${name}-${mode}.png` });
    if (mode === 'enhanced') {
      const samples = await page.evaluate(async () => {
        const rows = [];
        for (let i = 0; i < 120; i++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          rows.push(window.__vennDiagnostics?.().renderer);
        }
        return rows;
      });
      evidence.push({ name, mode, browser: browser.version(), capabilityOverride: '8 logical cores, 8 GB memory; actual WebGL capabilities unchanged', samples });
    }
    if (mode === 'reduced') {
      await page.locator('#projects').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${name}-projects.png` });
      await page.goto('http://127.0.0.1:4173/work/luminara/');
      await page.screenshot({ path: `${output}/${name}-case.png`, fullPage: true });
    }
    await context.close();
  }
}
writeFileSync(`${output}/measurements.json`, JSON.stringify(evidence, null, 2));
await browser.close();
console.log(`Review screenshots and measured high/medium-tier samples: ${output}`);
