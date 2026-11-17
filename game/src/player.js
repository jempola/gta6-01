// Rico Vale on foot: WASD / arrow movement, running, punching, and getting in and
// out of cars with E. When Rico is in a car, this module does nothing — the car
// physics in vehicle.js owns him then.

import { PLAYER, WORLD, clamp, angleTo, dist } from './config.js';
import { resolveBuildings } from './world.js';

/** The car nearest to the player within range, or null. */
export function nearestCar(S, range) {
  let best = null;
  let bestD = range;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = dist(S.player.x, S.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Try to enter the nearest car; returns true when Rico got in. */
export function tryEnterCar(S) {
  if (!S.player.onFoot) return false;
  const car = nearestCar(S, 70);
  if (!car) {
    S.message = 'No car close enough — walk up to one and press E.';
    S.messageT = 2;
    return false;
  }
  S.player.onFoot = false;
  S.player.car = car;
  car.playerControlled = true;
  car.parked = false;
  car.speed = 0;
  S.player.x = car.x;
  S.player.y = car.y;
  S.message = car.cop ? 'You jacked a police cruiser!' : 'You took the car.';
  S.messageT = 2;
  return true;
}

/** Step out of the current car onto the road beside it. */
export function exitCar(S) {
  const car = S.player.car;
  if (!car) return false;
  car.playerControlled = false;
  car.speed *= 0.4;
  const side = car.angle + Math.PI / 2;
  S.player.x = clamp(car.x + Math.cos(side) * 34, 20, WORLD.size - 20);
  S.player.y = clamp(car.y + Math.sin(side) * 34, 20, WORLD.size - 20);
  resolveBuildings(S, S.player, PLAYER.radius);
  S.player.onFoot = true;
  S.player.car = null;
  S.player.vx = 0;
  S.player.vy = 0;
  return true;
}

/** Punch the nearest pedestrian, cop or thug in front of Rico. */
export function punch(S) {
  const p = S.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = PLAYER.punchCooldown;
  p.punchAnim = 0.18;
  S.audio.punch();
  S.particles.push({
    x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26,
    vx: Math.cos(p.angle) * 60, vy: Math.sin(p.angle) * 60,
    life: 0.15, maxLife: 0.15, color: '#ffffff', size: 5, kind: 'spark',
  });
  const targets = [];
  for (const ped of S.peds) if (!ped.dead) targets.push(ped);
  for (const cop of S.cops) if (!cop.dead && cop.onFoot) targets.push(cop);
  for (const thug of S.thugs || []) if (!thug.dead) targets.push(thug);
  let best = null;
  let bestD = PLAYER.punchRange + 14;
  for (const t of targets) {
    const d = dist(p.x, p.y, t.x, t.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best) {
    best.health -= PLAYER.punchDamage;
    best.flee = true;
    best.state = 'flee';
    if (best.health <= 0) {
      best.dead = true;
      S.stats.kills += 1;
      if (best.isThug) {
        S.stats.thugsDown += 1;
        S.cash += 25;
      }
    }
    if (S.wanted < 1 && (best.isCop || best.isThug)) {
      // Hitting a cop in plain sight draws heat.
      if (best.isCop) S.wanted = Math.min(5, S.wanted + 1);
    }
  }
}

/** On-foot update for one fixed step. input gives axes; mouseWorld is the aim point. */
export function updatePlayer(S, dt, input, mouseWorld) {
  const p = S.player;
  if (!p.onFoot) return;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  const ax = input.axisX();
  const ay = input.axisY();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let vx = ax * speed;
  let vy = ay * speed;
  if (ax !== 0 && ay !== 0) {
    vx *= 0.7071;
    vy *= 0.7071;
  }
  p.vx = vx;
  p.vy = vy;
  p.x = clamp(p.x + vx * dt, 20, WORLD.size - 20);
  p.y = clamp(p.y + vy * dt, 20, WORLD.size - 20);
  resolveBuildings(S, p, PLAYER.radius);

  // Face the mouse when armed, otherwise face the direction of travel.
  if (S.weapon === 'pistol' && mouseWorld) {
    p.angle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);
  } else if (vx !== 0 || vy !== 0) {
    p.angle = Math.atan2(vy, vx);
  }
  p.moving = vx !== 0 || vy !== 0;
}
