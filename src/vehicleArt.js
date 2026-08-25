/* ============================================================
   Vehicle art painter — stylized side-view vector vehicles.
   Authored in vehicle-local space: meters, y-up, origin = COM.
   Layer order per wheel: trailing arm → coil spring → wheel →
   (body fenders drawn over wheel tops).
   ============================================================ */
import { clamp, lerp, TAU } from './util.js';

/* ---------- shared helpers ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function tube(ctx, pts, w, color, cap = 'round') {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function poly(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ellipse(ctx, x, y, r, r); ctx.fill(); }

/* Paint palettes per vehicle */
const PAINT = {
  buggy: {
    body: '#e8503a', bodyDark: '#b03426', bodyHi: '#ff8a68',
    accent: '#ffd23e', trim: '#262a33', cage: '#2d3340', cageHi: '#4a5364',
    glass: 'rgba(160, 220, 255, .9)', glassDark: 'rgba(70, 120, 170, .85)',
    decal: '#fff4d6', rim: '#e8ecf4', rimDark: '#9aa4b8', tire: '#22252c',
    fender: '#262a33',
  },
  monster: {
    body: '#2f6fe4', bodyDark: '#1d47a0', bodyHi: '#6fa4ff',
    accent: '#ff8a2a', trim: '#1c2130', cage: '#232a3a', cageHi: '#3d485f',
    glass: 'rgba(180, 230, 255, .92)', glassDark: 'rgba(60, 110, 170, .85)',
    decal: '#ffe9c9', rim: '#f0b429', rimDark: '#a86f12', tire: '#1d2026',
    fender: '#1c2130',
  },
  gt: {
    body: '#1fa78a', bodyDark: '#0f6f60', bodyHi: '#7fe8cd',
    accent: '#8b5cf6', trim: '#141824', cage: '#1a2030', cageHi: '#2e3850',
    glass: 'rgba(200, 235, 255, .9)', glassDark: 'rgba(50, 100, 150, .85)',
    decal: '#eafff8', rim: '#d8dfee', rimDark: '#8891a8', tire: '#20232a',
    fender: '#141824',
  },
};

/* ---------- wheels ---------- */
function drawWheel(ctx, cx, cy, r, spin, spinVel, style, P, detail = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  // tire
  const tireGrad = ctx.createRadialGradient(0, 0, r * .45, 0, 0, r);
  tireGrad.addColorStop(0, '#3a3f4b');
  tireGrad.addColorStop(.72, P.tire);
  tireGrad.addColorStop(1, '#15171d');
  ctx.fillStyle = tireGrad;
  ellipse(ctx, 0, 0, r, r); ctx.fill();
  // tread
  ctx.strokeStyle = '#0e1013'; ctx.lineWidth = r * .1;
  const lugs = style === 'mud' ? 12 : 20;
  const lugLen = style === 'mud' ? r * .2 : r * .12;
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * TAU + spin;
    const lx = Math.cos(a), ly = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(lx * (r - lugLen), ly * (r - lugLen));
    ctx.lineTo(lx * r, ly * r);
    ctx.stroke();
  }
  // sidewall ring
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = r * .07;
  ellipse(ctx, 0, 0, r * .82, r * .82); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = r * .05;
  ellipse(ctx, 0, 0, r * .7, r * .7); ctx.stroke();

  // rim
  const rimR = r * (style === 'aero' ? .62 : .58);
  const rimGrad = ctx.createLinearGradient(-rimR, rimR, rimR, -rimR);
  rimGrad.addColorStop(0, P.rim);
  rimGrad.addColorStop(.5, P.rimDark);
  rimGrad.addColorStop(1, P.rim);
  ctx.save();
  ctx.rotate(spin);
  if (style === 'aero') {
    ctx.fillStyle = rimGrad; ellipse(ctx, 0, 0, rimR, rimR); ctx.fill();
    // aero slots
    ctx.fillStyle = 'rgba(10,12,18,.8)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.save(); ctx.rotate(a);
      rr(ctx, rimR * .45, -rimR * .085, rimR * .38, rimR * .17, rimR * .08); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * .03;
    ellipse(ctx, 0, 0, rimR * .95, rimR * .95); ctx.stroke();
  } else {
    // spokes
    const nSpk = style === 'mud' ? 6 : 5;
    ctx.fillStyle = rimGrad;
    for (let i = 0; i < nSpk; i++) {
      const a = (i / nSpk) * TAU;
      ctx.save(); ctx.rotate(a);
      poly(ctx, [[rimR * .22, rimR * .13], [rimR * .92, rimR * .3 * .5 + rimR * .1], [rimR * .92, -rimR * .3 * .5 - rimR * .1], [rimR * .22, -rimR * .13]]);
      ctx.fill(); ctx.restore();
    }
    // rim barrel + lips
    ctx.strokeStyle = P.rimDark; ctx.lineWidth = r * .09;
    ellipse(ctx, 0, 0, rimR, rimR); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = r * .03;
    ellipse(ctx, 0, 0, rimR * .86, rimR * .86); ctx.stroke();
    if (style === 'beadlock') {
      ctx.fillStyle = '#cfd6e4';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        dot(ctx, Math.cos(a) * rimR * .78, Math.sin(a) * rimR * .78, r * .045, '#cfd6e4');
      }
    }
  }
  // hub
  const hubG = ctx.createRadialGradient(-r * .05, r * .05, r * .02, 0, 0, rimR * .3);
  hubG.addColorStop(0, '#f4f7ff'); hubG.addColorStop(1, P.rimDark);
  ctx.fillStyle = hubG; ellipse(ctx, 0, 0, rimR * .28, rimR * .28); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = r * .025;
  ellipse(ctx, 0, 0, rimR * .28, rimR * .28); ctx.stroke();
  dot(ctx, 0, 0, rimR * .09, '#2a2f3c');
  ctx.restore();

  // motion blur ghosts of spokes at speed
  if (Math.abs(spinVel) > 14 && detail > .5) {
    ctx.save(); ctx.rotate(spin);
    ctx.globalAlpha = clamp((Math.abs(spinVel) - 14) / 30, 0, .38);
    ctx.strokeStyle = 'rgba(200,210,230,.8)'; ctx.lineWidth = r * .05;
    for (let g = 1; g <= 2; g++) {
      ctx.rotate(-Math.sign(spinVel) * .16 * g);
      const nSpk = style === 'aero' ? 6 : style === 'mud' ? 6 : 5;
      for (let i = 0; i < nSpk; i++) {
        const a = (i / nSpk) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rimR * .3, Math.sin(a) * rimR * .3);
        ctx.lineTo(Math.cos(a) * rimR * .88, Math.sin(a) * rimR * .88);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // static specular arc on tire
  ctx.globalAlpha = .5;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * .06;
  ctx.beginPath(); ctx.arc(0, 0, r * .88, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------- suspension ---------- */
function drawSuspension(ctx, wh, anchor, hub, P, thick) {
  // trailing arm
  tube(ctx, [[anchor.x - .12, anchor.y], [hub.x + .05, hub.y]], thick * .8, '#3a4152');
  tube(ctx, [[anchor.x - .12, anchor.y], [hub.x + .05, hub.y]], thick * .5, '#57617550');
  // coil spring
  const coils = 5, r = thick * 1.05;
  ctx.strokeStyle = '#c8cede'; ctx.lineWidth = thick * .62; ctx.lineCap = 'round';
  ctx.beginPath();
  const mx = (anchor.x + hub.x) / 2, my = (anchor.y + hub.y) / 2 + .07;
  ctx.moveTo(anchor.x, anchor.y);
  for (let i = 0; i <= coils; i++) {
    const t = i / coils;
    const px = lerp(anchor.x, mx, t) + (i % 2 === 0 ? -r : r) * (1 - t * .3);
    const py = lerp(anchor.y, my, t) + (i % 2 === 0 ? .02 : -.02);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(hub.x, hub.y + .04);
  ctx.stroke();
  ctx.strokeStyle = '#7d879e'; ctx.lineWidth = thick * .3;
  ctx.stroke();
  // damper
  tube(ctx, [[anchor.x + .3, anchor.y + .04], [hub.x + .12, hub.y + .02]], thick * .5, '#e8483f', 'butt');
  tube(ctx, [[hub.x + .12, hub.y + .02], [lerp(hub.x + .12, anchor.x + .3, .45), lerp(hub.y + .02, anchor.y + .04, .45)]], thick * .34, '#f4f7ff', 'round');
}

/* ---------- buggy body ---------- */
function drawBuggyBody(ctx, v, P, o) {
  const t = o.time || 0;
  // ---- chassis tub ----
  const body = new Path2D();
  body.moveTo(-1.42, -.34);
  body.lineTo(1.28, -.34);
  body.quadraticCurveTo(1.52, -.32, 1.58, -.1);
  body.quadraticCurveTo(1.62, .1, 1.5, .17);      // nose
  body.lineTo(.62, .3);
  body.quadraticCurveTo(0, .38, -.7, .34);        // hood/deck line
  body.lineTo(-1.2, .3);
  body.quadraticCurveTo(-1.5, .26, -1.46, -.05);
  body.closePath();

  const g = ctx.createLinearGradient(0, -.34, 0, .38);
  g.addColorStop(0, P.bodyDark); g.addColorStop(.45, P.body); g.addColorStop(1, P.bodyHi);
  ctx.fillStyle = g; ctx.fill(body);
  ctx.strokeStyle = P.trim; ctx.lineWidth = .05; ctx.stroke(body);

  // side skirt shadow
  ctx.save(); ctx.clip(body);
  const sg = ctx.createLinearGradient(0, -.34, 0, .0);
  sg.addColorStop(0, 'rgba(0,0,0,.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(-1.5, -.4, 3.1, .45);
  // panel line
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .028;
  ctx.beginPath(); ctx.moveTo(-.72, .34); ctx.quadraticCurveTo(-.68, -.1, -.62, -.32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(.66, .3); ctx.quadraticCurveTo(.7, 0, .72, -.32); ctx.stroke();
  // racing stripe
  ctx.fillStyle = P.accent;
  ctx.beginPath();
  ctx.moveTo(.1, .375); ctx.quadraticCurveTo(.05, .05, .12, -.33);
  ctx.lineTo(.34, -.33); ctx.quadraticCurveTo(.3, .05, .34, .365); ctx.closePath(); ctx.fill();
  // rivets
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (let x = -1.3; x <= 1.45; x += .36) dot(ctx, x, -.26, .022, 'rgba(0,0,0,.35)');
  ctx.restore();

  // ---- rear deck + spare tire ----
  ctx.fillStyle = P.bodyDark;
  rr(ctx, -1.5, .18, .34, .16, .05); ctx.fill();
  drawSpare(ctx, -1.33, .3, .3, P);

  // ---- hood vents + grille ----
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  for (let i = 0; i < 3; i++) { rr(ctx, .78 + i * .17, .22, .1, .05, .02); ctx.fill(); }
  // grille
  ctx.fillStyle = '#1d2129'; rr(ctx, 1.34, .02, .24, .2, .05); ctx.fill();
  ctx.fillStyle = '#3d4453'; rr(ctx, 1.37, .05, .18, .13, .03); ctx.fill();
  // headlight (round)
  const hl = ctx.createRadialGradient(1.42, .26, .01, 1.42, .26, .1);
  hl.addColorStop(0, '#fffbe8'); hl.addColorStop(.6, '#ffe9a8'); hl.addColorStop(1, '#b89b56');
  ctx.fillStyle = o.night ? '#fff' : hl;
  ellipse(ctx, 1.42, .26, .085, .085); ctx.fill();
  ctx.strokeStyle = '#141824'; ctx.lineWidth = .028; ellipse(ctx, 1.42, .26, .085, .085); ctx.stroke();
  // taillight
  ctx.fillStyle = o.braking ? '#ff5a5f' : '#a03038';
  rr(ctx, -1.52, .08, .08, .12, .03); ctx.fill();
  if (o.braking) { ctx.save(); ctx.globalAlpha = .5; dot(ctx, -1.55, .14, .14, '#ff5a5f'); ctx.restore(); }

  // ---- fenders ----
  fender(ctx, 1.31, .12, .62, P);   // front
  fender(ctx, -1.31, .12, .62, P);  // rear

  // ---- roll cage (behind driver drawn parts) ----
  tube(ctx, [[-1.05, .3], [-.62, 1.06], [-.5, 1.1]], .075, P.cage);
  tube(ctx, [[.66, .28], [.4, 1.04], [.52, 1.1]], .075, P.cage);
  tube(ctx, [[-.5, 1.1], [.52, 1.1]], .07, P.cage);
  tube(ctx, [[-.9, .58], [-.62, 1.06]], .055, P.cage);      // rear stay
  tube(ctx, [[.75, .6], [.4, 1.04]], .055, P.cage);         // front stay
  tube(ctx, [[-.5, 1.1], [-.34, .78]], .045, P.cage);       // harness anchor
  tube(ctx, [[-.34, .78], [-.05, .78]], .04, P.cageHi);     // harness bar behind seat
  // cage top pads + shine
  tube(ctx, [[-.5, 1.1], [.52, 1.1]], .025, P.cageHi);
  tube(ctx, [[-.62, 1.06], [.4, 1.04]], .022, P.cageHi);

  // windshield frame
  tube(ctx, [[.66, .28], [.52, .86]], .05, '#3d4453');
  const wg = ctx.createLinearGradient(.52, .86, .66, .28);
  wg.addColorStop(0, P.glass); wg.addColorStop(1, P.glassDark);
  ctx.fillStyle = wg;
  poly(ctx, [[.62, .3], [.5, .82], [.34, .8], [.46, .3]]); ctx.fill();

  // exhaust
  tube(ctx, [[-1.3, .12], [-1.56, .2], [-1.6, .42]], .055, '#8b93a5');
  ellipse(ctx, -1.6, .44, .05, .05); ctx.fillStyle = '#20242e'; ctx.fill();

  // number plate decal
  plate(ctx, -.2, .1, '07', P, o);
  // bumper hooks
  ctx.strokeStyle = '#20242e'; ctx.lineWidth = .05;
  ctx.beginPath(); ctx.moveTo(1.58, -.05); ctx.quadraticCurveTo(1.68, -.02, 1.62, .08); ctx.stroke();
}

function drawSpare(ctx, x, y, r, P) {
  drawWheel(ctx, x, y, r, 0, 0, 'beadlock', P, 0);
}

function fender(ctx, x, y, r, P) {
  ctx.strokeStyle = P.trim; ctx.lineWidth = .1;
  ctx.beginPath(); ctx.arc(x, y + .02, r, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .04;
  ctx.beginPath(); ctx.arc(x, y + .02, r + .04, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}

function plate(ctx, x, y, txt, P, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = P.decal;
  rr(ctx, -.16, -.13, .32, .26, .05); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .02; ctx.stroke();
  ctx.scale(1, -1); // text upright
  ctx.fillStyle = '#2a2f3c';
  ctx.font = `900 .15px Nunito, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, 0, .01);
  ctx.restore();
}

/* ---------- monster truck body ---------- */
function drawMonsterBody(ctx, v, P, o) {
  // ladder frame rails (visible under body)
  ctx.fillStyle = '#232a3a';
  rr(ctx, -1.55, .02, 3.15, .13, .04); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = .02;
  ctx.beginPath(); ctx.moveTo(-1.5, .1); ctx.lineTo(1.55, .1); ctx.stroke();

  // cab + bed silhouette
  const body = new Path2D();
  body.moveTo(-1.72, .18);
  body.lineTo(-1.66, .72);           // bed front wall
  body.quadraticCurveTo(-1.62, .8, -1.5, .8);
  body.lineTo(-.62, .8);             // bed rail
  body.lineTo(-.56, .84);
  body.lineTo(-.5, 1.06);            // cab rear
  body.quadraticCurveTo(-.42, 1.18, -.22, 1.18);
  body.lineTo(.5, 1.16);             // roof
  body.quadraticCurveTo(.62, 1.14, .66, .98);
  body.lineTo(.86, .62);             // windshield slope
  body.lineTo(1.5, .56);             // hood
  body.quadraticCurveTo(1.78, .52, 1.8, .34);
  body.lineTo(1.78, .2);
  body.quadraticCurveTo(1.74, .12, 1.6, .12);
  body.closePath();
  const g = ctx.createLinearGradient(0, .1, 0, 1.18);
  g.addColorStop(0, P.bodyDark); g.addColorStop(.5, P.body); g.addColorStop(1, P.bodyHi);
  ctx.fillStyle = g; ctx.fill(body);
  ctx.strokeStyle = P.trim; ctx.lineWidth = .05; ctx.stroke(body);

  ctx.save(); ctx.clip(body);
  // skirt shadow
  const sg = ctx.createLinearGradient(0, .1, 0, .5);
  sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(-1.8, .05, 3.7, .5);
  // flame decal on bed+door
  ctx.fillStyle = P.accent;
  ctx.beginPath();
  ctx.moveTo(-1.7, .18);
  ctx.quadraticCurveTo(-1.2, .3, -.95, .18);
  ctx.quadraticCurveTo(-.9, .42, -.68, .3);
  ctx.quadraticCurveTo(-.55, .5, -.4, .32);
  ctx.lineTo(-.4, .18); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .9;
  ctx.beginPath();
  ctx.moveTo(1.75, .18);
  ctx.quadraticCurveTo(1.35, .26, 1.1, .18);
  ctx.quadraticCurveTo(1.0, .4, .82, .3);
  ctx.lineTo(.82, .18); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // panel lines
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .028;
  ctx.beginPath(); ctx.moveTo(-.56, .84); ctx.lineTo(-.5, .18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(.86, .62); ctx.lineTo(.8, .18); ctx.stroke();
  ctx.restore();

  // bed interior
  ctx.fillStyle = '#1a2130';
  poly(ctx, [[-1.55, .74], [-.62, .74], [-.62, .82], [-1.5, .82]]); ctx.fill();
  // exhaust stack behind cab
  tube(ctx, [[-.6, .8], [-.62, 1.34]], .06, '#98a1b4');
  ellipse(ctx, -.62, 1.36, .06, .05); ctx.fillStyle = '#20242e'; ctx.fill();

  // window
  const wg = ctx.createLinearGradient(.6, 1.1, .8, .7);
  wg.addColorStop(0, P.glass); wg.addColorStop(1, P.glassDark);
  ctx.fillStyle = wg;
  poly(ctx, [[.56, 1.08], [.62, 1.06], [.8, .68], [.56, .68], [.44, 1.08]]); ctx.fill();
  ctx.strokeStyle = P.trim; ctx.lineWidth = .03; ctx.stroke();

  // grille + bull bar
  ctx.fillStyle = '#1d2129'; rr(ctx, 1.5, .2, .3, .3, .06); ctx.fill();
  ctx.fillStyle = '#454e61';
  for (let i = 0; i < 4; i++) { rr(ctx, 1.54, .24 + i * .06, .22, .03, .015); ctx.fill(); }
  tube(ctx, [[1.72, .18], [1.98, .24], [1.96, .5], [1.7, .56]], .05, '#3d4453');
  // headlights
  const hl = ctx.createLinearGradient(1.5, .2, 1.5, .5);
  hl.addColorStop(0, '#fffbe8'); hl.addColorStop(1, '#ffce6b');
  ctx.fillStyle = o.night ? '#fff' : hl;
  rr(ctx, 1.5, .46, .12, .1, .04); ctx.fill();
  ctx.strokeStyle = '#141824'; ctx.lineWidth = .025; ctx.stroke();
  // taillight bar
  ctx.fillStyle = o.braking ? '#ff5a5f' : '#a03038';
  rr(ctx, -1.76, .5, .09, .22, .04); ctx.fill();
  if (o.braking) { ctx.globalAlpha = .45; dot(ctx, -1.8, .6, .16, '#ff5a5f'); ctx.globalAlpha = 1; }

  // massive fender flares
  flare(ctx, 1.52, .5, .95, P);
  flare(ctx, -1.52, .5, .95, P);
  // roof lights bar
  tube(ctx, [[.06, 1.2], [.56, 1.18]], .05, '#2a3140');
  for (let i = 0; i < 3; i++) {
    const lx = .14 + i * .17;
    const lg = ctx.createRadialGradient(lx, 1.26, .01, lx, 1.26, .05);
    lg.addColorStop(0, '#fff'); lg.addColorStop(1, '#c9b26b');
    ctx.fillStyle = o.night ? '#fff' : lg;
    rr(ctx, lx - .045, 1.22, .09, .08, .02); ctx.fill();
    ctx.strokeStyle = '#141824'; ctx.lineWidth = .02; ctx.stroke();
  }
  plate(ctx, -.18, .45, '13', P, o);
}

function flare(ctx, x, y, r, P) {
  ctx.fillStyle = P.fender;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 1.04, Math.PI * 1.96);
  ctx.arc(x, y, r * .8, Math.PI * 1.96, Math.PI * 1.04, true);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = .035;
  ctx.beginPath(); ctx.arc(x, y, r * .96, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}

/* ---------- GT body ---------- */
function drawGTBody(ctx, v, P, o) {
  const body = new Path2D();
  body.moveTo(-1.78, -.16);
  body.lineTo(-1.72, .12);
  body.quadraticCurveTo(-1.6, .2, -1.3, .22);     // rear haunch
  body.quadraticCurveTo(-.85, .26, -.6, .3);      // deck to canopy
  body.quadraticCurveTo(-.35, .5, .05, .5);       // canopy rear glass
  body.quadraticCurveTo(.45, .48, .62, .3);       // windshield
  body.quadraticCurveTo(1.1, .2, 1.5, .12);       // hood
  body.quadraticCurveTo(1.86, .06, 1.9, -.06);    // nose
  body.quadraticCurveTo(1.88, -.2, 1.6, -.22);
  body.lineTo(-1.7, -.24);
  body.closePath();
  const g = ctx.createLinearGradient(0, -.24, 0, .5);
  g.addColorStop(0, P.bodyDark); g.addColorStop(.5, P.body); g.addColorStop(1, P.bodyHi);
  ctx.fillStyle = g; ctx.fill(body);
  ctx.strokeStyle = P.trim; ctx.lineWidth = .045; ctx.stroke(body);

  ctx.save(); ctx.clip(body);
  const sg = ctx.createLinearGradient(0, -.24, 0, .05);
  sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(-1.9, -.26, 3.9, .32);
  // accent sweep decal
  ctx.fillStyle = P.accent; ctx.globalAlpha = .95;
  ctx.beginPath();
  ctx.moveTo(-1.75, -.05);
  ctx.quadraticCurveTo(-.6, .02, .2, -.06);
  ctx.quadraticCurveTo(1.0, -.12, 1.85, -.08);
  ctx.lineTo(1.85, -.22); ctx.lineTo(-1.75, -.22); ctx.closePath();
  ctx.fill(); ctx.globalAlpha = 1;
  // specular streak
  ctx.globalAlpha = .3;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-1.2, .18); ctx.quadraticCurveTo(0, .12, .9, .1);
  ctx.lineTo(.9, .16); ctx.quadraticCurveTo(0, .2, -1.2, .26); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // panel lines
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .024;
  ctx.beginPath(); ctx.moveTo(-.6, .3); ctx.lineTo(-.55, -.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.28, .14); ctx.lineTo(1.32, -.2); ctx.stroke();
  ctx.restore();

  // canopy glass
  const wg = ctx.createLinearGradient(-.4, .5, .5, .28);
  wg.addColorStop(0, P.glass); wg.addColorStop(1, P.glassDark);
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(-.52, .3);
  ctx.quadraticCurveTo(-.3, .47, .05, .47);
  ctx.quadraticCurveTo(.4, .45, .56, .3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.trim; ctx.lineWidth = .03; ctx.stroke();
  // wiper detail
  tube(ctx, [[.3, .3], [.42, .38]], .022, '#141824');
  // side intake
  ctx.fillStyle = '#10141f';
  poly(ctx, [[-1.2, .16], [-.7, .12], [-.7, .02], [-1.2, .05]]); ctx.fill();
  ctx.strokeStyle = P.accent; ctx.lineWidth = .03;
  ctx.beginPath(); ctx.moveTo(-1.18, .13); ctx.lineTo(-.72, .1); ctx.stroke();

  // rear wing
  tube(ctx, [[-1.5, .22], [-1.46, .56]], .05, '#1a2030');
  tube(ctx, [[-1.78, .22], [-1.74, .5]], .05, '#1a2030');
  const wingG = ctx.createLinearGradient(0, .5, 0, .62);
  wingG.addColorStop(0, P.accent); wingG.addColorStop(1, '#5b34c0');
  ctx.fillStyle = wingG;
  poly(ctx, [[-1.92, .6], [-1.32, .6], [-1.28, .52], [-1.95, .52]]); ctx.fill();
  ctx.strokeStyle = P.trim; ctx.lineWidth = .03; ctx.stroke();

  // splitter + diffuser
  ctx.fillStyle = '#141824';
  rr(ctx, 1.6, -.3, .34, .07, .03); ctx.fill();
  rr(ctx, -1.85, -.3, .3, .07, .03); ctx.fill();
  // headlights (slim LED)
  ctx.fillStyle = o.night ? '#fff' : '#e8f4ff';
  poly(ctx, [[1.62, .02], [1.86, -.02], [1.85, .05], [1.6, .09]]); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,36,.6)'; ctx.lineWidth = .02; ctx.stroke();
  // taillight strip
  ctx.fillStyle = o.braking ? '#ff5a5f' : '#8b2733';
  rr(ctx, -1.82, .06, .1, .08, .03); ctx.fill();
  if (o.braking) { ctx.globalAlpha = .5; dot(ctx, -1.86, .1, .13, '#ff5a5f'); ctx.globalAlpha = 1; }
  // exhaust
  dot(ctx, -1.84, -.1, .045, '#20242e');
  dot(ctx, -1.72, -.1, .045, '#20242e');

  flare(ctx, 1.43, -.1, .55, P);
  flare(ctx, -1.43, -.1, .55, P);
  plate(ctx, .7, .02, '21', P, o);
}

/* ---------- driver ---------- */
function drawDriver(ctx, v, o, P) {
  // seat + torso behind helmet
  const hx = o.headX || 0, hy = o.headY || 0;
  const def = v.def;
  const seat = SEAT[def.art];
  ctx.fillStyle = seat.suit;
  rr(ctx, seat.x - .14, seat.y - .12, .3, .34, .1); ctx.fill(); // torso
  // arm to wheel
  tube(ctx, [[seat.x + .05, seat.y + .1], [seat.x + .3, seat.y + .12], [seat.x + .42, seat.y + .02]], .055, seat.suit);
  // glove
  dot(ctx, seat.x + .44, seat.y + .01, .045, '#141824');
  // steering wheel
  ctx.strokeStyle = '#141824'; ctx.lineWidth = .04;
  ellipse(ctx, seat.x + .5, seat.y - .02, .1, .1); ctx.stroke();

  // helmet
  ctx.save();
  ctx.translate(seat.x + hx, seat.y + .32 + hy);
  const hr = seat.helmetR;
  const hg = ctx.createRadialGradient(-hr * .3, hr * .35, hr * .1, 0, 0, hr * 1.15);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(.35, o.helmet);
  hg.addColorStop(1, shade(o.helmet, -.35));
  ctx.fillStyle = hg;
  ellipse(ctx, 0, 0, hr, hr); ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,20,.55)'; ctx.lineWidth = hr * .09; ctx.stroke();
  // visor
  ctx.fillStyle = '#151a26';
  ctx.beginPath();
  ctx.ellipse(hr * .18, -hr * .05, hr * .62, hr * .42, -.18, Math.PI * 1.02, Math.PI * 2.02);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(120, 180, 255, .35)';
  ctx.beginPath();
  ctx.ellipse(hr * .3, -hr * .12, hr * .3, hr * .12, -.18, Math.PI * 1.1, Math.PI * 1.9);
  ctx.closePath(); ctx.fill();
  // stripe
  ctx.strokeStyle = o.helmetAccent; ctx.lineWidth = hr * .18;
  ctx.beginPath(); ctx.arc(0, 0, hr * .78, Math.PI * .25, Math.PI * .8); ctx.stroke();
  ctx.restore();
}

const SEAT = {
  buggy: { x: -.05, y: .34, helmetR: .17, suit: '#31405e' },
  monster: { x: .5, y: .6, helmetR: .17, suit: '#2c3a56' },
  gt: { x: .02, y: .05, helmetR: .13, suit: '#233042' },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + 255 * amt), 0, 255); g = clamp(Math.round(g + 255 * amt), 0, 255); b = clamp(Math.round(b + 255 * amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

/* ---------- damage overlay ---------- */
function drawDamage(ctx, v, P) {
  const d = v.damage;
  if (d < .18) return;
  const a = clamp((d - .18) / .5, 0, 1);
  ctx.save();
  ctx.globalAlpha = a * .85;
  // dents / scratches
  ctx.strokeStyle = 'rgba(20,16,12,.8)'; ctx.lineWidth = .035;
  const scratches = [
    [.5, .15, .8, .0], [1.1, .05, 1.35, .18], [-1.1, .1, -.8, .22], [-.3, -.18, .1, -.1],
  ];
  for (const s of scratches) tube(ctx, s, .03, 'rgba(25,20,15,.7)', 'butt');
  // missing paint patches
  ctx.fillStyle = 'rgba(60,55,50,.55)';
  ellipse(ctx, .95, .12, .12, .07); ctx.fill();
  ellipse(ctx, -.95, .18, .09, .06); ctx.fill();
  // cracked glass line (drawn over window region approx)
  ctx.strokeStyle = 'rgba(240,250,255,.85)'; ctx.lineWidth = .022;
  ctx.beginPath();
  ctx.moveTo(.1, .46); ctx.lineTo(.18, .36); ctx.lineTo(.12, .28); ctx.lineTo(.2, .2);
  ctx.stroke();
  ctx.restore();
}

/* ============================================================
   Main entry — drawVehicle(ctx, v, opts)
   ctx: already transformed to world meters with y-UP
   (caller did scale(s, -s)). v: physics Vehicle.
   ============================================================ */
export function drawVehicle(ctx, v, o = {}) {
  const def = v.def, P = PAINT[def.art];
  const rimStyle = def.art === 'gt' ? 'aero' : def.art === 'monster' ? 'mud' : 'beadlock';

  // driver head bob — reacts to suspension compression & rotation
  const penAvg = (v.wheels[0]?.pen || 0) * .5 + (v.wheels[1]?.pen || 0) * .5;
  o.headY = (o.headY ?? 0) + clamp(penAvg * .35, 0, .07) - clamp((v.angVel || 0) * -.008, -.05, .05);
  o.headX = (o.headX ?? 0) + clamp((v.vel?.x || 0) * -.004, -.04, .04);

  for (const wh of v.wheels) {
    if (wh.hidden) continue;
    const anchor = v.localToWorld({ x: wh.lx, y: wh.ly });
    const c = Math.cos(v.angle), s = Math.sin(v.angle);
    const hub = { x: anchor.x + s * wh.len, y: anchor.y - c * wh.len };
    drawSuspension(ctx, wh, anchor, hub, P, def.wheelR * .3);
    drawWheel(ctx, hub.x, hub.y, wh.r, -wh.spin, -wh.spinVel, rimStyle, P);
  }

  drawDriver(ctx, v, o, P);
  if (def.art === 'buggy') drawBuggyBody(ctx, v, P, o);
  else if (def.art === 'monster') drawMonsterBody(ctx, v, P, o);
  else drawGTBody(ctx, v, P, o);

  drawDamage(ctx, v, P);

  // night headlight cone (world-forward cone)
  if (o.night) {
    const nose = v.localToWorld({ x: def.wheelbase / 2 + .5, y: 0 });
    const dir = v.angle;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createRadialGradient(nose.x, nose.y, .1, nose.x, nose.y, 7);
    cone.addColorStop(0, 'rgba(255,246,200,.34)');
    cone.addColorStop(.4, 'rgba(255,240,180,.13)');
    cone.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y);
    const a0 = dir - .28, a1 = dir + .2;
    ctx.arc(nose.x, nose.y, 7, a0, a1, false);
    // flip to world coords: angle measured y-up but canvas y is down after our transform? ctx is y-up already
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* Standalone wheel for detached-wheel particles. */
export function drawDetachedWheel(ctx, x, y, r, spin, artId) {
  const P = PAINT[artId] || PAINT.buggy;
  const style = artId === 'gt' ? 'aero' : artId === 'monster' ? 'mud' : 'beadlock';
  drawWheel(ctx, x, y, r, spin, 0, style, P, 0);
}

export const PAINT_FOR = (art) => PAINT[art];
