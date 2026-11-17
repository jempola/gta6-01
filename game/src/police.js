// The wanted level (1–5 stars) and the police who enforce it: foot officers who
// chase Rico down and try to arrest him, and cruisers (in vehicle.js) that ram.
// Heat rises with crimes and falls when Rico hides or outruns the law; Lou's
// Garage clears it outright.

import { COP, WORLD, clamp, dist, angleTo, randRange } from './config.js';
import { spawnCopCar } from './vehicle.js';

/** Raise the wanted level by n stars (capped at 5) and reset the cool-down clock. */
export function addWanted(S, n) {
  S.wanted = Math.min(5, S.wanted + n);
  S.wantedTimer = 0;
  S.heatTimer = 0;
  if (S.wanted >= 1) S.audio.sirenBlip();
}

/** Spawn one foot officer near the player. */
export function spawnFootCop(S) {
  const a = randRange(S.rng, 0, Math.PI * 2);
  const r = randRange(S.rng, 300, 480);
  const cop = {
    x: clamp(S.player.x + Math.cos(a) * r, 60, WORLD.size - 60),
    y: clamp(S.player.y + Math.sin(a) * r, 60, WORLD.size - 60),
    angle: 0, speed: randRange(S.rng, 200, 240), health: 40,
    onFoot: true, isCop: true, dead: false, state: 'chase',
    punchTimer: 0, arrestTimer: 0, flee: false,
  };
  S.cops.push(cop);
  return cop;
}

/** Update the wanted level and every foot officer for one fixed step. */
export function updatePolice(S, dt) {
  const p = S.player;
  // Wanted decay: if no cop can see Rico for a while, the heat cools off.
  if (S.wanted > 0) {
    let nearestCop = Infinity;
    for (const cop of S.cops) if (!cop.dead) nearestCop = Math.min(nearestCop, dist(cop.x, cop.y, p.x, p.y));
    for (const car of S.cars) if (car.cop && !car.dead) nearestCop = Math.min(nearestCop, dist(car.x, car.y, p.x, p.y));
    const hidden = nearestCop > 520;
    const speedingAway = p.car && Math.abs(p.car.speed) > 320;
    if (hidden || speedingAway) {
      S.wantedTimer += dt;
      if (S.wantedTimer > 9) {
        S.wanted -= 1;
        S.wantedTimer = 0;
        S.message = S.wanted === 0 ? 'You lost them. Clean.' : 'Heat is cooling off…';
        S.messageT = 2;
        if (S.wanted === 0) S.audio.siren(false);
      }
    } else {
      S.wantedTimer = 0;
    }
  }

  // Lou's Garage: drive in with a car and the wanted level is wiped.
  const g = S.garage;
  if (S.wanted > 0 && !p.onFoot && p.car) {
    if (p.x > g.x - 20 && p.x < g.x + g.w + 20 && p.y > g.y - 20 && p.y < g.y + g.h + 20) {
      S.wanted = 0;
      S.wantedTimer = 0;
      S.cash = Math.max(0, S.cash - 50);
      S.message = "Lou's Garage: paint job done, heat gone. -$50.";
      S.messageT = 3;
      S.audio.cash();
      S.audio.siren(false);
      // The pursuing cruisers give up and drive off.
      for (const car of S.cars) if (car.cop) car.dead = true;
      for (const cop of S.cops) cop.dead = true;
    }
  }

  // Spawn to match the wanted level: cruisers plus foot officers.
  if (S.wanted > 0) {
    S.audio.siren(true);
    const wantCars = Math.min(COP.maxCars, Math.ceil(S.wanted / 2) + (S.wanted >= 4 ? 1 : 0));
    const liveCars = S.cars.filter((c) => c.cop && !c.dead).length;
    S.copSpawnTimer -= dt;
    if (liveCars < wantCars && S.copSpawnTimer <= 0) {
      spawnCopCar(S);
      S.copSpawnTimer = 2.5;
    }
    const wantFoot = Math.min(COP.maxFoot, S.wanted + 1);
    const liveFoot = S.cops.filter((c) => !c.dead).length;
    if (liveFoot < wantFoot && S.copSpawnTimer <= 0) {
      spawnFootCop(S);
      S.copSpawnTimer = 2.5;
    }
  } else {
    S.audio.siren(false);
  }

  // Foot officers: run Rico down; up close they try to arrest him.
  for (const cop of S.cops) {
    if (cop.dead) continue;
    if (cop.punchTimer > 0) cop.punchTimer -= dt;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > 900) {
      // Too far behind: teleport the officer closer, as if backup arrived.
      const a = randRange(S.rng, 0, Math.PI * 2);
      cop.x = clamp(p.x + Math.cos(a) * 420, 60, WORLD.size - 60);
      cop.y = clamp(p.y + Math.sin(a) * 420, 60, WORLD.size - 60);
      continue;
    }
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    if (d > 34) {
      cop.x = clamp(cop.x + Math.cos(a) * cop.speed * dt, 40, WORLD.size - 40);
      cop.y = clamp(cop.y + Math.sin(a) * cop.speed * dt, 40, WORLD.size - 40);
      cop.arrestTimer = 0;
    } else if (p.onFoot) {
      // Arrest: hold Rico for two seconds and the run ends in cuffs.
      cop.arrestTimer += dt;
      S.message = 'The cops are cuffing you — break free! (move!)';
      S.messageT = 0.5;
      if (p.moving) cop.arrestTimer -= dt * 2;
      if (cop.arrestTimer > 2) {
        p.health = 0;
        S.screen = 'over';
        S.overReason = 'Busted by the Solmar Bay police.';
      }
    } else if (cop.punchTimer <= 0) {
      // Rico is in a car: the officer yanks at the door and dents it.
      cop.punchTimer = 0.8;
      if (p.car) {
        p.car.health -= 6;
        p.car.speed *= 0.9;
      }
    }
  }
  S.cops = S.cops.filter((c) => !c.dead || dist(c.x, c.y, p.x, p.y) < 1200);
}
