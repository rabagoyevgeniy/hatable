# Implementation status

Updated as systems land. **IMPLEMENTED** = plays and was tested. **PARTIAL** = exists, incomplete. **NOT IMPLEMENTED** = specified, absent.

## P0 HUMAN PLAYTEST BLOCKERS (2026-08-26)

Human tester: the mobile build was not playable. Feature development is stopped until this gate is retested on a phone.

| Blocker | Code status | Human retest |
| --- | --- | --- |
| 1. Mobile must be landscape | **FIXED IN CODE** — portrait overlay «Поверните телефон», gameplay paused, landscape HUD | pending |
| 2. Player must never sink through terrain | **FIXED IN CODE** — feet follow the visual terrain mesh; emergency Y recovery | pending |
| 3. Hab must have real collision | **FIXED IN CODE** — hull walls + airlock corridor; furniture/locker circles | pending |
| 4. Mobile camera + UI playability | **FIXED IN CODE** — landscape FOV 48 / dist ~8.6; compact dock, 2×2 actions, dismissible hint, safe areas | pending |

Harness: `scripts/playability.mjs` (mesh snap, long walk, perimeter, airlock in/out). This does **not** replace a human holding a phone.

## IMPLEMENTED

- Movement, look, gather, craft, place, locker, hammer
- Suit meters: O₂, food, water, warmth
- Sol clock + daylight sky + sunrise/sunset lighting
- Habitat machine: pressure, leak, solar kW, battery kWh, gridOn, inside/outside °C
- Hab console (desk): readout, heater, lights, drink from tank
- Roof array condition + cell replacement with salvaged solar
- Sleep advances Sol and ticks habitat/weather/crops
- Versioned localStorage save: Continue / New Game / autosave
- Still (ice/hydrazine → water **if grid is live**; E at the cream pole with 2 scrap + canvas, ice is fuel)
- **First Sol vertical slice** gated by `scripts/first-sol.mjs`: leak → repair → power → sleep → still → ice → water → drink → crop (headless; browser E-build of the still still unverified in one sitting). Overlay names are not a horizon atlas.
- Plot with persistent moisture / light / temperature; ~4 watered **sleeps** to harvest. Sleep growth is a day, not the night you wake into. Sealed + live grid shelters the crop; heater-off cools that shelter; dead grid uses Mars cold
- Coupled stabilize (harness): storm cuts solar and crop light; grid death freezes plots **and** takes the still offline (no phantom kW on a dead grid) while leftover tank sips and a full flask still work; a blackout home bleeds pressure below suit refill; a cold heater holds a damaged-array blackout through noon; heater-off on a live grid cools the greenhouse; the bunk is not a magic O₂ tank when refill is dead; storm scars the array and can snap the roof cable (wire from the solar wreck). Sleep-through-storm is a diagnosis, not a silent kW drop. MAV cargo and plot water are pockets, not the Hab locker. Storms pause S-band without rewinding the tape.
- Seal patch visual
- Journal 8-step (guidance only; catch-up so a sealed hull is not still «pick scrap»)
- RU/EN, mobile touch, PWA
- **Phone landscape gate:** portrait shows «Поверните телефон» and pauses; landscape HUD (joystick bottom-left, actions 2×2 bottom-right, compact vitals/hotbar). Camera pulled back (FOV 48, dist ~8.6). iPhone safe-area insets.
- **Visual-terrain grounding:** player Y samples the same PlaneGeometry grid the mesh uses (mobile 80 segs, not analytic height under a coarse mesh). Emergency snap if Y falls below terrain. Spawn/save/blackout use the same ground.
- **Hab collision:** cylinder hull blocks; airlock at +Z is the only door; locker/bunk/desk/crates are simple circle blockers. `isInsideHab` is hull+airlock, not a 6.2 m circle.
- Hab interior furniture (bunk/desk/crates)
- Weather state machine CLEAR / DUST / STORM (after first emergency minutes)
- Still requires live Hab grid (night heater vs water)
- Still pump fails after a short run; salvage wire at the solar wreck to repair
- Leak is on the left wall inside the hatch (prompt + steam + plate), not the far back wall
- Browser playtest: leak → patch → console at the tear → bunk sleep (Sol 19→20)
- Hab tank is leftover sips (~2.2 L); last potato is seed until harvest
- Hab mix: leak hiss, sealed hum, heater rumble; grid death is silence

## PARTIAL

- Scanner science (F names expedition sites; ice/soil/wire/comms unlock tools; desk console lists identified samples after the hull is sealed. Place ident, overlay names, loot rings, and station/locker tags share the 22 m scan pulse. Hold-F is not a planet detector. Rover identified as dead, not driven)
- Range estimate (O₂ ∩ warmth ∩ thirst ∩ hunger round-trip; Hab console packing list for wire / Pathfinder / MAV after the hull is sealed; tank sips restore the walk; after Earth the MAV line wants a still flask + a harvested potato in **pockets**, not a desk drink, the last seed, or the Hab locker)
- Weather vs equipment damage (array sandblast + roof cable snap; no remote cable runs / extra machines yet)
- Diegetic HUD (console exists; default HUD still has meters; mobile landscape is compact, not a suit tablet)
- Story / delayed Earth (radio listens on a clear day or a clear-day sleep; storms bury S-band and pause the tape, they do not rewind it. Placing is not Hello, Earth. Journal contact waits for the reply)

## NOT IMPLEMENTED

- Rover (drive/battery/storage)
- Repair diagnostics as a full signature (filter / other machines; still pump is in)
- Remote shelters, cart, suit upgrades
- Escape as an engineering project (MAV is still a place)
- Event director (random fair failures)
- Quality-tier renderer beyond mobile/desktop flags
