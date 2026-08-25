/* ============================================================
   UI: DOM screens (boot, title, stages, garage, pause,
   results), HUD, SVG icon set, painted logo & vignettes.
   ============================================================ */
import { VEHICLES, UPGRADES, MAX_LEVEL, upgradeCost, UPG_BASE, BIOMES } from './data.js';
import { fmt } from './util.js';
import { drawVehicle } from './vehicleArt.js';
import { drawProp } from './props.js';
import { fbm, mulberry32, TAU } from './util.js';

/* ---------------- icon set (single-path, rounded style) ---------------- */
const ICONS = {
  play: 'M8 5.2v13.6c0 .9 1 1.5 1.8 1L21.4 13a1.2 1.2 0 0 0 0-2L9.8 4.2C9 3.7 8 4.3 8 5.2z',
  pause: 'M7 5h3.4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6.6 0H17a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3.4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  wrench: 'M21.7 6.3a5.5 5.5 0 0 1-7.4 6.5L7.1 20a2.3 2.3 0 0 1-3.2-3.2l7.2-7.2a5.5 5.5 0 0 1 6.5-7.4L14 5.8l.1 4.1 4.1.1 3.5-3.7zM5.5 18.1a1 1 0 1 0 1.4 1.4 1 1 0 0 0-1.4-1.4z',
  coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6zm0 2.3a.9.9 0 0 1 .9.9v.5c1 .2 1.8.9 1.8 2 0 1.4-1.3 2-2.6 2.2-.6.1-.9.3-.9.6 0 .3.3.5.8.5.4 0 .7-.1.9-.3a.9.9 0 0 1 1.3 1.2c-.5.5-1.1.8-1.8.9v.4a.9.9 0 0 1-1.8 0v-.5c-1-.2-1.9-.9-1.9-2 0-1.4 1.3-2 2.7-2.2.6-.1.9-.3.9-.5s-.3-.5-.9-.5c-.4 0-.7.1-.9.3a.9.9 0 0 1-1.2-1.3c.5-.5 1.1-.7 1.7-.8v-.4a.9.9 0 0 1 1-.9z',
  gem: 'M6 3h12a1 1 0 0 1 .8.4l3 4a1 1 0 0 1-.1 1.3l-9 10a1 1 0 0 1-1.5 0l-9-10a1 1 0 0 1 0-1.3l3-4A1 1 0 0 1 6 3zm.5 2-1.8 2.4h4.1L10 5zm4.6 0-1.2 2.4h5.4L13.5 5zM11 9.4H5.4l5.6 6.2zm2.4 8.6 5.6-6.2H13z',
  fuel: 'M5 3h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 2v5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm11.3.3 2.4 2.4a1 1 0 0 1 .3.7V16a2.5 2.5 0 0 1-5 0v-2h-1v-2h3v2a.5.5 0 0 0 1 0V8.9l-1.7-1.7zM7.5 6h3v2h-3z',
  flag: 'M5 2a1 1 0 0 1 1 1v1l6.5-1.8a2 2 0 0 1 2.6 2L14.6 7l4.4-1a1 1 0 0 1 .5 2l-13.4 3a1 1 0 0 1-.1-2l.4-.1V3a1 1 0 0 1 1-1zm1 8.6 13-2.9a1 1 0 0 1 .4 2L6 12.6V21a1 1 0 0 1-2 0v-9a1 1 0 0 1 2-.4z',
  trophy: 'M7 3h10a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1c0 2.6-1.6 4.6-4 5.4A5 5 0 0 1 13 14v2h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h2v-2a5 5 0 0 1-4-2.6C3.6 10.6 2 8.6 2 6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1h1zm-2.8 4c.2 1.2.9 2.1 1.8 2.5V7zm15.6 0h-1.8v2.5c.9-.4 1.6-1.3 1.8-2.5z',
  sound: 'M4 9h3l5-4a1 1 0 0 1 1.7.8v8.4a1 1 0 0 1-1.7.8l-5-4H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm12.5-1.8a1 1 0 0 1 1.4 0 7 7 0 0 1 0 9.6 1 1 0 0 1-1.4-1.4 5 5 0 0 0 0-6.8 1 1 0 0 1 0-1.4zm2.8-2.9a1 1 0 0 1 1.4 0 11 11 0 0 1 0 15.4 1 1 0 0 1-1.4-1.4 9 9 0 0 0 0-12.6 1 1 0 0 1 0-1.4z',
  mute: 'M4 9h3l5-4a1 1 0 0 1 1.7.8v8.4a1 1 0 0 1-1.7.8l-5-4H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm15.3-2.3 2.4 2.4 1.3-1.3a1 1 0 0 1 1.4 1.4L21.1 10l1.3 1.3a1 1 0 0 1-1.4 1.4L19.7 11.4l-1.3 1.3a1 1 0 0 1-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 0 1 1.4-1.4z',
  music: 'M9 3v10.6A3.5 3.5 0 1 0 11 17V7l9-2v6.6A3.5 3.5 0 1 0 22 14V2L9 3z',
  lock: 'M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V8a3 3 0 0 0-6 0zm3 4a1.5 1.5 0 0 0-.7 2.8V19a.7.7 0 0 0 1.4 0v-2.2A1.5 1.5 0 0 0 12 14z',
  check: 'M20.3 5.7a1 1 0 0 1 0 1.4l-10 10a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.4L9.6 15 18.9 5.7a1 1 0 0 1 1.4 0z',
  back: 'M14.7 4.3a1 1 0 0 1 0 1.4L8.4 12l6.3 6.3a1 1 0 0 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z',
  fwd: 'M9.3 4.3a1 1 0 0 1 1.4 0l7 7a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4-1.4L15.6 12 9.3 5.7a1 1 0 0 1 0-1.4z',
  flame: 'M12 2s1 2.4 1 4.2c0 1.5-1 2.4-2 2.4S8 7.7 8 6.4C8 4.3 10 2 10 2 6 3.4 4 6.5 4 9.7A8 8 0 0 0 12 22a8 8 0 0 0 8-8c0-4.4-3.4-7.5-8-12zM12 19a3.4 3.4 0 0 1-3.5-3.4c0-1.8 1.3-3 3.3-5.6 1.9 2.5 3.7 3.9 3.7 5.8A3.5 3.5 0 0 1 12 19z',
  engine: 'M4 8h2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2h2l2-2h1v12h-1l-2-2h-2v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm14.6 1.4L21 8v8l-2.4-1.4a3 3 0 0 0 0-5.2zM10 8v8',
  susp: 'M6 21a1 1 0 0 1-1-1c0-5 3.5-7.5 3.5-10.5C8.5 7 7 5.6 5.4 5.1a1 1 0 0 1 .5-1.9C8.4 3.8 10.5 6 10.5 9.5c0 2-.9 3.6-1.8 5.1-.8 1.5-1.7 3-1.7 5.4a1 1 0 0 1-1 1zm12 0a1 1 0 0 1-1-1c0-2.4-.9-3.9-1.7-5.4-.9-1.5-1.8-3.1-1.8-5.1C13.5 6 15.6 3.8 18.1 3.2a1 1 0 0 1 .5 1.9C17 5.6 15.5 7 15.5 9.5c0 3 3.5 5.5 3.5 10.5a1 1 0 0 1-1 1zM12 6a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1zm0 5a1 1 0 0 1-1-1V9a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1zm0 5a1 1 0 0 1-1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1zm0 5a1 1 0 0 1-1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1z',
  tire: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 2.7a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM11 1h2v2h-2zm0 20h2v2h-2zm9-9h2v0zM1 11h2v2H1zm20 0h2v2h-2z',
  tank: 'M6 4h9a1 1 0 0 1 .8.4L18 8h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v13h13v-9h-1a1 1 0 0 1-.8-.4L15.5 6zm2 3h5v6H8zm7.5 0h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 2.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 2.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1z',
  awd: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM4 13H2v-2h2zm18 0h-2v-2h2zM12 6V4h0zM6.3 7.1 4.9 5.6 6.3 4.2l1.5 1.4zM17.7 7.1l-1.4-1.5 1.4-1.4 1.5 1.4zM6.3 16.9l1.5 1.4-1.5 1.5-1.4-1.5zM17.7 16.9l1.5 1.4-1.5 1.5-1.4-1.5z',
  speed: 'M12 4a9 9 0 0 0-7.8 13.5A1 1 0 0 0 5 18h14a1 1 0 0 0 .8-.5A9 9 0 0 0 12 4zm0 6.5a2.5 2.5 0 0 1 1.9 4.1l3 2.4-.6.8-.4.2H8.1a1 1 0 0 1-.5-1.9l3-2.5A2.5 2.5 0 0 1 12 10.5zM4 12H2v-1.5h2zm18 0h-2v-1.5h2zM6 6.6 4.9 5.2l1-1 1.2 1.3zm12 0-1.2-.1 1.2-1.3 1 1z',
  crash: 'M12 2a8.5 8.5 0 0 0-8.4 9.8c.1.6.7 1 1.3.9l1.6-.3.9 1.6-1 1.4c-.4.5-.2 1.3.4 1.5a8.4 8.4 0 0 0 3.4.7l1-1.6h1.9l.9 1.6a8.6 8.6 0 0 0 3.3-1c.5-.3.6-1 .2-1.4l-1.1-1.3.8-1.7 1.7.4c.6.2 1.2-.2 1.3-.9A8.5 8.5 0 0 0 12 2zm-3.5 5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm7 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM12 12.4l1.2 2.4h-2.4z',
  fuelout: 'M12 3a9 9 0 0 0-9 9c0 1.6.4 3 1.1 4.3l-1.5 1.4a1 1 0 0 0 .6 1.7l4.3.5A9 9 0 1 0 12 3zm0 2a7 7 0 1 1-4.6 12.3l-.4-.4-2-.2.6-.6a1 1 0 0 0 .1-1.3A7 7 0 0 1 5 12a7 7 0 0 1 7-7zm-2.8 3.6c.3 0 .5.1.7.3l5.6 5.6c.2.2.3.5.3.7a1 1 0 0 1-1.7.7L8.5 10.3a1 1 0 0 1 .7-1.7zm5.6 0a1 1 0 0 1 .7 1.7l-1 1-1.4-1.4 1-1c.2-.2.4-.3.7-.3z',
  close: 'M6 4.6 12 10.6 18 4.6 19.4 6 13.4 12 19.4 18 18 19.4 12 13.4 6 19.4 4.6 18 10.6 12 4.6 6 6 4.6z',
  car: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2zm3.4-4L7.1 11h9.8l-1.3-4a.5.5 0 0 0-.5-.4H8.9a.5.5 0 0 0-.5.4zM6.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  dist: 'M6 2a1 1 0 0 1 1 1v1.3l11-2.1A2 2 0 0 1 20.4 4l.6 2.8a2 2 0 0 1-1.5 2.4L7 12v8.9a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm2 4.4v3.5l10.6-2.3-.4-2L8 6.4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
};
export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24"><path d="${ICONS[name] || ICONS.check}"/></svg>`;
}
const coinIco = `<svg class="coin-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f7b825"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#ffe9a0" stroke-width="1.6"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#c98a10" stroke-width="1.2"/><path d="M12 7.6l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="#ffe9a0"/></svg>`;
const gemIco = `<svg class="coin-ico" viewBox="0 0 24 24"><path d="M7 4h10l4 5-9 11L3 9z" fill="#49d6f0"/><path d="M7 4h5l-2 5 2 11L3 9z" fill="#8aeaf8"/><path d="M12 4h5l4 5-9 11z" fill="#1e9ed8"/></svg>`;

/* ---------------- pedal graphics ---------------- */
function pedalSVG(kind) {
  const id = kind === 'gas' ? 'g' : 'b';
  const c1 = kind === 'gas' ? ['#7bf0a0', '#2fae56', '#1d7331'] : ['#ff9d9d', '#e85656', '#a02f2f'];
  const chev = kind === 'gas'
    ? '<path d="M30 46l12-12-12-12 8 0 12 12-12 12z" fill="rgba(255,255,255,.9)"/><path d="M48 46l12-12-12-12 8 0 12 12-12 12z" fill="rgba(255,255,255,.65)"/>'
    : '<path d="M54 46l-12-12 12-12-8 0-12 12 12 12z" fill="rgba(255,255,255,.9)"/><path d="M36 46l-12-12 12-12-8 0-12 12 12 12z" fill="rgba(255,255,255,.65)"/>';
  return `<svg viewBox="0 0 84 84">
  <defs>
    <linearGradient id="pg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1[0]}"/><stop offset=".55" stop-color="${c1[1]}"/><stop offset="1" stop-color="${c1[2]}"/>
    </linearGradient>
    <linearGradient id="pgs-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.5)"/><stop offset=".5" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <g class="pedal-shape">
    <circle cx="42" cy="42" r="38" fill="url(#pg-${id})"/>
    <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(8,14,26,.55)" stroke-width="4"/>
    <circle cx="42" cy="42" r="33.5" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-dasharray="4 7"/>
    <circle cx="42" cy="42" r="30" fill="rgba(10,18,32,.18)"/>
    <circle cx="42" cy="42" r="30" fill="url(#pgs-${id})"/>
    ${chev}
  </g>
</svg>`;
}

/* ============================================================ */
export class UI {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.screens = {};
    this.hudEls = {};
    this.garageIdx = 0;
    this._garageRaf = null;
    this._build();
  }

  _el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  _btn(label, ic, cls = '', id = '') {
    return `<button class="btn ${cls}" ${id ? `id="${id}"` : ''}>${ic ? icon(ic) : ''}<span>${label}</span></button>`;
  }

  _build() {
    this.root.innerHTML = '';
    this._buildBoot();
    this._buildTitle();
    this._buildStages();
    this._buildGarage();
    this._buildPause();
    this._buildResults();
    this._buildHUD();
  }

  /* ---------- boot ---------- */
  _buildBoot() {
    const s = this._el(`<div class="screen" id="boot-screen">
      <canvas class="boot-logo" id="boot-logo" width="10" height="10"></canvas>
      <div class="boot-bar"><i id="boot-fill"></i></div>
      <div class="boot-tip" id="boot-tip">WARMING UP THE ENGINE…</div>
    </div>`);
    this.root.appendChild(s);
    this.screens.boot = s;
  }
  bootProgress(p, tip) {
    const f = this.screens.boot.querySelector('#boot-fill');
    if (f) f.style.width = Math.round(p * 100) + '%';
    if (tip) this.screens.boot.querySelector('#boot-tip').textContent = tip;
  }
  paintBootLogo() {
    const cv = this.screens.boot.querySelector('#boot-logo');
    paintLogo(cv);
  }

  /* ---------- title ---------- */
  _buildTitle() {
    const s = this._el(`<div class="screen hidden" id="title-screen">
      <div class="title-top">
        <div class="pill click" id="title-coins">${coinIco}<span>0</span></div>
        <div class="hdr-btns">
          <button class="btn-round" id="title-sfx" title="Sound">${icon('sound')}</button>
          <button class="btn-round" id="title-music" title="Music">${icon('music')}</button>
        </div>
      </div>
      <canvas class="title-logo" id="title-logo" width="10" height="10"></canvas>
      <div class="title-tag">TURBO HILL RACING · STUNT ADVENTURE</div>
      <div class="title-actions">
        ${this._btn('PLAY', 'play', 'accent big')}
        ${this._btn('GARAGE', 'wrench', 'gray')}
      </div>
      <div class="title-foot">ARROW KEYS / WASD ON DESKTOP · HOLD PEDALS ON TOUCH</div>
    </div>`);
    s.querySelector('#title-logo') && paintLogo(s.querySelector('#title-logo'));
    s.querySelector('.title-actions .btn').addEventListener('click', () => { this.h.audio?.click(); this.h.onPlay(); });
    s.querySelectorAll('.title-actions .btn')[1].addEventListener('click', () => { this.h.audio?.click(); this.h.onGarage(); });
    s.querySelector('#title-coins').addEventListener('click', () => this.h.onGarage());
    s.querySelector('#title-sfx').addEventListener('click', (e) => this.h.onToggleSfx(e.currentTarget));
    s.querySelector('#title-music').addEventListener('click', (e) => this.h.onToggleMusic(e.currentTarget));
    this.root.appendChild(s);
    this.screens.title = s;
  }
  showTitle(coins) {
    this._show('title');
    this.screens.title.querySelector('#title-coins span').textContent = fmt(coins);
    paintLogo(this.screens.title.querySelector('#title-logo'));
    const p = this.h.profile();
    this._syncToggle(this.screens.title.querySelector('#title-sfx'), p.sfx);
    this._syncToggle(this.screens.title.querySelector('#title-music'), p.music);
  }
  _syncToggle(btn, on) { btn.classList.toggle('off', !on); }

  /* ---------- stage select ---------- */
  _buildStages() {
    const s = this._el(`<div class="screen hidden" id="stage-screen">
      <div class="dim"></div>
      <div class="screen-header">
        <button class="btn-round" id="stages-back">${icon('back')}</button>
        <div class="screen-title">SELECT STAGE</div>
        <div class="pill">${coinIco}<span id="stages-coins">0</span></div>
      </div>
      <div class="stage-grid" id="stage-grid"></div>
    </div>`);
    s.querySelector('#stages-back').addEventListener('click', () => { this.h.audio?.back(); this.h.onTitle(); });
    this.root.appendChild(s);
    this.screens.stages = s;
  }
  showStages(profile) {
    this._show('stages');
    this.screens.stages.querySelector('#stages-coins').textContent = fmt(profile.coins);
    const grid = this.screens.stages.querySelector('#stage-grid');
    grid.innerHTML = '';
    for (const b of BIOMES) {
      const unlocked = profile.bestOverall >= b.unlockDist;
      const best = profile.best[b.id] || 0;
      const card = this._el(`<div class="stage-card ${unlocked ? '' : 'locked'}" data-biome="${b.id}">
        <canvas width="460" height="200"></canvas>
        ${best > 0 ? `<div class="sc-best pill">${icon('dist')}<span>${fmt(best)} m</span></div>` : ''}
        ${unlocked ? '' : `<div class="lock-overlay">${icon('lock')}<div class="lock-req">${icon('dist')}<span>${b.unlockText}</span></div></div>`}
        <div class="sc-body">
          <div class="sc-name">${b.name}</div>
          <div class="sc-sub">${icon('flame')}<span>${b.tagline}</span></div>
        </div>
      </div>`);
      paintVignette(card.querySelector('canvas'), b, unlocked);
      card.addEventListener('click', () => {
        if (!unlocked) { this.h.audio?.denied(); return; }
        this.h.audio?.click();
        this.h.onStartStage(b.id);
      });
      grid.appendChild(card);
    }
  }

  /* ---------- garage ---------- */
  _buildGarage() {
    const s = this._el(`<div class="screen hidden" id="garage-screen">
      <div class="screen-header">
        <button class="btn-round" id="garage-back">${icon('back')}</button>
        <div class="screen-title">GARAGE</div>
        <div class="pill">${coinIco}<span id="garage-coins">0</span></div>
      </div>
      <div class="garage-main">
        <div class="garage-left">
          <div class="garage-panel vehicle-stage">
            <canvas id="garage-canvas"></canvas>
            <div class="vs-flag">${icon('car')}<span id="garage-flag">OWNED</span></div>
            <div class="vehicle-nav">
              <button class="btn-round" id="v-prev">${icon('back')}</button>
              <button class="btn-round" id="v-next">${icon('fwd')}</button>
            </div>
            <div class="vehicle-dots" id="v-dots"></div>
          </div>
          <div class="garage-panel">
            <div class="vname-row"><div class="vname" id="v-name"></div><div class="vclass" id="v-class"></div></div>
            <div class="vstats" id="v-stats"></div>
            <div class="garage-actions" id="v-actions"></div>
          </div>
        </div>
        <div class="garage-panel upgrade-list" id="upgrade-list"></div>
      </div>
    </div>`);
    s.querySelector('#garage-back').addEventListener('click', () => { this.h.audio?.back(); this.h.onTitle(); });
    s.querySelector('#v-prev').addEventListener('click', () => { this.h.audio?.click(); this.garageNav(-1); });
    s.querySelector('#v-next').addEventListener('click', () => { this.h.audio?.click(); this.garageNav(1); });
    this.root.appendChild(s);
    this.screens.garage = s;
  }

  garageNav(d) {
    this.garageIdx = (this.garageIdx + d + VEHICLES.length) % VEHICLES.length;
    this.showGarage();
  }

  showGarage() {
    const p = this.h.profile();
    this._show('garage');
    this.screens.garage.querySelector('#garage-coins').textContent = fmt(p.coins);
    const def = VEHICLES[this.garageIdx];
    const owned = !!p.owned[def.id];
    const sel = p.selectedVehicle === def.id;

    this.screens.garage.querySelector('#v-name').textContent = def.name;
    this.screens.garage.querySelector('#v-class').textContent = def.cls;
    this.screens.garage.querySelector('#garage-flag').textContent = !owned ? 'LOCKED' : sel ? 'SELECTED' : 'OWNED · TAP TO SELECT';

    // stats bars (with upgrade preview)
    const upg = p.upgrades[def.id];
    const rows = [
      ['speed', 'speed', def.topSpeed / 34],
      ['accel', 'engine', def.engine / 24],
      ['grip', 'tire', def.grip / 1.15],
      ['fuel', 'tank', def.fuelCap / 95],
    ];
    const stats = this.screens.garage.querySelector('#v-stats');
    stats.innerHTML = rows.map(([lbl, ic, base]) => {
      const w = Math.round(Math.min(1, base + upg[id2upg(lbl)] * .09) * 100);
      return `<div class="vstat">${icon(ic)}<span>${lbl.toUpperCase()}</span><div class="bar"><i style="width:${w}%"></i></div></div>`;
      function id2upg(l) { return { speed: 'engine', accel: 'engine', grip: 'tires', fuel: 'tank' }[l]; }
    }).join('');

    // actions
    const act = this.screens.garage.querySelector('#v-actions');
    act.innerHTML = '';
    if (!owned) {
      const buy = this._el(this._btn(`BUY · ${fmt(def.price)}`, 'coin', 'green'));
      buy.style.width = '100%';
      buy.addEventListener('click', () => this.h.onBuyVehicle(def.id));
      act.appendChild(buy);
    } else if (!sel) {
      const use = this._el(this._btn('SELECT', 'check', 'cyan'));
      use.style.width = '100%';
      use.addEventListener('click', () => this.h.onSelectVehicle(def.id));
      act.appendChild(use);
    } else {
      const lbl = this._el(`<div style="width:100%;text-align:center;color:#7dffa8;font-weight:900;letter-spacing:1px;padding:10px">${icon('check')} READY TO RACE</div>`);
      act.appendChild(lbl);
    }

    // upgrade rows
    const list = this.screens.garage.querySelector('#upgrade-list');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = upg[u.id];
      const maxed = lvl >= MAX_LEVEL;
      const cost = upgradeCost(UPG_BASE[def.id], lvl);
      const row = this._el(`<div class="upg-row">
        <div class="upg-ico">${icon(u.icon)}</div>
        <div>
          <div class="upg-name">${u.name}</div>
          <div class="upg-desc">${u.desc}</div>
          <div class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('')}</div>
        </div>
        <div class="upg-btn">${maxed
          ? `<button class="btn small gray" disabled><span class="maxed">MAX</span></button>`
          : this._btn('', 'coin', 'small upg-cost')} </div>
      </div>`);
      if (!maxed) {
        const btn = row.querySelector('button');
        btn.innerHTML = `<span class="cost">${coinIco.replace('class="coin-ico"', 'class="coin-ico"')}<span>${fmt(cost)}</span></span><span style="font-size:11px;opacity:.85">TAP TO UPGRADE</span>`;
        btn.disabled = !owned || p.coins < cost;
        btn.addEventListener('click', () => this.h.onUpgrade(def.id, u.id));
      } else {
        row.querySelector('button').innerHTML = `<span class="maxed">MAXED</span>`;
      }
      list.appendChild(row);
    }

    // dots
    const dots = this.screens.garage.querySelector('#v-dots');
    dots.innerHTML = VEHICLES.map((v, i) => `<span class="vdot ${i === this.garageIdx ? 'on' : ''}"></span>`).join('');

    this._startGaragePreview(def, owned);
  }

  _startGaragePreview(def, owned) {
    if (this._garageRaf) cancelAnimationFrame(this._garageRaf);
    const cv = this.screens.garage.querySelector('#garage-canvas');
    const ctx = cv.getContext('2d');
    let t0 = performance.now();
    const mock = garageMock(def);
    const loop = () => {
      if (!this.screens.garage.classList.contains('hidden')) {
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== w * 2 || cv.height !== h * 2) { cv.width = w * 2; cv.height = h * 2; }
        const t = (performance.now() - t0) / 1000;
        drawGarageScene(ctx, cv.width, cv.height, mock, t, owned);
        this._garageRaf = requestAnimationFrame(loop);
      }
    };
    loop();
  }

  /* ---------- pause ---------- */
  _buildPause() {
    const s = this._el(`<div class="screen hidden" id="pause-screen">
      <div class="dim"></div>
      <div class="overlay-card">
        <div class="oc-title">PAUSED</div>
        <div class="oc-sub" id="pause-stats"></div>
        <div class="oc-actions">
          ${this._btn('RESUME', 'play', 'green')}
          ${this._btn('RESTART', 'flame', 'gray')}
          ${this._btn('QUIT', 'close', 'gray')}
        </div>
        <div class="toggles">
          <button class="btn-round" id="pause-sfx">${icon('sound')}</button>
          <button class="btn-round" id="pause-music">${icon('music')}</button>
        </div>
      </div>
    </div>`);
    const [res, rst, quit] = s.querySelectorAll('.oc-actions .btn');
    res.addEventListener('click', () => { this.h.audio?.click(); this.h.onResume(); });
    rst.addEventListener('click', () => { this.h.audio?.click(); this.h.onRestart(); });
    quit.addEventListener('click', () => { this.h.audio?.back(); this.h.onQuit(); });
    s.querySelector('#pause-sfx').addEventListener('click', (e) => this.h.onToggleSfx(e.currentTarget));
    s.querySelector('#pause-music').addEventListener('click', (e) => this.h.onToggleMusic(e.currentTarget));
    this.root.appendChild(s);
    this.screens.pause = s;
  }
  showPause(stats) {
    this._show('pause', true);
    this.screens.pause.querySelector('#pause-stats').textContent = stats;
    const p = this.h.profile();
    this._syncToggle(this.screens.pause.querySelector('#pause-sfx'), p.sfx);
    this._syncToggle(this.screens.pause.querySelector('#pause-music'), p.music);
  }
  hidePause() { this.screens.pause.classList.add('hidden'); }

  /* ---------- results ---------- */
  _buildResults() {
    const s = this._el(`<div class="screen hidden" id="results-screen">
      <div class="dim"></div>
      <div class="overlay-card">
        <div class="result-cause" id="res-cause"></div>
        <div class="oc-title" id="res-title">RUN OVER</div>
        <div class="result-dist"><span id="res-dist">0</span><small> m</small></div>
        <div id="res-record"></div>
        <div class="earn-list" id="res-earn"></div>
        <div class="oc-actions">
          ${this._btn('RETRY', 'flame', 'green')}
          ${this._btn('GARAGE', 'wrench', 'gray')}
          ${this._btn('MENU', 'back', 'gray')}
        </div>
      </div>
    </div>`);
    const [retry, gar, menu] = s.querySelectorAll('.oc-actions .btn');
    retry.addEventListener('click', () => { this.h.audio?.click(); this.h.onRestart(); });
    gar.addEventListener('click', () => { this.h.audio?.click(); this.h.onGarage(); });
    menu.addEventListener('click', () => { this.h.audio?.back(); this.h.onQuit(); });
    this.root.appendChild(s);
    this.screens.results = s;
  }
  showResults({ cause, title, dist, isRecord, earn }) {
    this._show('results', true);
    const s = this.screens.results;
    const causeIcon = cause === 'fuel' ? 'fuelout' : 'crash';
    const causeText = cause === 'fuel' ? 'OUT OF FUEL' : 'DRIVER DOWN';
    s.querySelector('#res-cause').innerHTML = `<span style="fill:var(--red)">${icon(causeIcon)}</span><span class="oc-sub" style="color:#ff9b9f">${causeText}</span>`;
    s.querySelector('#res-title').textContent = title;
    s.querySelector('#res-record').innerHTML = isRecord
      ? `<div class="record-badge">${icon('trophy')}<span>NEW RECORD!</span></div>` : '';
    const distEl = s.querySelector('#res-dist');
    const list = s.querySelector('#res-earn');
    list.innerHTML = '';
    const rows = [
      ['dist', 'DISTANCE', Math.round(earn.dist)],
      ['coin', 'PICKUPS', earn.pickups],
      ['flame', 'STUNTS', earn.stunts],
    ];
    const els = rows.map(([ic, lbl, val]) => {
      const r = this._el(`<div class="earn-row"><div class="l">${icon(ic)}<span>${lbl}</span></div><div class="r">${ic === 'coin' || ic === 'flame' ? coinIco : icon(ic)}<span>0</span></div></div>`);
      list.appendChild(r);
      return { r, val, ic };
    });
    const total = this._el(`<div class="earn-row earn-total"><div class="l">${icon('trophy')}<span>TOTAL EARNED</span></div><div class="r">${coinIco}<span>0</span></div></div>`);
    list.appendChild(total);
    const totalVal = earn.dist + earn.pickups + earn.stunts;
    // count-up animation
    const t0 = performance.now(), dur = 1100;
    const tick = () => {
      const u = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      distEl.textContent = fmt(dist * e);
      for (const { r, val, ic } of els) r.querySelector('.r span').textContent = fmt(val * e);
      total.querySelector('.r span').textContent = fmt(totalVal * e);
      if (u < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------- HUD ---------- */
  _buildHUD() {
    const hud = this._el(`<div id="hud" class="hidden">
      <div class="hud-top">
        <div class="hud-cluster">
          <div class="hud-fuel" id="hud-fuel">${icon('fuel')}<div class="track"><div class="fill" id="fuel-fill"></div></div></div>
          <div class="pill">${coinIco}<span id="hud-coins">0</span></div>
        </div>
        <div class="hud-cluster">
          <button class="btn-round hud-pause" id="hud-pause">${icon('pause')}</button>
        </div>
      </div>
      <div class="hud-dist"><div class="val" id="hud-dist">0 m</div><div class="best" id="hud-best"></div></div>
      <div class="combo-pop" id="combo-pop"></div>
      <div class="milestone-toast" id="milestone"></div>
      <div class="tutorial hidden" id="tutorial">${icon('flame')}<span>HOLD <b>GAS</b> TO LAUNCH · TIP BACK IN THE AIR FOR FLIPS</span></div>
      <div class="pedals">
        <div class="pedal brake" id="pedal-brake">${pedalSVG('brake')}<div class="plabel">BRAKE</div></div>
        <div class="pedal gas" id="pedal-gas">${pedalSVG('gas')}<div class="plabel">GAS</div></div>
      </div>
    </div>`);
    this.root.appendChild(hud);
    this.hudEls.root = hud;
    this.hudEls.fuel = hud.querySelector('#fuel-fill');
    this.hudEls.fuelBox = hud.querySelector('#hud-fuel');
    this.hudEls.coins = hud.querySelector('#hud-coins');
    this.hudEls.dist = hud.querySelector('#hud-dist');
    this.hudEls.best = hud.querySelector('#hud-best');
    this.hudEls.combo = hud.querySelector('#combo-pop');
    this.hudEls.milestone = hud.querySelector('#milestone');
    this.hudEls.tutorial = hud.querySelector('#tutorial');
    hud.querySelector('#hud-pause').addEventListener('click', () => { this.h.audio?.click(); this.h.onPause(); });
    this.onPedals?.(hud.querySelector('#pedal-gas'), hud.querySelector('#pedal-brake'));
    this.h.wirePedals(hud.querySelector('#pedal-gas'), hud.querySelector('#pedal-brake'));
  }

  showHUD(best) {
    this.hudEls.root.classList.remove('hidden');
    this.hudEls.best.textContent = best > 0 ? `BEST ${fmt(best)} m` : 'FIRST RUN';
  }
  hideHUD() { this.hudEls.root.classList.add('hidden'); }
  hideTutorial() { this.hudEls.tutorial.classList.add('hide'); }

  setHUD({ fuel01, lowFuel, coins, dist }) {
    this.hudEls.fuel.style.width = Math.round(fuel01 * 100) + '%';
    this.hudEls.fuelBox.classList.toggle('low', lowFuel);
    this.hudEls.coins.textContent = fmt(coins);
    this.hudEls.dist.textContent = fmt(dist) + ' m';
  }

  comboPop(text, sub) {
    const el = this.hudEls.combo;
    el.classList.remove('show');
    el.innerHTML = `${icon('flame')}<span>${text}${sub ? `<span class="sub">${sub}</span>` : ''}</span>`;
    void el.offsetWidth;
    el.classList.add('show');
  }
  milestone(text) {
    const el = this.hudEls.milestone;
    el.classList.remove('show');
    el.textContent = text;
    void el.offsetWidth;
    el.classList.add('show');
  }
  tutorial(show) { this.hudEls.tutorial.classList.toggle('hidden', !show); }

  /* ---------- screen switching ---------- */
  _show(name, overlay = false) {
    for (const k in this.screens) this.screens[k].classList.add('hidden');
    if (!overlay) this.hideHUD(); else this.hudEls.root?.classList.remove('hidden');
    if (name === 'hud') return;
    this.screens[name].classList.remove('hidden');
    if (name === 'title' || name === 'stages' || name === 'garage') this.hudEls.root?.classList.add('hidden');
  }
  show(name) { this._show(name); }
  hide(name) { this.screens[name]?.classList.add('hidden'); }
}

/* ============================================================
   Painted logo — used on boot + title (and exported for icon)
   ============================================================ */
export function paintLogo(cv) {
  const ctx = cv.getContext('2d');
  const W = 640, H = 200;
  if (cv.width !== W) { cv.width = W; cv.height = H; }
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.transform(1, 0, -0.16, 1, 0, 0); // italic shear

  const drawText = (txt, y, size, grad) => {
    ctx.font = `${size}px 'Titan One', 'Nunito', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // dark outer outline
    ctx.strokeStyle = '#131a2c';
    ctx.lineWidth = size * .22;
    ctx.strokeText(txt, 0, y);
    // body
    ctx.fillStyle = grad;
    ctx.fillText(txt, 0, y);
    // top gloss
    ctx.save();
    ctx.beginPath();
    ctx.rect(-W, y - size * .62, W * 2, size * .55);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    ctx.fillText(txt, 0, y);
    ctx.restore();
    // crisp edge
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = size * .02;
    ctx.strokeText(txt, 0, y);
  };

  const g1 = ctx.createLinearGradient(0, -66, 0, -18);
  g1.addColorStop(0, '#fff6d8'); g1.addColorStop(.45, '#ffd24d'); g1.addColorStop(.55, '#ffb423'); g1.addColorStop(1, '#f97f1f');
  const g2 = ctx.createLinearGradient(0, -8, 0, 62);
  g2.addColorStop(0, '#bdfff2'); g2.addColorStop(.45, '#53ecdf'); g2.addColorStop(.56, '#2cc4d8'); g2.addColorStop(1, '#1e8fd8');

  drawText('RUSH', -42, 78, g1);
  drawText('TRACK', 38, 78, g2);

  // speed streaks
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = .85;
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 9, w = 120 + i * 46, x = W / 2 + 150;
    const g = ctx.createLinearGradient(x, y, x - w, y);
    g.addColorStop(0, 'rgba(255,210,80,.9)');
    g.addColorStop(1, 'rgba(255,210,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y, w, 4 - i * .6);
  }
  // tire mark swoosh under TRACK
  ctx.strokeStyle = 'rgba(20,26,40,.85)';
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(120, 118);
  ctx.quadraticCurveTo(W / 2, 142, W - 90, 112);
  ctx.stroke();
  ctx.restore();
}

/* ============================================================
   Stage vignette painter (stage cards)
   ============================================================ */
export function paintVignette(cv, biome, unlocked) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const rng = mulberry32(biome.seed * 13);
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H * .8);
  g.addColorStop(0, biome.sky[0]); g.addColorStop(.55, biome.sky[1]); g.addColorStop(1, biome.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun/moon
  const sx = W * biome.sun.x * .8 + W * .1, sy = H * biome.sun.y;
  const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
  sg.addColorStop(0, biome.sun.core); sg.addColorStop(.3, biome.sun.glow); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, 60, 0, TAU); ctx.fill();
  // ridges
  for (const [color, y0, amp, wl] of [[biome.far.color, H * .52, 26, 90], [biome.mid.color, H * .6, 34, 55]]) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      ctx.lineTo(x, y0 - fbm(x / wl, biome.seed + y0, 3) * amp);
    }
    ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
  // ground band
  const gh = H * .22;
  const gg = ctx.createLinearGradient(0, H - gh, 0, H);
  gg.addColorStop(0, biome.ground.top); gg.addColorStop(.22, biome.ground.topDark); gg.addColorStop(.3, biome.ground.soil); gg.addColorStop(1, biome.ground.soilDark);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - gh + fbm(x / 40, biome.seed + 7, 2) * 10 + 6);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // props
  if (unlocked) {
    const keys = Object.keys(biome.props).filter(k => biome.props[k] > 0);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const key = keys[Math.floor(rng() * keys.length)];
      const x = 30 + rng() * (W - 60);
      const gy = H - gh + 6 + fbm(x / 40, biome.seed + 7, 2) * 10;
      const scale = 26 + rng() * 30;
      ctx.save();
      ctx.translate(x, gy);
      ctx.scale(scale, -scale);
      drawProp(ctx, { key, scale: 1, flip: rng() < .5, phase: 0 }, 0, biome, 0);
      ctx.restore();
    }
  }
}

/* ============================================================
   Garage scene (mini render of the vehicle on a podium)
   ============================================================ */
function garageMock(def) {
  const rest = def.wheelR + def.travel * .62;
  return {
    def, damage: 0, angle: 0, pos: { x: 0, y: 0 },
    localToWorld(l) { return { x: l.x, y: l.y }; },
    wheels: [
      { lx: -def.wheelbase / 2, ly: def.bodyY, r: def.wheelR, rest, len: rest, spin: 0, spinVel: 0, skid: 0, contact: null },
      { lx: def.wheelbase / 2, ly: def.bodyY, r: def.wheelR, rest, len: rest, spin: 0, spinVel: 0, skid: 0, contact: null },
    ],
  };
}

export function drawGarageScene(ctx, W, H, mock, t, owned) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // garage backdrop: wall + floor + light
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1d2947'); bg.addColorStop(.7, '#16203a'); bg.addColorStop(1, '#101828');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // wall panel lines
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * .72); ctx.stroke(); }
  // tool board
  ctx.fillStyle = 'rgba(9, 14, 26, .55)';
  ctx.fillRect(40, 30, 130, 90);
  ctx.strokeStyle = 'rgba(120, 140, 190, .25)'; ctx.strokeRect(40, 30, 130, 90);
  ctx.fillStyle = 'rgba(140, 160, 210, .3)';
  for (let i = 0; i < 5; i++) ctx.fillRect(52 + i * 24, 42, 10, 26);
  ctx.fillRect(52, 80, 106, 6);
  // ceiling lamps
  for (const lx of [W * .3, W * .7]) {
    const lg = ctx.createRadialGradient(lx, 8, 4, lx, 8, H * .5);
    lg.addColorStop(0, 'rgba(210, 230, 255, .2)');
    lg.addColorStop(1, 'rgba(210, 230, 255, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, 8, H * .5, 0, TAU); ctx.fill();
  }
  // floor
  const fy = H * .74;
  const fg = ctx.createLinearGradient(0, fy, 0, H);
  fg.addColorStop(0, '#2a3757'); fg.addColorStop(1, '#1a2440');
  ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
  // hazard stripe on podium edge
  ctx.save();
  ctx.beginPath(); ctx.rect(0, fy, W, 10); ctx.clip();
  for (let x = -20; x < W + 20; x += 24) {
    ctx.fillStyle = x % 48 === 0 ? 'rgba(255, 180, 40, .8)' : 'rgba(24, 32, 54, .9)';
    ctx.save(); ctx.translate(x, fy); ctx.transform(1, 0, -0.5, 1, 0, 0); ctx.fillRect(0, 0, 24, 10); ctx.restore();
  }
  ctx.restore();

  // vehicle
  const def = mock.def;
  const ppm = Math.min(W / (def.wheelbase + 2.6), H * .62) ;
  const groundY = fy + 26;
  // idle bounce
  const bob = Math.sin(t * 2.2) * .04 + Math.sin(t * 3.7) * .02;
  mock.pos = { x: 0, y: 0 }; // local-space origin already translated
  mock.angle = 0;
  const wheelSpin = t * 1.2;
  mock.wheels.forEach((wh, i) => {
    wh.spin = wheelSpin * (i ? 1 : 1);
    wh.len = wh.rest + Math.sin(t * 2.2 + i * 2.4) * def.travel * .16;
  });

  ctx.save();
  ctx.translate(W / 2, groundY);
  ctx.scale(ppm, -ppm);
  ctx.translate(0, def.wheelR + def.travel * .62 + def.bodyY + bob);
  drawVehicle(ctx, mock, { time: t, night: false, helmet: def.helmet, helmetAccent: def.helmetAccent, throttle: (Math.sin(t) > .6) ? 1 : 0 });
  ctx.restore();

  // contact shadow
  ctx.save();
  ctx.globalAlpha = .3;
  ctx.fillStyle = '#060a14';
  ctx.beginPath();
  ctx.ellipse(W / 2, groundY + 6, def.wheelbase * .62 * ppm, 12, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (!owned) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 30, .5)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
