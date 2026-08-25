/* ============================================================
   Vehicle physics: rigid chassis + penalty-spring wheels,
   friction-limited drive, air rotation, damage, fuel, tricks.
   ============================================================ */
import { clamp } from './util.js';
import { RUN } from './data.js';

const SUB_DT = 1 / 240;

export class Vehicle {
  constructor(def, upg, world) {
    this.def = def;
    this.world = world;
    const l = (id) => upg[id] || 0;
    this.lvl = { engine: l('engine'), susp: l('susp'), tires: l('tires'), tank: l('tank'), awd: l('awd') };

    // effective stats
    this.engineF = def.engine * (1 + 0.16 * this.lvl.engine);
    this.topSpeed = def.topSpeed * (1 + 0.07 * this.lvl.engine);
    this.brakeF = def.brake * (1 + 0.08 * this.lvl.engine);
    const s = def.suspK * (1 + 0.13 * this.lvl.susp);
    const c = def.suspC * (1 + 0.11 * this.lvl.susp);
    this.suspK = s; this.suspC = c;
    this.grip = def.grip * (1 + 0.09 * this.lvl.tires);
    this.fuelCap = def.fuelCap * (1 + 0.15 * this.lvl.tank);
    this.awdF = [0, .3, .55, .75, .9, 1][this.lvl.awd];

    this.mass = def.mass;
    this.I = def.mass * (Math.pow(def.wheelbase + 1.1, 2) + 0.81) / 12;

    // state
    this.pos = { x: 14, y: world.heightAt(14) + def.wheelR + 0.62 };
    this.vel = { x: 0, y: 0 };
    this.angle = 0; this.angVel = 0;
    this.fuel = this.fuelCap;
    this.damage = 0;
    this.crashed = false;
    this.outOfFuel = false;
    this.headTimer = 0;

    const wb = def.wheelbase, by = def.bodyY;
    this.wheels = [
      { lx: -wb / 2, ly: by, r: def.wheelR, rest: def.wheelR + def.travel * .62, len: def.wheelR + def.travel * .62, pen: 0, onGround: false, spin: 0, spinVel: 0, load: 0, skid: 0, drive: 1, contact: null },
      { lx: wb / 2, ly: by, r: def.wheelR, rest: def.wheelR + def.travel * .62, len: def.wheelR + def.travel * .62, pen: 0, onGround: false, spin: 0, spinVel: 0, load: 0, skid: 0, drive: this.awdF, contact: null },
    ];
    this.minLen = this.wheels[0].rest - def.travel;

    // locals for crash / scrape points (art-space; y-up)
    const art = ART_POINTS[def.art] || ART_POINTS.buggy;
    this.headLocal = art.head;
    this.scrapePoints = art.scrape;
    this.icePatch = false;

    // trick tracking
    this.airTime = 0; this.airRot = 0; this.airborne = false;
    this.flipQueue = [];          // flips done this air
    this.lastFlipDir = 0;
    this.landHandler = null;      // callback(airTime, flips, clean)
    this.crashHandler = null;
    this.scrapeHandler = null;
    this.impactHandler = null;    // (load, vSpeed)

    // telemetry
    this.speedKmh = 0; this.airborneNow = false; this.throttle = 0; this.brakeIn = 0;
  }

  get powerFactor() { return this.damage > .8 ? .72 : this.damage > .5 ? .88 : 1; }
  get grounded() { return this.wheels[0].onGround || this.wheels[1].onGround; }

  localToWorld(l) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.pos.x + l.x * c - l.y * s, y: this.pos.y + l.x * s + l.y * c };
  }

  step(dt, input) {
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(SUB_DT, remaining);
      this._substep(h, input);
      remaining -= h;
    }
    this.speedKmh = Math.hypot(this.vel.x, this.vel.y) * 3.6;
    this.airborneNow = !this.grounded;
  }

  _substep(dt, input) {
    const w = this.world, def = this.def;
    const throttle = this.crashed ? 0 : (this.outOfFuel ? 0 : input.gas ? 1 : 0);
    const braking = this.crashed ? 0 : input.brake ? 1 : 0;
    this.throttle = throttle; this.brakeIn = braking;
    let fx = 0, fy = 0;
    // gravity (arcade-scaled)
    fy = -21.5 * this.mass * (this.world.biome.gravityScale || 1);

    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    let torque = 0;
    let anyGround = false;

    for (const wh of this.wheels) {
      // collision wheel rides at rest extension (stable); `len` is visual squash
      const anchor = this.localToWorld({ x: wh.lx, y: wh.ly });
      const downX = s, downY = -c; // chassis down in world
      const cx = anchor.x + downX * wh.rest, cy = anchor.y + downY * wh.rest;
      const n = w.normalAt(cx);
      const surfY = w.heightAt(cx);
      const d = (cy - surfY) * n.y + (cx - cx) * n.x; // distance along normal (surface pt ≈ (cx,surfY))
      const pen = wh.r - d;

      if (pen > 0 && !this.crashed && !wh.dead) {
        anyGround = true;
        wh.onGround = true;
        wh.pen = Math.min(pen, def.travel + wh.r * .4);
        // visual suspension compression (spring squash under load)
        wh.len = clamp(wh.rest - wh.pen * .9, this.minLen, wh.rest);
        // anchor-point velocity
        const rX = anchor.x - this.pos.x, rY = anchor.y - this.pos.y;
        const vX = this.vel.x - this.angVel * rY, vY = this.vel.y + this.angVel * rX;
        const vN = vX * n.x + vY * n.y;
        const vT = vX * n.y + vY * -n.x;

        // suspension normal force
        let Fn = this.suspK * 1000 * pen - this.suspC * 600 * vN;
        if (Fn < 0) Fn = 0;
        const load = Fn;
        wh.load = load;

        // drive / brake along tangent
        const surfMu = this.icePatch ? .45 : 1;
        const maxT = 1.55 * load * this.grip * surfMu;
        let Ft = 0;
        const fwdSpeed = vT;
        if (throttle > 0) {
          const tr = clamp(1 - Math.abs(fwdSpeed) / this.topSpeed, 0, 1);
          Ft = throttle * this.engineF * 66 * this.powerFactor * tr * wh.drive * (fwdSpeed < -.5 ? 1.4 : 1);
        } else if (braking > 0) {
          if (fwdSpeed > .6) Ft = -braking * this.brakeF * 66 * clamp(fwdSpeed / 4, .35, 1);
          else Ft = -braking * this.brakeF * 66 * .42 * clamp(1 - Math.abs(fwdSpeed) / 6, 0, 1); // reverse crawl
        }
        // rolling resistance
        Ft -= fwdSpeed * load * .0016;
        const demanded = Ft;
        Ft = clamp(Ft, -maxT, maxT);
        wh.skid = Math.abs(demanded) > maxT * 1.02 || (throttle > 0 && Math.abs(fwdSpeed) < this.topSpeed * .12 && load > 0 && Math.abs(demanded) > maxT * .7) ? Math.min(1, wh.skid + dt * 9) : Math.max(0, wh.skid - dt * 5);

        // normal force at contact point, drive force at hub height
        const cpx = cx - n.x * wh.r, cpy = cy - n.y * wh.r;
        fx += n.x * Fn; fy += n.y * Fn;
        const rcx = cpx - this.pos.x, rcy = cpy - this.pos.y;
        torque += rcx * (n.y * Fn) - rcy * (n.x * Fn);
        fx += n.y * Ft; fy += -n.x * Ft;
        const rhx = cx - this.pos.x, rhy = cy - this.pos.y;
        torque += rhx * (-n.x * Ft) - rhy * (n.y * Ft);

        // wheel visual spin
        const targetSpin = (Ft > 0 && wh.skid > .4 ? this.topSpeed * 2.2 : Math.abs(fwdSpeed)) / wh.r;
        wh.spinVel += ((Math.sign(Ft >= 0 ? 1 : -1) * targetSpin) - wh.spinVel) * clamp(dt * 12, 0, 1);
        wh.contact = { x: cpx, y: cpy, nx: n.x, ny: n.y };
        if (Fn > 5200 && vN < -3.5 && this.impactHandler) this.impactHandler(Fn, vN); // hard landing
      } else {
        wh.onGround = false;
        wh.pen = 0; wh.load = 0; wh.skid = Math.max(0, wh.skid - dt * 4);
        wh.contact = null;
        wh.len += (wh.rest - wh.len) * clamp(dt * 10, 0, 1); // extend in air
        wh.spinVel += ((throttle * this.topSpeed * 1.6 / wh.r) - wh.spinVel) * clamp(dt * 2.2, 0, 1);
      }
      wh.spin += wh.spinVel * dt;
    }

    // chassis scrape points (bumpers / roof)
    for (const sp of this.scrapePoints) {
      const p = this.localToWorld(sp);
      const h = w.heightAt(p.x);
      if (p.y < h) {
        const n = w.normalAt(p.x);
        const pen = h - p.y;
        const rx = p.x - this.pos.x, ry = p.y - this.pos.y;
        const vX = this.vel.x - this.angVel * ry, vY = this.vel.y + this.angVel * rx;
        const vN = vX * n.x + vY * n.y;
        let Fn = 16000 * pen - 1100 * vN;
        if (Fn < 0) Fn = 0;
        const Ft = -clamp(vX * n.y - vY * n.x, -8, 8) * 520;
        fx += n.x * Fn + n.y * Ft; fy += n.y * Fn - n.x * Ft;
        torque += rx * (n.y * Fn - n.x * Ft) - ry * (n.x * Fn + n.y * Ft);
        if (this.scrapeHandler && (Math.abs(vN) > 3 || Math.abs(vX) > 4)) this.scrapeHandler(p, pen, Math.abs(vX));
        this.damage = Math.min(1, this.damage + dt * .06 * Math.min(1, Math.abs(vX) / 6));
      }
    }

    // air control
    if (!anyGround && !this.crashed) {
      torque += (throttle - braking) * def.airTorque * 3.5;
    } else if (!this.crashed && throttle > 0 && this.angVel > 2.6) {
      // wheelie governor — keeps stunts possible but spawn-safe
      torque -= Math.min(this.angVel - 2.6, 3.2) * this.I * 3.4;
    }

    // integrate
    const ax = fx / this.mass, ay = fy / this.mass;
    this.vel.x += ax * dt; this.vel.y += ay * dt;
    // aero drag
    this.vel.x -= this.vel.x * Math.abs(this.vel.x) * .0021 * dt * 60 / 60;
    this.vel.y -= this.vel.y * .06 * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.angVel += (torque / this.I) * dt;
    this.angVel = clamp(this.angVel, -9.5, 9.5);
    if (!anyGround) this.angVel *= (1 - .12 * dt);
    else this.angVel *= (1 - 1.4 * dt * (Math.abs(this.vel.x) < .4 ? 3 : 0.2));
    this.angle += this.angVel * dt;

    // fuel
    if (!this.crashed && !this.outOfFuel) {
      const burn = (.46 + 1.0 * (throttle + braking * .4)) * dt;
      this.fuel -= burn;
      if (this.fuel <= 0) { this.fuel = 0; this.outOfFuel = true; }
    }

    // ---- crash detection (driver head) ----
    const head = this.localToWorld(this.headLocal);
    const hh = w.heightAt(head.x);
    if (!this.crashed && head.y < hh + .04) {
      const speed = Math.hypot(this.vel.x, this.vel.y);
      this.headTimer += dt;
      if (speed > 8.5 || this.headTimer > .5) this._crash();
    } else this.headTimer = Math.max(0, this.headTimer - dt * 2);

    // ---- trick tracking ----
    if (!anyGround && !this.crashed) {
      if (!this.airborne) { this.airborne = true; this.airTime = 0; this.airRot = 0; this.flipQueue.length = 0; }
      this.airTime += dt;
      this.airRot += this.angVel * dt;
      const flipsDone = Math.floor(Math.abs(this.airRot) / (Math.PI * 2));
      while (this.flipQueue.length < flipsDone) {
        this.flipQueue.push(Math.sign(this.airRot));
      }
    } else if (this.airborne) {
      // landed
      this.airborne = false;
      if (this.landHandler && this.airTime > .45) {
        this.landHandler(this.airTime, this.flipQueue.slice(), anyGround);
      }
      this.airTime = 0; this.airRot = 0; this.flipQueue.length = 0;
    }
  }

  _crash() {
    if (this.crashed) return;
    this.crashed = true;
    this.angVel *= .55;
    if (this.crashHandler) this.crashHandler();
  }
}

/* local-space reference points per art (y-up, meters from chassis COM) */
const ART_POINTS = {
  buggy: {
    head: { x: .16, y: .78 },
    scrape: [{ x: -1.62, y: -.18 }, { x: 1.62, y: -.18 }, { x: -1.05, y: .62 }, { x: 1.05, y: .62 }],
  },
  monster: {
    head: { x: .1, y: .95 },
    scrape: [{ x: -1.78, y: .2 }, { x: 1.78, y: .2 }, { x: -1.1, y: .8 }, { x: 1.1, y: .8 }],
  },
  gt: {
    head: { x: .1, y: .5 },
    scrape: [{ x: -1.75, y: -.05 }, { x: 1.78, y: -.05 }, { x: -.95, y: .38 }, { x: .95, y: .38 }],
  },
};
