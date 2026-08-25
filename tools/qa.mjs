#!/usr/bin/env node
/* ============================================================
   QA harness: headless screenshots + autopilot physics soak.
   Usage: node qa.mjs [--shots] [--soak] [--err]
   Writes to /home/user/qa-tools/out/
   ============================================================ */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:8080';
const OUT = '/home/user/qa-tools/out';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});

const results = { pageErrors: [], consoleErrors: [] };

async function newPage(w, h) {
  const page = await browser.newPage();
  page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => results.pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text()); });
  return page;
}

const mode = process.argv[2] || '--shots';

if (mode === '--shots' || mode === '--all') {
  const page = await newPage(1280, 720);
  await page.goto(BASE + '/?qa=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__qa && document.fonts.status === 'loaded', { timeout: 15000 });
  await sleep(1400); // boot screen animates in

  const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });

  await shot('01-boot');
  await page.evaluate(() => { window.__qa.showTitle(); });
  await sleep(1600);
  await shot('02-title');

  await page.evaluate(() => { window.__qa.showStages(); });
  await sleep(600);
  await shot('03-stages');

  await page.evaluate(() => { window.__qa.ui.showGarage(); });
  await sleep(600);
  await shot('04-garage');

  // gameplay per biome: drive a bit w/ autopilot then freeze & shoot
  for (const [i, biome] of ['meadow', 'desert', 'city', 'frost'].entries()) {
    await page.evaluate((b) => {
      window.__qa.start(b, 1234, true);
    }, biome);
    // simulate ~22 s of driving in fast-forward
    for (let k = 0; k < 60 * 22; k++) {
      const alive = await page.evaluate(() => window.__qa.step(1 / 60) !== null);
      if (!alive) break;
    }
    await page.evaluate(() => { /* render one frame naturally */ });
    await sleep(400);
    await shot(`10-run-${biome}`);
    const tel = await page.evaluate(() => window.__qa.telemetry());
    console.log(`run ${biome}:`, JSON.stringify(tel));
  }

  // crashed state shot: start meadow and force crash via tumbling torque
  await page.evaluate(() => {
    window.__qa.start('meadow', 99, false);
    // drive up a ramp then hold brake in air to nose-slam
    for (let k = 0; k < 60 * 30; k++) {
      const t = window.__qa.step(1 / 60);
      if (t && t.crashed) break;
    }
  });
  await sleep(600);
  await shot('90-crash-attempt');

  // results screen
  await page.evaluate(() => {
    window.__qa.ui.showResults({ cause: 'crash', title: 'WIPEOUT!', dist: 742, isRecord: true, earn: { dist: 53, pickups: 64, stunts: 120 } });
  });
  await sleep(1800);
  await shot('05-results');

  // pause overlay
  await page.evaluate(() => {
    window.__qa.start('desert', 55, true);
    for (let k = 0; k < 60 * 6; k++) window.__qa.step(1 / 60);
    window.__qa.ui.showPause('742 m · 320 coins');
  });
  await sleep(500);
  await shot('06-pause');

  // portrait phone viewport
  const mob = await newPage(932, 430);
  await mob.goto(BASE + '/?qa=1', { waitUntil: 'networkidle0' });
  await mob.waitForFunction(() => window.__qa, { timeout: 15000 });
  await sleep(1200);
  await mob.evaluate(() => window.__qa.start('meadow', 7, true));
  for (let k = 0; k < 60 * 14; k++) await mob.evaluate(() => window.__qa.step(1 / 60));
  await sleep(400);
  await mob.screenshot({ path: `${OUT}/07-phone-landscape.png` });
  await mob.close();
  await page.close();
}

if (mode === '--soak' || mode === '--all') {
  const page = await newPage(1280, 720);
  await page.goto(BASE + '/?qa=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__qa, { timeout: 15000 });
  const seeds = [1, 42, 777, 31337];
  const report = [];
  for (const biome of ['meadow', 'desert', 'city', 'frost']) {
    for (const seed of seeds) {
      const tel = await page.evaluate(async (b, s) => {
        window.__qa.start(b, s, true);
        let last = null;
        for (let k = 0; k < 60 * 90; k++) {          // 90 s simulated
          last = window.__qa.step(1 / 60);
          if (!last) break;
          if (last.crashed) break;
        }
        return last;
      }, biome, seed);
      report.push({ biome, seed, ...tel });
      console.log(biome, seed, JSON.stringify(tel));
    }
  }
  writeFileSync(`${OUT}/soak.json`, JSON.stringify(report, null, 2));
  await page.close();
}

await browser.close();
console.log('QA DONE. console errors:', results.consoleErrors.length, results.consoleErrors.slice(0, 5));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
