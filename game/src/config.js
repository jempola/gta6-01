// Solmar Bay — every tuning number, colour and small math helper in one place.
// The world is a fixed 3600 x 3600 coastal city; the renderer scales the camera view
// to the window, so no rule below depends on the screen size.

export const WORLD = {
  size: 3600,
  roadSpacing: 450,
  roadWidth: 64,
  roadOffset: 225,
};

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 240,
  runSpeed: 390,
  punchRange: 34,
  punchDamage: 12,
  punchCooldown: 0.38,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 560,
  brake: 980,
  reverseMax: 150,
  topSpeed: 430,
  grip: 3.2,
  turnRate: 2.6,
  maxHealth: 100,
  explodeAt: 25,
};

export const COP = {
  maxFoot: 6,
  maxCars: 4,
  chaseSpeed: 400,
  ramDamage: 8,
};

export const BULLET = { speed: 900, life: 0.9, damage: 26 };

export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.cash.v1';

export const PALETTE = {
  ground: '#3d7a4e',
  sand: '#e8d29a',
  sea: '#2e7fa8',
  road: '#33363d',
  roadLine: '#e8c85a',
  sidewalk: '#8f8a7c',
  building: '#b08968',
  buildingRoof: '#8a6a4f',
  downtown: '#7d8aa0',
  park: '#4c8a3f',
  port: '#6e6a63',
  player: '#f2c94c',
  playerShirt: '#2e86de',
  ped: '#e8e8e8',
  cop: '#2e5fd0',
  copCar: '#1c2f6e',
  traffic: '#c94f4f',
  text: '#f5f1e6',
  muted: '#b8b0a0',
  panel: 'rgba(18, 16, 22, 0.92)',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58c472',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Clamp a number into [lo, hi]. */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Euclidean distance between two points. */
export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Angle from (x1, y1) to (x2, y2). */
export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Deterministic seeded random generator (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random number in [lo, hi) from the given rng function. */
export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** Random integer in [lo, hi] from the given rng function. */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pick one element from an array using the given rng function. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
