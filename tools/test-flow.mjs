import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qa, { timeout: 15000 });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const step = async (label, fn) => {
  try { const v = await fn(); console.log('✓', label, v ?? ''); return v; }
  catch (e) { console.log('✗', label, String(e).slice(0, 300)); process.exitCode = 1; }
};

await sleep(1500); // boot
await step('title visible', () => page.waitForSelector('#title-screen:not(.hidden)', { timeout: 4000 }).then(() => 'ok'));
await step('click PLAY → stages', async () => {
  await page.evaluate(() => window.__qa.ui.screens.title.querySelectorAll('.btn')[0].click());
  await page.waitForSelector('#stage-screen:not(.hidden)', { timeout: 3000 });
  return 'stage screen shown';
});
await step('meadow card starts run', async () => {
  await page.evaluate(() => document.querySelector('.stage-card[data-biome=meadow]').click());
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 3000 });
  return 'HUD shown';
});
await step('countdown present then driving', async () => {
  const st1 = await page.evaluate(() => window.__qa && document.querySelector('#hud'));
  await page.keyboard.down('ArrowRight');
  await sleep(6500); // countdown 3.6s + a bit of driving
  const tel = await page.evaluate(() => window.__qa.telemetry ? window.__qa.telemetry() : 'n/a');
  return JSON.stringify(tel);
});
await step('pause overlay', async () => {
  await page.evaluate(() => document.querySelector('#hud-pause').click());
  await page.waitForSelector('#pause-screen:not(.hidden)', { timeout: 2000 });
  return 'paused';
});
await step('resume', async () => {
  await page.evaluate(() => window.__qa.ui.screens.pause.querySelectorAll('.oc-actions .btn')[0].click());
  await sleep(300);
  const hidden = await page.evaluate(() => document.querySelector('#pause-screen').classList.contains('hidden'));
  return hidden ? 'resumed' : 'STILL PAUSED';
});
await step('drive until fuel-out or crash (max 75 s)', async () => {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < 75000) {
    last = await page.evaluate(() => window.__qa.telemetry());
    if (last.crashed) break;
    if (last.fuel <= 0 && last.speed < 1) break;
    await sleep(1000);
  }
  return JSON.stringify(last);
});
await step('results screen appears', async () => {
  await page.waitForSelector('#results-screen:not(.hidden)', { timeout: 9000 });
  return await page.evaluate(() => document.querySelector('#res-dist').textContent + ' m, earned ' + document.querySelector('.earn-total .r span').textContent);
});
await step('coins persisted to save', async () => {
  return await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('rushtrack.save.v1'));
    return 'save coins=' + s.coins + ' best.meadow=' + s.best.meadow + ' totalDist=' + s.totalDist;
  });
});
await step('retry restarts run', async () => {
  await page.evaluate(() => window.__qa.ui.screens.results.querySelectorAll('.oc-actions .btn')[0].click());
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 3000 });
  return 'run restarted';
});
await step('quit to title', async () => {
  await page.evaluate(() => { window.__qa.ui.showPause(''); window.__qa.ui.screens.pause.querySelectorAll('.oc-actions .btn')[2].click(); });
  await page.waitForSelector('#title-screen:not(.hidden)', { timeout: 3000 });
  return 'back at title';
});
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'NO PAGE ERRORS');
await browser.close();
