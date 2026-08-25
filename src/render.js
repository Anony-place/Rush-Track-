/* ============================================================
   Environment renderer: sky, celestial, clouds, parallax
   ridges & skylines, terrain with strata & dressing, pickups,
   distance flags, vehicle shadow, weather & screen effects.
   ============================================================ */
import { fbm, mulberry32, clamp, lerp, TAU, fmt } from './util.js';
import { drawProp } from './props.js';
import { PROP_SPEC } from './world.js';
import { drawVehicle } from './vehicleArt.js';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this._cloudSeeds = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = this.cv.clientWidth; this.h = this.cv.clientHeight;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
  }

  /* world→screen helpers (camera: x,y world center; zoom; shake) */
  ppm() { return (this.h / 10.5) * this.cam.zoom; }
  toScreenX(wx) { return (wx - this.cam.x) * this.ppm() + this.w / 2 + this.cam.shx; }
  toScreenY(wy) { return this.h * .62 - (wy - this.cam.y) * this.ppm() + this.cam.shy; }

  /* ================= main frame ================= */
  draw(state) {
    const { ctx } = this;
    this.cam = state.camera; this.t = state.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const b = state.world.biome;
    this.night = b.id === 'city';
    this._sky(b);
    this._celestial(b);
    if (this.night || b.id === 'frost') this._stars(b);
    if (b.id === 'frost') this._aurora(b);
    this._clouds(b);
    this._ridges(b, state);
    this._terrain(state);
    this._props(state, 'back');
    this._pickups(state);
    this._flags(state);
    this._vehicleShadow(state);
    state.vehicle && this._vehicle(state);
    this._props(state, 'front');
    this._particles(state);
    this._weather(state);
    this._vignette(state);
  }

  _particles(state) {
    if (!state.particles) return;
    const ppm = this.ppm();
    this._withWorldTransform(() => state.particles.draw(this.ctx, ppm));
  }

  /* ================= sky ================= */
  _sky(b) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.h * .85);
    g.addColorStop(0, b.sky[0]); g.addColorStop(.55, b.sky[1]); g.addColorStop(1, b.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  _celestial(b) {
    const { ctx } = this;
    const s = b.sun;
    const cx = this.w * s.x, cy = this.h * s.y;
    const R = s.r * (this.h / 540);
    const glow = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R * 4.2);
    glow.addColorStop(0, s.glow); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R * 4.2, cy - R * 4.2, R * 8.4, R * 8.4);
    ctx.fillStyle = s.core;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    if (s.moon) {
      ctx.fillStyle = 'rgba(140, 160, 210, .25)';
      ctx.beginPath(); ctx.arc(cx - R * .3, cy - R * .2, R * .22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + R * .25, cy + R * .3, R * .15, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + R * .1, cy - R * .42, R * .1, 0, TAU); ctx.fill();
      // crescent bite
      const skyg = ctx.createLinearGradient(0, 0, 0, this.h * .5);
      skyg.addColorStop(0, b.sky[0]); skyg.addColorStop(1, b.sky[1]);
      ctx.fillStyle = skyg;
      ctx.beginPath(); ctx.arc(cx + R * .55, cy - R * .35, R * .85, 0, TAU); ctx.fill();
    } else {
      // sun rays
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.t * .02);
      ctx.strokeStyle = 'rgba(255, 246, 210, .18)'; ctx.lineWidth = R * .1;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 1.35, Math.sin(a) * R * 1.35);
        ctx.lineTo(Math.cos(a) * R * 1.9, Math.sin(a) * R * 1.9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _stars(b) {
    const { ctx } = this;
    const rng = mulberry32(1234);
    const n = this.night ? 90 : 40;
    const alpha = this.night ? 1 : .5;
    for (let i = 0; i < n; i++) {
      const x = rng() * this.w, y = rng() * this.h * .5;
      const r = rng() * 1.4 + .4;
      const tw = .5 + .5 * Math.sin(this.t * (1 + rng() * 2) + i * 7.3);
      ctx.globalAlpha = alpha * (.35 + .65 * tw) * (1 - y / (this.h * .6));
      ctx.fillStyle = i % 11 === 0 ? '#bfe0ff' : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _clouds(b) {
    if (this.night) return;
    const { ctx } = this;
    if (!this._cloudSeeds) {
      const rng = mulberry32(77);
      this._cloudSeeds = Array.from({ length: 7 }, () => ({
        x: rng(), y: .06 + rng() * .3, s: .5 + rng() * .9, v: .004 + rng() * .01,
      }));
    }
    const wispy = b.id === 'frost';
    for (const c of this._cloudSeeds) {
      let cx = ((c.x + this.t * c.v) % 1.3) - .15;
      const cy = c.y * this.h, s = c.s * (this.h / 540);
      ctx.globalAlpha = wispy ? .3 : .85;
      if (wispy) {
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 6 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx * this.w - 130 * s, cy);
        ctx.quadraticCurveTo(cx * this.w, cy - 18 * s, cx * this.w + 150 * s, cy - 6 * s);
        ctx.stroke();
      } else {
        const puffs = [[0, 0, 46], [-52, 8, 30], [50, 10, 32], [-18, -20, 34], [24, -16, 28]];
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        for (const [dx, dy, r] of puffs) {
          ctx.beginPath(); ctx.arc(cx * this.w + dx * s, cy + dy * s, r * s, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(190, 205, 230,.5)';
        for (const [dx, dy, r] of puffs) {
          ctx.beginPath(); ctx.arc(cx * this.w + dx * s, cy + dy * s + r * s * .45, r * s * .8, 0, Math.PI); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ============ parallax ridge / skyline layers ============ */
  _ridges(b, state) {
    const { ctx } = this;
    const horizon = this.h * .62;
    const layers = [
      { def: b.far, par: .16, y0: horizon - this.h * .1, haze: .85 },
      { def: b.mid, par: .34, y0: horizon - this.h * .02, haze: .55 },
    ];
    for (const L of layers) {
      if (L.def.skyline) { this._skyline(L, b); }
      else {
        const step = 10;
        ctx.beginPath();
        ctx.moveTo(-4, this.h + 4);
        const ppm = this.ppm(), camX = this.cam.x;
        for (let sx = -4; sx <= this.w + 4; sx += step) {
          const wx = camX * L.par + (sx - this.w / 2) / (ppm * 2.2);
          const y = L.y0 - fbm(wx / (L.def.wl / 40), b.seed + L.par * 100, 3) * (L.def.amp / 40) * this.h * .55;
          ctx.lineTo(sx, y);
        }
        ctx.lineTo(this.w + 4, this.h + 4);
        ctx.closePath();
        ctx.fillStyle = L.def.color;
        ctx.fill();
        if (L.def.snow) this._ridgeSnow(L, b);
      }
      // atmospheric haze at base
      const hz = ctx.createLinearGradient(0, L.y0 - this.h * .12, 0, this.h * .62 + this.h * .08);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(1, b.hazeColor);
      ctx.fillStyle = hz;
      ctx.globalAlpha = L.haze * .8;
      ctx.fillRect(0, L.y0 - this.h * .12, this.w, this.h * .3);
      ctx.globalAlpha = 1;
    }
    // near hill band (just behind terrain)
    ctx.beginPath();
    ctx.moveTo(-4, this.h + 4);
    const ppm2 = this.ppm();
    const hillY = (sx) => {
      const wx = this.cam.x * .6 + (sx - this.w / 2) / (ppm2 * 1.1);
      return this.h * .62 + this.h * .06 - fbm(wx / 9, b.seed + 55, 3) * this.h * .16;
    };
    for (let sx = -4; sx <= this.w + 4; sx += 8) ctx.lineTo(sx, hillY(sx));
    ctx.lineTo(this.w + 4, this.h + 4);
    ctx.closePath();
    ctx.fillStyle = b.hills.color;
    ctx.fill();
    // silhouette trees / details riding the near hill line
    if (b.id === 'meadow' || b.id === 'frost' || b.id === 'desert') {
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.fillStyle = b.hills.dark;
      const stepPx = 46;
      const i0 = Math.floor((this.cam.x * .6 - 12) / (stepPx / (ppm2 * 1.1)));
      for (let i = i0; (i - i0) * stepPx < this.w + stepPx * 2; i++) {
        const r = mulberry32(((i * 2654435761) ^ b.seed) >>> 0)();
        if (r < .35) continue;
        const sx = (i - i0) * stepPx - stepPx;
        const y = hillY(sx);
        const hgt = 14 + r * 26, wdt = hgt * (b.id === 'desert' ? 1.4 : .55);
        ctx.beginPath();
        if (b.id === 'meadow' || b.id === 'frost') {
          ctx.moveTo(sx - wdt, y + 2);
          ctx.lineTo(sx, y - hgt);
          ctx.lineTo(sx + wdt, y + 2);
          ctx.closePath();
        } else {
          ctx.ellipse(sx, y - hgt * .2, wdt, hgt * .5, 0, Math.PI, 0);
        }
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Procedural city skyline with lit windows, antennas, beacons. */
  _skyline(L, b) {
    const { ctx } = this;
    const baseY = this.h * .62 + this.h * .05;
    const unit = 90; // px per building cell at this layer
    const off = this.cam.x * L.par;
    const i0 = Math.floor(off / unit) - 1;
    const n = Math.ceil(this.w / unit) + 3;
    ctx.save();
    for (let k = 0; k < n; k++) {
      const idx = i0 + k;
      const rng = mulberry32(((idx * 7919) ^ (b.seed + Math.round(L.par * 1000))) >>> 0);
      const bw = unit * (.55 + rng() * .35);
      const bh = this.h * (.16 + rng() * .34) * (L.par > .25 ? 1.15 : .85);
      const sx = idx * unit - off;
      // body
      ctx.fillStyle = L.def.color;
      ctx.fillRect(sx, baseY - bh, bw, bh + 40);
      // subtle top highlight
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(sx, baseY - bh, bw, 4);
      // window grid
      const cols = Math.max(2, Math.floor(bw / 12));
      const rows = Math.max(3, Math.floor(bh / 14));
      const litBase = L.par > .25 ? .3 : .18;
      for (let cy2 = 0; cy2 < rows; cy2++) {
        for (let cx2 = 0; cx2 < cols; cx2++) {
          const lit = rng() < litBase + (cy2 < rows * .4 ? .1 : 0);
          if (!lit) continue;
          const flick = rng() < .05 ? .4 + .6 * Math.abs(Math.sin(this.t * 3 + idx)) : 1;
          ctx.globalAlpha = (.35 + rng() * .5) * flick;
          ctx.fillStyle = rng() < .18 ? '#9fe8ff' : '#ffe2a0';
          const wx = sx + 4 + cx2 * (bw - 8) / cols;
          const wy = baseY - bh + 6 + cy2 * (bh - 10) / rows;
          ctx.fillRect(wx, wy, Math.max(2, (bw - 8) / cols - 3), Math.max(2.5, (bh - 10) / rows - 5));
        }
      }
      ctx.globalAlpha = 1;
      // antenna + beacon
      if (rng() < .4) {
        ctx.strokeStyle = L.def.color; ctx.lineWidth = 2.5;
        const ax = sx + bw / 2;
        const antH = 16 + rng() * 22;
        ctx.beginPath(); ctx.moveTo(ax, baseY - bh); ctx.lineTo(ax, baseY - bh - antH); ctx.stroke();
        const blink = .5 + .5 * Math.sin(this.t * 2.4 + idx * 1.7);
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#ff5a5f';
        ctx.beginPath(); ctx.arc(ax, baseY - bh - antH - 2, 2.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /** Snow caps along a ridge layer. */
  _ridgeSnow(L, b) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = .85;
    ctx.fillStyle = 'rgba(245, 250, 255, .9)';
    const ppm = this.ppm();
    for (let sx = -4; sx <= this.w + 4; sx += 10) {
      const wx = this.cam.x * L.par + (sx - this.w / 2) / (ppm * 2.2);
      const y = L.y0 - fbm(wx / (L.def.wl / 40), b.seed + L.par * 100, 3) * (L.def.amp / 40) * this.h * .55;
      const r = mulberry32(Math.abs(Math.floor(wx * 3)) + 11)();
      ctx.beginPath(); ctx.ellipse(sx, y + 3, 8 + r * 16, 4 + r * 5, 0, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
  }

  /** Aurora bands (frost sky). */
  _aurora(b) {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const yBase = this.h * (0.12 + band * .07);
      const g = ctx.createLinearGradient(0, yBase - 40, 0, yBase + 60);
      const hue = band === 1 ? '110, 255, 190' : band === 2 ? '80, 220, 255' : '150, 255, 160';
      const pulse = 0.05 + 0.035 * Math.sin(this.t * .7 + band * 2.1);
      g.addColorStop(0, `rgba(${hue}, 0)`);
      g.addColorStop(.5, `rgba(${hue}, ${pulse.toFixed(3)})`);
      g.addColorStop(1, `rgba(${hue}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, yBase + 60);
      for (let sx = -10; sx <= this.w + 10; sx += 26) {
        const wave = fbm(sx / 240 + this.t * .05 + band * 9, b.seed + band, 2) * 34;
        ctx.lineTo(sx, yBase + wave);
      }
      ctx.lineTo(this.w + 10, yBase + 60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ================= terrain ================= */
  _terrain(state) {
    const { ctx, cam } = this;
    const world = state.world, b = world.biome;
    const ppm = this.ppm();
    const x0 = cam.x - (this.w / 2) / ppm - 4, x1 = cam.x + (this.w / 2) / ppm + 4;
    const stepPx = 6;
    const stepM = stepPx / ppm;
    const samples = [];
    for (let x = x0; x <= x1; x += stepM) samples.push({ x, y: world.heightAt(x) });

    const toS = (wx, wy) => [this.toScreenX(wx), this.toScreenY(wy)];

    // soil body
    ctx.beginPath();
    let [sx, sy] = toS(samples[0].x, samples[0].y);
    ctx.moveTo(sx, sy);
    for (const s of samples) { [sx, sy] = toS(s.x, s.y); ctx.lineTo(sx, sy); }
    ctx.lineTo(this.w + 8, this.h + 8);
    ctx.lineTo(-8, this.h + 8);
    ctx.closePath();
    const soilDepthPx = this.h * .5;
    const g = ctx.createLinearGradient(0, this.toScreenY(0) - 40, 0, this.toScreenY(0) + soilDepthPx);
    g.addColorStop(0, b.ground.soil);
    g.addColorStop(1, b.ground.soilDark);
    ctx.fillStyle = g;
    ctx.fill();

    // strata bands
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = .25;
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = b.ground.rock;
      ctx.lineWidth = 14 + i * 10;
      ctx.beginPath();
      let first = true;
      for (const s of samples) {
        const [px, py] = toS(s.x, s.y - .55 - i * .78);
        first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        first = false;
      }
      ctx.stroke();
    }
    // speckle stones
    ctx.globalAlpha = .5;
    for (const s of samples) {
      if ((Math.floor(s.x * 7.3) & 7) !== 0) continue;
      const r = mulberry32(Math.abs(Math.floor(s.x * 13)) + 5)();
      const [px, py] = toS(s.x + r * .8, s.y - .8 - r * 2.6);
      ctx.fillStyle = b.ground.rock;
      ctx.beginPath(); ctx.ellipse(px, py, 3 + r * 5, 2 + r * 3.4, r * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // top cover band
    const bandPx = Math.max(10, .5 * ppm);
    const coverPath = () => {
      ctx.beginPath();
      let first = true;
      for (const s of samples) {
        const [px, py] = toS(s.x, s.y + .12);
        first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        first = false;
      }
    };
    coverPath();
    ctx.strokeStyle = b.ground.topDark;
    ctx.lineWidth = bandPx; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    coverPath();
    ctx.strokeStyle = b.ground.top;
    ctx.lineWidth = bandPx * .68;
    ctx.stroke();
    // bright edge
    coverPath();
    ctx.strokeStyle = b.ground.edgeLine;
    ctx.lineWidth = Math.max(2, bandPx * .14);
    ctx.stroke();

    // surface dressing per biome
    this._surfaceDressing(state, samples, toS, ppm, bandPx);

    // road markings (city)
    if (b.ground.road) {
      ctx.save();
      ctx.setLineDash(b.ground.road.dash.map(d => d * ppm));
      ctx.strokeStyle = b.ground.road.line;
      ctx.lineWidth = Math.max(3, .12 * ppm);
      ctx.beginPath();
      let first = true;
      for (const s of samples) {
        const [px, py] = toS(s.x, s.y - .52);
        first ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        first = false;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  _surfaceDressing(state, samples, toS, ppm, bandPx) {
    const { ctx } = this;
    const b = state.world.biome;
    if (b.id === 'meadow') {
      // grass tufts + flowers
      for (const s of samples) {
        const k = Math.floor(s.x * 3.1);
        if ((k & 3) !== 0) continue;
        const r = mulberry32(Math.abs(k) + 21)();
        const [px, py] = toS(s.x + r * .5, s.y + .1);
        ctx.strokeStyle = r > .5 ? '#3f9a4e' : '#59b558';
        ctx.lineWidth = Math.max(1.5, ppm * .035);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 3, py - 7 - r * 5, px + (r > .5 ? 6 : -5), py - 10 - r * 6);
        ctx.stroke();
        if (r > .82) {
          ctx.fillStyle = ['#ffd23e', '#ff8ab0', '#fefefe'][k % 3];
          ctx.beginPath(); ctx.arc(px + (r > .5 ? 6 : -5), py - 10 - r * 6, Math.max(2, ppm * .06), 0, TAU); ctx.fill();
        }
      }
    } else if (b.id === 'desert') {
      // sand ripple arcs
      ctx.globalAlpha = .3;
      ctx.strokeStyle = '#c9955a';
      ctx.lineWidth = Math.max(1.5, ppm * .03);
      for (const s of samples) {
        const k = Math.floor(s.x * 2.2);
        if ((k & 3) !== 1) continue;
        const r = mulberry32(Math.abs(k) + 33)();
        const [px, py] = toS(s.x, s.y - .32 - r * .3);
        ctx.beginPath(); ctx.arc(px, py, 12 + r * 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (b.id === 'frost') {
      // glossy ice sheen exactly where physics applies low grip
      for (const s of samples) {
        if (!state.world.iceAt(s.x)) continue;
        const [px, py] = toS(s.x, s.y + .05);
        const gg = ctx.createLinearGradient(px - 30, py, px + 30, py);
        gg.addColorStop(0, 'rgba(190, 225, 255, 0)');
        gg.addColorStop(.5, 'rgba(214, 240, 255, .85)');
        gg.addColorStop(1, 'rgba(190, 225, 255, 0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(px, py, 26, bandPx * .36, 0, 0, TAU); ctx.fill();
        // skate scratch lines on the ice
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(px - 18 + i * 14, py - 2 + i * 3);
          ctx.lineTo(px - 6 + i * 14, py - 5 + i * 3);
          ctx.stroke();
        }
      }
    } else if (b.id === 'city') {
      // wet asphalt sheen streaks
      ctx.globalAlpha = .16;
      for (const s of samples) {
        const k = Math.floor(s.x * 2.9);
        if ((k & 5) !== 0) continue;
        const r = mulberry32(Math.abs(k) + 55)();
        const [px, py] = toS(s.x, s.y - .3 - r * 1.2);
        const gg = ctx.createLinearGradient(px, py - 40, px, py + 40);
        gg.addColorStop(0, 'rgba(140, 190, 255, 0)');
        gg.addColorStop(.5, 'rgba(140, 190, 255, .9)');
        gg.addColorStop(1, 'rgba(140, 190, 255, 0)');
        ctx.fillStyle = gg;
        ctx.fillRect(px - 2, py - 40, 4, 80);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================= props ================= */
  _props(state, layer) {
    const { ctx } = this;
    const world = state.world;
    const ppm = this.ppm();
    const x0 = this.cam.x - (this.w / 2) / ppm - 12, x1 = this.cam.x + (this.w / 2) / ppm + 12;
    const list = world.propsNear(x0, x1);
    ctx.save();
    // world transform with y-up
    for (const p of list) {
      const spec = PROP_SPEC[p.key];
      if (spec.layer !== layer) continue;
      const gy = world.heightAt(p.x) + spec.sink * .5;
      // soft contact shadow
      ctx.save();
      ctx.globalAlpha = .22;
      ctx.fillStyle = '#000';
      const sy = this.toScreenY(gy);
      ctx.beginPath();
      ctx.ellipse(this.toScreenX(p.x), sy, p.scale * .55 * ppm, p.scale * .1 * ppm, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      this._withWorldTransform(() => drawProp(ctx, p, gy, world.biome, this.t));
    }
    ctx.restore();
  }

  _withWorldTransform(fn) {
    const ctx = this.ctx;
    const ppm = this.ppm();
    ctx.save();
    // translate to screen center then flip y
    ctx.translate(this.w / 2 + this.cam.shx, this.h * .62 + this.cam.shy);
    ctx.scale(ppm, -ppm);
    ctx.translate(-this.cam.x, -this.cam.y);
    fn();
    ctx.restore();
  }

  /* ================= pickups ================= */
  _pickups(state) {
    const { ctx } = this;
    const world = state.world;
    const ppm = this.ppm();
    const x0 = this.cam.x - (this.w / 2) / ppm - 4, x1 = this.cam.x + (this.w / 2) / ppm + 4;
    for (const p of world.pickupsNear(x0, x1)) {
      if (p.taken) continue;
      this._withWorldTransform(() => {
        if (p.kind === 'coin') drawCoin(ctx, p.x, p.y, this.t + p.phase);
        else if (p.kind === 'fuel') drawFuelCan(ctx, p.x, p.y + Math.sin(this.t * 2 + p.phase) * .08, this.t);
        else drawGem(ctx, p.x, p.y + Math.sin(this.t * 1.6 + p.phase) * .1, this.t + p.phase);
      });
    }
  }

  /* ================= flags & markers ================= */
  _flags(state) {
    const { ctx } = this;
    const world = state.world;
    const ppm = this.ppm();
    const x0 = this.cam.x - (this.w / 2) / ppm - 6, x1 = this.cam.x + (this.w / 2) / ppm + 6;

    // start gate
    if (x0 < 26) this._withWorldTransform(() => drawGate(ctx, world, 24));

    // milestone flags every 500 m
    const m0 = Math.max(1, Math.ceil(x0 / 500)), m1 = Math.floor(x1 / 500);
    for (let m = m0; m <= m1; m++) {
      const fx = m * 500;
      this._withWorldTransform(() => drawMilestoneFlag(ctx, world, fx));
    }
    // best-distance pennant
    const best = Math.floor(state.bestDist);
    if (best > 30 && best >= x0 - 4 && best <= x1 + 4) {
      this._withWorldTransform(() => drawBestFlag(ctx, world, best));
    }
  }

  /* ================= vehicle ================= */
  _vehicleShadow(state) {
    const { ctx } = this;
    if (!state.vehicle) return;
    const v = state.vehicle, world = state.world;
    const ppm = this.ppm();
    const gy = world.heightAt(v.pos.x);
    const alt = clamp(v.pos.y - gy, 0, 8);
    const a = clamp(.32 - alt * .035, 0, .32);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#071018';
    const sx = this.toScreenX(v.pos.x), sy = this.toScreenY(gy + .04);
    const rx = (v.def.wheelbase * .72) * ppm, ry = rx * .18;
    const stretch = 1 + alt * .06;
    ctx.beginPath(); ctx.ellipse(sx, sy, rx * stretch, ry, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _vehicle(state) {
    const v = state.vehicle;
    this._withWorldTransform(() => {
      drawVehicle(this.ctx, v, {
        time: this.t,
        night: this.night,
        braking: v.brakeIn > 0,
        throttle: v.throttle,
        helmet: v.def.helmet,
        helmetAccent: v.def.helmetAccent,
      });
    });
  }

  /* ================= weather / fx ================= */
  _weather(state) {
    const b = state.world.biome;
    if (b.id === 'frost') this._snowfall();
    if (b.id === 'desert') this._heatHaze();
    if (b.id === 'meadow') this._pollen();
    // speed streaks
    const v = state.vehicle;
    if (v) {
      const spd = Math.hypot(v.vel.x, v.vel.y);
      const k = clamp((spd - 14) / 16, 0, 1);
      if (k > 0) {
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = k * .25;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const rng = mulberry32(Math.floor(this.t * 24));
        for (let i = 0; i < 14; i++) {
          const y = rng() * this.h, len = 60 + rng() * 160 * k;
          const x = rng() * this.w;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * Math.sign(v.vel.x || 1), y); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /** Drifting warm pollen motes for the meadow. */
  _pollen() {
    const { ctx } = this;
    const rng = mulberry32(4242);
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const sp = .4 + rng() * 1.1;
      const x0 = rng() * (this.w + 120), y0 = rng() * this.h;
      const x = ((x0 + this.t * sp * 26 + Math.sin(this.t * .8 + i) * 18) % (this.w + 120) + this.w + 120) % (this.w + 120) - 60;
      const y = ((y0 - this.t * sp * 14 + Math.cos(this.t * .6 + i * 2) * 12) % (this.h + 40) + this.h + 40) % (this.h + 40) - 20;
      ctx.globalAlpha = .25 + rng() * .4;
      ctx.fillStyle = '#fff2b0';
      ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  _snowfall() {
    const { ctx } = this;
    const rng = mulberry12(42);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, .85)';
    for (let i = 0; i < 70; i++) {
      const speed = .5 + rng() * 1.2;
      const x0 = rng() * (this.w + 200), y0 = rng() * this.h;
      const x = ((x0 - this.t * speed * 90) % (this.w + 200) + this.w + 200) % (this.w + 200) - 100;
      const y = ((y0 + this.t * speed * 130) % (this.h + 40)) - 20;
      const r = 1 + rng() * 2.4;
      ctx.globalAlpha = .4 + rng() * .5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
    function mulberry12(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  }

  _heatHaze() {
    const { ctx } = this;
    ctx.save();
    const y = this.h * .58;
    for (let i = 0; i < 3; i++) {
      const off = Math.sin(this.t * 1.4 + i * 2.1) * 14;
      const g = ctx.createLinearGradient(0, y - 26 + i * 14 + off, 0, y + 8 + i * 14 + off);
      g.addColorStop(0, 'rgba(255, 230, 190, 0)');
      g.addColorStop(.5, `rgba(255, 230, 190, ${.09 - i * .02})`);
      g.addColorStop(1, 'rgba(255, 230, 190, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 30 + i * 14 + off, this.w, 36);
    }
    ctx.restore();
  }

  _vignette(state) {
    const { ctx } = this;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * .44, this.w / 2, this.h / 2, this.h * .95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4, 8, 18, .42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    if (state.vehicle && state.vehicle.crashed) {
      ctx.fillStyle = `rgba(120, 10, 20, ${clamp(.28 - state.crashFade * .28, 0, .28)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (state.lowFuelPulse) {
      const a = Math.max(0, Math.sin(this.t * 5)) * .1;
      ctx.fillStyle = `rgba(255, 60, 60, ${a})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
}

/* ================= pickup painters (world space, y-up) ================= */
export function drawCoin(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const spin = Math.sin(t * 3);
  const sx = Math.max(.18, Math.abs(Math.cos(t * 2.6)));
  ctx.scale(sx, 1);
  // glow
  const gl = ctx.createRadialGradient(0, 0, .1, 0, 0, .62);
  gl.addColorStop(0, 'rgba(255, 214, 80, .35)');
  gl.addColorStop(1, 'rgba(255, 214, 80, 0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(0, 0, .62, 0, TAU); ctx.fill();
  // disc
  const g = ctx.createLinearGradient(0, -.4, 0, .4);
  g.addColorStop(0, '#ffe9a0'); g.addColorStop(.5, '#ffc93c'); g.addColorStop(1, '#e09a1e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, .38, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a5c10'; ctx.lineWidth = .05;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 250, 220, .8)'; ctx.lineWidth = .035;
  ctx.beginPath(); ctx.arc(0, 0, .29, 0, TAU); ctx.stroke();
  // star emboss
  ctx.fillStyle = '#b87c14';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU - Math.PI / 2 + (spin > 0 ? 0 : 0);
    const px = Math.cos(a) * .17, py = Math.sin(a) * .17;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    const a2 = a + TAU / 10;
    ctx.lineTo(Math.cos(a2) * .075, Math.sin(a2) * .075);
  }
  ctx.closePath(); ctx.fill();
  // glint
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .05;
  ctx.beginPath(); ctx.arc(0, 0, .33, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
  ctx.restore();
}

export function drawFuelCan(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const gl = ctx.createRadialGradient(0, 0, .1, 0, 0, .8);
  gl.addColorStop(0, 'rgba(255, 110, 90, .3)');
  gl.addColorStop(1, 'rgba(255, 110, 90, 0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(0, 0, .8, 0, TAU); ctx.fill();
  // body
  const g = ctx.createLinearGradient(-.36, 0, .36, 0);
  g.addColorStop(0, '#d8402e'); g.addColorStop(.5, '#f4563c'); g.addColorStop(1, '#b02f22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-.34, -.42); ctx.lineTo(.34, -.42); ctx.lineTo(.38, .3);
  ctx.lineTo(.2, .38); ctx.lineTo(-.2, .38); ctx.lineTo(-.38, .3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6e1a12'; ctx.lineWidth = .045; ctx.stroke();
  // cap
  ctx.fillStyle = '#2c3140';
  ctx.beginPath(); ctx.arc(.24, .42, .09, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#141824'; ctx.lineWidth = .03; ctx.stroke();
  // spout
  ctx.fillStyle = '#2c3140';
  ctx.beginPath(); ctx.moveTo(.3, .34); ctx.lineTo(.48, .5); ctx.lineTo(.4, .56); ctx.lineTo(.26, .4); ctx.closePath(); ctx.fill();
  // label
  ctx.fillStyle = '#f5efdf';
  ctx.beginPath();
  ctx.moveTo(-.2, -.16); ctx.lineTo(.2, -.16); ctx.lineTo(.24, .2); ctx.lineTo(-.24, .2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6e1a12'; ctx.lineWidth = .025; ctx.stroke();
  // fuel-drop icon on label
  ctx.fillStyle = '#e04a30';
  ctx.beginPath();
  ctx.moveTo(0, .14);
  ctx.quadraticCurveTo(.12, -.02, 0, -.1);
  ctx.quadraticCurveTo(-.12, -.02, 0, .14);
  ctx.closePath(); ctx.fill();
  // handle
  ctx.strokeStyle = '#8a2318'; ctx.lineWidth = .06;
  ctx.beginPath(); ctx.arc(-.05, .4, .12, Math.PI * .1, Math.PI * .9); ctx.stroke();
  ctx.restore();
}

export function drawGem(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const gl = ctx.createRadialGradient(0, 0, .1, 0, 0, .85);
  gl.addColorStop(0, 'rgba(90, 240, 255, .4)');
  gl.addColorStop(1, 'rgba(90, 240, 255, 0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(0, 0, .85, 0, TAU); ctx.fill();
  const s = 1 + Math.sin(t * 3) * .05;
  ctx.scale(s, s);
  // emerald cut
  const g = ctx.createLinearGradient(-.3, .3, .3, -.3);
  g.addColorStop(0, '#1d9ed8'); g.addColorStop(.5, '#5ce8f8'); g.addColorStop(1, '#1d6ed8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-.26, .1); ctx.lineTo(-.13, .3); ctx.lineTo(.13, .3); ctx.lineTo(.26, .1);
  ctx.lineTo(.13, -.3); ctx.lineTo(-.13, -.3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0b4a8a'; ctx.lineWidth = .04; ctx.stroke();
  // facets
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = .03;
  ctx.beginPath(); ctx.moveTo(-.26, .1); ctx.lineTo(.26, .1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-.13, .3); ctx.lineTo(-.13, -.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(.13, .3); ctx.lineTo(.13, -.3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.moveTo(-.13, .28); ctx.lineTo(.0, .28); ctx.lineTo(-.08, .12); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ================= flag painters ================= */
export function drawGate(ctx, world, x) {
  const gy = world.heightAt(x);
  ctx.save();
  ctx.translate(x, gy);
  for (const px of [-3, 3]) {
    ctx.fillStyle = '#2c3648';
    ctx.fillRect(px - .07, 0, .14, 4.4);
    ctx.fillStyle = '#e8642a';
    ctx.fillRect(px - .1, 4.15, .2, .3);
  }
  // banner
  const g = ctx.createLinearGradient(0, 4.9, 0, 4.1);
  g.addColorStop(0, '#ffb423'); g.addColorStop(1, '#f97f1f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-3, 4.7); ctx.lineTo(3, 4.7); ctx.lineTo(3, 4.15); ctx.lineTo(-3, 4.15);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,0,.5)'; ctx.lineWidth = .05; ctx.stroke();
  ctx.scale(1, -1);
  ctx.fillStyle = '#3a1c00';
  ctx.font = '900 .42px Nunito, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('RUSH TRACK', 0, -4.42);
  ctx.restore();
}

export function drawMilestoneFlag(ctx, world, x) {
  const gy = world.heightAt(x);
  ctx.save();
  ctx.translate(x, gy);
  ctx.fillStyle = '#39445c';
  ctx.fillRect(-.05, 0, .1, 2.6);
  ctx.fillStyle = '#e8ecf4';
  ctx.fillRect(-.05, 2.3, .1, .08);
  // checkered pennant
  const cell = .16;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#11151f' : '#f4f7ff';
      ctx.fillRect(c * cell - .05, 2.6 - (r + 1) * cell, cell, cell);
    }
  }
  ctx.restore();
}

export function drawBestFlag(ctx, world, x) {
  const gy = world.heightAt(x);
  ctx.save();
  ctx.translate(x, gy);
  ctx.fillStyle = '#35e0e8';
  ctx.fillRect(-.05, 0, .1, 2.2);
  const wave = Math.sin(performance.now() / 300) * .08;
  ctx.fillStyle = '#35e0e8';
  ctx.beginPath();
  ctx.moveTo(.05, 2.2);
  ctx.quadraticCurveTo(.5, 2.28 + wave, .95, 2.16);
  ctx.lineTo(.9, 1.84); ctx.quadraticCurveTo(.5, 1.95 + wave, .05, 1.88);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(6,50,60,.5)'; ctx.lineWidth = .04; ctx.stroke();
  ctx.scale(1, -1);
  ctx.fillStyle = '#063038';
  ctx.font = '900 .22px Nunito, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BEST', .5, -2.02);
  ctx.restore();
}
