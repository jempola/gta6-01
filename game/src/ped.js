// Pedestrians: they stroll the sidewalks, flee from gunfire and crashes, and a few
// hotheads fight back. Peds are { x, y, angle, speed, health, state, color, tx, ty }
// where (tx, ty) is the current stroll target.

import { WORLD, clamp, dist, angleTo, randRange, pick } from './config.js';
import { randomSidewalkPoint, resolveBuildings } from './world.js';

const SHIRT_COLORS = ['#e8e8e8', '#d94f4f', '#4f7ec9', '#7ec94f', '#c9a44f', '#8a5fc9', '#e07a2e', '#3fa8a0'];
const NAMES = ['Mara', 'Tomas', 'Lena', 'Ivo', 'Petra', 'Dario', 'Nina', 'Kiko', 'Sara', 'Milo'];

/** Spawn one pedestrian near the given point. */
export function spawnPed(S, near) {
  const p = near ? { x: near.x + randRange(S.rng, -300, 300), y: near.y + randRange(S.rng, -300, 300) } : randomSidewalkPoint(S);
  const t = randomSidewalkPoint(S);
  const ped = {
    x: clamp(p.x, 60, WORLD.size - 60), y: clamp(p.y, 60, WORLD.size - 60),
    angle: randRange(S.rng, 0, Math.PI * 2), speed: randRange(S.rng, 45, 85),
    health: 30, state: 'walk', color: pick(S.rng, SHIRT_COLORS),
    tx: t.x, ty: t.y, name: pick(S.rng, NAMES),
    flee: false, dead: false, fight: S.rng() < 0.18, punchTimer: 0,
  };
  S.peds.push(ped);
  return ped;
}

/** Update every pedestrian for one fixed step. */
export function updatePeds(S, dt) {
  const p = S.player;
  const gunfire = S.recentShot > 0;
  for (const ped of S.peds) {
    if (ped.dead) continue;
    if (ped.punchTimer > 0) ped.punchTimer -= dt;
    const dPlayer = dist(ped.x, ped.y, p.x, p.y);
    // Flee from gunfire, from a speeding car, or when hurt.
    if (ped.flee || gunfire && dPlayer < 320 || dPlayer < 60 && p.car && Math.abs(p.car.speed) > 200) {
      ped.state = 'flee';
    }
    if (ped.state === 'flee') {
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      ped.x = clamp(ped.x + Math.cos(away) * 210 * dt, 40, WORLD.size - 40);
      ped.y = clamp(ped.y + Math.sin(away) * 210 * dt, 40, WORLD.size - 40);
      resolveBuildings(S, ped, 12);
      if (dPlayer > 520 && !ped.flee) ped.state = 'walk';
      if (dPlayer > 700) ped.flee = false;
      continue;
    }
    if (ped.state === 'fight') {
      // A hothead who fights back: close in and swing.
      const a = angleTo(ped.x, ped.y, p.x, p.y);
      ped.angle = a;
      if (dPlayer > 30) {
        ped.x = clamp(ped.x + Math.cos(a) * 170 * dt, 40, WORLD.size - 40);
        ped.y = clamp(ped.y + Math.sin(a) * 170 * dt, 40, WORLD.size - 40);
        resolveBuildings(S, ped, 12);
      } else if (ped.punchTimer <= 0) {
        ped.punchTimer = 0.7;
        if (p.onFoot) {
          // Punch Rico: armor soaks some of it.
          const dmg = 6;
          if (p.armor > 0) { const soak = Math.min(p.armor, dmg * 0.5); p.armor -= soak; p.health -= (dmg - soak); }
          else p.health -= dmg;
          if (p.health <= 0) { p.health = 0; S.screen = 'over'; }
        }
      }
      if (dPlayer > 420) ped.state = 'walk';
      continue;
    }
    // Stroll toward the target, then pick a new one.
    const dTarget = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (dTarget < 24) {
      const t = randomSidewalkPoint(S);
      ped.tx = t.x;
      ped.ty = t.y;
    } else {
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle = a;
      ped.x = clamp(ped.x + Math.cos(a) * ped.speed * dt, 40, WORLD.size - 40);
      ped.y = clamp(ped.y + Math.sin(a) * ped.speed * dt, 40, WORLD.size - 40);
      resolveBuildings(S, ped, 12);
    }
    // A fighter who gets punched or shot at turns and fights.
    if (ped.fight && ped.health < 30 && dPlayer < 260) ped.state = 'fight';
  }
  // Keep the streets populated near the player.
  const nearby = S.peds.filter((q) => !q.dead && dist(q.x, q.y, p.x, p.y) < 900).length;
  if (nearby < 12) spawnPed(S, p);
  S.peds = S.peds.filter((q) => !q.dead || dist(q.x, q.y, p.x, p.y) < 1200);

  // Thugs (the dock takedown crew): they hunt Rico down and swing at him.
  for (const thug of S.thugs || []) {
    if (thug.dead) continue;
    if (thug.punchTimer > 0) thug.punchTimer -= dt;
    const d = dist(thug.x, thug.y, p.x, p.y);
    const a = angleTo(thug.x, thug.y, p.x, p.y);
    thug.angle = a;
    if (d > 34 && d < 900) {
      thug.x = clamp(thug.x + Math.cos(a) * thug.speed * dt, 40, WORLD.size - 40);
      thug.y = clamp(thug.y + Math.sin(a) * thug.speed * dt, 40, WORLD.size - 40);
      resolveBuildings(S, thug, 12);
    } else if (d <= 34 && p.onFoot && thug.punchTimer <= 0) {
      thug.punchTimer = 0.9;
      const dmg = 4;
      if (p.armor > 0) { const soak = Math.min(p.armor, dmg * 0.5); p.armor -= soak; p.health -= (dmg - soak); }
      else p.health -= dmg;
      if (p.health <= 0) { p.health = 0; S.screen = 'over'; }
    }
  }
  S.thugs = (S.thugs || []).filter((t) => !t.dead || dist(t.x, t.y, p.x, p.y) < 1200);
}
