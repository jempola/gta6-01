// Screenshot scenes behind ?shot=cover|combat|mission|dusk. Each one stages a real
// game state (real systems, real HUD, real minimap) and then steps the world
// forward a few seconds so traffic, police and particles are mid-action.
import { startMission, startGig } from './missions.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicle.js';

function placeDowntownChase(G) {
  const p = G.player;
  p.x = 1900; p.y = 1575; p.angle = 0;
  const car = makeCar(G.rng, 1900, 1575, 0, { name: 'Sunset GT', color: '#c0392b', driver: 'player', parked: false });
  car.speed = 320;
  G.cars.push(car);
  p.inCar = car;
  // Traffic around the chase.
  for (let i = 0; i < 5; i += 1) {
    const c = makeCar(G.rng, 1700 + i * 120, 1575 + (i % 2 ? 30 : -30), 0, { driver: 'traffic' });
    c.speed = 150;
    G.cars.push(c);
  }
  addWanted(G, 3, 'Downtown chase');
  G.missions.active = null;
  G.banner('WANTED — 3 stars: Downtown chase');
}

export function stageShot(name, G) {
  G.screen = 'play';
  G.timeOfDay = name === 'dusk' ? 'dusk' : 'day';
  if (name === 'cover') {
    placeDowntownChase(G);
    startMission(G, 1); // "The Getaway Driver" — objective tracker + marker visible
    G.missions.dialogue = 'Dario: "The crew hit the Bay Bank. Cops are everywhere — lose the tail!"';
    G.missions.dialogueTimer = 99;
  } else if (name === 'combat') {
    const p = G.player;
    p.x = 1125; p.y = 1125; p.weapon = 'pistol'; p.ammo = 24; p.angle = 0.4;
    // A couple of hostile peds right in front, mid-fight.
    for (const ped of G.peds.list.slice(0, 3)) {
      ped.x = 1160 + Math.random() * 60; ped.y = 1150 + Math.random() * 60;
      ped.fighter = true; ped.flee = 0;
    }
    G.bullets.push({ x: p.x + 40, y: p.y + 10, vx: 900, vy: 200, life: 0.3, damage: 25 });
    G.particles.push({ x: p.x + 30, y: p.y + 8, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#ffd94a', size: 9 });
    addWanted(G, 2, 'Gunfire in Old Town');
    G.banner('On-foot combat — pistol out, aim with the mouse');
  } else if (name === 'mission') {
    startMission(G, 0);
    const p = G.player;
    p.x = 1125; p.y = 900;
    // Parked on the road (x=1125 is a road centre line), facing down the street.
    const car = makeCar(G.rng, 1125, 900, Math.PI / 2, { name: 'Bay Runner', color: '#2980b9', driver: 'player', parked: false });
    car.speed = 200;
    G.cars.push(car);
    p.inCar = car;
    G.missions.dialogue = 'Mara: "My delivery van is stuck at the port — bring it to the safehouse."';
    G.missions.dialogueTimer = 99;
  } else if (name === 'dusk') {
    placeDowntownChase(G);
    G.timeOfDay = 'dusk';
    startMission(G, 1); // "The Getaway Driver" — objective tracker + dialogue visible
    G.missions.dialogue = 'Dario: "Lose the tail before dark — the sun is going down on us!"';
    G.missions.dialogueTimer = 99;
    G.banner('Dusk escape — lose the tail before dark');
  }
  // Step the world forward so police close in and particles fly.
  const drive = { axis: () => ({ x: 0, y: -1 }), running: () => false };
  for (let i = 0; i < 90; i += 1) G.stepWorld(1 / 60, drive);
  G.camera.x = G.player.x; G.camera.y = G.player.y;
  G.toastTimer = 0;
  return { screen: 'play' };
}
