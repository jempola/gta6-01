// The city of Solmar Bay: a 3600 x 3600 grid of streets with districts for the beach
// and coast, a park, a port and downtown. Buildings are rectangles that collide.
// This module builds the city from a seeded rng and answers road and collision
// queries; it draws nothing.

import { WORLD, clamp, randInt, randRange, pick } from './config.js';

export const DISTRICTS = [
  { name: 'Beach', x: 0, y: 2700, w: 3600, h: 900, kind: 'beach' },
  { name: 'Park', x: 900, y: 900, w: 900, h: 900, kind: 'park' },
  { name: 'Port', x: 2700, y: 0, w: 900, h: 900, kind: 'port' },
  { name: 'Downtown', x: 1350, y: 1350, w: 900, h: 900, kind: 'downtown' },
];

/** Road centre lines, one per grid line, in both directions. */
export function roadLines() {
  const lines = [];
  for (let x = WORLD.roadOffset; x < WORLD.size; x += WORLD.roadSpacing) lines.push(x);
  return lines;
}

/** True when the point is on a road (within half the road width of a grid line). */
export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  const lines = roadLines();
  for (const line of lines) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

/** Nearest road centre line coordinate to a value, along one axis. */
export function nearestRoadCoord(v) {
  const lines = roadLines();
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  return best;
}

/** True when a circle at (x, y) with radius r overlaps any building. */
export function hitsBuilding(S, x, y, r) {
  for (const b of S.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/**
 * Push a circle out of any building it overlaps. Mutates the entity's x/y and
 * returns true when a push happened.
 */
export function resolveBuildings(S, ent, r) {
  let pushed = false;
  for (const b of S.buildings) {
    const cx = clamp(ent.x, b.x, b.x + b.w);
    const cy = clamp(ent.y, b.y, b.y + b.h);
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    pushed = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      ent.x = cx + (dx / d) * r;
      ent.y = cy + (dy / d) * r;
    } else {
      // Dead centre inside the box: shove out along the shortest side.
      const left = ent.x - b.x;
      const right = b.x + b.w - ent.x;
      const top = ent.y - b.y;
      const bottom = b.y + b.h - ent.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) ent.x = b.x - r;
      else if (m === right) ent.x = b.x + b.w + r;
      else if (m === top) ent.y = b.y - r;
      else ent.y = b.y + b.h + r;
    }
  }
  return pushed;
}

/** Which district, if any, contains the point. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return null;
}

/** Build the city into the shared state object S. */
export function buildWorld(S) {
  const rng = S.rng;
  S.roadsX = roadLines();
  S.roadsY = roadLines();
  S.districts = DISTRICTS;
  S.buildings = [];
  const half = WORLD.roadWidth / 2;
  const colors = ['#b08968', '#a87f5e', '#c09a72', '#9a7a58', '#7d8aa0', '#8a94a8', '#b5a284'];
  // One or two buildings per city block (the squares between roads).
  for (let gx = 0; gx < 7; gx += 1) {
    for (let gy = 0; gy < 7; gy += 1) {
      const bx0 = WORLD.roadOffset + gx * WORLD.roadSpacing + half + 14;
      const by0 = WORLD.roadOffset + gy * WORLD.roadSpacing + half + 14;
      const bw = WORLD.roadSpacing - WORLD.roadWidth - 28;
      const bh = WORLD.roadSpacing - WORLD.roadWidth - 28;
      const d = districtAt(bx0 + bw / 2, by0 + bh / 2);
      if (d && d.kind === 'park') {
        // The park keeps trees, not buildings; one small kiosk at most.
        if (rng() < 0.4) {
          S.buildings.push({ x: bx0 + bw / 2 - 40, y: by0 + bh / 2 - 30, w: 80, h: 60, color: '#8a6a4f', tall: false, district: 'park' });
        }
        continue;
      }
      if (d && d.kind === 'beach') {
        // Beachfront: low huts and cafes only, spaced out.
        if (rng() < 0.55) {
          const w = randRange(rng, 90, 150);
          const h = randRange(rng, 70, 110);
          S.buildings.push({ x: bx0 + randRange(rng, 0, bw - w), y: by0 + randRange(rng, 0, bh - h), w, h, color: '#e0c090', tall: false, district: 'beach' });
        }
        continue;
      }
      const downtown = d && d.kind === 'downtown';
      const count = downtown ? 2 : (rng() < 0.6 ? 2 : 1);
      for (let i = 0; i < count; i += 1) {
        const w = count === 2 ? bw / 2 - 12 : randRange(rng, bw * 0.5, bw * 0.85);
        const h = count === 2 ? randRange(rng, bh * 0.4, bh * 0.85) : randRange(rng, bh * 0.5, bh * 0.85);
        const x = count === 2 ? bx0 + i * (bw / 2 + 6) : bx0 + randRange(rng, 0, bw - w);
        const y = count === 2 ? by0 + randRange(rng, 0, bh - h) : by0 + randRange(rng, 0, bh - h);
        S.buildings.push({ x, y, w, h, color: pick(rng, colors), tall: downtown && rng() < 0.7, district: d ? d.kind : 'city' });
      }
    }
  }
  // The pay-n-spray garage that clears the wanted level, on a downtown street.
  S.garage = { x: 1560, y: 2010, w: 150, h: 90, name: "Lou's Garage" };
  // Hospital respawn point, downtown.
  S.hospital = { x: 1800, y: 1575 };
  // A few palm trees along the beach front, as decoration with no collision.
  S.trees = [];
  for (let i = 0; i < 40; i += 1) {
    S.trees.push({ x: randRange(rng, 60, WORLD.size - 60), y: randRange(rng, 2920, 3540), s: randRange(rng, 8, 14) });
  }
  for (let i = 0; i < 24; i += 1) {
    S.trees.push({ x: randRange(rng, 950, 1750), y: randRange(rng, 950, 1750), s: randRange(rng, 9, 15) });
  }
  return S;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(S) {
  const rng = S.rng;
  const vertical = rng() < 0.5;
  if (vertical) {
    return { x: pick(rng, S.roadsX) + randRange(rng, -14, 14), y: randRange(rng, 100, WORLD.size - 100) };
  }
  return { x: randRange(rng, 100, WORLD.size - 100), y: pick(rng, S.roadsY) + randRange(rng, -14, 14) };
}

/** A random point on a sidewalk (just off a road, inside a block edge). */
export function randomSidewalkPoint(S) {
  const rng = S.rng;
  const p = randomRoadPoint(S);
  p.x += randInt(rng, -1, 1) * 44;
  p.y += randInt(rng, -1, 1) * 44;
  p.x = clamp(p.x, 60, WORLD.size - 60);
  p.y = clamp(p.y, 60, WORLD.size - 60);
  return p;
}
