// Save / load through localStorage: cash, mission progress, player state, time.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash, health: G.player.health, armor: G.player.armor,
      x: G.player.x, y: G.player.y, weapon: G.player.weapon, ammo: G.player.ammo,
      completedMissions: G.missions.completed.slice(), unlocked: G.missions.unlocked,
      timeOfDay: G.timeOfDay, savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame(G) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    G.player.cash = data.cash ?? 0;
    G.player.health = data.health ?? 100;
    G.player.armor = data.armor ?? 0;
    G.player.x = data.x ?? G.player.x; G.player.y = data.y ?? G.player.y;
    G.player.weapon = data.weapon ?? 'fists'; G.player.ammo = data.ammo ?? 0;
    G.missions.completed = Array.isArray(data.completedMissions) ? data.completedMissions : [];
    G.missions.unlocked = data.unlocked ?? 1;
    G.timeOfDay = data.timeOfDay ?? 'day';
    return true;
  } catch { return false; }
}

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}
