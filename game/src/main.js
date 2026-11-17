// SOLMAR BAY — boot and the one loop. The game moves between four screens:
// title, play, paused and game over. The world advances in fixed 1/60 s steps.
// ?shot=cover|combat|mission|dusk stages that scene instead of the title screen
// and sets window.__shotReady once painted, for screenshots.
import { WORLD, STEP, makeRng, clamp } from './config.js';
import { buildCity } from './world.js';
import { createInput, ACTION_PAUSE, ACTION_INTERACT, ACTION_PUNCH, ACTION_RELOAD, ACTION_MUTE } from './input.js';
import { createPlayer, updatePlayerOnFoot, damagePlayer, punch, tryEnterExitCar } from './player.js';
import { spawnCars, updateCars } from './vehicle.js';
import { spawnPeds, updatePeds } from './ped.js';
import { createPolice, addWanted, updatePolice } from './police.js';
import { createMissions, startMission, startGig, updateMissions, missionMarker, MISSIONS, GIGS } from './missions.js';
import { spawnPickups, shoot, updateBullets } from './combat.js';
import { createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '7', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

const G = {
  rng: makeRng(seed),
  city: null,
  player: null,
  cars: [],
  peds: { list: [] },
  police: createPolice(),
  missions: createMissions(),
  pickups: [],
  bullets: [],
  particles: [],
  camera: { x: 700, y: 700, w: 1280, h: 720, zoom: 1 },
  time: 0,
  timeOfDay: 'day',
  screen: 'title',
  toast: '',
  toastTimer: 0,
  mouseWorld: { x: 0, y: 0 },
  audio,
  banner(text) {
    G.toast = text; G.toastTimer = 3.5;
    status.textContent = text;
  },
  addWanted(stars, reason) { addWanted(G, stars, reason); },
  missionMarker() { return missionMarker(G); },
  gameOver(reason) {
    if (G.screen === 'over') return;
    G.screen = 'over';
    G.overReason = reason;
    audio.siren(false);
    audio.setEngine(0, false);
    showOver(reason);
  },
};

function resetWorld() {
  G.rng = makeRng(seed);
  G.city = buildCity(seed);
  G.player = createPlayer(700, 760);
  G.cars = [];
  G.peds = { list: [] };
  G.police = createPolice();
  G.missions = createMissions();
  G.pickups = [];
  G.bullets = [];
  G.particles = [];
  G.time = 0;
  G.timeOfDay = 'day';
  G.toast = ''; G.toastTimer = 0;
  spawnCars(G, G.rng);
  spawnPeds(G, G.rng, 34);
  spawnPickups(G);
  G.camera.x = G.player.x; G.camera.y = G.player.y;
}

resetWorld();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function updateCamera() {
  const view = renderer.view;
  const zoom = clamp(Math.min(view.w, view.h) / 820, 0.65, 1.3);
  G.camera.zoom = zoom;
  G.camera.w = view.w / zoom;
  G.camera.h = view.h / zoom;
  const tx = G.player.x, ty = G.player.y;
  G.camera.x += (tx - G.camera.x) * 0.12;
  G.camera.y += (ty - G.camera.y) * 0.12;
  // Mouse position in world coordinates (for aiming).
  const cam = G.camera;
  G.mouseWorld.x = (cam.x - cam.w / 2) + input.mouse.x / cam.zoom;
  G.mouseWorld.y = (cam.y - cam.h / 2) + input.mouse.y / cam.zoom;
}

// One fixed step of the whole simulation. `inputLike` has axis() and running().
function stepWorld(dt, inputLike) {
  G.time += dt;
  const p = G.player;
  if (p.shootCooldown === undefined) p.shootCooldown = 0;
  if (p.inCar) updateCars(G, dt, inputLike);
  else updatePlayerOnFoot(G, dt, inputLike);
  if (!p.inCar) updateCars(G, dt, { axis: () => ({ x: 0, y: 0 }) });
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateBullets(G, dt);
  // Particles.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  if (G.toastTimer > 0) G.toastTimer -= dt;
  // Day cycle drifts slowly toward dusk; the spray shop / missions don't depend on it.
  if (G.time > 240 && G.timeOfDay === 'day') G.timeOfDay = 'dusk';
  updateCamera();
}
G.stepWorld = stepWorld;

// ---- DOM overlays: title, pause (with mission select), game over ----
const overlay = document.getElementById('overlay');
function showTitle() {
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="panel">
      <h1>SOLMAR BAY</h1>
      <p class="tag">An original open-world crime game — explore the city on foot and by car.</p>
      <p>Rico Vale is back in Solmar Bay. Steal cars, outrun the SBPD, run five story
      missions and side gigs, and build your name — and your cash — in the city.</p>
      <p class="controls">WASD move / drive &nbsp;·&nbsp; Mouse aim &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; F punch<br>
      E enter / steal car &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; P pause &amp; missions &nbsp;·&nbsp; M mute</p>
      <button id="btn-start">▶ Start game</button>
      ${hasSave() ? '<button id="btn-continue">Continue saved game</button>' : ''}
      <p class="fine">Original city, characters, story, art and music. No external assets, no network.</p>
    </div>`;
  document.getElementById('btn-start').addEventListener('click', () => { audio.unlock(); startGame(false); });
  const cont = document.getElementById('btn-continue');
  if (cont) cont.addEventListener('click', () => { audio.unlock(); startGame(true); });
}

function missionListHtml() {
  let html = '<h2>Missions</h2><p>Story missions unlock in order. Side gigs pay cash any time.</p>';
  MISSIONS.forEach((m, i) => {
    const done = G.missions.completed.includes(m.id);
    const locked = i + 1 > G.missions.unlocked;
    html += `<button class="mission" data-mission="${i}" ${locked || G.missions.active ? 'disabled' : ''}>
      ${done ? '✓ ' : ''}${i + 1}. ${m.title} — $${m.reward}${locked ? ' (locked)' : ''}</button>`;
  });
  GIGS.forEach((g) => {
    html += `<button class="mission" data-gig="${g.id}" ${G.missions.active ? 'disabled' : ''}>★ ${g.title} — $${g.reward}</button>`;
  });
  return html;
}

function showPause() {
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="panel">
      <h1>Paused</h1>
      ${missionListHtml()}
      <div class="row">
        <button id="btn-resume">Resume</button>
        <button id="btn-save">Save game</button>
        <button id="btn-load">Load save</button>
        <button id="btn-quit">Quit to title</button>
      </div>
      <p class="fine">Save lives in this browser (localStorage). Wanted level: ${G.player.wanted} star(s). Cash: $${G.player.cash}.</p>
    </div>`;
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-save').addEventListener('click', () => { G.banner(saveGame(G) ? 'Game saved.' : 'Save failed.'); resumeGame(); });
  document.getElementById('btn-load').addEventListener('click', () => { G.banner(loadGame(G) ? 'Save loaded.' : 'No save found.'); resumeGame(); });
  document.getElementById('btn-quit').addEventListener('click', () => { G.screen = 'title'; showTitle(); });
  overlay.querySelectorAll('[data-mission]').forEach((b) => b.addEventListener('click', () => {
    if (startMission(G, Number(b.dataset.mission))) resumeGame();
  }));
  overlay.querySelectorAll('[data-gig]').forEach((b) => b.addEventListener('click', () => {
    if (startGig(G, b.dataset.gig)) resumeGame();
  }));
}

function showOver(reason) {
  overlay.classList.remove('hidden');
  const title = reason === 'busted' ? 'Busted!' : 'Wasted!';
  overlay.innerHTML = `
    <div class="panel">
      <h1>${title}</h1>
      <p>The SBPD got the better of Rico this time. Cash kept: $${G.player.cash}. Missions done: ${G.missions.completed.length} / ${MISSIONS.length}.</p>
      <button id="btn-respawn">Respawn at the safehouse (−$100)</button>
      <button id="btn-restart">Start over</button>
    </div>`;
  document.getElementById('btn-respawn').addEventListener('click', () => {
    const p = G.player;
    p.health = 100; p.armor = 0; p.wanted = 0; p.heat = 0; p.inCar = null;
    p.x = 700; p.y = 760; p.cash = Math.max(0, p.cash - 100);
    G.police.cops = []; G.police.copCars = [];
    overlay.classList.add('hidden');
    G.screen = 'play';
  });
  document.getElementById('btn-restart').addEventListener('click', () => { resetWorld(); startGame(false); });
}

function startGame(fromSave) {
  resetWorld();
  if (fromSave) loadGame(G);
  overlay.classList.add('hidden');
  G.screen = 'play';
  status.textContent = 'Playing Solmar Bay. Press P for missions.';
  G.banner('Welcome back to Solmar Bay, Rico. Press P for missions.');
}

function resumeGame() {
  overlay.classList.add('hidden');
  G.screen = 'play';
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    G.banner(audio.isMuted() ? 'Sound muted.' : 'Sound on.');
  }
  if (G.screen === 'title') return;
  if (actions & ACTION_PAUSE) {
    if (G.screen === 'play') { G.screen = 'paused'; showPause(); }
    else if (G.screen === 'paused') resumeGame();
    return;
  }
  if (G.screen !== 'play') return;
  if (actions & ACTION_INTERACT) tryEnterExitCar(G);
  if (actions & ACTION_PUNCH) punch(G);
  if (actions & ACTION_RELOAD) {
    if (G.player.weapon === 'pistol') G.banner(G.player.ammo > 0 ? 'Pistol ready.' : 'Out of ammo — find an ammo pickup.');
  }
  if (input.takeClick()) shoot(G);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleActions();
  if (G.screen === 'play') {
    let acc = dt;
    while (acc >= STEP) { stepWorld(STEP, input); acc -= STEP; }
  } else if (G.screen === 'title') {
    updateCamera();
  }
  renderer.draw(G, G.screen);
  if (G.screen === 'play' || G.screen === 'paused') drawHud(G, canvas.getContext('2d'), renderer.view.w, renderer.view.h);
}

let last = performance.now();

// Screenshot mode: stage the scene, paint twice, signal readiness.
if (shot) {
  G.missions.unlocked = MISSIONS.length;
  stageShot(shot, G);
  G.screen = 'play';
  let painted = 0;
  function paint() {
    updateCamera();
    renderer.draw(G, 'play');
    drawHud(G, canvas.getContext('2d'), renderer.view.w, renderer.view.h);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  showTitle();
  requestAnimationFrame(frame);
}

// Test / debug hooks for headless playtesting (not part of the game UI).
window.__SOLMAR__ = {
  G, startGame, resetWorld, startMission: (i) => startMission(G, i), startGig: (id) => startGig(G, id),
  saveGame: () => saveGame(G), loadGame: () => loadGame(G),
  shoot: () => shoot(G), punch: () => punch(G), enterCar: () => tryEnterExitCar(G),
  setWanted: (n) => { G.player.wanted = n; },
};
