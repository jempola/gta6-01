// Story missions and side gigs. Five story missions in order plus two repeatable
// side gigs (taxi fares, vigilante). Each mission is a chain of objectives with a
// marker, dialogue lines and a cash reward.
import { dist2, angleTo } from './config.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'Welcome Back, Rico', reward: 300,
    intro: 'Mara: "Rico! You are back in Solmar Bay. My delivery van is stuck at the port — bring it to the safehouse."',
    steps: [
      { type: 'goto', x: 2900, y: 2900, label: 'Go to the Harbor Port van', radius: 90 },
      { type: 'goto', x: 700, y: 700, label: 'Drive the van back to the safehouse', radius: 90, needsCar: true },
    ],
  },
  {
    id: 'm2', title: 'The Getaway Driver', reward: 500,
    intro: 'Dario: "The crew hit the Bay Bank. Cops are everywhere — grab a fast car and lose the tail, then meet me downtown."',
    steps: [
      { type: 'getcar', label: 'Steal a fast car', radius: 0 },
      { type: 'escape', label: 'Lose the police (get wanted to 0)', radius: 0 },
      { type: 'goto', x: 1900, y: 1900, label: 'Meet Dario downtown', radius: 90 },
    ],
  },
  {
    id: 'm3', title: 'Harbor Delivery', reward: 450,
    intro: 'Priya: "A crate at the port has to reach the park bandstand before dark. No questions, no stops."',
    steps: [
      { type: 'goto', x: 3100, y: 2700, label: 'Pick up the crate at the port', radius: 90 },
      { type: 'goto', x: 620, y: 2900, label: 'Deliver the crate to Palm Park', radius: 90, timed: 75 },
    ],
  },
  {
    id: 'm4', title: 'The Rival Crew', reward: 700,
    intro: 'Mara: "The Coral Kings are muscling in on Old Town. Take down their enforcer at the pier — bring a pistol."',
    steps: [
      { type: 'goto', x: 120, y: 1500, label: 'Reach the marina pier', radius: 100 },
      { type: 'takedown', label: 'Take down the Coral Kings enforcer', radius: 0 },
      { type: 'goto', x: 700, y: 700, label: 'Get back to the safehouse', radius: 90 },
    ],
  },
  {
    id: 'm5', title: 'The Big Score', reward: 1200,
    intro: 'Dario: "One last job: the Sunset Casino vault. Grab the cash downtown, then lose a 3-star tail and bring it home."',
    steps: [
      { type: 'goto', x: 2000, y: 1600, label: 'Reach the Sunset Casino downtown', radius: 100 },
      { type: 'escape', label: 'Escape with 3 stars and lose the cops', radius: 0, wantedAtStart: 3 },
      { type: 'goto', x: 700, y: 700, label: 'Bring the score home', radius: 90 },
    ],
  },
];

export const GIGS = [
  { id: 'taxi', title: 'Taxi Fares', reward: 150, intro: 'Pick up fares around the city and drop them off. Each fare pays $150.' },
  { id: 'vigilante', title: 'Vigilante', reward: 250, intro: 'A Coral Kings getaway car is loose in the city. Ram it until it blows — $250 if you stop it.' },
];

export function createMissions() {
  return { active: null, stepIndex: 0, stepTimer: 0, completed: [], unlocked: 1, dialogue: '', dialogueTimer: 0, target: null, gigState: null };
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  if (index + 1 > G.missions.unlocked) { G.banner('Finish the previous mission first.'); return false; }
  if (G.missions.active) { G.banner('A mission is already running — finish or fail it first.'); return false; }
  G.missions.active = def;
  G.missions.stepIndex = 0;
  G.missions.stepTimer = 0;
  G.missions.target = null;
  G.missions.gigState = null;
  say(G, def.intro);
  G.audio.mission();
  G.banner(`Mission started: ${def.title}`);
  return true;
}

export function startGig(G, id) {
  if (G.missions.active) { G.banner('Finish the current mission first.'); return false; }
  const def = GIGS.find((g) => g.id === id);
  if (!def) return false;
  G.missions.active = { id: def.id, title: def.title, reward: def.reward, isGig: true, steps: [{ type: 'gig', label: def.title, radius: 0 }] };
  G.missions.stepIndex = 0;
  G.missions.gigState = { phase: 'pickup', timer: 0 };
  if (id === 'taxi') {
    // A fare waits at a random road junction; drop-off is another junction.
    const spots = [[1125, 675], [2025, 1125], [675, 2025], [2475, 1575], [1575, 2475]];
    const a = spots[Math.floor(Math.random() * spots.length)];
    let b = spots[Math.floor(Math.random() * spots.length)];
    while (b === a) b = spots[Math.floor(Math.random() * spots.length)];
    G.missions.gigState.pickup = { x: a[0], y: a[1] };
    G.missions.gigState.dropoff = { x: b[0], y: b[1] };
  } else {
    // Vigilante target car: a fast getaway car roaming downtown.
    const car = { x: 1900, y: 1600, angle: 0, speed: 200, health: 60, name: 'Coral Kings Getaway', color: '#8e44ad', driver: 'traffic', parked: false, isPolice: false, exploded: false, smoke: 0, target: { x: 2400, y: 1600, horizontal: true }, stuck: 0, honk: 0, w: 46, h: 22 };
    G.cars.push(car);
    G.missions.gigState.targetCar = car;
  }
  say(G, def.intro);
  G.audio.mission();
  return true;
}

export function say(G, text) {
  G.missions.dialogue = text;
  G.missions.dialogueTimer = 6;
}

function completeMission(G) {
  const def = G.missions.active;
  G.player.cash += def.reward;
  if (!def.isGig && !G.missions.completed.includes(def.id)) {
    G.missions.completed.push(def.id);
    G.missions.unlocked = Math.min(MISSIONS.length, G.missions.unlocked + 1);
  }
  G.banner(`Mission complete: ${def.title} — +$${def.reward}`);
  G.audio.cash();
  G.missions.active = null;
  G.missions.target = null;
  G.missions.gigState = null;
}

export function failMission(G, reason) {
  if (!G.missions.active) return;
  G.banner(`Mission failed: ${reason}`);
  G.audio.fail();
  G.missions.active = null;
  G.missions.target = null;
  G.missions.gigState = null;
}

function stepLabel(G) {
  const m = G.missions;
  if (!m.active) return '';
  if (m.active.isGig) {
    if (m.active.id === 'taxi') return m.gigState.phase === 'pickup' ? 'Pick up the fare' : 'Drop off the fare';
    return 'Stop the getaway car';
  }
  return m.active.steps[m.stepIndex].label;
}

export function missionObjective(G) {
  const m = G.missions;
  if (!m.active) return G.missions.completed.length === MISSIONS.length
    ? 'All story missions complete — free roam!'
    : `Next: ${MISSIONS[G.missions.unlocked - 1].title} (P → Missions)`;
  return `${m.active.title}: ${stepLabel(G)}`;
}

export function missionMarker(G) {
  const m = G.missions;
  if (!m.active) return null;
  if (m.active.isGig) {
    if (m.active.id === 'taxi') {
      const s = m.gigState;
      return s.phase === 'pickup' ? { x: s.pickup.x, y: s.pickup.y, color: '#f1c40f' } : { x: s.dropoff.x, y: s.dropoff.y, color: '#2ecc71' };
    }
    return m.gigState.targetCar && !m.gigState.targetCar.exploded
      ? { x: m.gigState.targetCar.x, y: m.gigState.targetCar.y, color: '#e74c3c' } : null;
  }
  const step = m.active.steps[m.stepIndex];
  if (step.type === 'goto') return { x: step.x, y: step.y, color: '#f1c40f' };
  if (step.type === 'takedown' && m.target) return { x: m.target.x, y: m.target.y, color: '#e74c3c' };
  return null;
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.dialogueTimer > 0) m.dialogueTimer -= dt;
  if (!m.active) return;
  const p = G.player;
  if (m.active.isGig) {
    updateGig(G, dt);
    return;
  }
  const step = m.active.steps[m.stepIndex];
  if (step.timed) {
    m.stepTimer += dt;
    if (m.stepTimer > step.timed) { failMission(G, 'Out of time on the delivery.'); return; }
  }
  if (step.type === 'goto') {
    const needCar = step.needsCar && !p.inCar;
    if (dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius && !needCar) advance(G);
    else if (needCar && dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius) {
      say(G, 'You need a car for this — steal one first!');
    }
  } else if (step.type === 'getcar') {
    if (p.inCar) advance(G);
  } else if (step.type === 'escape') {
    if (step.wantedAtStart && !step.armed) { G.addWanted(step.wantedAtStart, 'The casino alarm went off!'); step.armed = true; }
    if (p.wanted === 0) advance(G);
  } else if (step.type === 'takedown') {
    if (!m.target) {
      // Spawn the enforcer near the pier.
      const enforcer = {
        x: 200, y: 1500, angle: 0, speed: 60, health: 80, down: false,
        flee: 0, fleeX: 0, fleeY: 0, fighter: true, attackCooldown: 0,
        color: '#8e44ad', name: 'Coral Kings Enforcer', targetX: 200, targetY: 1500, retarget: 3,
      };
      G.peds.list.push(enforcer);
      m.target = enforcer;
      say(G, 'Enforcer: "You picked the wrong pier, Rico."');
    } else if (m.target.down) {
      advance(G);
    }
  }
}

function advance(G) {
  const m = G.missions;
  m.stepIndex += 1;
  m.stepTimer = 0;
  if (m.stepIndex >= m.active.steps.length) completeMission(G);
  else G.audio.pickup();
}

function updateGig(G, dt) {
  const m = G.missions;
  const p = G.player;
  const s = m.gigState;
  if (m.active.id === 'taxi') {
    if (s.phase === 'pickup') {
      if (dist2(p.x, p.y, s.pickup.x, s.pickup.y) < 80 * 80 && p.inCar) {
        s.phase = 'dropoff';
        say(G, 'Fare: "Downtown, please — and step on it!"');
      }
    } else if (dist2(p.x, p.y, s.dropoff.x, s.dropoff.y) < 80 * 80 && p.inCar) {
      completeMission(G);
    }
  } else {
    const car = s.targetCar;
    if (car && car.exploded) completeMission(G);
    else if (car) {
      // The getaway car flees from the player.
      const away = angleTo(p.x, p.y, car.x, car.y);
      car.angle = away;
      car.speed = 260;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
  }
}
