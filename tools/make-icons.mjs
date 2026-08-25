import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('/home/user/Rush-Track-/assets/img', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qa, { timeout: 10000 });

const dataUrls = await page.evaluate(async () => {
  const { drawVehicle } = await import('/src/vehicleArt.js');
  const { VEHICLES } = await import('/src/data.js');

  const render = (S) => {
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    // sunset sky
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#1d2b60'); g.addColorStop(.42, '#e8623c'); g.addColorStop(.62, '#ffb423'); g.addColorStop(1, '#ffd985');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const u = S / 512;
    // sun
    const sunG = ctx.createRadialGradient(S * .5, S * .56, 6, S * .5, S * .56, 150 * u);
    sunG.addColorStop(0, 'rgba(255,246,210,.95)'); sunG.addColorStop(.4, 'rgba(255,220,140,.45)'); sunG.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = sunG; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(S * .5, S * .56, 74 * u, 0, Math.PI * 2); ctx.fill();
    // far dunes
    ctx.fillStyle = '#8a3f3a';
    ctx.beginPath(); ctx.moveTo(0, S * .68);
    ctx.quadraticCurveTo(S * .3, S * .55, S * .62, S * .68);
    ctx.quadraticCurveTo(S * .85, S * .76, S, S * .66);
    ctx.lineTo(S, S); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
    // near dune
    ctx.fillStyle = '#3a1f2e';
    ctx.beginPath(); ctx.moveTo(0, S * .84);
    ctx.quadraticCurveTo(S * .34, S * .68, S * .72, S * .82);
    ctx.quadraticCurveTo(S * .88, S * .88, S, S * .84);
    ctx.lineTo(S, S); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
    // speed streaks
    ctx.globalAlpha = .5;
    for (let i = 0; i < 3; i++) {
      const gg = ctx.createLinearGradient(S * .62, 0, S, 0);
      gg.addColorStop(0, 'rgba(255,240,200,.0)'); gg.addColorStop(1, 'rgba(255,240,200,.8)');
      ctx.fillStyle = gg;
      ctx.fillRect(S * .6, S * .3 + i * 26 * u, S * .36, 7 * u);
    }
    ctx.globalAlpha = 1;
    // buggy mid-jump (nose up)
    const def = VEHICLES[0];
    const mock = {
      def, damage: 0, angle: .22, pos: { x: 0, y: 0 },
      localToWorld(l) {
        const c = Math.cos(this.angle), s = Math.sin(this.angle);
        return { x: this.pos.x + l.x * c - l.y * s, y: this.pos.y + l.x * s + l.y * c };
      },
      vel: { x: 0, y: 0 }, angVel: 0,
      wheels: [0, 1].map(i => ({
        lx: (i ? 1 : -1) * def.wheelbase / 2, ly: def.bodyY, r: def.wheelR,
        rest: def.wheelR + def.travel * .62, len: def.wheelR + def.travel * .62,
        spin: 2.2, spinVel: 0, skid: 0, contact: null, pen: 0,
      })),
    };
    const ppm = S / 4.9;
    ctx.save();
    ctx.translate(S * .5, S * .52);
    ctx.scale(ppm, -ppm);
    drawVehicle(ctx, mock, { time: 1, night: false, throttle: 1, helmet: def.helmet, helmetAccent: def.helmetAccent });
    ctx.restore();
    // dust puff behind rear wheel
    ctx.fillStyle = 'rgba(255,220,170,.7)';
    for (let i = 0; i < 5; i++) {
      const r = (10 + i * 7) * u;
      ctx.beginPath(); ctx.arc(S * .18 - i * 26 * u, S * .78 - i * 8 * u, r, 0, Math.PI * 2); ctx.fill();
    }
    return cv.toDataURL('image/png');
  };
  return { 512: render(512), 192: render(192) };
});

writeFileSync('/home/user/Rush-Track-/assets/img/icon-512.png', Buffer.from(dataUrls[512].split(',')[1], 'base64'));
writeFileSync('/home/user/Rush-Track-/assets/img/icon-192.png', Buffer.from(dataUrls[192].split(',')[1], 'base64'));
console.log('icons written');
await browser.close();
