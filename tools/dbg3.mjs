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
const log = await page.evaluate(() => {
  
  window.__qa.start('meadow', 5, true);
  const qa = window.__qa;
  const rows = [];
  let prev = null;
  for (let k = 0; k < 60 * 3; k++) {
    const t = qa.step(1/60);
    if (!t) break;
    if (k % 6 === 0 || (!prev?.crashed && t.crashed)) {
      const v = qa.vehicle();
      rows.push({
        s: (k/60).toFixed(2), x: +v.pos.x.toFixed(2), y: +v.pos.y.toFixed(2),
        vx: +v.vel.x.toFixed(1), vy: +v.vel.y.toFixed(1), ang: +v.angle.toFixed(2),
        wv: +v.angVel.toFixed(1), g: v.grounded,
        w0: { pen: +v.wheels[0].pen.toFixed(3), load: Math.round(v.wheels[0].load), len: +v.wheels[0].len.toFixed(2) },
        crashed: t.crashed,
      });
    }
    prev = t;
    if (t.crashed) break;
  }
  return rows;
});
console.table ? console.log(JSON.stringify(log, null, 1)) : null;
await browser.close();
