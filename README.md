[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jempola/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jempola/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay — Open-World Crime Game

A 2D top-down open-world crime game set in **Solmar Bay**, an original sun-soaked coastal city. You are **Rico Vale**, an ex-driver pulled back in by his old fixer Milo — while Vane's crew leans on the docks and the Solmar Bay police watch every street.

No GTA intellectual property is used anywhere: every name, place and character is original.

## The game

- **A living city** — a 3600 × 3600 grid of streets with a beach and coast, a park, a port and downtown; buildings collide, the light slides from day to dusk.
- **On foot and behind the wheel** — walk, run and punch on foot; press E near any car to steal it and drive. Cars have real physics (acceleration, braking, steering, skids), health, and explode when heavily damaged. Traffic cars cruise the road grid and parked cars wait to be taken.
- **Pedestrians** — they stroll the sidewalks, flee from gunfire and crashes, and a few hotheads fight back.
- **Wanted level, 1–5 stars** — police cruisers ram you and foot officers chase you down and try to arrest you. Lose them by hiding, outrunning them, or paying for a new paint job at Lou's Garage.
- **Five story missions** — a drive-to job, a chase, an escape, a delivery and a takedown — each with map markers, dialogue from Milo, an objective tracker and a payout, plus two side gigs: taxi fares and vigilante work. Pick missions from the pause menu.
- **Combat** — fists plus a pistol pickup, mouse aim, ammo, and health and armor packs scattered around the city.
- **HUD** — health and armor bars, cash, wanted stars, weapon and ammo, the mission objective, and a live minimap showing you, cars, mission markers and police.
- **Full flow** — title screen, pause menu with mission select, save and load through localStorage, and game over with a hospital respawn.
- **Polish** — skid, smoke and muzzle-flash particles; synthesized WebAudio sound effects (engine hum, sirens, gunshots) and a simple music loop. No external assets, no network requests, vanilla JavaScript ES modules, plain canvas.

## How to run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot; accelerate, brake and steer while driving |
| Shift | Run |
| E | Enter / exit a car |
| Mouse click | Punch (fists) or shoot (pistol) — aim with the mouse |
| P / Esc | Pause — mission select, save, load |
| Enter / Space | Start / confirm |

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged deterministically from seed 7: the cover chase downtown, on-foot combat at the port, a mission mid-run, and a dusk police escape.

## About this entry

Built for the [gta6-01 competition on make.fun](https://make.fun/bounty/gta6-01) — $1,666 in rewards, top 100 entries paid.

Join make.fun through the referral link: https://make.fun/r/9fsyewfc
