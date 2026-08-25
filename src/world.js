/* ============================================================
   World: procedural heightfield terrain, stunt features,
   prop placement, pickups. Deterministic per run seed.
   ============================================================ */
import { fbm, noise1, mulberry32, clamp, smoothstep, TAU } from './util.js';
import { RUN } from './data.js';

const STEP = 2;          // meters between terrain samples
const CHUNK = 48;        // samples generated per chunk (96 m)
const MARGIN = 14;       // samples of context for slope clamping

/* Prop world-size catalog (meters of height). img key → path assets/img/props/<biome>/<key>.png */
export const PROP_SPEC = {
  tree:      { h: 5.6, layer: 'back',  sink: .1 },
  pine:      { h: 6.4, layer: 'back',  sink: .08 },
  bush:      { h: 1.05, layer: 'front', sink: .05 },
  rock:      { h: .95, layer: 'front', sink: .12 },
  fence:     { h: .95, layer: 'back',  sink: .05 },
  hay:       { h: .95, layer: 'back',  sink: .06 },
  saguaro:   { h: 3.4, layer: 'back',  sink: .06 },
  cactusSmall: { h: 1.15, layer: 'front', sink: .05 },
  mesaRock:  { h: 1.6, layer: 'back',  sink: .14 },
  skull:     { h: .55, layer: 'front', sink: .1 },
  sign:      { h: 1.9, layer: 'back',  sink: .05 },
  tumbleweed: { h: .75, layer: 'front', sink: 0, anim: 'roll' },
  lamp:      { h: 5.2, layer: 'back',  sink: .05, glow: true },
  hydrant:   { h: .8, layer: 'front', sink: .06 },
  barrier:   { h: .95, layer: 'front', sink: .06 },
  dumpster:  { h: 1.35, layer: 'back', sink: .08 },
  pineSnow:  { h: 6.6, layer: 'back',  sink: .1 },
  iceRock:   { h: 1.0, layer: 'front', sink: .14 },
  deadTree:  { h: 4.4, layer: 'back',  sink: .06 },
  snowman:   { h: 1.35, layer: 'front', sink: .1 },
};

export class World {
  constructor(biome, runSeed, bestDist = 0) {
    this.biome = biome;
    this.seed = (runSeed ^ (biome.seed * 7919)) >>> 0;
    this.h = new Map();          // index → height
    this.generatedTo = -1;
    this.props = [];             // {x, key, scale, flip, phase} sorted by x
    this.pickups = [];           // {x, y, kind, taken, phase, vx?, vy?} (collected coins fly to HUD)
    this.features = [];          // for rendering special marks (e.g. ramp boards) & QA
    this.bestDist = bestDist;
    this._nextPropX = 26;
    this._nextFuelX = 300 + ((this.seed % 60));
    this._nextGemX = 620 + (this.seed % 240);
    this._nextFeatureX = 90;
    this._pending = [];          // features being blended
    this.maxX = 0;
    this.tumbleweeds = [];       // animated props
  }

  /* ---------- terrain ---------- */
  baseHeight(x) {
    const b = this.biome.terrain;
    const diff = 1 + Math.min(x / 2600, .85);
    const big = fbm(x / b.wl, this.seed, 3) * b.amp * diff;
    const small = fbm(x / (b.wl * .31), this.seed + 5, 2) * b.amp * .38 * diff * b.rough;
    const micro = noise1(x / 3.1, this.seed + 9) * .085 * b.rough;
    return big + small + micro;
  }

  featureAt(fx, rng) {
    const b = this.biome.terrain.ramps;
    const roll = rng();
    const types = ['kicker', 'table', 'whoops', 'drop', 'dune'];
    const type = types[Math.floor(roll * types.length)];
    const ramp = .78 + rng() * .5;
    if (type === 'kicker') {
      const w = 16 + rng() * 8;
      return { type, x0: fx, x1: fx + w, lip: (3.4 + rng() * 2.2) * b * ramp, gap: 10 + rng() * 6, drop: 2.6 + rng() * 2.4 };
    }
    if (type === 'table') {
      const w = 34 + rng() * 12;
      return { type, x0: fx, x1: fx + w, lip: (3 + rng() * 1.6) * b * ramp, flat: 10 + rng() * 6 };
    }
    if (type === 'whoops') {
      const n = 4 + Math.floor(rng() * 3);
      const w = n * 7;
      return { type, x0: fx, x1: fx + w, n, amp: .8 + rng() * .5 };
    }
    if (type === 'drop') {
      const w = 26 + rng() * 10;
      return { type, x0: fx, x1: fx + w, d: 4 + rng() * 3 };
    }
    const w = 46 + rng() * 18;
    return { type: 'dune', x0: fx, x1: fx + w, amp: (5 + rng() * 3) * b };
  }

  featureOffset(f, x) {
    const t = (x - f.x0) / (f.x1 - f.x0);
    if (t < 0 || t > 1) return 0;
    const ss = smoothstep(clamp(t, 0, 1));
    switch (f.type) {
      case 'kicker': {
        // rise to lip over 0..0.72, then cliff down over 0.72..1
        if (t < .72) { const u = t / .72; return (u * u) * f.lip; }
        const u = (t - .72) / .28; return f.lip * (1 - smoothstep(u)) - u * u * f.drop;
      }
      case 'table': {
        if (t < .3) { const u = t / .3; return smoothstep(u) * f.lip; }
        if (t > .7) { const u = (t - .7) / .3; return f.lip * (1 - smoothstep(u)); }
        return f.lip;
      }
      case 'whoops': {
        return Math.sin(t * Math.PI * 2 * f.n - Math.PI / 2) * .5 * f.amp + f.amp * .5;
      }
      case 'drop': {
        if (t < .45) { const u = t / .45; return smoothstep(u) * f.d; }
        return f.d;
      }
      case 'dune': return Math.sin(t * Math.PI) * f.amp;
    }
    return 0;
  }

  ensure(x) {
    const target = Math.floor((x + 260) / STEP);
    if (target <= this.generatedTo) return;
    const c0 = this.generatedTo + 1;
    for (let i = Math.max(0, c0); i <= target; i++) this._genSample(i);
    this.generatedTo = target;          // set BEFORE decorate (decorate queries heightAt)
    this.maxX = Math.max(this.maxX, target * STEP);
    const fromX = c0 * STEP;
    this._decorate(fromX, target * STEP);
  }

  _genSample(i) {
    const x = i * STEP;
    let h;
    if (x < 46) { h = 0; }                               // flat spawn apron
    else if (x < 74) { h = this.baseHeight(x) * smoothstep((x - 46) / 28); } // blend in
    else {
      // roll features
      while (this._nextFeatureX <= x + 40) {
        const rng = mulberry32((this.seed ^ (this._nextFeatureX * 31)) >>> 0);
        const f = this.featureAt(this._nextFeatureX, rng);
        this._pending.push(f);
        this.features.push(f);
        this._nextFeatureX += f.x1 - f.x0 + 120 + rng() * 160;
      }
      this._pending = this._pending.filter(f => x <= f.x1 + 4);
      let off = 0;
      for (const f of this._pending) off += this.featureOffset(f, x);
      h = this.baseHeight(x) + off;
    }
    // forward slope clamp for drivability (~52°)
    const prev = this.h.get(i - 1);
    const maxDh = STEP * 1.28;
    if (prev !== undefined) h = clamp(h, prev - maxDh, prev + maxDh);
    this.h.set(i, h);
  }

  heightAt(x) {
    this.ensure(x);
    const fi = Math.floor(x / STEP);
    const a = this.h.get(fi) ?? 0, b = this.h.get(fi + 1) ?? a;
    const t = x / STEP - fi;
    return a + (b - a) * t;
  }

  normalAt(x) {
    const e = 1.1;
    const dy = this.heightAt(x + e) - this.heightAt(x - e);
    const len = Math.hypot(2 * e, dy);
    return { x: (-dy) / len, y: (2 * e) / len, slope: dy / (2 * e) }; // y-up unit normal
  }

  /* ---------- decoration (props + pickups) ---------- */
  _decorate(fromX, toX) {
    const rng = mulberry32((this.seed ^ (Math.floor(fromX) * 2654435761)) >>> 0);
    const P = this.biome.props;

    // props
    while (this._nextPropX < toX) {
      const x = this._nextPropX;
      if (x > 34) {
        const entries = Object.entries(P).filter(([, w]) => w > 0);
        let total = entries.reduce((s, [, w]) => s + w, 0);
        let r = rng() * total, key = entries[0][0];
        for (const [k, w] of entries) { r -= w; if (r <= 0) { key = k; break; } }
        const spec = PROP_SPEC[key];
        const scale = spec.h * (0.82 + rng() * 0.42);
        const prop = { x, key, scale, flip: rng() < .5, phase: rng() * TAU, yOff: 0 };
        this.props.push(prop);
        if (spec.anim === 'roll') { prop.vx = 1.6 + rng() * 1.4; this.tumbleweeds.push(prop); }
      }
      this._nextPropX += 13 + rng() * 22;
    }

    // coin runs
    if (rng() < .8) {
      const x = fromX + rng() * (toX - fromX);
      if (x > 90) {
        const n = 4 + Math.floor(rng() * 4);
        const arc = this.features.some(f => x > f.x0 - 8 && x < f.x1 + 24 && (f.type === 'kicker' || f.type === 'table'));
        for (let i = 0; i < n; i++) {
          let px = x + i * 2.4, py;
          if (arc) {
            const t = i / (n - 1);
            py = this.heightAt(px) + 1.6 + Math.sin(t * Math.PI) * 2.6;
          } else {
            py = this.heightAt(px) + 1.15;
          }
          this.pickups.push({ x: px, y: py, kind: 'coin', taken: false, phase: rng() * TAU });
        }
      }
    }

    // fuel cans
    while (this._nextFuelX < toX) {
      const x = this._nextFuelX;
      const y = this.heightAt(x) + 1.05;
      this.pickups.push({ x, y, kind: 'fuel', taken: false, phase: rng() * TAU });
      this._nextFuelX += 270 + rng() * 90;
    }
    // gems
    while (this._nextGemX < toX) {
      const x = this._nextGemX;
      this.pickups.push({ x, y: this.heightAt(x) + 1.7, kind: 'gem', taken: false, phase: rng() * TAU });
      this._nextGemX += 640 + rng() * 420;
    }

    this.props.sort((a, b) => a.x - b.x);
    this.pickups.sort((a, b) => a.x - b.x);
  }

  /** Frost: deterministic low-grip ice bands shared by physics + visuals. */
  iceAt(x) {
    if (this.biome.id !== 'frost') return false;
    const m9 = Math.floor(x / 90);
    const rng = mulberry32((m9 * 977) >>> 0);
    if (rng() >= .5) return false;
    const x0 = m9 * 90 + 30 + rng() * 40;
    return x > x0 && x < x0 + 14;
  }

  update(dt, t) {
    for (const tw of this.tumbleweeds) {
      tw.x += tw.vx * dt;
      tw.phase += dt * tw.vx * 1.5;
      tw.yOff = Math.abs(Math.sin(tw.phase)) * .34;
    }
  }

  pickupsNear(x0, x1) {
    // binary search window
    const arr = this.pickups;
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x < x0) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < arr.length && arr[i].x <= x1; i++) out.push(arr[i]);
    return out;
  }
  propsNear(x0, x1) {
    const arr = this.props;
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x < x0) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < arr.length && arr[i].x <= x1; i++) out.push(arr[i]);
    return out;
  }
}
