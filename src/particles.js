/* ============================================================
   Particles: wheel dust, exhaust/engine smoke, sparks, debris
   (incl. detached wheel), pickup bursts, floating score text.
   ============================================================ */
import { clamp, TAU } from './util.js';
import { drawDetachedWheel } from './vehicleArt.js';

class P {
  constructor(o) { Object.assign(this, o); }
}

export class Particles {
  constructor() { this.list = []; this.floaters = []; this.debris = []; }

  spawn(o) { this.list.push(new P({ age: 0, dead: false, ...o })); }

  wheelDust(x, y, vx, vy, color = 'rgba(160,130,100,', n = 1, big = false) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        kind: 'dust', x, y,
        vx: vx * .2 + (Math.random() - .7) * 2.2, vy: vy * .1 + Math.random() * 1.8 + .4,
        r: (big ? .22 : .1) + Math.random() * .16, life: .55 + Math.random() * .5, color,
      });
    }
  }

  exhaust(x, y, vx, vy, dark = false) {
    this.spawn({
      kind: 'smoke', x, y,
      vx: vx * .1 - .6 - Math.random(), vy: .5 + Math.random() * .8,
      r: .07 + Math.random() * .06, life: .7 + Math.random() * .6,
      color: dark ? 'rgba(60,58,62,' : 'rgba(200,200,205,',
    });
  }
  engineSmoke(x, y, intensity) {
    this.spawn({
      kind: 'smoke', x, y,
      vx: (Math.random() - .8) * 1.4, vy: 1.2 + Math.random() * 1.6,
      r: .1 + Math.random() * .12 * intensity, life: .9 + Math.random(),
      color: intensity > 1 ? 'rgba(40,38,42,' : 'rgba(120,116,124,',
    });
  }

  sparks(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        kind: 'spark', x, y,
        vx: (Math.random() - .2) * 7, vy: Math.random() * 5 + 1,
        r: .03 + Math.random() * .03, life: .3 + Math.random() * .35,
      });
    }
  }

  burst(x, y, color, n = 8, speed = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (.4 + Math.random() * .8);
      this.spawn({
        kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: .04 + Math.random() * .05, life: .35 + Math.random() * .3, color,
      });
    }
  }

  coinBurst(x, y) { this.burst(x, y, 'rgba(255,200,60,', 10, 6); }
  gemBurst(x, y) { this.burst(x, y, 'rgba(90,240,255,', 14, 7); }
  fuelBurst(x, y) { this.burst(x, y, 'rgba(255,120,90,', 10, 5); }

  crashBurst(x, y) {
    for (let i = 0; i < 16; i++) {
      this.spawn({
        kind: 'dust', x, y,
        vx: (Math.random() - .5) * 10, vy: Math.random() * 7,
        r: .18 + Math.random() * .3, life: .8 + Math.random() * .8, color: 'rgba(150,130,110,',
      });
    }
    this.sparks(x, y, 12);
    // debris shards
    for (let i = 0; i < 7; i++) {
      this.spawn({
        kind: 'shard', x, y,
        vx: (Math.random() - .5) * 12, vy: 2 + Math.random() * 8,
        rot: Math.random() * TAU, rotV: (Math.random() - .5) * 18,
        s: .06 + Math.random() * .1, life: 1.6 + Math.random(),
        color: ['#e8503a', '#262a33', '#ffd23e', '#8b93a5'][i % 4],
      });
    }
  }

  detachWheel(x, y, vx, vy, r, artId) {
    this.debris.push({ kind: 'wheel', x, y, vx: vx * .6 + 2, vy: vy * .3 + 5, spin: 0, spinV: 9, r, artId, ground: false, done: false });
  }

  floater(x, y, text, color = '#ffd76e') {
    this.floaters.push({ x, y, text, color, age: 0, life: 1.1 });
  }

  snowSpray(x, y, vx) {
    for (let i = 0; i < 2; i++) {
      this.spawn({
        kind: 'dust', x, y,
        vx: -vx * .3 + (Math.random() - .5) * 2, vy: Math.random() * 2.2,
        r: .09 + Math.random() * .12, life: .4 + Math.random() * .3, color: 'rgba(235,245,255,',
      });
    }
  }

  update(dt, world) {
    for (const p of this.list) {
      p.age += dt;
      if (p.age > p.life) { p.dead = true; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dust' || p.kind === 'smoke') { p.vx *= (1 - 1.6 * dt); p.vy += (p.kind === 'smoke' ? 1.2 : 1.9) * dt; p.r += dt * .5; }
      if (p.kind === 'spark') p.vy -= 26 * dt;
      if (p.kind === 'shard') { p.vy -= 24 * dt; p.rot += p.rotV * dt; }
    }
    this.list = this.list.filter(p => !p.dead);
    for (const f of this.floaters) { f.age += dt; f.y += dt * 1.4; }
    this.floaters = this.floaters.filter(f => f.age < f.life);
    // detached wheel physics (bounces on terrain)
    for (const d of this.debris) {
      if (d.done) continue;
      d.vy -= 21 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.spin += d.spinV * dt;
      const gy = world ? world.heightAt(d.x) : -1e9;
      if (d.y - d.r < gy) {
        d.y = gy + d.r;
        if (Math.abs(d.vy) < 1.2) { d.vx *= .9; d.vy = 0; d.spinV *= .96; }
        else { d.vy = -d.vy * .48; d.vx *= .82; }
      }
    }
    this.debris = this.debris.filter(d => !d.done);
  }

  draw(ctx, ppm) {
    // ctx is in world transform (y-up)
    for (const p of this.list) {
      const u = p.age / p.life;
      const a = 1 - u;
      if (p.kind === 'dust' || p.kind === 'smoke') {
        ctx.fillStyle = p.color + (a * (p.kind === 'smoke' ? .5 : .45)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = (p.color || 'rgba(255,190,80,') + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - u * .5), 0, TAU); ctx.fill();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = clamp(1.4 - u, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
        ctx.restore();
      }
    }
    for (const d of this.debris) {
      if (d.kind === 'wheel') drawDetachedWheel(ctx, d.x, d.y, d.r, d.spin, d.artId);
    }
    for (const f of this.floaters) {
      const a = 1 - f.age / f.life;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(f.x, f.y);
      ctx.scale(1 / ppm * 16, -1 / ppm * 16); // constant screen-size text
      ctx.font = '900 1px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = .22; ctx.strokeStyle = 'rgba(20,10,0,.8)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
}
