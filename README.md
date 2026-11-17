# Solmar Bay — an original open-world crime game

**Solmar Bay** is a 2D top-down open-world crime game for the make.fun gta6-01
bounty ("Make GTA 6"). It runs offline in a desktop browser from the static
files under `game/` — no build step, no network, no external assets.

## The game

You are **Rico Vale**, an ex-driver pulled back into the sun-soaked coastal
city of **Solmar Bay**. Explore the city on foot and by car: Marina Beach,
Old Town, Downtown, Palm Park and the Harbor Port, all on one open map.

- **City** — a road grid with traffic, sidewalks, a beach, a park, a port and
  downtown towers. Buildings are solid; the sea is on the west edge.
- **On foot** — WASD to walk, Shift to run, F to punch, E to get in a car.
- **Cars** — drive with WASD/arrows, steal any parked or traffic car (jacking
  draws the law), car health and explosions when a car takes too much damage.
- **Traffic & pedestrians** — traffic cars follow the roads and brake for the
  car ahead; pedestrians stroll the sidewalks, flee gunfire and crashes, and a
  few fight back.
- **Wanted level** — 1–5 stars. Police cars chase and ram; foot cops chase and
  try to arrest you. Lose them by hiding or outrunning them, or pay $150 at
  the Sunset Auto spray shop to clear your name.
- **Missions** — five story missions with markers and dialogue (a port pickup,
  a bank getaway, a timed harbor delivery, a pier takedown, the big casino
  score), plus two repeatable side gigs: taxi fares and vigilante work.
  Open the pause menu (P) to pick a mission.
- **Combat** — fists and a pistol (pick one up in the city), mouse aim, click
  to shoot, ammo and health/armor pickups.
- **HUD** — health and armor bars, cash, wanted stars, weapon and ammo, the
  mission objective tracker, dialogue, and a live minimap showing the player,
  cars, police, the spray shop, the safehouse and mission markers.
- **Menus & save** — start screen, pause menu with mission select, game over
  with respawn, and save/load through localStorage.
- **Polish** — day/dusk lighting, skid and smoke particles, muzzle flashes,
  and fully synthesized WebAudio sound: engine hum, sirens, gunshots and a
  looping bassline. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| Mouse + click | Aim and shoot (pistol) |
| F / Space | Punch |
| E | Enter / exit / steal a car |
| R | Reload note (pistol) |
| P / Esc | Pause, missions, save/load |
| M | Mute |

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

## Structure

- `game/index.html` — page, canvas and menu overlays
- `game/src/main.js` — boot, loop, screens, camera, test hooks
- `game/src/world.js` — city generation, roads, buildings, collision
- `game/src/player.js` — Rico on foot, punching, entering cars
- `game/src/vehicle.js` — driving physics, traffic AI, explosions
- `game/src/ped.js` — pedestrians (stroll, flee, fight back)
- `game/src/police.js` — wanted level, police chase and arrest
- `game/src/missions.js` — five story missions and two side gigs
- `game/src/combat.js` — pistol, bullets, pickups
- `game/src/hud.js` — HUD and minimap
- `game/src/render.js` — canvas drawing, lighting
- `game/src/audio.js` — synthesized WebAudio SFX and music
- `game/src/save.js` — localStorage save/load
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — screenshot scenes (`?shot=cover|combat|mission|dusk`)
- `game/src/config.js` — shared constants

Everything in this game — the city, characters, vehicles, names, story, art,
sounds and music — is original. Nothing is taken from Rockstar Games' Grand
Theft Auto series or any other commercial game.

## License

MIT — see `LICENSE`.
