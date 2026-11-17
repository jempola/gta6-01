// The wanted system: stars 1-5, police cars and foot cops that spawn, chase,
// ram and arrest. Lose them by hiding, outrunning them, or paying at the spray shop.
import { WANTED_MAX, WORLD, clamp, dist2, angleTo, angleDiff } from './config.js';
import { makeCar } from './vehicle.js';
import { damagePlayer } from './player.js';

export function createPolice() {
  return { cops: [], copCars: [], spawnTimer: 0, hiddenTimer: 0, arrestTimer: 0 };
}

export function addWanted(G, stars, reason) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.min(WANTED_MAX, p.wanted + stars);
  p.heat = 1;
  G.police.hiddenTimer = 0;
  if (p.wanted > before) {
    G.banner(`WANTED — ${p.wanted} star${p.wanted > 1 ? 's' : ''}${reason ? ': ' + reason : ''}`);
    G.audio.siren(true);
  }
}

function spawnCopCar(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(angle) * 700, 100, WORLD.size - 100);
  const y = clamp(p.y + Math.sin(angle) * 700, 100, WORLD.size - 100);
  const car = makeCar(G.rng, x, y, angleTo(x, y, p.x, p.y), { name: 'SBPD Interceptor', color: '#1a1a2e', isPolice: true, driver: 'police' });
  car.health = 120;
  G.cars.push(car);
  G.police.copCars.push(car);
  return car;
}

function spawnFootCop(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  const cop = {
    x: clamp(p.x + Math.cos(angle) * 420, 60, WORLD.size - 60),
    y: clamp(p.y + Math.sin(angle) * 420, 60, WORLD.size - 60),
    angle: 0, health: 50, down: false, isCop: true, speed: 200,
    attackCooldown: 0, color: '#1a2a4a', name: 'Officer',
  };
  G.police.cops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  const p = G.player;
  const pol = G.police;
  const wanted = p.wanted;
  G.audio.siren(wanted > 0);
  if (wanted > 0) G.audio.sirenWail(G.time);
  if (wanted === 0) {
    pol.spawnTimer = 0;
    return;
  }
  // Spawn pressure scales with stars.
  pol.spawnTimer -= dt;
  const wantCars = Math.min(4, wanted);
  const wantCops = wanted >= 2 ? Math.min(4, wanted) : 0;
  if (pol.spawnTimer <= 0) {
    pol.spawnTimer = Math.max(1.2, 4.5 - wanted * 0.7);
    if (pol.copCars.filter((c) => !c.exploded).length < wantCars) spawnCopCar(G);
    if (pol.cops.filter((c) => !c.down).length < wantCops) spawnFootCop(G);
  }
  // Police cars chase and ram the player.
  for (const car of pol.copCars) {
    if (car.exploded) continue;
    const want = angleTo(car.x, car.y, p.x, p.y);
    const diff = angleDiff(want, car.angle);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const targetSpeed = p.inCar ? 430 : 300;
    car.speed += (targetSpeed - car.speed) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram: hitting the player's car damages it; hitting the player on foot hurts.
    if (dist2(car.x, car.y, p.x, p.y) < 46 * 46) {
      if (p.inCar) {
        p.inCar.health -= 14 * dt * 10;
        if (p.inCar.health <= 0) { /* explodeCar handles the bail-out */ }
      } else {
        damagePlayer(G, 12 * dt * 10);
      }
    }
  }
  // Foot cops chase and try to arrest (touch = busted when the player is weak/slow).
  for (const cop of pol.cops) {
    if (cop.down) continue;
    if (cop.attackCooldown > 0) cop.attackCooldown -= dt;
    const d = dist2(cop.x, cop.y, p.x, p.y);
    if (d > 900 * 900) { cop.down = true; continue; } // lost the trail
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (d < 26 * 26 && cop.attackCooldown <= 0) {
      cop.attackCooldown = 1;
      if (p.inCar) {
        p.inCar.health -= 8;
      } else {
        damagePlayer(G, 10);
        G.banner('A cop is grabbing you — run!');
      }
    }
  }
  pol.copCars = pol.copCars.filter((c) => !c.exploded);
  pol.cops = pol.cops.filter((c) => !c.down);
  // Cool down: if no cop is near for a while, stars decay one at a time.
  const nearest = Math.min(
    ...pol.copCars.map((c) => dist2(c.x, c.y, p.x, p.y)),
    ...pol.cops.map((c) => dist2(c.x, c.y, p.x, p.y)),
    Infinity,
  );
  if (nearest > 520 * 520) {
    pol.hiddenTimer += dt;
    if (pol.hiddenTimer > 9) {
      pol.hiddenTimer = 0;
      p.wanted -= 1;
      G.banner(p.wanted > 0 ? `Heat cooling off… ${p.wanted} star${p.wanted > 1 ? 's' : ''} left.` : 'You lost the cops. Clean.');
      if (p.wanted === 0) G.audio.siren(false);
    }
  } else {
    pol.hiddenTimer = 0;
  }
}
