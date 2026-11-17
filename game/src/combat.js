// Combat: pistol shots (mouse aim), bullets, fists via the player module, and
// pickups scattered around the city (pistol, ammo, health, armor).
import { dist2, angleTo, TAU } from './config.js';
import { scarePeds } from './ped.js';
import { damageCar } from './vehicle.js';

export function spawnPickups(G) {
  G.pickups = [
    { kind: 'pistol', x: 760, y: 760, taken: false },
    { kind: 'pistol', x: 1900, y: 1150, taken: false },
    { kind: 'health', x: 1150, y: 2000, taken: false },
    { kind: 'health', x: 2500, y: 1200, taken: false },
    { kind: 'health', x: 700, y: 3000, taken: false },
    { kind: 'ammo', x: 1600, y: 2000, taken: false },
    { kind: 'ammo', x: 2900, y: 1600, taken: false },
    { kind: 'armor', x: 2050, y: 2050, taken: false },
    { kind: 'armor', x: 900, y: 1150, taken: false },
  ];
  G.bullets = [];
}

export function shoot(G) {
  const p = G.player;
  if (p.inCar || p.weapon !== 'pistol' || p.ammo <= 0) return;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.22;
  p.ammo -= 1;
  const angle = p.angle;
  G.bullets.push({
    x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.7, damage: 25,
  });
  G.particles.push({ x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#ffd94a', size: 8 });
  G.audio.shot();
  scarePeds(G, p.x, p.y, 320);
  G.addWanted(0, ''); // no-op keep
  // Firing a gun in public draws attention.
  if (Math.random() < 0.5) G.addWanted(1, 'Gunfire heard');
}

export function updateBullets(G, dt) {
  const p = G.player;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    // Hit a ped / cop.
    for (const t of [...G.peds.list, ...G.police.cops]) {
      if (t.down) continue;
      if (dist2(b.x, b.y, t.x, t.y) < 18 * 18) {
        b.life = 0;
        t.health -= b.damage;
        if (t.health <= 0) {
          t.down = true;
          G.addWanted(1, t.isCop ? 'Shot a police officer' : 'Shot a pedestrian');
        } else if (t.flee !== undefined) {
          t.flee = 3; t.fleeX = p.x; t.fleeY = p.y;
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit a car.
    for (const car of G.cars) {
      if (car.exploded) continue;
      if (dist2(b.x, b.y, car.x, car.y) < 28 * 28) {
        b.life = 0;
        damageCar(G, car, b.damage);
        if (car.driver === 'traffic') G.addWanted(1, 'Shot at traffic');
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  // Pickups.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      pk.taken = true;
      G.audio.pickup();
      if (pk.kind === 'pistol') { p.weapon = 'pistol'; p.ammo = Math.max(p.ammo, 24); G.banner('Picked up a pistol! Aim with the mouse, click to shoot. Press R to reload (needs ammo).'); }
      else if (pk.kind === 'ammo') { p.ammo += 24; G.banner('Picked up ammo (+24).'); }
      else if (pk.kind === 'health') { p.health = Math.min(100, p.health + 40); G.banner('Health pack (+40).'); }
      else if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); G.banner('Body armor (+50).'); }
    }
  }
}
