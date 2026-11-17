// SOLMAR BAY — an original 2D top-down open-world crime game.
// Shared constants. No Rockstar / GTA IP anywhere: every name here is original.
export const WORLD = { size: 3600, roadGap: 450, roadWidth: 64 };
export const COLORS = {
  grass: '#5d8a4a', road: '#33363d', roadLine: '#c8b84a', sidewalk: '#8d8578',
  sand: '#d9c27a', sea: '#2e6f8e', park: '#4a7d3a', downtown: '#4a4a55',
  buildingA: '#7a6a58', buildingB: '#5f6f7d', buildingC: '#8a5f4d', buildingD: '#6d5a7a',
};
export const PLAYER = { radius: 14, walkSpeed: 175, runSpeed: 265, maxHealth: 100, punchDamage: 12, punchRange: 36, punchCooldown: 0.45 };
export const CAR = { maxSpeed: 430, accel: 330, brake: 540, reverseMax: 170, steer: 2.7, maxHealth: 100 };
export const WANTED_MAX = 5;
export const TAU = Math.PI * 2;
export const STEP = 1 / 60;
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save.v1';
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
// Deterministic seeded random (mulberry32) so screenshot scenes are reproducible.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
