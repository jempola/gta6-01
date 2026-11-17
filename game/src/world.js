// The city of Solmar Bay: grid streets, beach and sea on the west, a park, a port
// in the south-east, downtown towers in the centre. Buildings are collision boxes.
// All names, districts and streets are original.
import { WORLD, COLORS, makeRng, clamp } from './config.js';

export const ROAD_XS = [];
export const ROAD_YS = [];
for (let x = 225; x < WORLD.size; x += WORLD.roadGap) ROAD_XS.push(x);
for (let y = 225; y < WORLD.size; y += WORLD.roadGap) ROAD_YS.push(y);

export const DISTRICTS = [
  { name: 'Marina Beach', x: 0, y: 0, w: 190, h: WORLD.size, kind: 'beach' },
  { name: 'Old Town', x: 190, y: 0, w: 1100, h: 1100, kind: 'old' },
  { name: 'Downtown', x: 1350, y: 1350, w: 1100, h: 1100, kind: 'downtown' },
  { name: 'Palm Park', x: 190, y: 2400, w: 900, h: 1000, kind: 'park' },
  { name: 'Harbor Port', x: 2500, y: 2500, w: 1100, h: 1100, kind: 'port' },
  { name: 'North Hills', x: 190, y: 0, w: 3410, h: 200, kind: 'hills' },
];

const BUILDING_COLORS = [COLORS.buildingA, COLORS.buildingB, COLORS.buildingC, COLORS.buildingD];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  // One building per city block (between roads), skipping beach, park and port yards.
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
      const x0 = ROAD_XS[bx] + WORLD.roadWidth / 2 + 24;
      const y0 = ROAD_YS[by] + WORLD.roadWidth / 2 + 24;
      const x1 = ROAD_XS[bx + 1] - WORLD.roadWidth / 2 - 24;
      const y1 = ROAD_YS[by + 1] - WORLD.roadWidth / 2 - 24;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // Park block and port yard stay open.
      if (cx > 190 && cx < 1090 && cy > 2400 && cy < 3400) continue;
      if (cx > 2500 && cy > 2500) continue;
      const downtown = cx > 1350 && cx < 2450 && cy > 1350 && cy < 2450;
      const w = (x1 - x0) * (downtown ? 0.62 : 0.5 + rng() * 0.22);
      const h = (y1 - y0) * (downtown ? 0.62 : 0.5 + rng() * 0.22);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)],
        tall: downtown, roof: rng(),
      });
    }
  }
  // Landmarks: the marina pier, the park bandstand, port cranes (drawn, not colliders).
  const landmarks = [
    { kind: 'pier', x: 60, y: 1500, w: 130, h: 26 },
    { kind: 'bandstand', x: 620, y: 2900, w: 90, h: 90 },
    { kind: 'crane', x: 2900, y: 2700, w: 60, h: 180 },
    { kind: 'crane', x: 3200, y: 3050, w: 60, h: 180 },
  ];
  return {
    buildings, landmarks,
    // Pay-n-spray style garage: drive in to clear the wanted level (costs $150).
    garage: { x: 1560, y: 690, w: 150, h: 110, name: 'Sunset Auto — Spray Shop' },
    // Mission start / safehouse.
    safehouse: { x: 700, y: 700, w: 120, h: 100, name: "Rico's Safehouse" },
    park: { x: 190, y: 2400, w: 900, h: 1000 },
    port: { x: 2500, y: 2500, w: 1100, h: 1100 },
    beach: { x: 0, y: 0, w: 190, h: WORLD.size },
  };
}

export function isOnRoad(x, y) {
  const rw = WORLD.roadWidth / 2 + 14;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < rw) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < rw) return true;
  return false;
}

// Circle vs building collision: push the circle out, return true when it hit.
export function collideBuildings(buildings, x, y, r) {
  let hit = false;
  for (const b of buildings) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      x += (dx / d) * push; y += (dy / d) * push;
    }
  }
  return { x, y, hit };
}

export function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// A point on a road near (x,y): snap to the nearest road centre line.
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_XS[0], bestD = Infinity;
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bestD) { bestD = d; bestX = rx; } }
  let bestY = ROAD_YS[0]; bestD = Infinity;
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d < bestD) { bestD = d; bestY = ry; } }
  return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}
