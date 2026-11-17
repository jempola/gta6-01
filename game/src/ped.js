// Pedestrians: they stroll the sidewalks, flee from gunfire and crashes, and a
// few hot-headed ones fight back when attacked.
import { WORLD, clamp, dist2, angleTo, makeRng } from './config.js';
import { collideBuildings, isOnRoad } from './world.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];
const NAMES = ['Mara', 'Tomas', 'Lena', 'Dario', 'Priya', 'Jonas', 'Sofia', 'Kofi', 'Ana', 'Ruben'];

export function spawnPeds(G, rng, count) {
  G.peds.list = [];
  for (let i = 0; i < count; i += 1) {
    const x = 200 + rng() * (WORLD.size - 400);
    const y = 200 + rng() * (WORLD.size - 400);
    G.peds.list.push({
      x, y, angle: rng() * Math.PI * 2, speed: 45 + rng() * 30,
      health: 30, down: false, flee: 0, fleeX: 0, fleeY: 0,
      fighter: rng() < 0.18, attackCooldown: 0,
      color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
      name: NAMES[Math.floor(rng() * NAMES.length)],
      targetX: x, targetY: y, retarget: rng() * 4,
    });
  }
}

function pickStrollTarget(ped, rng) {
  // Prefer a nearby road, so peds walk the sidewalks.
  const dx = (rng() - 0.5) * 700, dy = (rng() - 0.5) * 700;
  ped.targetX = clamp(ped.x + dx, 200, WORLD.size - 200);
  ped.targetY = clamp(ped.y + dy, 200, WORLD.size - 200);
  ped.retarget = 3 + rng() * 4;
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds.list) {
    if (ped.down) continue;
    if (ped.attackCooldown > 0) ped.attackCooldown -= dt;
    const playerNear = dist2(ped.x, ped.y, p.x, p.y) < 260 * 260;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * 190 * dt;
      ped.y += Math.sin(away) * 190 * dt;
    } else if (ped.fighter && playerNear && p.health > 0 && !p.inCar && ped.attackCooldown === 0 && dist2(ped.x, ped.y, p.x, p.y) < 40 * 40) {
      // A fighter swings back at the player.
      ped.attackCooldown = 0.9;
      G.audio.punch();
      p.health = Math.max(0, p.health - 6);
      if (p.health <= 0) G.gameOver('wasted');
    } else if (ped.fighter && playerNear && !p.inCar && dist2(ped.x, ped.y, p.x, p.y) < 130 * 130) {
      ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    } else {
      ped.retarget -= dt;
      if (ped.retarget <= 0 || dist2(ped.x, ped.y, ped.targetX, ped.targetY) < 30 * 30) pickStrollTarget(ped, G.rng);
      ped.angle = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 30, WORLD.size - 30);
    ped.y = clamp(ped.y, 30, WORLD.size - 30);
    const hit = collideBuildings(G.city.buildings, ped.x, ped.y, 12);
    ped.x = hit.x; ped.y = hit.y;
  }
  // Thin the crowd back up over time so the streets stay alive.
  if (G.peds.list.filter((q) => !q.down).length < 24 && Math.random() < dt * 0.2) {
    const rng = makeRng((Math.random() * 1e9) | 0);
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 600, 200, WORLD.size - 200);
    const y = clamp(p.y + Math.sin(angle) * 600, 200, WORLD.size - 200);
    G.peds.list.push({
      x, y, angle, speed: 50, health: 30, down: false, flee: 0, fleeX: 0, fleeY: 0,
      fighter: rng() < 0.15, attackCooldown: 0, color: PED_COLORS[0], name: 'Mara',
      targetX: x, targetY: y, retarget: 3,
    });
  }
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds.list) {
    if (ped.down) continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.flee = 2.5 + Math.random(); ped.fleeX = x; ped.fleeY = y;
    }
  }
}
