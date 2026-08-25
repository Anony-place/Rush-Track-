/* Persistent player profile via localStorage. */

const KEY = 'rushtrack.save.v1';

export const DEFAULT_SAVE = {
  coins: 0,
  gems: 0,
  selectedVehicle: 'buggy',
  owned: { buggy: true, monster: false, gt: false },
  upgrades: { // per vehicle per upgrade id → level 0..5
    buggy: { engine: 0, susp: 0, tires: 0, tank: 0, awd: 0 },
    monster: { engine: 0, susp: 0, tires: 0, tank: 0, awd: 0 },
    gt: { engine: 0, susp: 0, tires: 0, tank: 0, awd: 0 },
  },
  best: { meadow: 0, desert: 0, city: 0, frost: 0 },   // best distance per biome (m)
  bestOverall: 0,
  totalDist: 0,
  totalFlips: 0,
  tutorialSeen: false,
  sfx: true,
  music: true,
};

let data = null;

export function load() {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? deepMerge(structuredClone(DEFAULT_SAVE), JSON.parse(raw)) : structuredClone(DEFAULT_SAVE);
  } catch { data = structuredClone(DEFAULT_SAVE); }
  return data;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

export function profile() { return load(); }

export function addCoins(n) { data.coins += n; save(); }
export function spendCoins(n) { if (data.coins < n) return false; data.coins -= n; save(); return true; }

export function recordRun(biomeId, dist, flips) {
  data.totalDist += dist;
  data.totalFlips += flips;
  const d = Math.floor(dist);
  let isRecord = false;
  if (d > data.best[biomeId]) { data.best[biomeId] = d; isRecord = true; }
  if (d > data.bestOverall) data.bestOverall = d;
  save();
  return isRecord;
}

function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) base[k] = deepMerge(base[k] ?? {}, over[k]);
    else if (over[k] !== undefined) base[k] = over[k];
  }
  return base;
}

/* Reset hook for QA. */
export function _reset() { data = structuredClone(DEFAULT_SAVE); save(); }
