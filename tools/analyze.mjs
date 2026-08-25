#!/usr/bin/env node
/* Numeric art QA: analyze screenshots (palette/composition) and
   in-page painter geometry (vehicle sprite bounds, wheel placement,
   prop painter coverage). Fails loudly on blank/wrong-hue output. */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync } from 'fs';

const DIR = '/home/user/qa-tools/out';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-gpu', '--mute-audio'],
  headless: 'shell',
});
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
await page.evaluate(() => { window.analyze = (dataUrl) => {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.getElementById('c');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const n = d.length / 4;
      let sumL = 0, minL = 1e9, maxL = -1;
      const hueBuckets = new Array(12).fill(0);
      let satSum = 0, colored = 0;
      const colors = new Set();
      const quadL = [0, 0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const L = .2126 * r + .7152 * g + .0722 * b;
        sumL += L; if (L < minL) minL = L; if (L > maxL) maxL = L;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        satSum += sat;
        if (sat > .25 && mx > 40) {
          colored++;
          let h = 0;
          if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6;
          else if (mx === g) h = (b - r) / (mx - mn) + 2;
          else h = (r - g) / (mx - mn) + 4;
          hueBuckets[Math.floor(h * 2) % 12]++;
        }
        if (i % 16 === 0) colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
        const q = (Math.floor(((i / 4) % cv.width) / (cv.width / 2)) + Math.floor(Math.floor((i / 4) / cv.width) / (cv.height / 2))) * 0;
        const px = (i / 4) % cv.width, py = Math.floor((i / 4) / cv.width);
        quadL[(px > cv.width / 2 ? 1 : 0) + (py > cv.height / 2 ? 2 : 0)] += L;
      }
      const W = cv.width, H = cv.height;
      res({
        w: W, h: H,
        avgL: +(sumL / n).toFixed(1), minL: Math.round(minL), maxL: Math.round(maxL),
        avgSat: +(satSum / n).toFixed(3), coloredFrac: +(colored / n).toFixed(3),
        distinctColors: colors.size,
        hueBuckets,
        quadAvgL: quadL.map(q => +(q / (n / 4)).toFixed(1)),
      });
    };
    img.src = dataUrl;
  });
}; });

const files = readdirSync(DIR).filter(f => f.endsWith('.png'));
const report = {};
for (const f of files) {
  const b64 = readFileSync(`${DIR}/${f}`).toString('base64');
  const stats = await page.evaluate((du) => window.analyze(du), `data:image/png;base64,${b64}`);
  report[f] = stats;
  console.log(f, JSON.stringify({ avgL: stats.avgL, sat: stats.avgSat, colored: stats.coloredFrac, colors: stats.distinctColors }));
}

/* ---- checks ---- */
const fails = [];
const expect = (name, cond, msg) => { if (!cond) fails.push(`${name}: ${msg}`); };

for (const [f, s] of Object.entries(report)) {
  expect(f, s.distinctColors > 200, `too few distinct colors (${s.distinctColors}) — looks blank`);
  expect(f, s.avgL > 18 && s.avgL < 235, `suspicious global luminance ${s.avgL}`);
  expect(f, s.coloredFrac > .08, `almost monochrome (coloredFrac ${s.coloredFrac})`);
}
/* ---- in-page painter geometry QA ---- */
await page.goto('http://localhost:8080/?qa=1', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qa, { timeout: 10000 });
const artQA = await page.evaluate(() => {
  const res = { vehicles: [], props: {} };
  // import painters
  return import('/src/vehicleArt.js').then(async (VA) => {
    const { drawVehicle } = VA;
    const { drawProp } = await import('/src/props.js');
    const { VEHICLES } = await import('/src/data.js');

    const mkMock = (def) => ({
      def, damage: 0, angle: 0, pos: { x: 0, y: 0 },
      localToWorld(l) { return { x: l.x, y: l.y }; },
      wheels: [0, 1].map(i => ({
        lx: (i ? 1 : -1) * def.wheelbase / 2, ly: def.bodyY, r: def.wheelR,
        rest: def.wheelR + def.travel * .62, len: def.wheelR + def.travel * .62,
        spin: .6, spinVel: 0, skid: 0, contact: null,
      })),
    });
    for (const def of VEHICLES) {
      const ppm = 150;
      const W = 720, H = 560;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, 210);
      ctx.scale(ppm, -ppm);
      drawVehicle(ctx, mkMock(def), { time: 0, night: false, helmet: def.helmet, helmetAccent: def.helmetAccent });
      ctx.restore();
      const img = ctx.getImageData(0, 0, W, H).data;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, ink = 0, bright = 0;
      for (let i = 0; i < img.length; i += 4) {
        const x = (i / 4) % W, y = Math.floor(i / 4 / W);
        // pixel differs from pure black bg?
        if (img[i] + img[i + 1] + img[i + 2] > 24) {
          ink++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (img[i] + img[i + 1] + img[i + 2] > 380) bright++;
        }
      }
      const wheelPix = [];
      for (const wh of mkMock(def).wheels) {
        // wheel center in canvas px (y flip)
        const cx = W / 2 + wh.lx * ppm, cy = 210 - (wh.ly - wh.len) * ppm;
        let hit = 0, tot = 0;
        for (let a = 0; a < 24; a++) {
          for (let rr = .3; rr <= .95; rr += .3) {
            const px = Math.round(cx + Math.cos(a) * wh.r * rr * ppm);
            const py = Math.round(cy + Math.sin(a) * wh.r * rr * ppm);
            const idx = (py * W + px) * 4;
            tot++;
            if (img[idx] + img[idx + 1] + img[idx + 2] > 24) hit++;
          }
        }
        wheelPix.push(+(hit / tot).toFixed(2));
      }
      res.vehicles.push({
        id: def.id,
        bboxM: { w: +((maxX - minX) / ppm).toFixed(2), h: +((maxY - minY) / ppm).toFixed(2) },
        inkFrac: +(ink / (W * H)).toFixed(3), brightFrac: +(bright / (W * H)).toFixed(3),
        bboxInk: +(ink / (ppm * ppm)).toFixed(2), // ink px² in meter²
        wheelFill: wheelPix,
      });
    }
    // props
    const keys = ['tree', 'pine', 'bush', 'rock', 'fence', 'hay', 'saguaro', 'cactusSmall', 'mesaRock', 'skull', 'sign', 'tumbleweed', 'lamp', 'hydrant', 'barrier', 'dumpster', 'pineSnow', 'iceRock', 'deadTree', 'snowman'];
    for (const key of keys) {
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, 300, 300);
      ctx.save();
      ctx.translate(150, 290);
      ctx.scale(30, -30);
      drawProp(ctx, { key, scale: 6, flip: false, phase: .5 }, 0, { id: 'city' }, 0);
      ctx.restore();
      const img = ctx.getImageData(0, 0, 300, 300).data;
      let ink = 0, minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i] + img[i + 1] + img[i + 2] > 90) {
          ink++;
          const x = (i / 4) % 300, y = Math.floor(i / 4 / 300);
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
      }
      res.props[key] = { inkFrac: +(ink / 90000).toFixed(3), w: maxX - minX, h: maxY - minY, grounded: minY > 230 ? (300 - minY) : -1 };
    }
    return res;
  });
});
console.log('ART QA:', JSON.stringify(artQA, null, 1));

/* ---- deterministic biome scene composition (parked car, no HUD) ---- */
const biomeQA = await page.evaluate(async () => {
  const { Renderer } = await import('/src/render.js');
  const { World } = await import('/src/world.js');
  const { Vehicle } = await import('/src/physics.js');
  const { VEHICLES, BIOMES } = await import('/src/data.js');
  const { Particles } = await import('/src/particles.js');
  const out = {};
  for (const biome of BIOMES) {
    const cv = document.createElement('canvas');
    cv.width = 1280; cv.height = 720;
    Object.defineProperty(cv, 'clientWidth', { value: 1280 });
    Object.defineProperty(cv, 'clientHeight', { value: 720 });
    const r = new Renderer(cv);
    const world = new World(biome, 777, 0);
    world.ensure(80);
    const def = VEHICLES[0];
    const v = new Vehicle(def, { engine: 0, susp: 0, tires: 0, tank: 0, awd: 0 }, world);
    v.pos.x = 60; v.pos.y = world.heightAt(60) + def.wheelR + .4;
    for (let i = 0; i < 240; i++) v.step(1 / 60, {}); // settle
    const state = {
      world, vehicle: v,
      camera: { x: v.pos.x + 3, y: v.pos.y + 1.2, zoom: 1, shx: 0, shy: 0 },
      time: 4.2, particles: new Particles(), bestDist: 0, crashFade: 0, lowFuelPulse: false,
    };
    r.draw(state);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rows = {};
    const third = (y0, y1) => {
      const d = ctx.getImageData(0, Math.floor(720 * y0), 1280, Math.floor(720 * (y1 - y0))).data;
      let L = 0, sat = 0, n = d.length / 4;
      const hue = new Array(12).fill(0);
      for (let i = 0; i < d.length; i += 4) {
        const rr = d[i], gg = d[i + 1], bb = d[i + 2];
        L += .2126 * rr + .7152 * gg + .0722 * bb;
        const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
        const s = mx === 0 ? 0 : (mx - mn) / mx;
        sat += s;
        if (s > .22 && mx > 40) {
          let h;
          if (mx === rr) h = ((gg - bb) / (mx - mn) + 6) % 6;
          else if (mx === gg) h = (bb - rr) / (mx - mn) + 2;
          else h = (rr - gg) / (mx - mn) + 4;
          hue[Math.floor(h * 2) % 12]++;
        }
      }
      const tot = hue.reduce((a, b) => a + b, 0) || 1;
      return { L: Math.round(L / n), sat: +(sat / n).toFixed(2), hue: hue.map(h => +(h / tot).toFixed(2)) };
    };
    out[biome.id] = { top: third(0, .38), mid: third(.38, .62), ground: third(.62, 1) };
  }
  return out;
});
console.log('BIOME QA:', JSON.stringify(biomeQA, null, 1));
const biomeChecks = {
  meadow: { groundGreen: (b) => b.ground.hue[3] + b.ground.hue[4] > .12, skyBlue: (b) => b.top.hue[6] + b.top.hue[7] > .15 },
  desert: { warm: (b) => b.mid.hue[0] + b.mid.hue[1] + b.mid.hue[2] > .3, groundWarm: (b) => b.ground.hue[0] + b.ground.hue[1] > .18 },
  city: { dark: (b) => b.top.L < 90, lit: (b) => b.top.sat > .1 },
  frost: { brightGround: (b) => b.ground.L > 150, paleSky: (b) => b.top.L > 80 },
};
for (const [bid, checks] of Object.entries(biomeChecks)) {
  for (const [name, fn] of Object.entries(checks)) {
    expect(`biome ${bid} ${name}`, !!fn(biomeQA[bid]), JSON.stringify(biomeQA[bid]).slice(0, 220));
  }
}

for (const v of artQA.vehicles) {
  const bboxArea = v.bboxM.w * v.bboxM.h;
  const fillRatio = v.bboxInk / Math.max(1e-6, bboxArea);
  expect(`vehicle ${v.id}`, fillRatio > .18 && fillRatio < .95, `bbox fill ratio ${fillRatio.toFixed(2)} (sprite broken?)`);
  expect(`vehicle ${v.id}`, v.bboxM.w > 2 && v.bboxM.w < 5.5, `width ${v.bboxM.w} m`);
  expect(`vehicle ${v.id}`, v.bboxM.h > .8 && v.bboxM.h < 2.6, `height ${v.bboxM.h} m`);
  expect(`vehicle ${v.id} wheels`, v.wheelFill.every(f => f > .92), `wheel fill ${v.wheelFill}`);
}
for (const [k, p] of Object.entries(artQA.props)) {
  expect(`prop ${k}`, p.inkFrac > .002, `no pixels drawn (${p.inkFrac})`);
  expect(`prop ${k}`, p.h > 20 && p.h < 290, `height px ${p.h}`);
}

console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nALL ART CHECKS PASSED');
await browser.close();
process.exit(fails.length ? 1 : 0);
