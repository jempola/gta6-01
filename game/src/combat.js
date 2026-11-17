// Combat: the pistol pickup, shooting with mouse aim, bullets, and the health,
// armor and cash pickups scattered around the city. Fists live in player.js.

import { BULLET, PLAYER, WORLD, clamp, dist, randRange, pick } from './config.js';
import { addWanted } from './police.js';
import { explodeCar } from './vehicle.js';

/** Spawn the starting pickups around the city. */
export function spawnPickups(S) {
  const rng = S.rng;
  const spots = [
    { x: 2025, y: 1800, kind: 'pistol' },
    { x: 1125, y: 1125, kind: 'health' },
    { x: 2475, y: 2475, kind: 'health' },
    { x: 675, y: 2925, kind: 'armor' },
    { x: 2925, y: 675, kind: 'armor' },
    { x: 1575, y: 675, kind: 'health' },
    { x: 3375, y: 1575, kind: 'pistol' },
    { x: 675, y: 1575, kind: 'cash' },
  ];
  for (const s of spots) {
    S.pickups.push({ x: s.x, y: s.y, kind: s.kind, taken: false, bob: rng() * Math.PI * 2 });
  }
  // A few extra cash drops on the beach front.
  for (let i = 0; i < 6; i += 1) {
    S.pickups.push({ x: randRange(rng, 300, 3300), y: randRange(rng, 2850, 3400), kind: 'cash', taken: false, bob: rng() * Math.PI * 2 });
  }
}

/** Fire one bullet from the player toward the mouse world point. */
export function shoot(S, mouseWorld) {
  const p = S.player;
  if (S.weapon !== 'pistol') return false;
  if (S.ammo <= 0) {
    S.message = 'Out of ammo — find a pistol pickup.';
    S.messageT = 1.5;
    return false;
  }
  if (S.shootCooldown > 0) return false;
  S.shootCooldown = 0.22;
  S.ammo -= 1;
  S.stats.shots += 1;
  const ox = p.x + Math.cos(p.angle) * 20;
  const oy = p.y + Math.sin(p.angle) * 20;
  const a = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  S.bullets.push({ x: ox, y: oy, vx: Math.cos(a) * BULLET.speed, vy: Math.sin(a) * BULLET.speed, life: BULLET.life, fromPlayer: true });
  S.audio.shot();
  S.recentShot = 0.6;
  // Muzzle flash particle.
  S.particles.push({
    x: ox, y: oy, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
    life: 0.08, maxLife: 0.08, color: '#ffd94f', size: 9, kind: 'flash',
  });
  return true;
}

/** Apply a bullet hit to a target entity; returns true when it died. */
function hitTarget(S, t, dmg) {
  t.health -= dmg;
  if (t.health <= 0) {
    t.dead = true;
    S.stats.kills += 1;
    if (t.isThug) {
      S.stats.thugsDown += 1;
      S.cash += 25;
    }
    return true;
  }
  if (t.state) t.state = 'flee';
  t.flee = true;
  return false;
}

/** Update bullets, pickups and the shooting cooldown for one fixed step. */
export function updateCombat(S, dt) {
  if (S.shootCooldown > 0) S.shootCooldown -= dt;
  if (S.recentShot > 0) S.recentShot -= dt;
  const p = S.player;

  for (const b of S.bullets) {
    if (b.life <= 0) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Buildings stop bullets.
    let blocked = false;
    for (const bd of S.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { blocked = true; break; }
    }
    if (blocked || b.x < 0 || b.x > WORLD.size || b.y < 0 || b.y > WORLD.size) {
      b.life = 0;
      S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#cccccc', size: 3, kind: 'spark' });
      continue;
    }
    // Hit a pedestrian, cop or thug.
    let done = false;
    const victims = [];
    for (const ped of S.peds) if (!ped.dead) victims.push(ped);
    for (const cop of S.cops) if (!cop.dead) victims.push(cop);
    for (const thug of S.thugs || []) if (!thug.dead) victims.push(thug);
    for (const v of victims) {
      if (dist(b.x, b.y, v.x, v.y) < 18) {
        const died = hitTarget(S, v, BULLET.damage);
        S.stats.hits += 1;
        if (v.isCop) addWanted(S, 1);
        else if (died) addWanted(S, 1);
        b.life = 0;
        done = true;
        break;
      }
    }
    if (done) continue;
    // Hit a car.
    for (const car of S.cars) {
      if (car.dead) continue;
      if (dist(b.x, b.y, car.x, car.y) < 26) {
        car.health -= BULLET.damage;
        S.stats.hits += 1;
        b.life = 0;
        if (car.health <= 25 && !car.dead) {
          // Heavy damage: the car catches fire and blows.
          explodeCar(S, car);
        }
        break;
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);

  // Pickups: walk over one to collect it.
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    pk.bob += dt * 3;
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'pistol') {
        S.weapon = 'pistol';
        S.ammo += 24;
        S.message = 'Pistol picked up — 24 rounds. Click to shoot.';
      } else if (pk.kind === 'health') {
        p.health = clamp(p.health + 50, 0, PLAYER.maxHealth);
        S.message = 'Health pack: +50 HP.';
      } else if (pk.kind === 'armor') {
        p.armor = clamp(p.armor + 50, 0, PLAYER.maxArmor);
        S.message = 'Armor vest: +50 armor.';
      } else if (pk.kind === 'cash') {
        const amount = pick(S.rng, [20, 40, 60]);
        S.cash += amount;
        S.message = `Found $${amount} on the street.`;
        S.audio.cash();
      }
      if (pk.kind !== 'cash') S.audio.pickup();
      S.messageT = 2;
    }
  }
  // A fresh health pack respawns now and then so the city never runs dry.
  S.pickupTimer -= dt;
  if (S.pickupTimer <= 0) {
    S.pickupTimer = 25;
    const taken = S.pickups.find((pk) => pk.taken);
    if (taken) {
      taken.taken = false;
      taken.x = clamp(p.x + randRange(S.rng, -500, 500), 100, WORLD.size - 100);
      taken.y = clamp(p.y + randRange(S.rng, -500, 500), 100, WORLD.size - 100);
    }
  }
}
