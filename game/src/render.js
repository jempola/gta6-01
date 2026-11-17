// Drawing only: the city, the sea and beach, roads, buildings, cars, peds,
// the player, particles, bullets and day/dusk lighting. Camera follows the player.
import { WORLD, COLORS, TAU } from './config.js';
import { ROAD_XS, ROAD_YS } from './world.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1 };

  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  function worldToScreen(G, x, y) {
    const cam = G.camera;
    return {
      x: (x - (cam.x - cam.w / 2)) * cam.zoom,
      y: (y - (cam.y - cam.h / 2)) * cam.zoom,
    };
  }

  function drawGround(G) {
    const cam = G.camera;
    const x0 = cam.x - cam.w / 2 - 50, y0 = cam.y - cam.h / 2 - 50;
    const x1 = cam.x + cam.w / 2 + 50, y1 = cam.y + cam.h / 2 + 50;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, view.w, view.h);
    // Sea + sand (west edge).
    const sea = worldToScreen(G, 0, 0);
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, 0, Math.max(0, (95 - (cam.x - cam.w / 2)) * cam.zoom), view.h);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(Math.max(0, (95 - (cam.x - cam.w / 2)) * cam.zoom), 0, Math.max(0, (190 - 95) * cam.zoom - Math.max(0, (cam.x - cam.w / 2 - 95) * cam.zoom)), view.h);
    // Park.
    const park = worldToScreen(G, G.city.park.x, G.city.park.y);
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, G.city.park.w * cam.zoom, G.city.park.h * cam.zoom);
    // Port yard.
    const port = worldToScreen(G, G.city.port.x, G.city.port.y);
    ctx.fillStyle = '#7d7468';
    ctx.fillRect(port.x, port.y, G.city.port.w * cam.zoom, G.city.port.h * cam.zoom);
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const rx of ROAD_XS) {
      const s = worldToScreen(G, rx, 0);
      if (s.x > -80 && s.x < view.w + 80) ctx.fillRect(s.x - (WORLD.roadWidth / 2) * cam.zoom, 0, WORLD.roadWidth * cam.zoom, view.h);
    }
    for (const ry of ROAD_YS) {
      const s = worldToScreen(G, 0, ry);
      if (s.y > -80 && s.y < view.h + 80) ctx.fillRect(0, s.y - (WORLD.roadWidth / 2) * cam.zoom, view.w, WORLD.roadWidth * cam.zoom);
    }
    // Centre dashes.
    ctx.fillStyle = COLORS.roadLine;
    for (const rx of ROAD_XS) {
      const s = worldToScreen(G, rx, 0);
      if (s.x < -20 || s.x > view.w + 20) continue;
      for (let y = y0; y < y1; y += 56) {
        const p = worldToScreen(G, rx, y);
        ctx.fillRect(p.x - 2, p.y, 4, 26 * cam.zoom);
      }
    }
    for (const ry of ROAD_YS) {
      const s = worldToScreen(G, 0, ry);
      if (s.y < -20 || s.y > view.h + 20) continue;
      for (let x = x0; x < x1; x += 56) {
        const p = worldToScreen(G, x, ry);
        ctx.fillRect(p.x, p.y - 2, 26 * cam.zoom, 4);
      }
    }
    // Sidewalk edges.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (const rx of ROAD_XS) {
      const s = worldToScreen(G, rx, 0);
      if (s.x < -80 || s.x > view.w + 80) continue;
      ctx.beginPath();
      ctx.moveTo(s.x - (WORLD.roadWidth / 2 + 8) * cam.zoom, 0); ctx.lineTo(s.x - (WORLD.roadWidth / 2 + 8) * cam.zoom, view.h);
      ctx.moveTo(s.x + (WORLD.roadWidth / 2 + 8) * cam.zoom, 0); ctx.lineTo(s.x + (WORLD.roadWidth / 2 + 8) * cam.zoom, view.h);
      ctx.stroke();
    }
  }

  function drawBuildings(G) {
    const cam = G.camera;
    for (const b of G.city.buildings) {
      const s = worldToScreen(G, b.x, b.y);
      const w = b.w * cam.zoom, h = b.h * cam.zoom;
      if (s.x + w < -20 || s.x > view.w + 20 || s.y + h < -20 || s.y > view.h + 20) continue;
      // Drop shadow for height.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(s.x + 6, s.y + 8, w, h);
      ctx.fillStyle = b.color;
      ctx.fillRect(s.x, s.y, w, h);
      ctx.fillStyle = b.tall ? '#3a3a44' : 'rgba(255,255,255,0.14)';
      ctx.fillRect(s.x + 4, s.y + 4, w - 8, h - 8);
      // Windows.
      ctx.fillStyle = 'rgba(255,240,180,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 42)), rows = Math.max(1, Math.floor(b.h / 42));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 13 + Math.floor(b.roof * 100)) % 3 === 0) continue;
          ctx.fillRect(s.x + 10 + i * (w - 20) / cols, s.y + 10 + j * (h - 20) / rows, 7 * cam.zoom, 7 * cam.zoom);
        }
      }
    }
    // Landmarks.
    for (const lm of G.city.landmarks) {
      const s = worldToScreen(G, lm.x, lm.y);
      ctx.fillStyle = lm.kind === 'pier' ? '#8a6f4d' : lm.kind === 'bandstand' ? '#c9a86a' : '#e67e22';
      ctx.fillRect(s.x, s.y, lm.w * cam.zoom, lm.h * cam.zoom);
    }
    // Garage + safehouse.
    const g = worldToScreen(G, G.city.garage.x, G.city.garage.y);
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(g.x, g.y, G.city.garage.w * cam.zoom, G.city.garage.h * cam.zoom);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.max(11, 13 * cam.zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SUNSET AUTO', g.x + (G.city.garage.w * cam.zoom) / 2, g.y + 20);
    ctx.fillText('SPRAY SHOP', g.x + (G.city.garage.w * cam.zoom) / 2, g.y + 38);
    const sh = worldToScreen(G, G.city.safehouse.x, G.city.safehouse.y);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(sh.x, sh.y, G.city.safehouse.w * cam.zoom, G.city.safehouse.h * cam.zoom);
    ctx.fillStyle = '#111';
    ctx.fillText('SAFEHOUSE', sh.x + (G.city.safehouse.w * cam.zoom) / 2, sh.y + 20);
    ctx.textAlign = 'left';
  }

  function drawCar(G, car) {
    const cam = G.camera;
    const s = worldToScreen(G, car.x, car.y);
    if (s.x < -60 || s.x > view.w + 60 || s.y < -60 || s.y > view.h + 60) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.angle);
    const z = cam.zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-22 * z + 3, -10 * z + 4, 46 * z, 22 * z);
    ctx.fillStyle = car.exploded ? '#222' : car.color;
    ctx.beginPath();
    ctx.roundRect(-23 * z, -11 * z, 46 * z, 22 * z, 6 * z);
    ctx.fill();
    ctx.fillStyle = car.isPolice ? '#fff' : 'rgba(20,30,45,0.85)';
    ctx.fillRect(-6 * z, -9 * z, 14 * z, 18 * z);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(19 * z, -9 * z, 3 * z, 5 * z);
    ctx.fillRect(19 * z, 4 * z, 3 * z, 5 * z);
    if (car.isPolice) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-14 * z, -11 * z, 8 * z, 4 * z);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-14 * z, 7 * z, 8 * z, 4 * z);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${9 * z}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 2 * z, 3 * z);
    }
    if (car.smoke > 0 && !car.exploded) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(-14 * z, 0, 6 * z, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(G, x, y, angle, color, radius, down) {
    const s = worldToScreen(G, x, y);
    if (s.x < -40 || s.x > view.w + 40 || s.y < -40 || s.y > view.h + 40) return;
    const z = G.camera.zoom;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (down) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, radius * z, (radius * 0.55) * z, angle, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, radius * z, radius * z * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, radius * z, 0, TAU); ctx.fill();
    // Facing tick + arms.
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(radius * 0.7 * z, 0, radius * 0.45 * z, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw(G, screen) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w, view.h);
    drawGround(G);
    drawBuildings(G);
    // Mission marker.
    const marker = G.missionMarker ? G.missionMarker() : null;
    if (marker) {
      const s = worldToScreen(G, marker.x, marker.y);
      const pulse = 26 + Math.sin(G.time * 5) * 6;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = marker.color;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // Pickups.
    for (const pk of G.pickups) {
      if (pk.taken) continue;
      const s = worldToScreen(G, pk.x, pk.y);
      const bob = Math.sin(G.time * 3 + pk.x) * 3;
      ctx.fillStyle = pk.kind === 'health' ? '#e74c3c' : pk.kind === 'ammo' ? '#f1c40f' : pk.kind === 'armor' ? '#3498db' : '#9b59b6';
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, 10 * G.camera.zoom, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 11px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'pistol' ? 'GUN' : pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'AMMO' : 'ARMOR', s.x, s.y + bob + 4);
      ctx.textAlign = 'left';
    }
    for (const car of G.cars) drawCar(G, car);
    for (const ped of G.peds.list) drawPerson(G, ped.x, ped.y, ped.angle, ped.color, 11, ped.down);
    for (const cop of G.police.cops) drawPerson(G, cop.x, cop.y, cop.angle, '#1a2a4a', 12, cop.down);
    // Player (on foot only; in a car the car is the player).
    const p = G.player;
    if (!p.inCar) {
      const blink = p.hurtTimer > 0 && Math.floor(G.time * 12) % 2 === 0;
      if (!blink) {
        drawPerson(G, p.x, p.y, p.angle, '#e74c3c', p.radius, false);
        if (p.weapon === 'pistol') {
          const s = worldToScreen(G, p.x, p.y);
          ctx.save();
          ctx.translate(s.x, s.y); ctx.rotate(p.angle);
          ctx.fillStyle = '#222';
          ctx.fillRect(8, -2, 16 * G.camera.zoom, 4);
          ctx.restore();
        }
        if (p.punchAnim > 0) {
          const s = worldToScreen(G, p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
          ctx.fillStyle = '#ffd94a';
          ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, TAU); ctx.fill();
        }
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffd94a';
    for (const b of G.bullets) {
      const s = worldToScreen(G, b.x, b.y);
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill();
    }
    // Particles.
    for (const pt of G.particles) {
      const s = worldToScreen(G, pt.x, pt.y);
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, pt.size * G.camera.zoom, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Day / dusk lighting.
    if (G.timeOfDay === 'dusk') {
      const grad = ctx.createLinearGradient(0, 0, 0, view.h);
      grad.addColorStop(0, 'rgba(90,40,90,0.18)');
      grad.addColorStop(1, 'rgba(255,120,40,0.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, view.w, view.h);
    } else if (G.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(10,10,40,0.30)';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    // Vignette.
    const vg = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.45, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  return { draw, view, worldToScreen };
}
