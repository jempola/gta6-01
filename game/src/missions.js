// Story missions and side gigs. Five story missions with map markers, dialogue and
// payouts — a drive-to job, a chase, an escape, a delivery and a takedown — plus two
// side gigs: taxi fares and vigilante work. Missions are picked from the pause menu.
// S.mission is null or { id, name, step, target, timer, payout, text, progress }.

import { WORLD, clamp, dist, randRange, pick } from './config.js';
import { addWanted } from './police.js';
import { spawnTrafficCar } from './vehicle.js';

export const MISSIONS = [
  {
    id: 'drive', name: 'First Fare', kind: 'drive',
    intro: 'Milo: "Rico, you are back behind the wheel. Take the sedan to the beachfront hotel — the client waits."',
    payout: 200,
    desc: 'Drive to the beachfront hotel marker.',
  },
  {
    id: 'chase', name: 'Tail the Courier', kind: 'chase',
    intro: 'Milo: "A courier is carrying our ledger across town. Stay on his bumper for five seconds — do not lose him."',
    payout: 350,
    desc: 'Chase the marked car and stay close for 5 seconds.',
  },
  {
    id: 'escape', name: 'Heat Escape', kind: 'escape',
    intro: 'Milo: "You tripped every alarm in the port. Three stars on you, Rico. Lose the cops and stay free."',
    payout: 400,
    desc: 'Lose a 3-star wanted level.',
  },
  {
    id: 'delivery', name: 'Bay Delivery', kind: 'delivery',
    intro: 'Milo: "A package sits at the port warehouse. Pick it up, then run it downtown before the clock dies."',
    payout: 300,
    desc: 'Collect the package at the port, deliver it downtown in 90 seconds.',
  },
  {
    id: 'takedown', name: 'Dock Takedown', kind: 'takedown',
    intro: 'Milo: "Three of Vane’s thugs are leaning on the dock workers. Put all three down — fists or pistol, your call."',
    payout: 500,
    desc: 'Defeat the 3 marked thugs at the port.',
  },
];

export const GIGS = [
  { id: 'taxi', name: 'Taxi Fare', desc: 'Pick up the fare and drop them off. Pays $80.' },
  { id: 'vigilante', name: 'Vigilante', desc: 'Chase down the marked getaway car. Pays $150.' },
];

/** Start a story mission by id; returns false when one is already running. */
export function startMission(S, id) {
  if (S.mission) return false;
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return false;
  const mission = { id: def.id, name: def.name, kind: def.kind, step: 0, timer: 0, payout: def.payout, text: def.intro, progress: 0, target: null };
  if (def.kind === 'drive') {
    mission.target = { x: 3150, y: 3150, label: 'Beachfront Hotel' };
    mission.text = 'Drive to the beachfront hotel.';
  } else if (def.kind === 'chase') {
    const car = spawnTrafficCar(S, S.player);
    car.isTarget = true;
    car.color = '#e5534b';
    car.speed = 260;
    mission.targetCar = car;
    mission.target = { x: car.x, y: car.y, label: 'Courier' };
    mission.text = 'Stay on the courier’s bumper.';
  } else if (def.kind === 'escape') {
    S.wanted = 3;
    S.wantedTimer = 0;
    mission.timer = 60;
    mission.text = 'Lose the 3-star wanted level!';
  } else if (def.kind === 'delivery') {
    mission.target = { x: 3150, y: 450, label: 'Port Warehouse' };
    mission.text = 'Pick up the package at the port.';
  } else if (def.kind === 'takedown') {
    S.thugs = [];
    for (let i = 0; i < 3; i += 1) {
      S.thugs.push({
        x: 3000 + i * 90, y: 500 + (i % 2) * 80, angle: 0, speed: 150,
        health: 60, state: 'fight', color: '#3a3a3a', isThug: true,
        dead: false, flee: false, fight: true, punchTimer: 0, tx: 3000, ty: 500,
      });
    }
    S.stats.thugsDown = 0;
    mission.target = { x: 3050, y: 540, label: 'Dock Thugs' };
    mission.text = 'Defeat the 3 thugs at the port. (0/3)';
  }
  S.mission = mission;
  S.objective = mission.text;
  S.missionDialogue = def.intro;
  S.missionDialogueT = 6;
  S.audio.missionDone();
  return true;
}

/** Start a side gig by id; returns false when a mission or gig is already running. */
export function startGig(S, id) {
  if (S.mission || S.gig) return false;
  if (id === 'taxi') {
    const px = clamp(S.player.x + randRange(S.rng, -500, 500), 200, WORLD.size - 200);
    const py = clamp(S.player.y + randRange(S.rng, -500, 500), 200, WORLD.size - 200);
    S.gig = { id: 'taxi', step: 0, target: { x: px, y: py, label: 'Fare' }, payout: 80, text: 'Pick up the taxi fare.' };
    S.peds.push({
      x: px, y: py, angle: 0, speed: 0, health: 100, state: 'walk',
      color: '#f2c94c', tx: px, ty: py, name: 'Fare', flee: false, dead: false,
      fight: false, punchTimer: 0, isFare: true,
    });
    S.gig.fare = S.peds[S.peds.length - 1];
  } else if (id === 'vigilante') {
    const car = spawnTrafficCar(S, S.player);
    car.isTarget = true;
    car.color = '#e5534b';
    car.speed = 300;
    S.gig = { id: 'vigilante', step: 0, targetCar: car, target: { x: car.x, y: car.y, label: 'Getaway Car' }, payout: 150, text: 'Stop the getaway car — ram it or shoot it.' };
  } else return false;
  S.objective = S.gig.text;
  return true;
}

/** Pay out and clear the current mission. */
function completeMission(S) {
  const m = S.mission;
  S.cash += m.payout;
  S.stats.missionsDone += 1;
  S.completedMissions.push(m.id);
  S.message = `Mission complete: ${m.name} — +$${m.payout}.`;
  S.messageT = 4;
  S.objective = 'No active mission. Open the pause menu (P) to pick one.';
  S.audio.missionDone();
  S.audio.cash();
  S.mission = null;
}

/** Fail the current mission with a reason. */
function failMission(S, reason) {
  S.message = `Mission failed: ${reason}`;
  S.messageT = 4;
  S.objective = 'No active mission. Open the pause menu (P) to pick one.';
  S.audio.fail();
  if (S.mission && S.mission.targetCar) S.mission.targetCar.isTarget = false;
  S.mission = null;
}

/** Update the active mission or gig for one fixed step. */
export function updateMissions(S, dt) {
  const p = S.player;
  const m = S.mission;
  if (m) {
    if (m.kind === 'drive') {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 90) completeMission(S);
    } else if (m.kind === 'chase') {
      const car = m.targetCar;
      if (!car || car.dead) {
        failMission(S, 'You lost the courier.');
      } else {
        m.target = { x: car.x, y: car.y, label: 'Courier' };
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < 110) {
          m.progress += dt;
          m.text = `Stay on him… ${m.progress.toFixed(1)}s / 5s`;
          S.objective = m.text;
          if (m.progress >= 5) completeMission(S);
        } else {
          m.progress = Math.max(0, m.progress - dt);
          m.text = 'Stay on the courier’s bumper.';
          S.objective = m.text;
          if (d > 900) failMission(S, 'The courier got away.');
        }
      }
    } else if (m.kind === 'escape') {
      m.timer -= dt;
      m.text = `Lose the cops! ${Math.max(0, Math.ceil(m.timer))}s left.`;
      S.objective = m.text;
      if (S.wanted === 0) completeMission(S);
      else if (m.timer <= 0) failMission(S, 'The cops kept you in their sights.');
    } else if (m.kind === 'delivery') {
      if (m.step === 0) {
        if (dist(p.x, p.y, m.target.x, m.target.y) < 90) {
          m.step = 1;
          m.timer = 90;
          m.target = { x: 1800, y: 1800, label: 'Downtown Drop' };
          m.text = 'Package collected! Deliver downtown in 90s.';
          S.objective = m.text;
          S.message = 'Package collected — go, go!';
          S.messageT = 2;
        }
      } else {
        m.timer -= dt;
        m.text = `Deliver downtown — ${Math.max(0, Math.ceil(m.timer))}s left.`;
        S.objective = m.text;
        if (dist(p.x, p.y, m.target.x, m.target.y) < 90) completeMission(S);
        else if (m.timer <= 0) failMission(S, 'The delivery window closed.');
      }
    } else if (m.kind === 'takedown') {
      const down = S.stats.thugsDown;
      m.text = `Defeat the 3 thugs at the port. (${down}/3)`;
      S.objective = m.text;
      if (down >= 3) completeMission(S);
    }
    return;
  }

  const g = S.gig;
  if (!g) return;
  if (g.id === 'taxi') {
    if (g.step === 0) {
      if (g.fare && !g.fare.dead && dist(p.x, p.y, g.fare.x, g.fare.y) < 50) {
        g.step = 1;
        g.fare.dead = true; // They hop in with Rico.
        const dx = clamp(p.x + randRange(S.rng, -900, 900), 200, WORLD.size - 200);
        const dy = clamp(p.y + randRange(S.rng, -900, 900), 200, WORLD.size - 200);
        g.target = { x: dx, y: dy, label: 'Drop-off' };
        g.text = 'Drop the fare off at the marker.';
        S.objective = g.text;
      }
    } else if (dist(p.x, p.y, g.target.x, g.target.y) < 90) {
      S.cash += g.payout;
      S.message = `Taxi fare complete — +$${g.payout}.`;
      S.messageT = 3;
      S.objective = 'No active mission. Open the pause menu (P) to pick one.';
      S.audio.cash();
      S.gig = null;
    }
  } else if (g.id === 'vigilante') {
    const car = g.targetCar;
    if (!car) { S.gig = null; return; }
    g.target = { x: car.x, y: car.y, label: 'Getaway Car' };
    if (car.dead || car.health <= 25) {
      S.cash += g.payout;
      S.message = `Vigilante gig done — +$${g.payout}.`;
      S.messageT = 3;
      S.objective = 'No active mission. Open the pause menu (P) to pick one.';
      S.audio.cash();
      S.gig = null;
    } else if (dist(p.x, p.y, car.x, car.y) > 1200) {
      S.message = 'Vigilante gig failed: the car escaped.';
      S.messageT = 3;
      S.objective = 'No active mission. Open the pause menu (P) to pick one.';
      S.gig = null;
    }
  }
}
