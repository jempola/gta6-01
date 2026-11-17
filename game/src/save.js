// Save and load through localStorage. Only plain numbers, strings and small arrays
// are stored — never functions or DOM nodes — so a save always round-trips.

import { SAVE_KEY } from './config.js';

/** True when a save exists in this browser. */
export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Write the current run into localStorage. Returns true on success. */
export function saveGame(S) {
  try {
    const data = {
      version: 1,
      x: S.player.x,
      y: S.player.y,
      health: S.player.health,
      armor: S.player.armor,
      cash: S.cash,
      wanted: S.wanted,
      weapon: S.weapon,
      ammo: S.ammo,
      time: S.time,
      dusk: S.dusk,
      completedMissions: S.completedMissions,
      missionsDone: S.stats.missionsDone,
      kills: S.stats.kills,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Read a save back; returns the data object or null when there is none. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.x !== 'number' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply loaded save data onto the live state object. */
export function applySave(S, data) {
  S.player.x = data.x;
  S.player.y = data.y;
  S.player.health = data.health ?? 100;
  S.player.armor = data.armor ?? 0;
  S.cash = data.cash ?? 0;
  S.wanted = data.wanted ?? 0;
  S.weapon = data.weapon ?? 'fists';
  S.ammo = data.ammo ?? 0;
  S.time = data.time ?? 0;
  S.dusk = !!data.dusk;
  S.completedMissions = Array.isArray(data.completedMissions) ? data.completedMissions : [];
  S.stats.missionsDone = data.missionsDone ?? 0;
  S.stats.kills = data.kills ?? 0;
  // Rico steps out of any car on load, standing on the street.
  S.player.onFoot = true;
  S.player.car = null;
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
}
