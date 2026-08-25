/* ============================================================
   RUSH TRACK — main: boot, screens, run loop, camera, wiring.
   ============================================================ */
import { Renderer } from './render.js';
import { World } from './world.js';
import { Vehicle } from './physics.js';
import { Particles } from './particles.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { load, save, profile, addCoins, spendCoins, recordRun, _reset } from './save.js';
import { VEHICLES, BIOMES, UPGRADES, MAX_LEVEL, upgradeCost, UPG_BASE, RUN } from './data.js';
import { clamp, lerp, fmt, mulberry32 } from './util.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const particles = new Particles();
const input = new Input();
const audio = new AudioEngine(profile());
const P = profile();

const ui = new UI(document.getElementById('ui'), {
  audio,
  profile: () => P,
  onPlay: () => showStages(),
  onGarage: () => { gameMode = 'garage'; ui.showGarage(); },
  onTitle: () => showTitle(),
  onStartStage: (id) => startRun(id),
  onBuyVehicle: (id) => {
    const def = VEHICLES.find(v => v.id === id);
    if (P.coins >= def.price && spendCoins(def.price)) {
      P.owned[id] = true; save();
      audio.buy();
      ui.showGarage();
    } else audio.denied();
  },
  onSelectVehicle: (id) => { P.selectedVehicle = id; save(); audio.click(); ui.showGarage(); },
  onUpgrade: (vid, uid) => {
    const def = VEHICLES.find(v => v.id === vid);
    const lvl = P.upgrades[vid][uid];
    if (lvl >= MAX_LEVEL) return;
    const cost = upgradeCost(UPG_BASE[vid], lvl);
    if (!P.owned[vid] || P.coins < cost) { audio.denied(); return; }
    if (spendCoins(cost)) {
      P.upgrades[vid][uid] = lvl + 1;
      save(); audio.buy();
      ui.showGarage();
    }
  },
  onPause: () => pauseRun(),
  onResume: () => resumeRun(),
  onRestart: () => { ui.hidePause(); startRun(run?.biomeId); },
  onQuit: () => { ui.hidePause(); endAudio(); showTitle(); },
  onToggleSfx: (btn) => { P.sfx = !P.sfx; save(); audio.applyVolumes(); if (P.sfx) audio.click(); btn.classList.toggle('off', !P.sfx); },
  onToggleMusic: (btn) => { P.music = !P.music; save(); audio.applyVolumes(); audio.click(); btn.classList.toggle('off', !P.music); },
  wirePedals: (g, b) => input.attachPedals(g, b),
});

/* ---------------- global state ---------------- */
let gameMode = 'title';      // title | stages | garage | run | results
let run = null;              // active run data
let time = 0;
let titleScene = null;

input.onFirstTouch = () => {
  audio.unlock();
  if (gameMode !== 'run') audio.playMusic('menu');
};

/* first user gesture anywhere unlocks audio + starts menu music */
document.addEventListener('pointerdown', () => {
  audio.unlock();
  if (gameMode !== 'run') audio.playMusic('menu');
  if (!audio._amb) audio.startAmbience(gameMode === 'run' && run ? run.biomeId : 'meadow');
});

/* ---------------- title backdrop scene ---------------- */
function makeTitleScene() {
  const biome = BIOMES[0];
  const world = new World(biome, 20240825, 0);
  const def = VEHICLES.find(v => v.id === P.selectedVehicle) || VEHICLES[0];
  const v = new Vehicle(def, P.upgrades[def.id], world);
  v.pos = { x: 18, y: world.heightAt(18) + def.wheelR + def.travel * .62 + def.bodyY + .02 };
  return {
    world, vehicle: v, biomeId: biome.id,
    camera: { x: v.pos.x + 3, y: v.pos.y + 1.4, zoom: 1, shx: 0, shy: 0 },
    particles: new Particles(), bestDist: 0, time: 0, crashFade: 0,
  };
}

/* ---------------- screens ---------------- */
function showTitle() {
  gameMode = 'title';
  titleScene = makeTitleScene();
  ui.showTitle(P.coins);
  audio.playMusic('menu');
  audio.startAmbience('meadow');
  endRunAudio();
}
function showStages() {
  gameMode = 'stages';
  ui.showStages(P);
}

/* ---------------- run lifecycle ---------------- */
function startRun(biomeId) {
  const biome = BIOMES.find(b => b.id === biomeId);
  const def = VEHICLES.find(v => v.id === P.selectedVehicle) || VEHICLES[0];
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const world = new World(biome, seed, P.best[biomeId] || 0);
  const v = new Vehicle(def, P.upgrades[def.id], world);
  world.ensure(60);

  run = {
    biomeId, world, vehicle: v,
    camera: { x: v.pos.x + 2, y: v.pos.y + 1, zoom: 1, shx: 0, shy: 0 },
    particles: new Particles(),
    state: 'countdown', countdownT: 3.6,
    coins: 0, gems: 0, fuelCans: 0, stuntCoins: 0, flipsTotal: 0,
    distCoins: 0, dist: 0, bestDist: P.best[biomeId] || 0,
    crashFade: 0, overT: 0, coastT: 0,
    lastMilestone: 0, tutorial: !P.tutorialSeen, tutorialT: 0,
    startTime: 0,
  };

  // handlers
  v.landHandler = (airTime, flips, clean) => onLanding(airTime, flips, clean);
  v.crashHandler = () => onCrash();
  v.scrapeHandler = (p, pen, speed) => {
    if (Math.random() < .5) run.particles.sparks(p.x, p.y, 3);
    if (Math.random() < .3) audio.scrape();
  };
  v.impactHandler = (load, vN) => {
    const f = clamp(-vN / 12, 0, 1);
    if (f > .18) {
      audio.land(f);
      run.camera.shx = (Math.random() - .5) * 14 * f;
      run.camera.shy = (Math.random() - .5) * 10 * f;
      const wpos = v.pos;
      run.particles.wheelDust(wpos.x, run.world.heightAt(wpos.x) + .2, -v.vel.x, 0, dustColor(), 8, true);
      v.damage = Math.min(1, v.damage + f * .1);
    } else if (f > .05) audio.thud();
  };

  gameMode = 'run';
  ui.hide('title'); ui.hide('stages'); ui.hide('garage');
  ui.hide('results');
  ui.showHUD(run.bestDist);
  ui.tutorial(run.tutorial);
  audio.playMusic('game');
  audio.startAmbience(biomeId);
  audio.startEngine(def);
  audio.countdown();
}

function dustColor() {
  return {
    meadow: 'rgba(120, 90, 60,',
    desert: 'rgba(210, 160, 100,',
    city: 'rgba(140, 140, 150,',
    frost: 'rgba(235, 245, 255,',
  }[run.biomeId] || 'rgba(160,130,100,';
}

function onLanding(airTime, flips, clean) {
  const v = run.vehicle;
  if (v.crashed) return;
  let stunt = 0;
  if (flips.length > 0 && clean) {
    const n = flips.length;
    const dir = flips[0];
    const label = n >= 3 ? 'INSANE!!' : n === 2 ? 'DOUBLE FLIP!' : dir > 0 ? 'BACKFLIP!' : 'FRONTFLIP!';
    const base = RUN.flipBase * n * n * .7 + RUN.flipBase * n * .3;
    stunt = Math.round(base);
    run.flipsTotal += n;
    audio.flip(n);
    ui.comboPop(label, `+${stunt}`);
    run.particles.floater(v.pos.x, v.pos.y + 1.6, `+${stunt}`, '#ffd76e');
  } else if (airTime > 1.2) {
    stunt = Math.round(airTime * RUN.airTimeBonus * 10) / 10 | 0;
    stunt = Math.round(airTime * RUN.airTimeBonus);
    ui.comboPop('BIG AIR', `+${stunt}`);
    run.particles.floater(v.pos.x, v.pos.y + 1.6, `+${stunt}`, '#9fe8ff');
    audio.whoosh();
  }
  run.stuntCoins += stunt;
}

function onCrash() {
  const v = run.vehicle;
  audio.crash();
  audio.stopEngine();
  run.particles.crashBurst(v.pos.x, v.pos.y + .2);
  // detach front wheel
  const fw = v.wheels[1];
  fw.dead = true; fw.hidden = true;
  const c = Math.cos(v.angle), s = Math.sin(v.angle);
  run.particles.detachWheel(
    v.pos.x + fw.lx * c - fw.ly * s,
    v.pos.y + fw.lx * s + fw.ly * c - fw.len,
    v.vel.x, v.vel.y, fw.r, v.def.art);
  run.state = 'over'; run.overT = 0;
  run.camera.shx = (Math.random() - .5) * 26;
  run.camera.shy = (Math.random() - .5) * 18;
  if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
}

function pauseRun() {
  if (!run || run.state === 'done') return;
  run.paused = true;
  ui.showPause(`${fmt(run.dist)} m · ${fmt(P.coins + sessionEarn())} coins`);
  audio.stopEngine();
  audio.playMusic('menu');
}
function resumeRun() {
  if (!run) return;
  run.paused = false;
  ui.hidePause();
  if (run.state !== 'over') audio.startEngine(run.vehicle.def);
  audio.playMusic('game');
}
function sessionEarn() {
  return run ? (run.coins + run.gems * RUN.gemValue + run.stuntCoins) : 0;
}

function finishRun(cause) {
  if (run.state === 'done') return;
  run.state = 'done';
  const dist = Math.floor(run.dist);
  const pickups = run.coins + run.gems * RUN.gemValue;
  const distEarn = Math.round(dist * RUN.distanceCoinRate);
  const total = pickups + distEarn + run.stuntCoins;
  addCoins(total);
  const isRecord = recordRun(run.biomeId, dist, run.flipsTotal);
  if (P.tutorialSeen === false && run.dist > 30) { P.tutorialSeen = true; save(); }
  endRunAudio();
  audio.stopMusic();
  if (isRecord) audio.fanfare(); else if (cause === 'crash') audio.gameOver();
  gameMode = 'results';
  ui.showResults({
    cause,
    title: isRecord ? 'NEW RECORD!' : cause === 'fuel' ? 'TANK EMPTY' : 'WIPEOUT!',
    dist,
    isRecord,
    earn: { dist: distEarn, pickups, stunts: run.stuntCoins },
  });
}

function endRunAudio() {
  audio.stopEngine();
}
function endAudio() { audio.stopEngine(); audio.stopAmbience(); }

/* ---------------- per-frame update ---------------- */
function updateRun(dt) {
  const r = run, v = r.vehicle, w = r.world;
  if (r.paused) return;

  r.dist = Math.max(r.dist, v.pos.x - 14);
  time += dt;

  if (r.state === 'countdown') {
    const prev = Math.ceil(r.countdownT);
    r.countdownT -= dt;
    const now = Math.ceil(r.countdownT);
    if (now !== prev && now >= 1 && now <= 3) audio.countdown();
    if (r.countdownT <= .6 && r.countdownT + dt > .6) audio.countdown(true);
    if (r.countdownT <= 0) r.state = 'driving';
    v.step(dt, { gas: false, brake: false });
  } else {
    v.step(dt, input);
  }

  // tutorial dismissal
  if (r.tutorial) {
    r.tutorialT += dt;
    if ((input.gas && r.tutorialT > 1.2) || r.tutorialT > 9) {
      r.tutorial = false;
      ui.hideTutorial();
    }
  }

  // fuel low warning
  const fuel01 = v.fuel / v.fuelCap;
  if (fuel01 < RUN.fuelWarn && fuel01 > 0 && r.state === 'driving') audio.lowFuel();

  // out of fuel → coast → results
  if (v.outOfFuel && r.state === 'driving') {
    if (Math.abs(v.vel.x) < .55) r.coastT += dt; else r.coastT = 0;
    if (r.coastT > 1.4) finishRun('fuel');
  }
  if (r.state === 'over') {
    r.overT += dt;
    r.crashFade = Math.min(1, r.crashFade + dt * .8);
    if (r.overT > 1.9) finishRun('crash');
  }

  // pickups
  const cx = v.pos.x;
  for (const pk of w.pickupsNear(cx - 4, cx + 4)) {
    if (pk.taken) continue;
    const dx = pk.x - cx, dy = pk.y - v.pos.y;
    const reach = RUN.pickupRadius + (pk.kind === 'fuel' ? .5 : 0);
    if (dx * dx + dy * dy < reach * reach) {
      pk.taken = true;
      if (pk.kind === 'coin') {
        r.coins += RUN.coinValue; audio.coin(); r.particles.coinBurst(pk.x, pk.y);
        r.particles.floater(pk.x, pk.y + .6, '+1', '#ffd76e');
      } else if (pk.kind === 'gem') {
        r.gems += 1; audio.gem(); r.particles.gemBurst(pk.x, pk.y);
        r.particles.floater(pk.x, pk.y + .6, '+25', '#7ae8ff');
      } else {
        r.fuelCans++; audio.fuelPickup(); r.particles.fuelBurst(pk.x, pk.y);
        v.fuel = Math.min(v.fuelCap, v.fuel + v.fuelCap * .38);
        r.particles.floater(pk.x, pk.y + .8, 'FUEL!', '#ff9b8f');
      }
    }
  }

  // milestones
  const mStep = 250;
  const m = Math.floor(r.dist / mStep);
  if (m > r.lastMilestone && r.dist > 100) {
    r.lastMilestone = m;
    ui.milestone(`${fmt(m * mStep)} m!`);
    audio.milestone();
  }

  // wheels dust/snow/skid particles + audio params
  let skidMax = 0;
  for (const wh of v.wheels) {
    if (!wh.contact || wh.dead) continue;
    const spd = Math.abs(v.vel.x);
    if (wh.skid > .35 && spd > 3) {
      r.particles.wheelDust(wh.contact.x, wh.contact.y, -v.vel.x * .5, 0, dustColor(), 1);
    } else if (spd > 7 && Math.random() < .5) {
      if (r.biomeId === 'frost') r.particles.snowSpray(wh.contact.x, wh.contact.y, v.vel.x);
      else r.particles.wheelDust(wh.contact.x, wh.contact.y, -v.vel.x * .3, 0, dustColor(), 1);
    }
    skidMax = Math.max(skidMax, wh.skid);
  }
  // exhaust
  if (!v.crashed && !v.outOfFuel && r.state !== 'countdown') {
    const back = v.localToWorld({ x: -v.def.wheelbase * .62, y: .1 });
    if (v.throttle > 0 && Math.random() < .4) {
      r.particles.exhaust(back.x, back.y, v.vel.x, v.vel.y);
    }
    if (v.damage > .55) {
      const eng = v.localToWorld({ x: v.def.wheelbase * .3, y: .2 });
      if (Math.random() < (v.damage > .8 ? .5 : .3)) r.particles.engineSmoke(eng.x, eng.y, v.damage > .8 ? 1.6 : 1);
    }
  }

  // engine audio
  const spinAvg = (Math.abs(v.wheels[0].spinVel) + Math.abs(v.wheels[1].spinVel)) / 2;
  const rpm = clamp(spinAvg * v.def.wheelR / v.topSpeed * .8 + v.throttle * .3, 0, 1);
  audio.setEngine(v.outOfFuel || v.crashed ? 0 : rpm, v.throttle, skidMax, !v.grounded);

  // camera
  const cam = r.camera;
  const lookX = clamp(v.vel.x * .5, -3, 6.5);
  const targetX = v.pos.x + lookX;
  const targetY = v.pos.y + 1.1;
  cam.x = lerp(cam.x, targetX, 1 - Math.pow(.0018, dt));
  cam.y = lerp(cam.y, targetY, 1 - Math.pow(.006, dt));
  const zoomT = r.state === 'over' ? 1.18 : clamp(1.06 - Math.abs(v.vel.x) * .012, .8, 1.06);
  cam.zoom = lerp(cam.zoom, zoomT, 1 - Math.pow(.02, dt));
  cam.shx *= Math.pow(.001, dt); cam.shy *= Math.pow(.001, dt);

  // world upkeep
  w.ensure(v.pos.x + 60);
  w.update(dt, time);

  // ice patches (frost): low grip over shared ice bands
  v.icePatch = w.iceAt(v.pos.x);

  r.particles.update(dt, w);
  ui.setHUD({ fuel01: Math.max(0, fuel01), lowFuel: fuel01 < RUN.fuelWarn, coins: P.coins + sessionEarn(), dist: r.dist });
}

function updateTitle(dt) {
  const s = titleScene;
  if (!s) return;
  time += dt;
  const v = s.vehicle;
  v.step(dt, { gas: false, brake: false });
  // idle exhaust puffs
  if (Math.random() < .12) {
    const back = v.localToWorld({ x: -v.def.wheelbase * .62, y: .1 });
    s.particles.exhaust(back.x, back.y, .2, 0);
  }
  s.camera.x = v.pos.x + 2.5 + Math.sin(time * .1) * .4;
  s.camera.y = lerp(s.camera.y, v.pos.y + 1.5, .02);
  s.world.ensure(v.pos.x + 40);
  s.particles.update(dt, s.world);
}

/* ---------------- main loop ---------------- */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000);
  lastT = now;

  if (gameMode === 'run' && run) {
    updateRun(dt);
    renderer.draw({
      world: run.world, vehicle: run.vehicle, camera: run.camera,
      time, particles: run.particles, bestDist: run.bestDist,
      crashFade: run.crashFade, lowFuelPulse: run.vehicle.fuel / run.vehicle.fuelCap < .13 && !run.vehicle.outOfFuel,
    });
  } else if (gameMode === 'results' && run) {
    // frozen scene behind results card
    time += dt;
    run.particles.update(dt, run.world);
    run.world.update(dt, time);
    renderer.draw({
      world: run.world, vehicle: run.vehicle, camera: run.camera,
      time, particles: run.particles, bestDist: run.bestDist,
      crashFade: run.crashFade, lowFuelPulse: false,
    });
  } else if (titleScene) {
    updateTitle(dt);
    renderer.draw({ world: titleScene.world, vehicle: titleScene.vehicle, camera: titleScene.camera, time, particles: titleScene.particles, bestDist: 0 });
  }

  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
async function boot() {
  ui._show('boot');
  ui.paintBootLogo();
  ui.bootProgress(.2, 'LOADING FONTS…');
  try {
    await Promise.all([
      document.fonts.load("400 40px 'Titan One'"),
      document.fonts.load("900 20px Nunito"),
      document.fonts.load("800 italic 16px Nunito"),
    ]);
    await document.fonts.ready;
  } catch { }
  ui.bootProgress(.7, 'TUNING THE ENGINE…');
  await new Promise(r => setTimeout(r, 350));
  ui.bootProgress(1, 'GO!');
  await new Promise(r => setTimeout(r, 220));
  showTitle();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameMode === 'run' && run && run.state !== 'done') pauseRun();
});

/* ---------------- QA hooks (headless testing) ---------------- */
window.__qa = {
  start(biomeId, seed = 42, autopilot = true) {
    audio.unlock();
    const biome = BIOMES.find(b => b.id === biomeId) || BIOMES[0];
    const def = VEHICLES.find(v => v.id === P.selectedVehicle) || VEHICLES[0];
    const world = new World(biome, seed >>> 0, P.best[biome.id] || 0);
    const v = new Vehicle(def, P.upgrades[def.id], world);
    world.ensure(80);
    run = {
      biomeId, world, vehicle: v,
      camera: { x: v.pos.x + 2, y: v.pos.y + 1, zoom: 1, shx: 0, shy: 0 },
      particles: new Particles(),
      state: 'driving', countdownT: 0,
      coins: 0, gems: 0, fuelCans: 0, stuntCoins: 0, flipsTotal: 0,
      dist: 0, bestDist: P.best[biome.id] || 0, crashFade: 0, overT: 0, coastT: 0,
      lastMilestone: 0, tutorial: false, tutorialT: 99, autopilot,
    };
    v.landHandler = (a, f, c) => onLanding(a, f, c);
    v.crashHandler = () => onCrash();
    v.impactHandler = () => { };
    v.scrapeHandler = () => { };
    gameMode = 'run';
    if (run.autopilot) {
      // heuristic driver: full throttle; correct attitude in air; brake before steep drops
      input.gas = true; input.brake = false;
    }
  },
  autopilot(dt = 1 / 60) {
    const v = run.vehicle;
    let inp = { gas: true, brake: false };
    if (!v.grounded) {
      // normalized pitch: 0 = level, π = upside down; target slight nose-down for landing
      const norm = ((v.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let d = norm;                       // rotation state
      // if nose-up beyond ~40° and still rotating CCW, push nose down
      if ((d > 0.25 && d < 2.6) && v.angVel > -1.2) inp = { gas: false, brake: true };
      // if nose-down steep and rotating CW, lift nose
      else if (d > 3.9 && v.angVel < 1.2) inp = { gas: true, brake: false };
      else inp = { gas: true, brake: false };
    }
    return inp;
  },
  step(dt) {
    if (!run) return null;
    const inp = run.autopilot ? this.autopilot(dt) : input;
    const r = run;
    r.vehicle.step(dt, inp);
    r.dist = Math.max(r.dist, r.vehicle.pos.x - 14);
    r.world.ensure(r.vehicle.pos.x + 60);
    r.world.update(dt, 0);
    r.particles.update(dt, r.world);
    const cam = r.camera;
    cam.x = lerp(cam.x, r.vehicle.pos.x + clamp(r.vehicle.vel.x * .5, -3, 6.5), .12);
    cam.y = lerp(cam.y, r.vehicle.pos.y + 1.1, .1);
    return this.telemetry();
  },
  telemetry() {
    const v = run.vehicle;
    return {
      x: +v.pos.x.toFixed(1), dist: +run.dist.toFixed(1),
      speed: +Math.hypot(v.vel.x, v.vel.y).toFixed(1),
      angle: +v.angle.toFixed(2), grounded: v.grounded,
      crashed: v.crashed, fuel: +v.fuel.toFixed(1), damage: +v.damage.toFixed(2),
      coins: run.coins, gems: run.gems, stuntCoins: run.stuntCoins, flips: run.flipsTotal,
      airTime: +v.airTime.toFixed(2),
    };
  },
  showTitle, showStages, ui, renderer,
  vehicle: () => run?.vehicle,
  resetSave: () => { _reset(); },
  profile: () => P,
  input,
};

boot();
