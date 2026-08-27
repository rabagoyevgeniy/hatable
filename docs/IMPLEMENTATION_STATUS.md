# Implementation status

Updated as systems land. **IMPLEMENTED** = plays and was tested. **PARTIAL** = exists, incomplete. **NOT IMPLEMENTED** = specified, absent.

## P0.1 MOBILE PLAYABILITY (2026-08-27)

Human retest of the control pass: feet were *on* the mesh, but a flat **packedYard** disc covered the astronaut; right stick was inverted (left↔right).

| Item | Code status | Human retest |
| --- | --- | --- |
| packedYard disc | **REMOVED** — no replacement plane/decal. Hab yard is the real terrain mesh | pending |
| Right stick direction | **FIXED IN CODE** — thumb right looks right (yaw decreases at spawn); up looks up; matches mouse `camYaw -= movementX` | pending |
| Dual-stick feel | **TUNED IN CODE** — dead 0.11, curve 1.28, damp 16, follow exp(-16 dt), equal stick sizes on landscape | pending |

**AUTOMATED VERIFIED:** `scripts/playability.mjs` — packedYard absent; lookRates player-view signs; forward facing −Z at yaw=0; mesh grounding; airlock; hab→lab. `npm run smoke`.

**HUMAN PHONE TEST REQUIRED:** walk the old yard footprint, both sticks at once, circle the Hab, enter/exit airlock, idle orbit, run away and see the back.

**Do not begin Rover or new survival/scan-gates until a human approves this pass.**

## P0 PLAYER CONTROL & WORLD SCALE (2026-08-26)

Previous pass (still in the build): mesh grounding, dual-stick layout, third-person behind/above, station scale, spatial still. Human retest then found packedYard + inverted look stick — see P0.1 above.

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
- **Phone landscape gate:** portrait shows «Поверните телефон» and pauses; landscape HUD (left move stick, right look stick, large Interact). Camera behind the astronaut (FOV 42, dist ~15.4). iPhone safe-area insets.
- **Visual-terrain grounding:** player Y samples the same PlaneGeometry bilinear the mesh uses (mobile 96 segs). Three.js vertex Z is `iy * cell - half`. Feet sit on mesh + 7 cm. Emergency snap if Y falls below terrain. Spawn/save/blackout use the same ground. Camera does not hide sink. The flat packedYard disc is gone so it cannot cover the astronaut.
- **Hab station:** living module (~6.8 m radius) + dedicated airlock + west lab/tube + greenhouse silhouette + yard solar + antenna + night beacon. Hull walls block; airlock at +Z is the only door; lab tube is a second interior. Locker/bunk/desk/crates are circle blockers.
- **Distiller:** spatial pump hiss (distance + stereo pan), silent when off; steam/lamp/spin when working. Prompts: ICE → WATER / LOAD ICE / COLLECT WATER. QA plates remain.
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
