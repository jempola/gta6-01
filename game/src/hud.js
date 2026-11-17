// The HUD: health and armor bars, cash, wanted stars, weapon and ammo, the mission
// objective line, and a canvas minimap of the whole city showing the player, cars,
// mission markers and police.

import { WORLD, FONT, PALETTE, clamp } from './config.js';

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

/** Draw the minimap into the top-right corner of the canvas. */
export function drawMinimap(ctx, S, canvasW) {
  const size = 190;
  const x0 = canvasW - size - 14;
  const y0 = 14;
  const scale = size / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  // Sea along the bottom edge, park green, port grey.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + size * (2700 / WORLD.size), size, size * (900 / WORLD.size));
  ctx.fillStyle = '#4c8a3f';
  ctx.fillRect(x0 + size * (900 / WORLD.size), y0 + size * (900 / WORLD.size), size * (900 / WORLD.size), size * (900 / WORLD.size));
  // Roads.
  ctx.strokeStyle = 'rgba(220,220,220,0.55)';
  ctx.lineWidth = 1;
  for (const line of S.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + size, y0 + line * scale);
    ctx.stroke();
  }
  // Garage.
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(x0 + S.garage.x * scale - 2, y0 + S.garage.y * scale - 2, 5, 5);
  // Mission / gig marker, pulsing.
  const target = (S.mission && S.mission.target) || (S.gig && S.gig.target);
  if (target) {
    const pulse = 4 + Math.sin(S.time * 6) * 2;
    ctx.fillStyle = '#ff4f4f';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  // Cars as white dots, cop cars as blue dots.
  for (const car of S.cars) {
    if (car.dead) continue;
    ctx.fillStyle = car.cop ? '#5a8cff' : 'rgba(255,255,255,0.85)';
    ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
  }
  // Foot cops as blue dots.
  ctx.fillStyle = '#5a8cff';
  for (const cop of S.cops) {
    if (!cop.dead) ctx.fillRect(x0 + cop.x * scale - 1.5, y0 + cop.y * scale - 1.5, 3, 3);
  }
  // Player as a gold dot with a white ring.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(x0 + S.player.x * scale, y0 + S.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Draw the full HUD over the game canvas. */
export function drawHUD(ctx, S, canvasW, canvasH) {
  ctx.save();
  ctx.font = `600 15px ${FONT}`;
  ctx.textBaseline = 'top';

  // Health and armor bars, bottom-left.
  const bx = 14;
  const by = canvasH - 66;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 6, by - 26, 250, 84);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('RICO VALE', bx, by - 20);
  bar(ctx, bx, by, 220, 14, S.player.health / 100, '#e5534b');
  ctx.fillStyle = PALETTE.text;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`HP ${Math.ceil(S.player.health)}`, bx + 226, by - 1);
  ctx.font = `600 15px ${FONT}`;
  bar(ctx, bx, by + 20, 220, 10, S.player.armor / 100, '#5a8cff');
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`ARMOR ${Math.ceil(S.player.armor)}`, bx + 226, by + 18);

  // Cash, top-left.
  ctx.font = `700 22px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`$${S.cash}`, 14, 14);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('SOLMAR BAY', 14, 42);

  // Wanted stars, top-centre.
  const stars = S.wanted;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd94f' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', canvasW / 2 - 60 + i * 30, 10);
  }
  ctx.textAlign = 'left';

  // Weapon and ammo, bottom-right.
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  const weaponText = S.weapon === 'pistol' ? `PISTOL  •  ${S.ammo} rounds` : 'FISTS';
  const ww = ctx.measureText(weaponText).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(canvasW - ww - 34, canvasH - 44, ww + 20, 30);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(weaponText, canvasW - ww - 24, canvasH - 36);

  // Mission objective, under the stars.
  if (S.objective) {
    ctx.font = `600 15px ${FONT}`;
    const ow = ctx.measureText(S.objective).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvasW / 2 - ow / 2 - 12, 52, ow + 24, 28);
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText(S.objective, canvasW / 2, 59);
    ctx.textAlign = 'left';
  }

  // Toast message, centre-bottom.
  if (S.messageT > 0 && S.message) {
    ctx.font = `600 15px ${FONT}`;
    const mw = ctx.measureText(S.message).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(canvasW / 2 - mw / 2 - 12, canvasH - 110, mw + 24, 28);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(S.message, canvasW / 2, canvasH - 103);
    ctx.textAlign = 'left';
  }

  // Mission dialogue line, above the toast.
  if (S.missionDialogueT > 0 && S.missionDialogue) {
    ctx.font = `italic 15px ${FONT}`;
    const dw = ctx.measureText(S.missionDialogue).width;
    const maxW = Math.min(dw, canvasW - 80);
    ctx.fillStyle = 'rgba(18,16,22,0.85)';
    ctx.fillRect(canvasW / 2 - maxW / 2 - 14, canvasH - 152, maxW + 28, 30);
    ctx.fillStyle = '#ffd9a0';
    ctx.textAlign = 'center';
    ctx.fillText(S.missionDialogue, canvasW / 2, canvasH - 145, maxW);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, S, canvasW);
  ctx.restore();
}
