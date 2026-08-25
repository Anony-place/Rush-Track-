/* ============================================================
   RUSH TRACK — game data: vehicles, upgrades, biomes, economy
   ============================================================ */

export const VEHICLES = [
  {
    id: 'buggy',
    name: 'SCOUT BUGGY',
    cls: 'Starter Rig',
    price: 0,
    art: 'buggy',
    helmet: '#f2f4f8',
    helmetAccent: '#ff5a5f',
    // physics
    mass: 86,
    wheelR: 0.46,
    wheelbase: 2.62,          // distance between wheel anchors
    bodyY: 0.12,              // anchor vertical offset (chassis frame height above wheel line at rest)
    comY: 0.06,               // center of mass offset above anchors line
    engine: 15.5,             // base drive force (kN-ish, tuned)
    topSpeed: 24,
    brake: 13,
    suspK: 34,                // suspension stiffness
    suspC: 2.1,               // damping
    travel: 0.34,             // suspension travel (m)
    grip: 1.0,
    fuelCap: 62,              // seconds of fuel
    airTorque: 205,
    sound: { base: 62, growl: .58, saw: .5, square: .22, noise: .3 },
    stats: { speed: 2.2, accel: 2.4, grip: 2.6, fuel: 2.0 },
    desc: 'Featherweight forest runner. Nimble in the air, thirsty for upgrades.',
  },
  {
    id: 'monster',
    name: 'DUNE MAULER',
    cls: 'Monster Truck',
    price: 3200,
    art: 'monster',
    helmet: '#1d2436',
    helmetAccent: '#35e0e8',
    mass: 132,
    wheelR: 0.66,
    wheelbase: 3.05,
    bodyY: 0.5,
    comY: 0.16,
    engine: 23.5,
    topSpeed: 26,
    brake: 16,
    suspK: 27,
    suspC: 2.4,
    travel: 0.5,
    grip: 1.06,
    fuelCap: 70,
    airTorque: 300,
    sound: { base: 46, growl: .8, saw: .62, square: .3, noise: .42 },
    stats: { speed: 3.0, accel: 3.2, grip: 3.6, fuel: 3.0 },
    desc: 'Seismic suspension. Eats canyons, spits out gravity.',
  },
  {
    id: 'gt',
    name: 'VORTEX GT',
    cls: 'Rally Prototype',
    price: 9500,
    art: 'gt',
    helmet: '#f2f4f8',
    helmetAccent: '#8b5cf6',
    mass: 96,
    wheelR: 0.4,
    wheelbase: 2.86,
    bodyY: -0.12,
    comY: -0.05,
    engine: 21.0,
    topSpeed: 34,
    brake: 18,
    suspK: 42,
    suspC: 2.6,
    travel: 0.24,
    grip: 1.12,
    fuelCap: 56,
    airTorque: 230,
    sound: { base: 88, growl: .4, saw: .75, square: .12, noise: .22 },
    stats: { speed: 4.6, accel: 3.8, grip: 4.0, fuel: 2.4 },
    desc: 'Aerodynamic obsession. Holds the land-speed ego of the fleet.',
  },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine', icon: 'engine', desc: 'More thrust, higher top speed' },
  { id: 'susp',   name: 'Suspension', icon: 'susp', desc: 'Softer landings, stabler chassis' },
  { id: 'tires',  name: 'Tires', icon: 'tire', desc: 'Grip on dirt, sand, snow & ice' },
  { id: 'tank',   name: 'Fuel Tank', icon: 'tank', desc: 'Carry more fuel per run' },
  { id: 'awd',    name: 'All-Wheel Drive', icon: 'awd', desc: 'Front wheel pulls too' },
];
export const MAX_LEVEL = 5;
export function upgradeCost(base, level) { return Math.round(base * Math.pow(1.85, level)); }
export const UPG_BASE = { buggy: 90, monster: 160, gt: 260 };

/** Multiplier curves — level 0..5 */
export const mod = {
  engine: (l, v) => v.engine * (1 + 0.16 * l),
  topSpeed: (l, v) => v.topSpeed * (1 + 0.07 * l),
  susp: (l, v) => ({ k: v.suspK * (1 + 0.13 * l), c: v.suspC * (1 + 0.11 * l) }),
  tires: (l, v) => v.grip * (1 + 0.09 * l),
  tank: (l, v) => v.fuelCap * (1 + 0.15 * l),
  awd: (l, v) => (l > 0 ? clamp01map(l) : 0),
};
function clamp01map(l) { return [0, .3, .55, .75, .9, 1][l]; }

/* ---------------- biomes ---------------- */
export const BIOMES = [
  {
    id: 'meadow',
    name: 'SUNNY MEADOWS',
    tagline: 'Rolling hills · gentle breeze',
    unlockDist: 0,             // unlocked from start
    unlockText: '',
    seed: 11,
    sky: ['#57c4ff', '#a8e6ff', '#eafff4'],
    sun: { x: .78, y: .24, r: 46, core: '#fff6d8', glow: 'rgba(255,236,170,.5)' },
    hazeColor: 'rgba(180, 224, 255, .55)',
    far: { color: '#7fa8d8', snow: false, amp: 46, wl: 320 },
    mid: { color: '#5d8fbf', snow: false, amp: 34, wl: 190 },
    hills: { color: '#4f9e55', dark: '#3d8447' },
    ground: { top: '#6fce62', topDark: '#58b552', soil: '#8a5a3c', soilDark: '#6e4630', rock: '#7b6a5c', speck: 'rgba(60,40,25,.35)', road: null, edgeLine: 'rgba(46,110,50,.9)' },
    props: { tree: 1.0, pine: .8, bush: 1.0, rock: .55, fence: .5, hay: .35, flower: null },
    ambience: 'meadow',
    terrain: { wl: 46, amp: 7.5, rough: .45, ramps: 1.0 },
    gravityScale: 1,
  },
  {
    id: 'desert',
    name: 'DUST CANYON',
    tagline: 'Sun-baked dunes & red mesas',
    unlockDist: 800,
    unlockText: 'Drive 800 m in any stage',
    seed: 29,
    sky: ['#ff9e5e', '#ffcf8a', '#ffe9c4'],
    sun: { x: .5, y: .3, r: 58, core: '#fff1c4', glow: 'rgba(255,190,110,.55)' },
    hazeColor: 'rgba(255, 190, 130, .5)',
    far: { color: '#c4714f', snow: false, amp: 58, wl: 380 },
    mid: { color: '#a5553d', snow: false, amp: 40, wl: 210 },
    hills: { color: '#c98350', dark: '#a8633c' },
    ground: { top: '#e8b06e', topDark: '#d39654', soil: '#b3734a', soilDark: '#8f5636', rock: '#9c6247', speck: 'rgba(90,50,25,.3)', edgeLine: 'rgba(160,100,55,.9)' },
    props: { saguaro: 1.0, cactusSmall: .9, mesaRock: .6, skull: .25, sign: .3, tumbleweed: .35 },
    ambience: 'desert',
    terrain: { wl: 58, amp: 8.6, rough: .38, ramps: 1.15 },
    gravityScale: 1,
  },
  {
    id: 'city',
    name: 'NEON HARBOR',
    tagline: 'Midnight skyline · rain-slick asphalt',
    unlockDist: 1800,
    unlockText: 'Drive 1 800 m in any stage',
    seed: 47,
    sky: ['#0b1030', '#18235a', '#2c3a7c'],
    sun: { x: .18, y: .2, r: 40, core: '#f4f7ff', glow: 'rgba(190,210,255,.35)', moon: true },
    hazeColor: 'rgba(70, 90, 170, .5)',
    far: { color: '#1a2450', snow: false, amp: 30, wl: 260, skyline: true },
    mid: { color: '#232f66', snow: false, amp: 24, wl: 150, skyline: true },
    hills: { color: '#252e56', dark: '#1b2344' },
    ground: { top: '#3a4258', topDark: '#2e3548', soil: '#22283a', soilDark: '#181d2c', rock: '#2c3346', speck: 'rgba(0,0,0,.35)', road: { line: 'rgba(255, 214, 90, .85)', dash: [2.6, 2.8] }, edgeLine: 'rgba(120,132,170,.55)' },
    props: { lamp: 1.0, hydrant: .5, barrier: .6, sign: .35, dumpster: .4 },
    ambience: 'city',
    terrain: { wl: 64, amp: 5.2, rough: .3, ramps: 1.05 },
    gravityScale: 1,
  },
  {
    id: 'frost',
    name: 'FROSTBITE PASS',
    tagline: 'Snowfields · black ice · auroras',
    unlockDist: 3200,
    unlockText: 'Drive 3 200 m in any stage',
    seed: 73,
    sky: ['#2a3f7a', '#7d9bd8', '#dfe9ff'],
    sun: { x: .8, y: .2, r: 40, core: '#f6faff', glow: 'rgba(220,235,255,.4)', moon: true },
    hazeColor: 'rgba(210, 228, 255, .55)',
    far: { color: '#8fa8d8', snow: true, amp: 64, wl: 400 },
    mid: { color: '#6d87c0', snow: true, amp: 42, wl: 210 },
    hills: { color: '#dfe9f6', dark: '#bcd0ea' },
    ground: { top: '#f2f7ff', topDark: '#d8e6f6', soil: '#9db1cf', soilDark: '#7b90b3', rock: '#8195b5', speck: 'rgba(90,110,150,.3)', ice: true, edgeLine: 'rgba(150,175,215,.9)' },
    props: { pineSnow: 1.0, iceRock: .7, deadTree: .45, snowman: .22 },
    ambience: 'frost',
    terrain: { wl: 54, amp: 9.0, rough: .5, ramps: 1.2 },
    gravityScale: 1,
  },
];

export const RUN = {
  fuelWarn: .22,
  coinValue: 1,
  gemValue: 25,
  flipBase: 40,           // coins for a single flip; multiplies with combo
  airTimeBonus: 2,        // coins per full second airborne on a jump
  distanceCoinRate: 1 / 8, // 1 coin per 8 m
  pickupRadius: 1.5,
};

export const ECONOMY = { firstVehicleFree: true };
