// The renderer: draws the city, roads, buildings, cars, people, pickups, bullets
// and particles from the camera's point of view, then the day/dusk lighting tint.
// It never changes game state; the HUD is drawn separately by hud.js.

import { WORLD, FONT, PALETTE } from './config.js';

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-20, -11, 42, 24);
  // Body.
  ctx.fillStyle = car.dead ? '#222222' : car.color;
  ctx.fillRect(-22, -12, 44, 24);
  // Cabin and windshield.
  ctx.fillStyle = car.dead ? '#111111' : '#9fc4d8';
  ctx.fillRect(-6, -10, 14, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(14, -10, 4, 20);
  // Headlights when it is dusk.
  if (car.playerControlled || car.cop) {
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(20, -9, 3, 4);
    ctx.fillRect(20, 5, 3, 4);
  }
  // Cop light bar, flashing.
  if (car.cop) {
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#2e5fd0';
    ctx.fillRect(-4, -12, 8, 5);
    ctx.fillStyle = on ? '#2e5fd0' : '#ff3b30';
    ctx.fillRect(-4, 7, 8, 5);
  }
  // Target marker for chase / vigilante cars.
  if (car.isTarget) {
    ctx.rotate(-car.angle);
    ctx.fillStyle = '#ff4f4f';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(-8, -48);
    ctx.lineTo(8, -48);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Health bar over a damaged player or target car.
  if ((car.playerControlled || car.isTarget) && car.health < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(car.x - 22, car.y - 30, 44, 5);
    ctx.fillStyle = car.health > 50 ? '#58c472' : '#e5534b';
    ctx.fillRect(car.x - 21, car.y - 29, 42 * Math.max(0, car.health / 100), 3);
  }
}

function drawPerson(ctx, x, y, angle, shirt, isPlayer, punchAnim, time) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Body and head.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, isPlayer ? 14 : 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Punching arm.
  if (punchAnim > 0) {
    ctx.fillStyle = shirt;
    ctx.fillRect(8, -3, 16, 6);
  }
  // Facing tick.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(10, -2, 6, 4);
  ctx.restore();
}

/** Draw the whole scene for state S onto ctx (already sized to the canvas). */
export function drawWorld(ctx, S, viewW, viewH) {
  const cam = S.camera;
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.translate(-cam.x + viewW / 2, -cam.y + viewH / 2);
  if (S.shake > 0) {
    ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  }
  const vx0 = cam.x - viewW / 2 - 80;
  const vy0 = cam.y - viewH / 2 - 80;
  const vx1 = cam.x + viewW / 2 + 80;
  const vy1 = cam.y + viewH / 2 + 80;

  // Ground: grass, then the sea and sand along the south coast.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(vx0, 0), Math.max(vy0, 3150), Math.min(vx1, WORLD.size) - Math.max(vx0, 0), Math.min(vy1, WORLD.size) - Math.max(vy0, 3150));
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(vx0, 0), Math.max(vy0, 2920), Math.min(vx1, WORLD.size) - Math.max(vx0, 0), Math.min(vy1, 3150) - Math.max(vy0, 2920));

  // District tints: park green, port concrete.
  for (const d of S.districts) {
    if (d.kind === 'park') {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'port') {
      ctx.fillStyle = PALETTE.port;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'downtown') {
      ctx.fillStyle = 'rgba(125,138,160,0.25)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
  }

  // Trees in the park and along the beach.
  ctx.fillStyle = '#2e6b34';
  for (const t of S.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads: dark strips with dashed centre lines, plus pale sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const line of S.roadsX) ctx.fillRect(line - WORLD.roadWidth / 2 - 10, vy0, WORLD.roadWidth + 20, vy1 - vy0);
  for (const line of S.roadsY) ctx.fillRect(vx0, line - WORLD.roadWidth / 2 - 10, vx1 - vx0, WORLD.roadWidth + 20);
  ctx.fillStyle = PALETTE.road;
  for (const line of S.roadsX) ctx.fillRect(line - WORLD.roadWidth / 2, vy0, WORLD.roadWidth, vy1 - vy0);
  for (const line of S.roadsY) ctx.fillRect(vx0, line - WORLD.roadWidth / 2, vx1 - vx0, WORLD.roadWidth);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const line of S.roadsX) {
    ctx.beginPath();
    ctx.moveTo(line, Math.max(vy0, 0));
    ctx.lineTo(line, Math.min(vy1, WORLD.size));
    ctx.stroke();
  }
  for (const line of S.roadsY) {
    ctx.beginPath();
    ctx.moveTo(Math.max(vx0, 0), line);
    ctx.lineTo(Math.min(vx1, WORLD.size), line);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  for (const b of S.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.tall ? '#5a6a80' : PALETTE.buildingRoof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,240,180,0.75)';
      for (let wy = b.y + 18; wy < b.y + b.h - 14; wy += 26) {
        for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }

  // The garage, with its gold sign.
  const g = S.garage;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText("LOU'S GARAGE", g.x + g.w / 2, g.y + 26);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CLEAR WANTED • $50', g.x + g.w / 2, g.y + 46);
  ctx.textAlign = 'left';

  // Pickups, bobbing gently.
  for (const pk of S.pickups) {
    if (pk.taken || pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'pistol') {
      ctx.fillStyle = '#222831';
      ctx.fillRect(-10, -4, 20, 8);
      ctx.fillRect(4, 2, 6, 8);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -9, 26, 20);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'armor') {
      ctx.fillStyle = '#2e5fd0';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, -6);
      ctx.lineTo(10, 4);
      ctx.lineTo(0, 11);
      ctx.lineTo(-10, 4);
      ctx.lineTo(-10, -6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a00';
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  // Mission marker: a pulsing red column and ring on the ground.
  const target = (S.mission && S.mission.target) || (S.gig && S.gig.target);
  if (target) {
    const pulse = 26 + Math.sin(S.time * 5) * 6;
    ctx.strokeStyle = '#ff4f4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,79,79,0.18)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4f4f';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 52);
    ctx.lineTo(target.x - 9, target.y - 70);
    ctx.lineTo(target.x + 9, target.y - 70);
    ctx.closePath();
    ctx.fill();
    if (target.label) {
      ctx.font = `700 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(target.label, target.x, target.y - 76);
      ctx.textAlign = 'left';
    }
  }

  // Cars, then people, then bullets and particles.
  for (const car of S.cars) {
    if (car.x < vx0 - 60 || car.x > vx1 + 60 || car.y < vy0 - 60 || car.y > vy1 + 60) continue;
    drawCar(ctx, car, S.time);
  }
  for (const ped of S.peds) {
    if (ped.dead || ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, false, 0, S.time);
  }
  for (const thug of S.thugs || []) {
    if (thug.dead || thug.x < vx0 || thug.x > vx1 || thug.y < vy0 || thug.y > vy1) continue;
    drawPerson(ctx, thug.x, thug.y, thug.angle, '#3a3a3a', false, 0, S.time);
    ctx.fillStyle = '#ff4f4f';
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THUG', thug.x, thug.y - 20);
    ctx.textAlign = 'left';
  }
  for (const cop of S.cops) {
    if (cop.dead || cop.x < vx0 || cop.x > vx1 || cop.y < vy0 || cop.y > vy1) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#2e5fd0', false, 0, S.time);
  }
  if (S.player.onFoot && S.player.health > 0) {
    drawPerson(ctx, S.player.x, S.player.y, S.player.angle, PALETTE.playerShirt, true, S.player.punchAnim, S.time);
    // Gold ring so Rico is easy to spot in a crowd.
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S.player.x, S.player.y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd94f';
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of S.particles) {
    const frac = pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, frac);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + frac * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dusk lighting: a warm violet wash plus a darker vignette at the edges.
  if (S.dusk) {
    ctx.fillStyle = 'rgba(40, 24, 80, 0.30)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.fillStyle = 'rgba(255, 140, 60, 0.07)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }
  ctx.restore();
}
