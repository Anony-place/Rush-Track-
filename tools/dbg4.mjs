import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qa, { timeout: 10000 });
const out = await page.evaluate(() => {
  window.__qa.start('meadow', 5, true);
  const qa = window.__qa;
  const v = qa.vehicle(), w = v.world;
  const probe = [];
  for (let k = 0; k < 30; k++) {
    const step = k === 0 ? null : qa.step(1/240);
    const c = Math.cos(v.angle), s = Math.sin(v.angle);
    for (const [i, wh] of v.wheels.entries()) {
      const ax = v.pos.x + wh.lx * c - wh.ly * s;
      const ay = v.pos.y + wh.lx * s + wh.ly * c;
      const cy = ay - c * wh.len;
      const cx = ax + s * wh.len;
      const n = w.normalAt(cx);
      const sy = w.heightAt(cx);
      const d = (cy - sy) * n.y;
      probe.push({ k, i, ax: +ax.toFixed(2), ay: +ay.toFixed(2), cx: +cx.toFixed(2), cy: +cy.toFixed(2), sy: +sy.toFixed(2), ny: +n.y.toFixed(2), d: +d.toFixed(3), r: wh.r, pen: +(wh.r - d).toFixed(3) });
    }
    if (k > 6) break;
  }
  return probe.slice(0, 16);
});
console.log(JSON.stringify(out, null, 0));
await browser.close();
