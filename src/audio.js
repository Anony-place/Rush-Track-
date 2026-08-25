/* ============================================================
   RUSH TRACK audio engine — 100% procedural WebAudio.
   Music sequencer (menu + gameplay), RPM-driven engine synth,
   per-biome ambience beds, full UI/gameplay SFX.
   ============================================================ */
import { clamp } from './util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor(profile) {
    this.p = profile;
    this.ctx = null;
    this.ready = false;
    this.musicMode = null;
    this._musicTimer = null;
    this._ambTimer = [];
    this._engine = null;
    this._amb = null;
    this._lastLowFuel = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18; this.comp.knee.value = 24;
      this.comp.ratio.value = 6; this.comp.attack.value = .004; this.comp.release.value = .24;
      this.master.connect(this.comp); this.comp.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.engBus = this.ctx.createGain();
      this.ambBus = this.ctx.createGain();
      for (const b of [this.musicBus, this.sfxBus, this.engBus, this.ambBus]) b.connect(this.master);

      // shared delay for music
      this.delay = this.ctx.createDelay(1);
      this.delayFB = this.ctx.createGain(); this.delayFB.gain.value = .34;
      this.delaySend = this.ctx.createGain(); this.delaySend.gain.value = .5;
      this.delayFilter = this.ctx.createBiquadFilter(); this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.value = 2600;
      this.delaySend.connect(this.delay); this.delay.connect(this.delayFilter);
      this.delayFilter.connect(this.delayFB); this.delayFB.connect(this.delay);
      this.delayFilter.connect(this.musicBus);

      this.noiseBuf = this._makeNoise();
      this.ready = true;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ready) return;
    this.musicBus.gain.value = this.p.music ? .6 : 0;
    this.sfxBus.gain.value = this.p.sfx ? .9 : 0;
    this.ambBus.gain.value = this.p.sfx ? .5 : 0;
    this.engBus.gain.value = this.p.sfx ? .8 : 0;
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + .02 * white) / 1.02; // slight brown mix
      d[i] = white * .7 + last * 3.5;
    }
    return buf;
  }

  _noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop;
    return s;
  }

  _env(gainNode, t, peak, attack, decay, sustain = 0, rel = .05) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(Math.max(.0001, peak * decay), t + attack + decay);
  }

  _blip({ type = 'sine', f0, f1, t, dur, gain, bus, attack = .005, curve = 'exp' }) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined) (curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + .05);
    return o;
  }

  _noiseHit({ t, dur, gain, f0 = 3000, f1 = 200, type = 'lowpass', q = 1, bus }) {
    const s = this._noiseSrc(false);
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + .05);
  }

  /* ================= SFX ================= */
  click() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'square', f0: 1500, f1: 1050, t, dur: .06, gain: .12 });
    this._blip({ type: 'sine', f0: 3200, t: t + .004, dur: .04, gain: .06 });
  }
  back() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'square', f0: 700, f1: 480, t, dur: .08, gain: .12 });
  }
  coin(pitch = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'sine', f0: NOTE(88 + pitch), t, dur: .1, gain: .2 });
    this._blip({ type: 'sine', f0: NOTE(95 + pitch), t: t + .06, dur: .16, gain: .18 });
    this._blip({ type: 'triangle', f0: NOTE(107 + pitch), t: t + .06, dur: .12, gain: .08 });
  }
  gem() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [93, 100, 104].forEach((n, i) => this._blip({ type: 'sine', f0: NOTE(n), t: t + i * .07, dur: .22, gain: .16 }));
  }
  fuelPickup() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'sine', f0: 200, f1: 90, t, dur: .18, gain: .22 });
    for (let i = 0; i < 3; i++) this._blip({ type: 'sine', f0: 160 + i * 40, f1: 320 + i * 60, t: t + .05 + i * .07, dur: .09, gain: .12 });
    this._noiseHit({ t: t + .02, dur: .3, gain: .08, f0: 600, f1: 2400, type: 'bandpass', q: 2 });
  }
  whoosh() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseHit({ t, dur: .4, gain: .16, f0: 400, f1: 1600, type: 'bandpass', q: 1.4 });
  }
  flip(n) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.whoosh();
    [0, 4, 7, 12].slice(0, 2 + Math.min(2, n)).forEach((s, i) =>
      this._blip({ type: 'triangle', f0: NOTE(81 + s), t: t + .05 + i * .06, dur: .18, gain: .15 }));
  }
  land(force) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const g = clamp(force, .2, 1);
    this._blip({ type: 'sine', f0: 90, f1: 38, t, dur: .16, gain: .3 * g });
    this._noiseHit({ t, dur: .12 * g + .05, gain: .18 * g, f0: 900, f1: 120 });
  }
  thud() { this.land(.35); }
  crash() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseHit({ t, dur: .5, gain: .5, f0: 4000, f1: 90 });
    this._blip({ type: 'sine', f0: 70, f1: 26, t, dur: .5, gain: .55 });
    this._blip({ type: 'square', f0: 620, f1: 300, t, dur: .3, gain: .1 });
    this._blip({ type: 'square', f0: 880, f1: 420, t: t + .02, dur: .25, gain: .08 });
  }
  scrape() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseHit({ t, dur: .18, gain: .1, f0: 2400, f1: 3200, type: 'bandpass', q: 6 });
  }
  milestone() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [84, 91].forEach((n, i) => this._blip({ type: 'sine', f0: NOTE(n), t: t + i * .1, dur: .3, gain: .18 }));
  }
  lowFuel() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (t - this._lastLowFuel < 2.4) return;
    this._lastLowFuel = t;
    this._blip({ type: 'square', f0: 880, t, dur: .09, gain: .09 });
    this._blip({ type: 'square', f0: 880, t: t + .14, dur: .09, gain: .09 });
  }
  gameOver() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [76, 72, 69, 64].forEach((n, i) => this._blip({ type: 'triangle', f0: NOTE(n), t: t + i * .16, dur: .3, gain: .18 }));
    this._blip({ type: 'sine', f0: NOTE(52), t: t + .48, dur: .8, gain: .2 });
  }
  fanfare() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => this._blip({ type: 'square', f0: NOTE(n), t: t + i * .09, dur: .22, gain: .1 }));
    [72, 76, 79, 84].forEach((n, i) => this._blip({ type: 'sine', f0: NOTE(n + 12), t: t + i * .09, dur: .3, gain: .12 }));
    this._blip({ type: 'sine', f0: NOTE(96), t: t + .36, dur: .5, gain: .14 });
  }
  buy() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'sine', f0: NOTE(93), t, dur: .12, gain: .18 });
    this._blip({ type: 'sine', f0: NOTE(88), t: t + .05, dur: .1, gain: .14 });
    this._blip({ type: 'sine', f0: 220, f1: 80, t, dur: .12, gain: .2 });
  }
  denied() {
    if (!this.ready) this.unlock();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'square', f0: 220, t, dur: .1, gain: .12 });
    this._blip({ type: 'square', f0: 180, t: t + .1, dur: .16, gain: .12 });
  }
  countdown(final = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._blip({ type: 'sine', f0: final ? 1200 : 700, t, dur: final ? .4 : .12, gain: .2 });
  }

  /* ================= engine synth ================= */
  startEngine(def) {
    if (!this.ready) return;
    this.stopEngine();
    const c = this.ctx, t = c.currentTime;
    const S = def.sound;

    const out = c.createGain(); out.gain.value = 0;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 1.2;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.8 * x); }
    shaper.curve = curve;

    const osc1 = c.createOscillator(); osc1.type = 'sawtooth';
    const osc2 = c.createOscillator(); osc2.type = 'square';
    const g1 = c.createGain(); g1.gain.value = S.saw;
    const g2 = c.createGain(); g2.gain.value = S.square;
    const sub = c.createOscillator(); sub.type = 'sine';
    const gSub = c.createGain(); gSub.gain.value = .5;

    // exhaust noise
    const nz = this._noiseSrc();
    const nzF = c.createBiquadFilter(); nzF.type = 'bandpass'; nzF.frequency.value = 180; nzF.Q.value = .8;
    const gNz = c.createGain(); gNz.gain.value = S.noise * .5;

    osc1.connect(g1); osc2.connect(g2); sub.connect(gSub);
    g1.connect(shaper); g2.connect(shaper); gSub.connect(shaper);
    shaper.connect(filt);
    nz.connect(nzF); nzF.connect(gNz); gNz.connect(filt);
    filt.connect(out); out.connect(this.engBus);

    // skid layer
    const skz = this._noiseSrc();
    const skF = c.createBiquadFilter(); skF.type = 'bandpass'; skF.frequency.value = 950; skF.Q.value = 2.2;
    const skG = c.createGain(); skG.gain.value = 0;
    skz.connect(skF); skF.connect(skG); skG.connect(this.engBus);

    osc1.start(t); osc2.start(t); sub.start(t); nz.start(t); skz.start(t);

    this._engine = { def, out, filt, osc1, osc2, sub, nzF, gNz, skG, skz, nz, sources: [osc1, osc2, sub, nz, skz], rpm: 0 };
    out.gain.setTargetAtTime(.16, t, .3);
  }

  setEngine(rpm01, throttle, skid, airborne) {
    if (!this.ready || !this._engine) return;
    const e = this._engine, t = this.ctx.currentTime;
    const S = e.def.sound;
    const rpm = clamp(rpm01, 0, 1);
    e.rpm += (rpm - e.rpm) * .18;
    const r = e.rpm;
    // 3-"gear" pitch illusion
    const gearF = (r * 2.2) % .7;
    const f = S.base * (.55 + gearF * 1.15 + r * .5);
    e.osc1.frequency.setTargetAtTime(f, t, .04);
    e.osc2.frequency.setTargetAtTime(f * .5 * 1.005, t, .04);
    e.sub.frequency.setTargetAtTime(f * .25, t, .05);
    e.filt.frequency.setTargetAtTime(320 + r * 1900 + throttle * 700, t, .07);
    e.gNz.gain.setTargetAtTime(S.noise * (.25 + r * .5 + throttle * .3), t, .08);
    e.out.gain.setTargetAtTime(.13 + throttle * .09 + r * .05, t, .1);
    e.skG.gain.setTargetAtTime(skid * .22, t, .06);
  }

  stopEngine() {
    if (!this._engine) return;
    const e = this._engine, t = this.ctx.currentTime;
    e.out.gain.setTargetAtTime(0, t, .12);
    e.skG.gain.setTargetAtTime(0, t, .1);
    const srcs = e.sources;
    setTimeout(() => { try { srcs.forEach(s => s.stop()); } catch { } }, 600);
    this._engine = null;
  }

  /* ================= ambience ================= */
  startAmbience(biomeId) {
    if (!this.ready) return;
    this.stopAmbience();
    const c = this.ctx, t = c.currentTime;
    const bed = c.createGain(); bed.gain.value = 0; bed.connect(this.ambBus);

    // wind base
    const wind = this._noiseSrc();
    const windF = c.createBiquadFilter(); windF.type = 'lowpass';
    const windG = c.createGain();
    wind.connect(windF); windF.connect(windG); windG.connect(bed);
    wind.start(t);

    const cfg = {
      meadow: { vol: .1, freq: 420, birds: true },
      desert: { vol: .22, freq: 640, hawks: true },
      city: { vol: .12, freq: 200, crickets: true, sirens: true },
      frost: { vol: .3, freq: 520, gusts: true },
    }[biomeId] || { vol: .1, freq: 400 };

    windF.frequency.value = cfg.freq;
    windG.gain.value = cfg.vol;
    bed.gain.setTargetAtTime(1, t, 1.2);

    // slow wind swell LFO
    const lfo = c.createOscillator(); lfo.frequency.value = .07 + Math.random() * .05;
    const lfoG = c.createGain(); lfoG.gain.value = cfg.vol * .5;
    lfo.connect(lfoG); lfoG.connect(windG.gain); lfo.start(t);

    const timers = [];
    const every = (fn, min, max) => {
      const loop = () => {
        fn();
        const id = setTimeout(loop, (min + Math.random() * (max - min)) * 1000);
        timers.push(id);
      };
      loop();
    };

    if (cfg.birds) every(() => this._bird(bed), 2.2, 7);
    if (cfg.hawks) every(() => this._hawk(bed), 7, 16);
    if (cfg.crickets) every(() => this._crickets(bed), 3, 8);
    if (cfg.sirens) every(() => this._siren(bed), 14, 30);
    if (cfg.gusts) every(() => this._gust(bed), 4, 9);

    this._amb = { bed, wind, lfo, timers, srcs: [wind, lfo] };
  }

  _bird(bed) {
    const t = this.ctx.currentTime + Math.random() * .5;
    const base = 2200 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this._blip({ type: 'sine', f0: base, f1: base * (1.2 + Math.random() * .5), t: t + i * .14, dur: .1, gain: .035, bus: bed });
    }
  }
  _hawk(bed) {
    const t = this.ctx.currentTime;
    const o = this._blip({ type: 'sawtooth', f0: 1150, f1: 620, t, dur: .7, gain: .025, bus: bed });
  }
  _crickets(bed) {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      this._blip({ type: 'sine', f0: 4300, t: t + i * .07, dur: .045, gain: .012, bus: bed });
    }
  }
  _siren(bed) {
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 6; i++) {
      this._blip({ type: 'sine', f0: i % 2 ? 740 : 620, t: t + i * .35, dur: .34, gain: .014, bus: bed });
    }
  }
  _gust(bed) {
    const t = this.ctx.currentTime;
    const s = this._noiseSrc(false); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + 1.4);
    f.frequency.linearRampToValueAtTime(350, t + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(.09, t + 1.2);
    g.gain.linearRampToValueAtTime(.0001, t + 3.2);
    s.connect(f); f.connect(g); g.connect(bed);
    s.start(t); s.stop(t + 3.4);
  }

  stopAmbience() {
    if (!this._amb) return;
    const { bed, srcs, timers } = this._amb;
    bed.gain.setTargetAtTime(0, this.ctx.currentTime, .4);
    setTimeout(() => { try { srcs.forEach(s => s.stop()); } catch { } }, 1500);
    timers.forEach(id => clearTimeout(id));
    this._amb = null;
  }

  /* ================= music sequencer ================= */
  playMusic(mode) {
    if (!this.ready) return;
    if (this.musicMode === mode) return;
    this.stopMusic();
    this.musicMode = mode;
    const cfg = mode === 'menu' ? MENU_MUSIC : GAME_MUSIC;
    this._step16 = 0;
    this._nextStep = this.ctx.currentTime + .1;
    this._musicTimer = setInterval(() => this._schedule(cfg), 25);
  }
  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
    this.musicMode = null;
  }

  _schedule(cfg) {
    const spb = 60 / cfg.bpm, stepDur = spb / 4;
    while (this._nextStep < this.ctx.currentTime + .14) {
      this._playStep(cfg, this._step16, this._nextStep, stepDur);
      this._nextStep += stepDur;
      this._step16 = (this._step16 + 1) % 64;
    }
  }

  _playStep(cfg, s16, t, dt) {
    const bar = Math.floor(s16 / 16), beat = Math.floor((s16 % 16) / 4), sub = s16 % 16;
    const chord = cfg.prog[bar % cfg.prog.length];
    // drums
    if (cfg.kick(sub)) this._kick(t, cfg.kickVol);
    if (cfg.snare(sub)) this._snare(t, cfg.snareVol);
    if (cfg.hat(sub)) this._hat(t, sub % 8 === 6 ? .5 : .18);
    // bass
    const bnote = cfg.bass(sub, chord);
    if (bnote !== null) this._bassNote(bnote, t, dt * (cfg.bassLen || 1.6), cfg.bassVol);
    // arp
    const an = cfg.arp && cfg.arp(sub, chord, bar);
    if (an !== null && an !== undefined) this._pluck(an, t, .09, cfg.arpVol, true);
    // lead melody (sparse phrases)
    if (cfg.lead) {
      const ln = cfg.lead(sub, chord, bar);
      if (ln !== null && ln !== undefined) this._leadNote(ln, t, dt * 3, cfg.leadVol);
    }
    // pad at bar start
    if (sub === 0 && cfg.pad) this._pad(chord, t, (60 / cfg.bpm) * 4, cfg.padVol);
  }

  _kick(t, vol) {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + .12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + .2);
  }
  _snare(t, vol) {
    const s = this._noiseSrc(false); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .16);
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    s.start(t, Math.random()); s.stop(t + .2);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(vol * .5, t);
    og.gain.exponentialRampToValueAtTime(.001, t + .09);
    o.connect(og); og.connect(this.musicBus);
    o.start(t); o.stop(t + .1);
  }
  _hat(t, vol) {
    const s = this._noiseSrc(false); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * .16, t);
    g.gain.exponentialRampToValueAtTime(.001, t + (vol > .3 ? .22 : .05));
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    s.start(t, Math.random()); s.stop(t + .3);
  }
  _bassNote(n, t, dur, vol) {
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    f.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + .05);
  }
  _pluck(n, t, dur, vol, delay) {
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = NOTE(n);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .006);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(f); f.connect(g);
    g.connect(this.musicBus);
    if (delay) g.connect(this.delaySend);
    o.start(t); o.stop(t + dur + .05);
  }
  _leadNote(n, t, dur, vol) {
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = NOTE(n);
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = NOTE(n) * 1.006;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .02);
    g.gain.setValueAtTime(vol, t + dur * .5);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o1.connect(f); o2.connect(f); f.connect(g);
    g.connect(this.musicBus); g.connect(this.delaySend);
    o1.start(t); o1.stop(t + dur + .05);
    o2.start(t); o2.stop(t + dur + .05);
  }
  _pad(chord, t, dur, vol) {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * .3);
    g.gain.linearRampToValueAtTime(.0001, t + dur);
    f.connect(g); g.connect(this.musicBus);
    for (const n of chord.notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
        o.connect(f);
        o.start(t); o.stop(t + dur + .1);
      }
    }
  }
}

/* Chords as {root, notes} midi note arrays (A minor family) */
const Am = { root: 45, notes: [57, 60, 64] };
const F = { root: 41, notes: [53, 57, 60] };
const C = { root: 48, notes: [55, 60, 64] };
const G = { root: 43, notes: [55, 59, 62] };
const Dm = { root: 50, notes: [62, 65, 69] };
const Em = { root: 52, notes: [64, 67, 71] };

const MENU_MUSIC = {
  bpm: 92,
  prog: [Am, F, C, G],
  kick: (s) => s === 0 || s === 8,
  kickVol: .5,
  snare: (s) => s === 4 || s === 12,
  snareVol: .16,
  hat: (s) => s % 4 === 2,
  bass: (s, ch) => (s === 0 ? ch.root : s === 10 ? ch.root + 7 : null),
  bassVol: .17, bassLen: 3,
  pad: true, padVol: .05,
  arp: null,
  lead: (s, ch, bar) => {
    const phrase = [0, null, null, 4, null, null, 7, null, null, null, 9, null, 7, null, null, null];
    const p = phrase[s];
    return p === null || p === undefined ? null : ch.notes[0] + 12 + p - (p > 7 ? 0 : 0);
  },
  leadVol: .045,
};

const GAME_MUSIC = {
  bpm: 128,
  prog: [Am, F, C, G],
  kick: (s) => s % 4 === 0,
  kickVol: .65,
  snare: (s) => s % 16 === 4 || s % 16 === 12,
  snareVol: .3,
  hat: (s) => s % 2 === 0 ? false : true,
  bass: (s, ch) => {
    const seq = [0, 0, 12, 0, 0, 12, 0, 10];
    return ch.root + seq[s % 8] - 12;
  },
  bassVol: .2, bassLen: 1.2,
  pad: true, padVol: .035,
  arp: (s, ch, bar) => {
    const tones = [ch.notes[0] + 12, ch.notes[1] + 12, ch.notes[2] + 12, ch.notes[1] + 12];
    return tones[s % 4];
  },
  arpVol: .05,
  lead: (s, ch, bar) => {
    if (bar % 2 !== 1) return null;
    const hook = {
      1: [76, null, null, 74, null, 76, null, null, 79, null, null, null, 76, null, null, null],
      3: [74, null, null, 72, null, 74, null, null, 71, null, null, null, 69, null, null, null],
    }[bar % 4 === 1 ? 1 : 3];
    const n = hook[s];
    return n ?? null;
  },
  leadVol: .075,
};
