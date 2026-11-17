// Rico Vale on foot: WASD movement, running, punching, entering and exiting cars.
import { PLAYER, WORLD, clamp, dist2, angleTo } from './config.js';
import { collideBuildings, pointInRect } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.maxHealth, armor: 0, cash: 250,
    weapon: 'fists', ammo: 0, inCar: null,
    punchCooldown: 0, punchAnim: 0, hurtTimer: 0, moving: false,
    wanted: 0, heat: 0,
  };
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.hurtTimer > 0 || G.screen === 'over') return;
  let left = amount;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left); p.armor -= absorbed; left -= absorbed; }
  p.health -= left;
  p.hurtTimer = 0.6;
  if (p.health <= 0) {
    p.health = 0;
    G.gameOver('wasted');
  }
}

export function updatePlayerOnFoot(G, dt, input) {
  const p = G.player;
  const axis = input.axis();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.moving = axis.x !== 0 || axis.y !== 0;
  if (p.moving) {
    const len = Math.hypot(axis.x, axis.y) || 1;
    let nx = p.x + (axis.x / len) * speed * dt;
    let ny = p.y + (axis.y / len) * speed * dt;
    nx = clamp(nx, 30, WORLD.size - 30);
    ny = clamp(ny, 30, WORLD.size - 30);
    const hit = collideBuildings(G.city.buildings, nx, ny, p.radius);
    p.x = hit.x; p.y = hit.y;
    p.angle = Math.atan2(axis.y, axis.x);
  }
  // Aim follows the mouse when armed; otherwise faces the walk direction.
  if (p.weapon === 'pistol' && G.mouseWorld) p.angle = angleTo(p.x, p.y, G.mouseWorld.x, G.mouseWorld.y);
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  // Walk into the spray shop on foot to clear wanted (costs $150).
  if (pointInRect(p.x, p.y, G.city.garage) && p.wanted > 0 && p.cash >= 150) {
    p.cash -= 150; p.wanted = 0; p.heat = 0;
    G.police.cops = []; G.police.copCars = [];
    G.banner('Sunset Auto resprayed your ride — wanted level cleared! (-$150)');
    G.audio.cash();
  }
}

// Punch the nearest ped / cop in front of the player.
export function punch(G) {
  const p = G.player;
  if (p.punchCooldown > 0 || p.inCar) return;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.25;
  G.audio.punch();
  const range = PLAYER.punchRange + p.radius;
  let best = null, bestD = range * range;
  const targets = [...G.peds.list, ...G.police.cops];
  for (const t of targets) {
    if (t.down) continue;
    const d = dist2(p.x, p.y, t.x, t.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    best.health -= PLAYER.punchDamage;
    G.particles.push({ x: best.x, y: best.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffd94a', size: 6 });
    if (best.health <= 0) {
      best.down = true;
      G.addWanted(1, 'Assaulted a pedestrian');
      if (best.isCop) G.addWanted(1, 'Attacked a police officer');
    } else if (best.flee !== undefined) {
      best.flee = 3; best.fleeX = p.x; best.fleeY = p.y;
    }
  }
}

// E near a car: jack it (stealing adds wanted). E while driving: step out.
export function tryEnterExitCar(G) {
  const p = G.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    car.driver = null;
    G.banner('You left the car.');
    return;
  }
  let best = null, bestD = 70 * 70;
  for (const car of G.cars) {
    if (car.exploded) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) { G.banner('No car nearby — walk up to one and press E.'); return; }
  const stolen = best.driver === 'traffic' || best.parked;
  best.driver = 'player'; best.parked = false;
  p.inCar = best;
  if (stolen) {
    G.addWanted(1, 'Stole a car');
    G.banner(`You jacked the ${best.name}! The law noticed.`);
  } else {
    G.banner(`You got into the ${best.name}.`);
  }
  G.audio.pickup();
}
