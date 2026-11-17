// The screenshot scenes behind ?shot=cover|combat|mission|dusk. Each one resets the
// world from the fixed seed, then plays the real rules forward for a fixed number of
// steps — driving, shooting, a mission running — so the frame is what a short game
// really looks like, and the same seed always gives the same frame.

import { STEP } from './config.js';
import { updateVehicles, spawnCopCar } from './vehicle.js';
import { updatePeds } from './ped.js';
import { updatePolice } from './police.js';
import { updateCombat, shoot } from './combat.js';
import { updateMissions, startMission } from './missions.js';
import { tryEnterCar } from './player.js';
import { createState } from './main.js';

/** A minimal fake input: no keys held, mouse parked to the right of the player. */
function fakeInput(S) {
  return {
    axisX: () => 0,
    axisY: () => -1,
    running: () => false,
    mouse: { x: 700, y: 360, down: false },
  };
}

/** Run the live simulation forward for `seconds` of game time. */
function simulate(S, seconds) {
  const input = fakeInput(S);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    S.time += STEP;
    if (S.messageT > 0) S.messageT -= STEP;
    updateVehicles(S, STEP, input);
    updatePeds(S, STEP);
    updatePolice(S, STEP);
    updateCombat(S, STEP);
    updateMissions(S, STEP);
    for (const pt of S.particles) pt.life -= STEP;
    S.particles = S.particles.filter((pt) => pt.life > 0);
    S.camera.x = S.player.x;
    S.camera.y = S.player.y;
  }
}

/**
 * Set the world to the named scene (cover, combat, mission or dusk; any other name
 * is cover) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const scene = name === 'combat' || name === 'mission' || name === 'dusk' ? name : 'cover';
  // Rebuild a fresh state from the same seed the page was opened with, so the
  // scene is deterministic, then point the caller's state at it.
  const fresh = createState(world.seed, world.audio);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
  world.screen = 'play';

  if (scene === 'cover') {
    // Rico driving downtown with cruisers on his tail, mid-chase. Stage a fresh
    // car on a downtown road heading east, so the chase stays on the road.
    const car = {
      x: 1575, y: 1575, angle: 0, speed: 0, color: '#e07a2e', health: 100,
      traffic: false, parked: false, playerControlled: true, cop: false,
      dead: false, smoke: 0, bumpTimer: 0, isTarget: false,
    };
    world.cars.push(car);
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.onFoot = false;
    world.player.car = car;
    world.wanted = 2;
    spawnCopCar(world);
    spawnCopCar(world);
    simulate(world, 3);
  } else if (scene === 'combat') {
    // Rico on foot with a pistol, firing at thugs near the port, muzzle flash lit.
    world.weapon = 'pistol';
    world.ammo = 24;
    world.player.x = 3050;
    world.player.y = 540;
    world.camera.x = 3050;
    world.camera.y = 540;
    startMission(world, 'takedown');
    simulate(world, 1.0);
    const mw = { x: world.player.x + 200, y: world.player.y - 60 };
    world.player.angle = Math.atan2(mw.y - world.player.y, mw.x - world.player.x);
    shoot(world, mw);
    simulate(world, 0.2);
  } else if (scene === 'mission') {
    // The delivery mission mid-run: marker, objective line and minimap visible.
    world.player.x = 3000;
    world.player.y = 600;
    world.camera.x = 3000;
    world.camera.y = 600;
    startMission(world, 'delivery');
    simulate(world, 2);
  } else {
    // Dusk police escape: low sun, sirens, Rico speeding away from cruisers.
    world.dusk = true;
    const car = {
      x: 1575, y: 1575, angle: 0, speed: 0, color: '#e07a2e', health: 100,
      traffic: false, parked: false, playerControlled: true, cop: false,
      dead: false, smoke: 0, bumpTimer: 0, isTarget: false,
    };
    world.cars.push(car);
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.onFoot = false;
    world.player.car = car;
    world.wanted = 3;
    spawnCopCar(world);
    spawnCopCar(world);
    simulate(world, 3);
    world.dusk = true;
    world.duskLock = true;
  }
  return { screen: 'play' };
}
