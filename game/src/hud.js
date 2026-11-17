// HUD: health/armor bars, cash, wanted stars, weapon and ammo, the mission
// objective tracker, dialogue banner, and the minimap (player, cars, police,
// mission markers, garage and safehouse).
import { WORLD, FONT, clamp } from './config.js';
import { missionObjective, missionMarker } from './missions.js';

const MAP_SIZE = 168;
const MAP_SCALE = MAP_SIZE / WORLD.size;

export function drawHud(G, ctx, viewW, viewH) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // Top-left: health + armor.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 240, 66);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('RICO VALE', 24, 18);
  bar(ctx, 24, 40, 220, 10, p.health / 100, '#e74c3c');
  bar(ctx, 24, 54, 220, 10, p.armor / 100, '#3498db');
  // Top-right: cash + wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(viewW - 254, 12, 240, 66);
  ctx.fillStyle = '#2ecc71';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`$${p.cash}`, viewW - 24, 18);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, viewW - 34 - i * 26, 56, 10);
  }
  // Bottom-left: weapon + ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, viewH - 58, 210, 44);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = 'left';
  const weaponText = p.inCar
    ? `${p.inCar.name}  ♥ ${Math.max(0, Math.round(p.inCar.health))}`
    : p.weapon === 'pistol' ? `Pistol  ${p.ammo} rounds` : 'Fists  (F to punch)';
  ctx.fillText(weaponText, 24, viewH - 44);
  ctx.fillStyle = '#bbb';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('WASD move/drive · E enter car · M mute · P pause', 24, viewH - 22);
  // Objective tracker, under the top-left panel.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const obj = missionObjective(G);
  ctx.fillRect(14, 88, Math.min(420, 20 + obj.length * 7.5), 30);
  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText('★ ' + obj, 24, 96);
  // Timed mission countdown.
  if (G.missions.active && !G.missions.active.isGig) {
    const step = G.missions.active.steps[G.missions.stepIndex];
    if (step && step.timed) {
      const left = Math.max(0, Math.ceil(step.timed - G.missions.stepTimer));
      ctx.fillStyle = left < 15 ? '#e74c3c' : '#fff';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText(`⏱ ${left}s`, 24, 126);
    }
  }
  // Dialogue banner.
  if (G.missions.dialogueTimer > 0 && G.missions.dialogue) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const w = Math.min(viewW - 40, 760);
    ctx.fillRect((viewW - w) / 2, viewH - 150, w, 52);
    ctx.fillStyle = '#fff';
    ctx.font = `15px ${FONT}`;
    ctx.textAlign = 'center';
    wrapText(ctx, G.missions.dialogue, viewW / 2, viewH - 138, w - 24, 19);
    ctx.textAlign = 'left';
  }
  // Toast banner (one-liners like "Wanted level up").
  if (G.toastTimer > 0 && G.toast) {
    ctx.globalAlpha = clamp(G.toastTimer, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect((viewW - 520) / 2, 92, 520, 30);
    ctx.fillStyle = '#ffd94a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(G.toast, viewW / 2, 100);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // Minimap, bottom-right.
  drawMinimap(G, ctx, viewW - MAP_SIZE - 14, viewH - MAP_SIZE - 14);
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy); yy += lineH; line = word;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

export function drawMinimap(G, ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 4, y - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  // Sea, beach, park, roads.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x, y, 190 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x, y, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(x, y, 190 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#4a7d3a';
  ctx.fillRect(x + 190 * MAP_SCALE, y + 2400 * MAP_SCALE, 900 * MAP_SCALE, 1000 * MAP_SCALE);
  ctx.fillStyle = '#33363d';
  for (const rx of [225, 675, 1125, 1575, 2025, 2475, 2925, 3375]) ctx.fillRect(x + rx * MAP_SCALE - 1, y, 3, MAP_SIZE);
  for (const ry of [225, 675, 1125, 1575, 2025, 2475, 2925, 3375]) ctx.fillRect(x, y + ry * MAP_SCALE - 1, MAP_SIZE, 3);
  // Garage + safehouse.
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(x + G.city.garage.x * MAP_SCALE - 3, y + G.city.garage.y * MAP_SCALE - 3, 6, 6);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x + G.city.safehouse.x * MAP_SCALE - 3, y + G.city.safehouse.y * MAP_SCALE - 3, 6, 6);
  // Mission marker (pulsing diamond).
  const marker = missionMarker(G);
  if (marker) {
    const mx = x + marker.x * MAP_SCALE, my = y + marker.y * MAP_SCALE;
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.moveTo(mx, my - pulse); ctx.lineTo(mx + pulse, my); ctx.lineTo(mx, my + pulse); ctx.lineTo(mx - pulse, my);
    ctx.closePath(); ctx.fill();
  }
  // Cars (white), police (blue/red), player (yellow, on top).
  ctx.fillStyle = '#fff';
  for (const car of G.cars) {
    if (car.exploded) continue;
    ctx.fillRect(x + car.x * MAP_SCALE - 1.5, y + car.y * MAP_SCALE - 1.5, 3, 3);
  }
  ctx.fillStyle = '#3498db';
  for (const car of G.police.copCars) {
    ctx.fillRect(x + car.x * MAP_SCALE - 2, y + car.y * MAP_SCALE - 2, 4, 4);
  }
  for (const cop of G.police.cops) {
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(x + cop.x * MAP_SCALE - 1.5, y + cop.y * MAP_SCALE - 1.5, 3, 3);
  }
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + (G.camera.x - G.camera.w / 2) * MAP_SCALE, y + (G.camera.y - G.camera.h / 2) * MAP_SCALE, G.camera.w * MAP_SCALE, G.camera.h * MAP_SCALE);
  // Player.
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(x + G.player.x * MAP_SCALE, y + G.player.y * MAP_SCALE, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(x - 4, y - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x, y - 18);
  ctx.restore();
}
