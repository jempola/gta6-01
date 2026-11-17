// Cars: player driving physics, traffic AI that follows the road grid, parked cars,
// damage and explosions. A car is { x, y, angle, speed, color, health, traffic,
// parked, playerControlled, cop, dead }. Speed is signed along the car's heading.

import { CAR, COP, WORLD, clamp, dist, angleDiff, angleTo, randRange, pick, wrapAngle } from './config.js';
import { isOnRoad, nearestRoadCoord, resolveBuildings, randomRoadPoint } from './world.js';

const TRAFFIC_COLORS = ['#c94f4f', '#4f7ec9', '#c9a44f', '#7ec94f', '#c94fa8', '#e8e8e8', '#5a5a66', '#e07a2e'];
const COP_COLOR = '#1c2f6e';

/** Spawn one traffic car on a road, heading along it. */
export function spawnTrafficCar(S, near) {
  const rng = S.rng;
  let p;
  if (near) {
    const line = pick(rng, S.roadsX);
    p = { x: clamp(near.x + randRange(rng, -700, 700), 120, WORLD.size - 120), y: line + randRange(rng, -12, 12) };
  } else {
    p = randomRoadPoint(S);
  }
  const angle = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  const car = {
    x: p.x, y: p.y, angle, speed: randRange(rng, 90, 170),
    color: pick(rng, TRAFFIC_COLORS), health: CAR.maxHealth,
    traffic: true, parked: false, playerControlled: false, cop: false,
    dead: false, smoke: 0, bumpTimer: 0, targetAngle: angle, isTarget: false,
  };
  S.cars.push(car);
  return car;
}

/** Spawn a parked car at a roadside spot. */
export function spawnParkedCar(S) {
  const rng = S.rng;
  const p = randomRoadPoint(S);
  const vertical = rng() < 0.5;
  const car = {
    x: p.x + (vertical ? randRange(rng, 40, 48) : 0),
    y: p.y + (vertical ? 0 : randRange(rng, 40, 48)),
    angle: vertical ? Math.PI / 2 : 0,
    speed: 0, color: pick(rng, TRAFFIC_COLORS), health: CAR.maxHealth,
    traffic: false, parked: true, playerControlled: false, cop: false,
    dead: false, smoke: 0, bumpTimer: 0, isTarget: false,
  };
  S.cars.push(car);
  return car;
}

/** Spawn a police cruiser near the player, already chasing. */
export function spawnCopCar(S) {
  const rng = S.rng;
  const a = randRange(rng, 0, Math.PI * 2);
  const r = randRange(rng, 420, 620);
  const car = {
    x: clamp(S.player.x + Math.cos(a) * r, 80, WORLD.size - 80),
    y: clamp(S.player.y + Math.sin(a) * r, 80, WORLD.size - 80),
    angle: angleTo(0, 0, S.player.x, S.player.y),
    speed: 200, color: COP_COLOR, health: CAR.maxHealth,
    traffic: false, parked: false, playerControlled: false, cop: true,
    dead: false, smoke: 0, bumpTimer: 0, isTarget: false,
  };
  car.angle = angleTo(car.x, car.y, S.player.x, S.player.y);
  S.cars.push(car);
  return car;
}

/** Blow a car up: particles, sound, damage to everyone nearby. */
export function explodeCar(S, car) {
  if (car.dead) return;
  car.dead = true;
  car.speed = 0;
  S.audio.explosion();
  for (let i = 0; i < 26; i += 1) {
    const a = S.rng() * Math.PI * 2;
    const sp = randRange(S.rng, 60, 420);
    S.particles.push({
      x: car.x, y: car.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: randRange(S.rng, 0.4, 1.1), maxLife: 1.1,
      color: pick(S.rng, ['#ff9a3c', '#e5534b', '#f2c94c', '#888888']), size: randRange(S.rng, 4, 11), kind: 'fire',
    });
  }
  S.shake = Math.max(S.shake, 10);
  // Splash damage: peds, cops, the player and other cars nearby take a hit.
  const hurt = (ent, d) => {
    if (!ent || ent.dead) return;
    ent.health -= 60;
    if (ent.health <= 0) ent.dead = true;
  };
  if (dist(S.player.x, S.player.y, car.x, car.y) < 110) {
    damagePlayer(S, 35);
  }
  for (const ped of S.peds) if (dist(ped.x, ped.y, car.x, car.y) < 120) hurt(ped, 60);
  for (const cop of S.cops) if (dist(cop.x, cop.y, car.x, car.y) < 120) hurt(cop, 60);
  for (const other of S.cars) {
    if (other !== car && !other.dead && dist(other.x, other.y, car.x, car.y) < 110) {
      other.health -= 55;
      if (other.health <= 0) explodeCar(S, other);
    }
  }
  if (car.playerControlled) {
    S.player.onFoot = true;
    S.player.car = null;
    S.player.x = car.x + 40;
    S.player.y = car.y;
    S.player.invuln = 1.2;
    S.message = 'Your car blew up!';
    S.messageT = 2.5;
  }
  if (S.wanted < 2) S.wanted = Math.min(5, S.wanted + 1);
}

/** Damage the player, honouring armor first, and handling death. */
export function damagePlayer(S, amount) {
  const p = S.player;
  if (p.invuln > 0 || p.health <= 0) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.7);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.invuln = 0.25;
  if (p.health <= 0) {
    p.health = 0;
    S.screen = 'over';
    S.audio.fail();
  }
}

/** Player driving physics for one fixed step. */
export function updatePlayerCar(S, dt, input) {
  const car = S.player.car;
  if (!car || S.player.onFoot) return;
  const throttle = -input.axisY(); // up = accelerate
  const steer = input.axisX();
  if (throttle > 0) {
    car.speed += CAR.accel * dt;
  } else if (throttle < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.45 * dt;
  } else {
    car.speed -= car.speed * 0.9 * dt;
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.topSpeed);
  const turning = steer * CAR.turnRate * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle = wrapAngle(car.angle + turning * dt * Math.sign(car.speed || 1));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car hard; scraping them damages it.
  const before = { x: car.x, y: car.y };
  car.x = clamp(nx, 30, WORLD.size - 30);
  car.y = clamp(ny, 30, WORLD.size - 30);
  if (resolveBuildings(S, car, 22)) {
    if (Math.abs(car.speed) > 160) {
      car.health -= 8;
      car.speed *= 0.45;
      S.shake = Math.max(S.shake, 4);
      spawnSkid(S, car);
    } else {
      car.speed *= 0.6;
    }
  }
  // Skid particles when steering hard at speed.
  if (Math.abs(steer) > 0.5 && Math.abs(car.speed) > 240) spawnSkid(S, car);
  if (car.health < 55) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      S.particles.push({
        x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16,
        vx: randRange(S.rng, -20, 20), vy: randRange(S.rng, -40, -10),
        life: 0.8, maxLife: 0.8, color: '#555555', size: 7, kind: 'smoke',
      });
    }
  }
  if (car.health <= CAR.explodeAt && !car.dead) explodeCar(S, car);
  S.player.x = car.x;
  S.player.y = car.y;
  S.player.angle = car.angle;
  void before;
}

function spawnSkid(S, car) {
  for (let i = 0; i < 2; i += 1) {
    S.particles.push({
      x: car.x - Math.cos(car.angle) * 14 + randRange(S.rng, -6, 6),
      y: car.y - Math.sin(car.angle) * 14 + randRange(S.rng, -6, 6),
      vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: '#2a2a2a', size: 4, kind: 'skid',
    });
  }
}

/** Traffic AI: cruise along the road grid, turn at intersections, brake for cars ahead. */
export function updateTrafficCar(S, car, dt) {
  if (car.dead) return;
  // Keep the car glued to its lane: steer toward the nearest road line.
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  let desired = car.angle;
  if (vertical) {
    const targetX = nearestRoadCoord(car.x);
    const err = targetX - car.x;
    desired = car.angle > 0 ? Math.PI / 2 : -Math.PI / 2;
    desired += clamp(err * 0.004, -0.25, 0.25) * (car.angle > 0 ? 1 : -1);
  } else {
    const targetY = nearestRoadCoord(car.y);
    const err = targetY - car.y;
    desired = car.angle > -Math.PI / 2 && car.angle < Math.PI / 2 ? 0 : Math.PI;
    desired += clamp(err * 0.004, -0.25, 0.25) * (desired === 0 ? 1 : -1);
  }
  car.angle = wrapAngle(car.angle + clamp(angleDiff(car.angle, desired), -1.4 * dt, 1.4 * dt));
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = Math.abs(car.x - nearestRoadCoord(car.x)) < 26;
  const nearY = Math.abs(car.y - nearestRoadCoord(car.y)) < 26;
  if (nearX && nearY && S.rng() < dt * 0.25) {
    car.angle = wrapAngle(car.angle + (S.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
  }
  // Brake for a car directly ahead.
  let blocked = false;
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 70 && Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.5) {
      blocked = true;
      break;
    }
  }
  const targetSpeed = blocked ? 0 : 150;
  car.speed += clamp(targetSpeed - car.speed, -300 * dt, 160 * dt);
  car.x = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 30, WORLD.size - 30);
  car.y = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 30, WORLD.size - 30);
  if (resolveBuildings(S, car, 22)) car.speed *= 0.5;
  // Running over a pedestrian is a crime, and the ped gets hurt.
  for (const ped of S.peds) {
    if (!ped.dead && dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
      ped.health -= 50;
      ped.flee = true;
      ped.state = 'flee';
      if (ped.health <= 0) ped.dead = true;
      if (car.playerControlled) S.wanted = Math.min(5, S.wanted + 1);
      car.speed *= 0.7;
    }
  }
}

/** Cop cruisers: ram the player, or the player's car. */
export function updateCopCar(S, car, dt) {
  if (car.dead) return;
  const target = S.player.car && !S.player.onFoot ? S.player.car : S.player;
  const want = angleTo(car.x, car.y, target.x, target.y);
  car.angle = wrapAngle(car.angle + clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt));
  const d = dist(car.x, car.y, target.x, target.y);
  const targetSpeed = d > 90 ? COP.chaseSpeed : 260;
  car.speed += clamp(targetSpeed - car.speed, -500 * dt, 420 * dt);
  car.x = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 30, WORLD.size - 30);
  car.y = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 30, WORLD.size - 30);
  if (resolveBuildings(S, car, 22)) car.speed *= 0.5;
  if (d < 46) {
    // Ram: damage the player's car, or knock Rico down on foot.
    if (S.player.car && !S.player.onFoot) {
      S.player.car.health -= COP.ramDamage * dt;
      S.player.car.speed *= 0.98;
      S.shake = Math.max(S.shake, 2);
      if (S.player.car.health <= CAR.explodeAt) explodeCar(S, S.player.car);
    } else if (S.player.onFoot) {
      damagePlayer(S, COP.ramDamage * dt * 2);
      S.player.x += Math.cos(car.angle) * 30 * dt;
      S.player.y += Math.sin(car.angle) * 30 * dt;
    }
    car.speed *= 0.6;
  }
}

/** Update every car for one fixed step; removes wrecks after a while. */
export function updateVehicles(S, dt, input) {
  updatePlayerCar(S, dt, input);
  for (const car of S.cars) {
    if (car.dead) continue;
    if (car.playerControlled) continue;
    if (car.cop) updateCopCar(S, car, dt);
    else if (car.traffic) updateTrafficCar(S, car, dt);
  }
  // Car-on-car bumps: slow both, spark a little. Bump damage has a cooldown
  // per car — without it, two cars grinding together would melt in a second.
  for (const car of S.cars) if (car.bumpTimer > 0) car.bumpTimer -= dt;
  for (let i = 0; i < S.cars.length; i += 1) {
    const a = S.cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < S.cars.length; j += 1) {
      const b = S.cars[j];
      if (b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        a.speed *= 0.85;
        b.speed *= 0.85;
        if ((a.bumpTimer <= 0 || b.bumpTimer <= 0) && (Math.abs(a.speed) > 200 || Math.abs(b.speed) > 200)) {
          a.health -= 4;
          b.health -= 4;
          a.bumpTimer = 0.5;
          b.bumpTimer = 0.5;
          if (a.health <= CAR.explodeAt) explodeCar(S, a);
          if (b.health <= CAR.explodeAt) explodeCar(S, b);
        }
      }
    }
  }
  // Keep traffic topped up near the player; drop wrecks far away.
  if (S.cars.filter((c) => c.traffic && !c.dead).length < 10) spawnTrafficCar(S, S.player);
  S.cars = S.cars.filter((c) => !c.dead || dist(c.x, c.y, S.player.x, S.player.y) < 1400);
}
