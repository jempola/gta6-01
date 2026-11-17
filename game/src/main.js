// Solmar Bay — boot and the one loop. Input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, pause (with mission select, save and load) and game over with respawn.
// ?seed=N fixes the city. ?shot=cover|combat|mission|dusk (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot driver.

import { STEP, WORLD, mulberry32 } from './config.js';
import { buildWorld } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayer, tryEnterCar, exitCar, punch } from './player.js';
import { updateVehicles, spawnTrafficCar, spawnParkedCar } from './vehicle.js';
import { updatePeds, spawnPed } from './ped.js';
import { updatePolice } from './police.js';
import { updateCombat, shoot, spawnPickups } from './combat.js';
import { startMission, startGig, updateMissions, MISSIONS, GIGS } from './missions.js';
import { drawHUD } from './hud.js';
import { drawWorld } from './render.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const audio = createAudio();

/** Build a fresh game state for the given seed. */
export function createState(seedValue, audioObj) {
  const rng = mulberry32(seedValue);
  const S = {
    seed: seedValue,
    rng,
    time: 0,
    dusk: false,
    duskLock: false,
    screen: 'title',
    camera: { x: 1800, y: 1800 },
    player: {
      x: 1800, y: 1800, angle: 0, vx: 0, vy: 0,
      health: 100, armor: 0, onFoot: true, car: null,
      punchTimer: 0, punchAnim: 0, invuln: 0, moving: false,
    },
    cars: [], peds: [], cops: [], thugs: [],
    bullets: [], particles: [], pickups: [],
    buildings: [], trees: [], districts: [],
    roadsX: [], roadsY: [], garage: null, hospital: null,
    wanted: 0, wantedTimer: 0, heatTimer: 0, copSpawnTimer: 0,
    cash: 120, weapon: 'fists', ammo: 0,
    shootCooldown: 0, recentShot: 0, pickupTimer: 25,
    mission: null, gig: null,
    objective: 'No active mission. Press P to open the menu and pick one.',
    message: '', messageT: 0,
    missionDialogue: '', missionDialogueT: 0,
    completedMissions: [],
    stats: { shots: 0, hits: 0, kills: 0, missionsDone: 0, thugsDown: 0 },
    shake: 0, overReason: '',
    audio: audioObj,
  };
  buildWorld(S);
  spawnPickups(S);
  for (let i = 0; i < 12; i += 1) spawnTrafficCar(S, null);
  for (let i = 0; i < 10; i += 1) spawnParkedCar(S);
  for (let i = 0; i < 16; i += 1) spawnPed(S, S.player);
  return S;
}

let S = createState(seed, audio);
window.__game = S;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/** Mouse position converted into world coordinates through the camera. */
function mouseWorld(input) {
  return {
    x: S.camera.x - canvas.width / 2 + input.mouse.x,
    y: S.camera.y - canvas.height / 2 + input.mouse.y,
  };
}

function announce(message) {
  status.textContent = message;
}

/** One fixed simulation step while playing. */
function stepPlay(dt, input) {
  S.time += dt;
  // Day slowly turns to dusk and back on a five-minute cycle, unless dusk was
  // forced on (screenshots, or the test hook) — a forced dusk sticks.
  if (!S.duskLock) S.dusk = (S.time % 300) > 235;
  if (S.messageT > 0) S.messageT -= dt;
  if (S.missionDialogueT > 0) S.missionDialogueT -= dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);

  const mw = mouseWorld(input);
  updatePlayer(S, dt, input, mw);
  updateVehicles(S, dt, input);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateCombat(S, dt);
  updateMissions(S, dt);

  // Particles age and die.
  for (const pt of S.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);

  // Camera eases after the player (or the player's car).
  const tx = S.player.x;
  const ty = S.player.y;
  S.camera.x += (tx - S.camera.x) * Math.min(1, dt * 5);
  S.camera.y += (ty - S.camera.y) * Math.min(1, dt * 5);
  S.camera.x = Math.max(canvas.width / 2 - 200, Math.min(WORLD.size - canvas.width / 2 + 200, S.camera.x));
  S.camera.y = Math.max(canvas.height / 2 - 200, Math.min(WORLD.size - canvas.height / 2 + 200, S.camera.y));

  // Engine hum and music follow the action.
  const carSpeed = S.player.car && !S.player.onFoot ? Math.abs(S.player.car.speed) / 430 : 0;
  audio.engine(carSpeed);
  audio.updateMusic(dt, true);
}

/** One fixed step on the title screen: traffic and pedestrians drift by. */
function stepTitle(dt) {
  S.time += dt;
  for (const car of S.cars) {
    if (car.traffic && !car.dead) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < 0 || car.x > WORLD.size || car.y < 0 || car.y > WORLD.size) {
        car.x = 1800;
        car.y = 1800;
      }
    }
  }
  S.camera.x = 1800 + Math.cos(S.time * 0.05) * 300;
  S.camera.y = 1800 + Math.sin(S.time * 0.05) * 300;
}

/* ---------------- Screens: the overlay menus ---------------- */

function missionButtons() {
  return MISSIONS.map((m) => {
    const done = S.completedMissions.includes(m.id) ? ' ✓' : '';
    return `<button class="menu-btn" data-mission="${m.id}">${m.name} — $${m.payout}${done}<span class="menu-sub">${m.desc}</span></button>`;
  }).join('') + GIGS.map((g) => (
    `<button class="menu-btn" data-gig="${g.id}">${g.name}<span class="menu-sub">${g.desc}</span></button>`
  )).join('');
}

function showTitle() {
  S.screen = 'title';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="panel">
      <h1>SOLMAR BAY</h1>
      <p class="tagline">A sun-soaked open-world crime story. You are Rico Vale — ex-driver, pulled back in.</p>
      <p class="story">Milo needs a driver. Vane owns the docks. The bay is yours to take: steal cars, outrun the law, run five story missions and two side gigs, and get rich — or get busted trying.</p>
      <button class="menu-btn primary" id="btn-start">▶ Start the story</button>
      ${hasSave() ? '<button class="menu-btn" id="btn-continue">Continue saved game</button>' : ''}
      <p class="controls">WASD / arrows — move &amp; drive &nbsp;•&nbsp; Shift — run &nbsp;•&nbsp; E — enter / exit car &nbsp;•&nbsp; Click — punch / shoot &nbsp;•&nbsp; P — pause &amp; missions</p>
      <p class="controls">Steal any car. Lose the cops at Lou's Garage. Save anytime from the pause menu.</p>
    </div>`;
  document.getElementById('btn-start').addEventListener('click', () => { audio.unlock(); startGame(); });
  const cont = document.getElementById('btn-continue');
  if (cont) cont.addEventListener('click', () => { audio.unlock(); startGame(true); });
  announce('Solmar Bay. Press Enter or click Start to play.');
}

function showPause() {
  S.screen = 'pause';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="panel">
      <h1>PAUSED</h1>
      <p class="tagline">Cash $${S.cash} &nbsp;•&nbsp; Missions done: ${S.stats.missionsDone} &nbsp;•&nbsp; Wanted: ${'★'.repeat(S.wanted)}${'☆'.repeat(5 - S.wanted)}</p>
      <button class="menu-btn primary" id="btn-resume">Resume</button>
      <h2>Story missions</h2>
      ${missionButtons()}
      <button class="menu-btn" id="btn-save">💾 Save game</button>
      <button class="menu-btn" id="btn-load">📂 Load saved game</button>
      <button class="menu-btn" id="btn-restart">↺ Restart from the beginning</button>
      <p class="controls">P / Esc — resume &nbsp;•&nbsp; E — enter a car &nbsp;•&nbsp; Click — punch / shoot</p>
    </div>`;
  document.getElementById('btn-resume').addEventListener('click', () => { audio.click(); resumeGame(); });
  document.getElementById('btn-save').addEventListener('click', () => {
    const ok = saveGame(S);
    announce(ok ? 'Game saved.' : 'Save failed.');
    showPause();
  });
  document.getElementById('btn-load').addEventListener('click', () => {
    const data = loadSave();
    if (data) { applySave(S, data); resumeGame(); }
    else { announce('No save found.'); }
  });
  document.getElementById('btn-restart').addEventListener('click', () => { startGame(); });
  overlay.querySelectorAll('[data-mission]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (startMission(S, btn.dataset.mission)) resumeGame();
      else announce('Finish the current mission first.');
    });
  });
  overlay.querySelectorAll('[data-gig]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (startGig(S, btn.dataset.gig)) resumeGame();
      else announce('Finish the current job first.');
    });
  });
  announce('Paused.');
}

function showGameOver() {
  S.screen = 'over';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="panel">
      <h1>${S.overReason ? 'BUSTED' : 'WASTED'}</h1>
      <p class="tagline">${S.overReason || 'Rico went down in Solmar Bay.'}</p>
      <p class="story">Cash: $${S.cash} &nbsp;•&nbsp; Missions done: ${S.stats.missionsDone} &nbsp;•&nbsp; The bay will wait — the hospital patches Rico up for $100.</p>
      <button class="menu-btn primary" id="btn-respawn">Respawn at the hospital</button>
      <button class="menu-btn" id="btn-title2">Back to title</button>
    </div>`;
  document.getElementById('btn-respawn').addEventListener('click', () => respawn());
  document.getElementById('btn-title2').addEventListener('click', () => { S = createState(seed, audio); window.__game = S; showTitle(); });
  announce(`Game over. ${S.overReason || ''}`);
}

function startGame(fromSave) {
  S = createState(seed, audio);
  window.__game = S;
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(S, data);
  }
  S.screen = 'play';
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  announce('Playing. Press P for missions, E near a car to drive.');
}

function resumeGame() {
  S.screen = 'play';
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  announce('Playing.');
}

function respawn() {
  const p = S.player;
  p.health = 100;
  p.armor = 0;
  p.x = S.hospital.x;
  p.y = S.hospital.y;
  p.onFoot = true;
  p.car = null;
  p.invuln = 2;
  S.cash = Math.max(0, S.cash - 100);
  S.wanted = 0;
  S.cops = [];
  S.overReason = '';
  S.camera.x = p.x;
  S.camera.y = p.y;
  S.screen = 'play';
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  announce('Respawned at the hospital. -$100.');
}

function pauseGame() {
  if (S.screen === 'play') showPause();
}

/* ---------------- Shot staging ---------------- */

function runShot(name) {
  const scene = stageShot(name, S);
  let painted = 0;
  function paint() {
    drawWorld(ctx, S, canvas.width, canvas.height);
    if (scene.screen === 'play') drawHUD(ctx, S, canvas.width, canvas.height);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/* ---------------- The live game ---------------- */

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (S.screen === 'play') showPause();
      else if (S.screen === 'pause') resumeGame();
    }
    if (actions & ACTION_CONFIRM) {
      if (S.screen === 'title') { audio.unlock(); startGame(); }
      else if (S.screen === 'over') respawn();
      else if (S.screen === 'pause') resumeGame();
    }
    if (S.screen !== 'play') return;
    if (actions & ACTION_ENTER_CAR) {
      if (S.player.onFoot) tryEnterCar(S);
      else exitCar(S);
    }
    if (actions & ACTION_PUNCH) {
      if (S.weapon === 'pistol') shoot(S, mouseWorld(input));
      else punch(S);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (S.screen === 'play') {
      while (accumulator >= STEP) {
        stepPlay(STEP, input);
        accumulator -= STEP;
        if (S.screen !== 'play') break;
      }
      // Holding the mouse button keeps firing the pistol.
      if (S.weapon === 'pistol' && input.mouse.down) shoot(S, mouseWorld(input));
    } else if (S.screen === 'title') {
      while (accumulator >= STEP) {
        stepTitle(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (S.screen === 'over' && !overlay.innerHTML) showGameOver();
    drawWorld(ctx, S, canvas.width, canvas.height);
    if (S.screen === 'play' || S.screen === 'pause') drawHUD(ctx, S, canvas.width, canvas.height);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === 'play') showPause();
  });

  showTitle();
  requestAnimationFrame(frame);
}

/* ---------------- Test hooks (used by the headless probe) ---------------- */
window.__solmar = {
  start: (fromSave) => { audio.unlock(); startGame(fromSave); },
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  respawn: () => respawn(),
  startMission: (id) => startMission(S, id),
  startGig: (id) => startGig(S, id),
  save: () => saveGame(S),
  load: () => { const d = loadSave(); if (d) applySave(S, d); return !!d; },
  hasSave: () => hasSave(),
  setDusk: (v) => { S.dusk = !!v; S.duskLock = !!v; },
  setWanted: (n) => { S.wanted = n; },
  givePistol: () => { S.weapon = 'pistol'; S.ammo = 24; },
  teleport: (x, y) => { S.player.x = x; S.player.y = y; S.camera.x = x; S.camera.y = y; },
  enterCar: () => tryEnterCar(S),
  state: () => ({
    screen: S.screen, x: S.player.x, y: S.player.y,
    health: S.player.health, cash: S.cash, wanted: S.wanted,
    onFoot: S.player.onFoot, weapon: S.weapon, ammo: S.ammo,
    cars: S.cars.length, traffic: S.cars.filter((c) => c.traffic && !c.dead).length,
    peds: S.peds.filter((p) => !p.dead).length,
    cops: S.cops.filter((c) => !c.dead).length,
    copCars: S.cars.filter((c) => c.cop && !c.dead).length,
    mission: S.mission ? S.mission.id : null, objective: S.objective,
    bullets: S.bullets.length, shots: S.stats.shots,
  }),
};

if (shot) runShot(shot);
else runGame();
