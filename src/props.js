/* ============================================================
   Prop painters — hand-authored vector props in a unified style:
   2-stop gradient fills, dark soft outlines, highlight accents.
   All drawn in world space (meters, y-up), base at (0,0), height h.
   ============================================================ */
import { TAU, clamp } from './util.js';

const OUT = 'rgba(16, 22, 36, .55)';

function outline(ctx) { ctx.strokeStyle = OUT; ctx.lineWidth = .05; ctx.stroke(); }
function vgrad(ctx, y0, y1, c0, c1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}
function blob(ctx, x, y, rx, ry, fill, o = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (o) outline(ctx);
}
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

/* ---------------- meadow ---------------- */
function tree(ctx, h, t) {
  const w = h * .62;
  // trunk
  ctx.beginPath();
  ctx.moveTo(-w * .1, 0); ctx.quadraticCurveTo(-w * .12, h * .4, -w * .16, h * .55);
  ctx.lineTo(w * .16, h * .55); ctx.quadraticCurveTo(w * .12, h * .4, w * .1, 0);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 0, h * .55, '#7a4a30', '#5d3620'); ctx.fill(); outline(ctx);
  // branches
  ctx.strokeStyle = '#5d3620'; ctx.lineWidth = h * .045; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, h * .5); ctx.lineTo(-w * .3, h * .66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h * .52); ctx.lineTo(w * .28, h * .68); ctx.stroke();
  // foliage cluster
  const cy = h * .78, cx = 0;
  const leaves = [
    [-w * .55, cy - h * .07, w * .42, h * .2],
    [w * .55, cy - h * .05, w * .4, h * .19],
    [-w * .2, cy + h * .13, w * .46, h * .22],
    [w * .22, cy + h * .14, w * .42, h * .2],
    [0, cy + h * .02, w * .5, h * .26],
  ];
  for (const [x, y, rx, ry] of leaves) blob(ctx, x, y, rx, ry, '#3e8e4d');
  for (const [x, y, rx, ry] of leaves) { ctx.beginPath(); ctx.ellipse(x - rx * .18, y + ry * .22, rx * .62, ry * .55, 0, 0, TAU); ctx.fillStyle = 'rgba(122, 205, 124, .5)'; ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(-w * .18, cy + h * .16, w * .3, h * .1, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255, 244, 170, .28)'; ctx.fill();
  // fruit dots
  ctx.fillStyle = 'rgba(255, 120, 90, .85)';
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    ctx.beginPath(); ctx.arc(Math.cos(a) * w * .5, cy + Math.sin(a * 1.7) * h * .12, h * .018, 0, TAU); ctx.fill();
  }
}

function pine(ctx, h, snow) {
  const w = h * .52;
  ctx.fillStyle = vgrad(ctx, 0, h * .2, '#6e452c', '#503020');
  rr(ctx, -w * .09, 0, w * .18, h * .22, .02); ctx.fill(); outline(ctx);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const ty = h * (.18 + i * .2), tw = w * (1 - i * .18), th = h * .3;
    ctx.beginPath();
    ctx.moveTo(0, ty + th);
    ctx.lineTo(-tw * .5, ty);
    for (let j = 0; j < 4; j++) {
      const u = j / 4;
      ctx.lineTo(-tw * .5 + tw * u + tw * .0625, ty + th * .18);
      ctx.lineTo(-tw * .5 + tw * (u + .125), ty + th * .18);
      ctx.lineTo(-tw * .5 + tw * (u + .25), ty);
    }
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#2f6b44' : '#357a4c'; ctx.fill(); outline(ctx);
    if (snow) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(245, 250, 255, .95)';
      ctx.beginPath(); ctx.ellipse(0, ty + th, tw * .62, th * .3, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  if (snow) blob(ctx, 0, h * .985, w * .1, h * .035, '#f5faff');
}

function bush(ctx, h) {
  blob(ctx, -h * .45, h * .32, h * .5, h * .34, '#3d8e4d');
  blob(ctx, h * .42, h * .3, h * .48, h * .32, '#357a44');
  blob(ctx, 0, h * .5, h * .55, h * .42, '#46a357');
  ctx.beginPath(); ctx.ellipse(-h * .18, h * .6, h * .28, h * .16, 0, 0, TAU);
  ctx.fillStyle = 'rgba(140, 215, 140, .55)'; ctx.fill();
  ctx.fillStyle = '#ff6b8a';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.arc(-h * .4 + i * h * .28, h * .42 + (i % 2) * h * .2, h * .035, 0, TAU); ctx.fill();
  }
}

function rock(ctx, h, hue = 'brown') {
  const w = h * 1.25;
  const shades = hue === 'ice'
    ? ['#cfe4f8', '#a8c8e8', '#88aed6']
    : hue === 'red' ? ['#c98a62', '#a8663f', '#87502f'] : ['#a89887', '#8a7a68', '#6e604f'];
  ctx.beginPath();
  ctx.moveTo(-w * .5, 0);
  ctx.lineTo(-w * .42, h * .55);
  ctx.lineTo(-w * .12, h);
  ctx.lineTo(w * .28, h * .86);
  ctx.lineTo(w * .5, h * .4);
  ctx.lineTo(w * .38, 0);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 0, h, shades[0], shades[1]); ctx.fill(); outline(ctx);
  // facet
  ctx.beginPath();
  ctx.moveTo(-w * .12, h); ctx.lineTo(w * .05, h * .3); ctx.lineTo(w * .3, h * .5);
  ctx.lineTo(w * .28, h * .86); ctx.closePath();
  ctx.fillStyle = shades[2]; ctx.globalAlpha = .8; ctx.fill(); ctx.globalAlpha = 1;
  // top light
  ctx.beginPath();
  ctx.moveTo(-w * .42, h * .55); ctx.lineTo(-w * .12, h); ctx.lineTo(w * .02, h * .82);
  ctx.lineTo(-w * .18, h * .5); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
  if (hue === 'ice') {
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = h * .03;
    ctx.beginPath(); ctx.moveTo(-w * .3, h * .3); ctx.lineTo(-w * .1, h * .75); ctx.stroke();
  }
}

function fence(ctx, h) {
  const w = h * 2.2;
  ctx.fillStyle = '#9a6a42';
  for (const px of [-w * .38, w * .38]) {
    rr(ctx, px - h * .07, 0, h * .14, h, .03); ctx.fill(); outline(ctx);
  }
  ctx.fillStyle = vgrad(ctx, h * .3, h * .8, '#b07a4c', '#8a5a38');
  for (const ry of [h * .62, h * .28]) {
    rr(ctx, -w * .5, ry, w, h * .13, .04); ctx.fill(); outline(ctx);
  }
}

function hay(ctx, h) {
  const w = h * .9;
  ctx.beginPath(); ctx.ellipse(0, h * .45, w * .5, h * .42, 0, 0, TAU);
  ctx.fillStyle = vgrad(ctx, h * .05, h * .9, '#e8c874', '#c9a24e'); ctx.fill(); outline(ctx);
  ctx.beginPath(); ctx.ellipse(0, h * .45, w * .34, h * .3, 0, 0, TAU);
  ctx.fillStyle = '#d4ac58'; ctx.fill();
  ctx.strokeStyle = '#b08c3e'; ctx.lineWidth = h * .045;
  ctx.beginPath(); ctx.arc(0, h * .45, w * .16, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, h * .45, w * .3, .4, 2.4); ctx.stroke();
}

/* ---------------- desert ---------------- */
function saguaro(ctx, h, t) {
  const w = h * .3;
  const body = (x, y0, y1, r) => {
    rr(ctx, x - r, y0, r * 2, y1 - y0, r); ctx.fill(); outline(ctx);
  };
  ctx.fillStyle = vgrad(ctx, 0, h, '#4d9e5e', '#357a46');
  body(0, 0, h * .92, w * .42);
  // arms
  ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = w * .8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w * .34, h * .5); ctx.quadraticCurveTo(-w * 1.1, h * .5, -w * 1.05, h * .72); ctx.stroke();
  outlineStroke(ctx, -w * .34, h * .5, -w * 1.1, h * .5, -w * 1.05, h * .72, w * .8);
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath(); ctx.moveTo(w * .34, h * .36); ctx.quadraticCurveTo(w * 1.05, h * .36, w * 1.02, h * .58); ctx.stroke();
  outlineStroke(ctx, w * .34, h * .36, w * 1.05, h * .36, w * 1.02, h * .58, w * .8);
  // ridges
  ctx.strokeStyle = 'rgba(20, 60, 30, .35)'; ctx.lineWidth = h * .012;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * w * .15, h * .06); ctx.lineTo(i * w * .16, h * .88); ctx.stroke();
  }
  // flower
  ctx.fillStyle = '#ff9ec2';
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * h * .022, h * .93 + Math.sin(a) * h * .022, h * .02, h * .02, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, h * .93, h * .015, 0, TAU); ctx.fill();
}
function outlineStroke(ctx, x0, y0, cx, cy, x1, y1, w) {
  ctx.strokeStyle = OUT; ctx.lineWidth = w + .05;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
}

function cactusSmall(ctx, h) {
  ctx.fillStyle = vgrad(ctx, 0, h, '#5eb06e', '#438c52');
  const pad = (x, y, r, sq) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * sq, 0, 0, TAU); ctx.fill(); outline(ctx); };
  pad(0, h * .3, h * .3, 1.05);
  pad(-h * .3, h * .55, h * .22, 1.1);
  pad(h * .3, h * .62, h * .24, 1.1);
  pad(h * .1, h * .88, h * .17, 1.15);
  ctx.fillStyle = '#ffe066';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-h * .1 + i * h * .14, h * .98, h * .02, 0, TAU); ctx.fill(); }
}

function skull(ctx, h) {
  const w = h * 1.15;
  // horns
  ctx.strokeStyle = '#e8ddc8'; ctx.lineWidth = h * .09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w * .32, h * .55); ctx.quadraticCurveTo(-w * .62, h * .8, -w * .5, h * 1.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * .32, h * .55); ctx.quadraticCurveTo(w * .62, h * .8, w * .5, h * 1.05); ctx.stroke();
  // skull
  ctx.beginPath(); ctx.ellipse(0, h * .42, w * .3, h * .38, 0, 0, TAU);
  ctx.fillStyle = vgrad(ctx, h * .1, h * .8, '#f5efdf', '#d8cdb2'); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#20161c';
  ctx.beginPath(); ctx.ellipse(-w * .12, h * .5, h * .07, h * .09, .2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * .12, h * .5, h * .07, h * .09, -.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, h * .3); ctx.lineTo(-h * .05, h * .18); ctx.lineTo(h * .05, h * .18); ctx.closePath(); ctx.fill();
}

function sign(ctx, h, night) {
  ctx.fillStyle = '#8a5f3c';
  rr(ctx, -h * .06, 0, h * .12, h, .03); ctx.fill(); outline(ctx);
  const w = h * .78;
  ctx.beginPath();
  ctx.moveTo(-w * .5, h * .68); ctx.lineTo(w * .5, h * .68); ctx.lineTo(w * .62, h * .82); ctx.lineTo(w * .5, h * .96); ctx.lineTo(-w * .5, h * .96); ctx.lineTo(-w * .62, h * .82);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, h * .6, h, night ? '#b0632a' : '#c98443', night ? '#8a4a1e' : '#a8662f'); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(60, 34, 14, .8)';
  rr(ctx, -w * .34, h * .77, w * .5, h * .09, .02); ctx.fill();
  rr(ctx, -w * .34, h * .9 - h * .045, w * .3, h * .08, .02); ctx.fill();
  ctx.fillStyle = '#f5e6c8';
  ctx.beginPath(); ctx.arc(w * .3, h * .82, h * .05, 0, TAU); ctx.fill();
}

function tumbleweed(ctx, h, phase) {
  ctx.save();
  ctx.rotate(phase);
  ctx.strokeStyle = '#a8845a'; ctx.lineWidth = h * .035; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a0 = i * 1.7;
    ctx.beginPath();
    ctx.arc(Math.cos(a0) * h * .2, Math.sin(a0) * h * .2, h * .34, a0, a0 + 3.6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9a678';
  for (let i = 0; i < 4; i++) {
    const a0 = i * 2.3 + 1;
    ctx.beginPath();
    ctx.arc(Math.cos(a0) * h * .25, Math.sin(a0) * h * .25, h * .26, a0, a0 + 2.8);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- city ---------------- */
function lamp(ctx, h, night) {
  ctx.fillStyle = vgrad(ctx, 0, h, '#3a4258', '#252c3e');
  rr(ctx, -h * .035, 0, h * .07, h * .9, .02); ctx.fill(); outline(ctx);
  ctx.beginPath();
  ctx.moveTo(-h * .03, h * .9); ctx.quadraticCurveTo(-h * .03, h * 1.02, h * .12, h * 1.02);
  ctx.lineTo(h * .16, h * 1.02); ctx.quadraticCurveTo(h * .16, h * .94, h * .05, h * .92);
  ctx.closePath(); ctx.fill();
  // lamp head
  const lx = h * .15, ly = h * .99;
  ctx.beginPath(); ctx.ellipse(lx, ly, h * .07, h * .045, 0, 0, TAU);
  ctx.fillStyle = night ? '#fff6c8' : '#c8cede'; ctx.fill(); outline(ctx);
  if (night) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly - h * .04, h * .02, lx, ly - h * .04, h * .5);
    g.addColorStop(0, 'rgba(255, 240, 180, .5)');
    g.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(lx, ly - h * .04, h * .5, 0, TAU); ctx.fill();
    // light cone
    const cone = ctx.createLinearGradient(lx, ly, lx, ly - h * .85);
    cone.addColorStop(0, 'rgba(255, 240, 180, .28)');
    cone.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(lx - h * .05, ly - h * .03); ctx.lineTo(lx + h * .05, ly - h * .03);
    ctx.lineTo(lx + h * .3, ly - h * .85); ctx.lineTo(lx - h * .3, ly - h * .85);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function hydrant(ctx, h) {
  ctx.fillStyle = vgrad(ctx, 0, h, '#e85a5a', '#b03434');
  rr(ctx, -h * .22, 0, h * .44, h * .55, h * .1); ctx.fill(); outline(ctx);
  ctx.beginPath(); ctx.arc(0, h * .55, h * .22, Math.PI, 0); ctx.fillStyle = '#d64c4c'; ctx.fill(); outline(ctx);
  ctx.fillStyle = '#f0e8d8'; rr(ctx, -h * .07, h * .55, h * .14, h * .12, .04); ctx.fill();
  ctx.fillStyle = '#b03434';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * h * .26, h * .35, h * .07, h * .05, 0, 0, TAU); ctx.fill(); outline(ctx); }
  ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, -h * .14, h * .18, h * .1, h * .26, h * .05); ctx.fill();
}

function barrier(ctx, h) {
  const w = h * 2.4;
  ctx.fillStyle = '#4a5368';
  for (const px of [-w * .36, w * .36]) { rr(ctx, px - h * .06, 0, h * .12, h * .8, .03); ctx.fill(); outline(ctx); }
  rr(ctx, -w * .5, h * .5, w, h * .42, .05);
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(-w * .5, h * .5, w, h * .42);
  ctx.fillStyle = '#e8642a';
  for (let i = -3; i < 4; i++) {
    ctx.save(); ctx.translate(i * w * .18, h * .71); ctx.rotate(-.5);
    ctx.fillRect(-w * .05, -h * .5, w * .1, h); ctx.restore();
  }
  ctx.restore();
  outline(ctx);
}

function dumpster(ctx, h) {
  const w = h * 1.6;
  ctx.fillStyle = vgrad(ctx, 0, h, '#3f8e6e', '#2a6650');
  rr(ctx, -w * .5, 0, w, h * .78, .06); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#2a6650';
  rr(ctx, -w * .55, h * .74, w * 1.1, h * .16, .08); ctx.fill(); outline(ctx);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = h * .03;
  ctx.beginPath(); ctx.moveTo(-w * .18, h * .05); ctx.lineTo(-w * .18, h * .74); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * .18, h * .05); ctx.lineTo(w * .18, h * .74); ctx.stroke();
  ctx.fillStyle = '#22262f';
  for (const wx of [-w * .3, w * .3]) { ctx.beginPath(); ctx.arc(wx, -h * .02, h * .06, 0, TAU); ctx.fill(); }
}

/* ---------------- frost ---------------- */
function deadTree(ctx, h) {
  ctx.strokeStyle = '#5a4a3c'; ctx.lineCap = 'round';
  ctx.lineWidth = h * .07;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(h * .02, h * .5, -h * .04, h * .8); ctx.stroke();
  ctx.lineWidth = h * .045;
  ctx.beginPath(); ctx.moveTo(-h * .01, h * .45); ctx.quadraticCurveTo(h * .2, h * .6, h * .3, h * .8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-h * .02, h * .6); ctx.quadraticCurveTo(-h * .22, h * .7, -h * .3, h * .9); ctx.stroke();
  ctx.lineWidth = h * .025;
  ctx.beginPath(); ctx.moveTo(h * .24, h * .7); ctx.lineTo(h * .38, h * .66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-h * .24, h * .78); ctx.lineTo(-h * .36, h * .72); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-h * .04, h * .78); ctx.lineTo(-h * .06, h * .98); ctx.stroke();
  ctx.strokeStyle = 'rgba(230, 240, 255, .8)'; ctx.lineWidth = h * .015;
  ctx.beginPath(); ctx.moveTo(-h * .03, h * .1); ctx.lineTo(-h * .04, h * .5); ctx.stroke();
}

function snowman(ctx, h) {
  blob(ctx, 0, h * .26, h * .3, h * .27, '#f8fbff');
  blob(ctx, 0, h * .62, h * .22, h * .21, '#f8fbff');
  blob(ctx, 0, h * .9, h * .15, h * .14, '#fdfeff');
  ctx.fillStyle = '#1d2436';
  ctx.beginPath(); ctx.arc(-h * .05, h * .92, h * .018, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(h * .05, h * .92, h * .018, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, h * .87); ctx.lineTo(-h * .02, h * .84); ctx.lineTo(h * .02, h * .84); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = h * .025; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-h * .2, h * .62); ctx.lineTo(-h * .42, h * .52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h * .2, h * .62); ctx.lineTo(h * .42, h * .5); ctx.stroke();
  ctx.fillStyle = '#e8642a';
  ctx.beginPath(); ctx.moveTo(-h * .13, h * 1.02); ctx.lineTo(h * .13, h * 1.02); ctx.lineTo(h * .1, h * 1.12); ctx.lineTo(-h * .1, h * 1.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9a24e';
  rr(ctx, -h * .1, h * .44, h * .2, h * .05, .02); ctx.fill();
}

function mesaRock(ctx, h) {
  const w = h * 1.9;
  ctx.beginPath();
  ctx.moveTo(-w * .5, 0); ctx.lineTo(-w * .46, h * .5); ctx.lineTo(-w * .3, h * .6);
  ctx.lineTo(-w * .28, h); ctx.lineTo(w * .28, h); ctx.lineTo(w * .3, h * .58);
  ctx.lineTo(w * .46, h * .46); ctx.lineTo(w * .5, 0);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 0, h, '#c98a62', '#9a5f3e'); ctx.fill(); outline(ctx);
  ctx.fillStyle = 'rgba(60, 34, 22, .3)';
  ctx.fillRect(-w * .2, 0, w * .06, h);
  ctx.fillRect(w * .1, 0, w * .05, h);
  ctx.fillStyle = 'rgba(255, 220, 160, .3)';
  ctx.fillRect(-w * .28, h * .86, w * .56, h * .1);
}

/* ---------------- dispatcher ---------------- */
export function drawProp(ctx, p, groundY, biome, t) {
  const h = p.scale;
  ctx.save();
  ctx.translate(p.x, groundY - (p.yOff || 0));
  ctx.scale(p.flip ? -1 : 1, 1);
  switch (p.key) {
    case 'tree': tree(ctx, h, t); break;
    case 'pine': pine(ctx, h, false); break;
    case 'bush': bush(ctx, h); break;
    case 'rock': rock(ctx, h, 'brown'); break;
    case 'fence': fence(ctx, h); break;
    case 'hay': hay(ctx, h); break;
    case 'saguaro': saguaro(ctx, h, t); break;
    case 'cactusSmall': cactusSmall(ctx, h); break;
    case 'mesaRock': mesaRock(ctx, h); break;
    case 'skull': skull(ctx, h); break;
    case 'sign': sign(ctx, h, biome.id === 'city'); break;
    case 'tumbleweed': tumbleweed(ctx, h, p.phase); break;
    case 'lamp': lamp(ctx, h, biome.id === 'city' && biome.night !== false); break;
    case 'hydrant': hydrant(ctx, h); break;
    case 'barrier': barrier(ctx, h); break;
    case 'dumpster': dumpster(ctx, h); break;
    case 'pineSnow': pine(ctx, h, true); break;
    case 'iceRock': rock(ctx, h, 'ice'); break;
    case 'deadTree': deadTree(ctx, h); break;
    case 'snowman': snowman(ctx, h); break;
    default: rock(ctx, h, 'brown');
  }
  ctx.restore();
}
