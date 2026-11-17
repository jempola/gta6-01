// Cars: player driving physics, parked cars, traffic AI that follows the road
// grid, collisions, car health and explosions.
import { CAR, WORLD, clamp, dist2, angleDiff, makeRng, TAU } from './config.js';
import { collideBuildings, isOnRoad, nearestRoadPoint, ROAD_XS, ROAD_YS } from './world.js';

const CAR_NAMES = ['Solmar Comet', 'Bay Runner', 'Palm Cruiser', 'Harbor Hauler', 'Sunset GT', 'Coral Coupe', 'Dune Buggy', 'Metro Taxi'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#f39c12'];

export function makeCar(rng, x, y, angle, opts = {}) {
  const i = Math.floor(rng() * CAR_NAMES.length);
  return {
    x, y, angle, speed: 0, health: CAR.maxHealth,
    name: opts.name || CAR_NAMES[i], color: opts.color || CAR_COLORS[i],
    driver: opts.driver !== undefined ? opts.driver : 'traffic', parked: !!opts.parked, isPolice: !!opts.isPolice,
    exploded: false, smoke: 0, target: null, stuck: 0, honk: 0,
    w: 46, h: 22,
  };
}

export function spawnCars(G, rng) {
  G.cars = [];
  // Parked cars along roads.
  for (let i = 0; i < 26; i += 1) {
    const rx = ROAD_XS[Math.floor(rng() * ROAD_XS.length)];
    const ry = ROAD_YS[Math.floor(rng() * ROAD_YS.length)];
    const alongX = rng() > 0.5;
    const x = alongX ? rx + (rng() - 0.5) * 300 : rx + 44;
    const y = alongX ? ry + 44 : ry + (rng() - 0.5) * 300;
    G.cars.push(makeCar(rng, x, y, alongX ? 0 : Math.PI / 2, { parked: true }));
  }
  // Moving traffic.
  for (let i = 0; i < 18; i += 1) {
    const rx = ROAD_XS[Math.floor(rng() * ROAD_XS.length)];
    const ry = ROAD_YS[Math.floor(rng() * ROAD_YS.length)];
    const car = makeCar(rng, rx, ry, rng() > 0.5 ? 0 : Math.PI / 2, { driver: 'traffic' });
    car.speed = 120 + rng() * 60;
    car.target = pickRoadTarget(rng, car);
    G.cars.push(car);
  }
  // The player's starter car near the safehouse, parked on the road centre line.
  const starter = makeCar(rng, 780, 675, 0, { name: 'Sunset GT', color: '#c0392b', driver: null, parked: true });
  G.cars.push(starter);
}

function pickRoadTarget(rng, car) {
  const p = nearestRoadPoint(car.x, car.y);
  const horizontal = Math.abs(car.y - p.y) < 4;
  if (horizontal) return { x: car.x + (rng() > 0.5 ? 450 : -450), y: p.y, horizontal: true };
  return { x: p.x, y: car.y + (rng() > 0.5 ? 450 : -450), horizontal: false };
}

function explodeCar(G, car) {
  if (car.exploded) return;
  car.exploded = true; car.speed = 0;
  G.audio.explosion();
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * TAU, s = 60 + Math.random() * 220;
    G.particles.push({ x: car.x, y: car.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, color: i % 3 ? '#ff7b2f' : '#ffd94a', size: 5 + Math.random() * 6 });
  }
  G.particles.push({ x: car.x, y: car.y, vx: 0, vy: -30, life: 1.4, max: 1.4, color: '#555', size: 22 });
  if (G.player.inCar === car) {
    G.player.inCar = null;
    G.player.x = car.x + 50; G.player.y = car.y + 50;
    G.player.health = Math.max(15, G.player.health - 25);
    G.banner('Your car exploded! You bailed out, hurt.');
  }
  G.addWanted(1, 'Caused an explosion');
}

export function damageCar(G, car, amount) {
  if (car.exploded) return;
  car.health -= amount;
  if (car.health <= 30) car.smoke = 1;
  if (car.health <= 0) explodeCar(G, car);
}

function carHitsBuildings(G, car) {
  const hit = collideBuildings(G.city.buildings, car.x, car.y, 24);
  if (hit.hit) {
    if (Math.abs(car.speed) > 120) damageCar(G, car, Math.abs(car.speed) * 0.06);
    car.speed *= 0.4;
    car.x = hit.x; car.y = hit.y;
  }
}

function carHitsCar(a, b, G) {
  if (a.exploded || b.exploded || a === b) return;
  const d = dist2(a.x, a.y, b.x, b.y);
  if (d > 48 * 48) return;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 90) {
    damageCar(G, a, impact * 0.05);
    damageCar(G, b, impact * 0.05);
    G.audio.punch();
  }
  const push = (48 - Math.sqrt(d)) / 2 || 1;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  a.x -= Math.cos(ang) * push; a.y -= Math.sin(ang) * push;
  b.x += Math.cos(ang) * push; b.y += Math.sin(ang) * push;
  a.speed *= 0.7; b.speed *= 0.7;
}

export function updateCars(G, dt, input) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.exploded) continue;
    if (car.driver === 'player') {
      const axis = input.axis();
      const forward = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0; // W = forward
      const steering = axis.x;
      if (forward > 0) car.speed += CAR.accel * dt;
      else if (forward < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed -= Math.sign(car.speed) * 140 * dt;
      if (Math.abs(car.speed) < 8 && forward === 0) car.speed = 0;
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      if (Math.abs(car.speed) > 5) {
        car.angle += steering * CAR.steer * dt * Math.sign(car.speed) * (car.speed > 0 ? 1 : -1);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 30, WORLD.size - 30);
      car.y = clamp(car.y, 30, WORLD.size - 30);
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      if (Math.abs(car.speed) > 300 && Math.random() < 0.3) {
        G.particles.push({ x: car.x - Math.cos(car.angle) * 22, y: car.y - Math.sin(car.angle) * 22, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#222', size: 4 });
      }
      G.audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
    } else if (car.driver === 'traffic') {
      // Follow the road grid toward the current target, then pick a new one.
      if (!car.target) car.target = pickRoadTarget(G.rng, car);
      const tx = car.target.x, ty = car.target.y;
      const want = Math.atan2(ty - car.y, tx - car.x);
      const diff = angleDiff(want, car.angle);
      car.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
      const targetSpeed = 150;
      car.speed += (targetSpeed - car.speed) * dt * 0.8;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist2(car.x, car.y, tx, ty) < 60 * 60 || !isOnRoad(car.x, car.y)) {
        car.target = pickRoadTarget(G.rng, car);
      }
      // Traffic brakes for the car ahead.
      for (const other of G.cars) {
        if (other === car || other.exploded) continue;
        const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
        const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 30) car.speed *= 0.9;
      }
    }
    carHitsBuildings(G, car);
    if (car.smoke > 0 && Math.random() < 0.4) {
      G.particles.push({ x: car.x, y: car.y - 8, vx: 0, vy: -40, life: 0.8, max: 0.8, color: '#666', size: 6 });
    }
  }
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) carHitsCar(G.cars[i], G.cars[j], G);
  }
  // Running over pedestrians.
  for (const car of G.cars) {
    if (car.exploded || Math.abs(car.speed) < 40) continue;
    for (const ped of G.peds.list) {
      if (ped.down) continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
        ped.health = 0; ped.down = true;
        ped.flee = 0;
        if (car.driver === 'player') G.addWanted(1, 'Ran over a pedestrian');
        G.audio.punch();
      }
    }
  }
}
