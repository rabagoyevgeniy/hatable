# Implementation status

Updated as systems land. **IMPLEMENTED** = plays and was tested. **PARTIAL** = exists, incomplete. **NOT IMPLEMENTED** = specified, absent.

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
- **First Sol vertical slice** gated by `scripts/first-sol.mjs`: leak → repair → power → sleep → still → ice → water → drink → crop (headless; browser E-build of the still still unverified in one sitting)
- Plot with persistent moisture / light / temperature; ~4 watered **sleeps** to harvest. Sleep growth is a day, not the night you wake into. Sealed + live grid shelters the crop; dead grid uses Mars cold
- Coupled stabilize (harness): storm cuts solar and crop light; grid death freezes plots; storm scars the array and can snap the roof cable (wire from the solar wreck). Sleep-through-storm is a diagnosis, not a silent kW drop
- Seal patch visual
- Journal 8-step (guidance only; catch-up so a sealed hull is not still «pick scrap»)
- RU/EN, mobile touch, PWA
- Hab interior furniture (bunk/desk/crates)
- Weather state machine CLEAR / DUST / STORM (after first emergency minutes)
- Still requires live Hab grid (night heater vs water)
- Still pump fails after a short run; salvage wire at the solar wreck to repair
- Leak is on the left wall inside the hatch (prompt + steam + plate), not the far back wall
- Browser playtest: leak → patch → console at the tear → bunk sleep (Sol 19→20)
- Hab tank is leftover sips (~2.2 L); last potato is seed until harvest
- Hab mix: leak hiss, sealed hum, heater rumble; grid death is silence

## PARTIAL

- Scanner science (first-scan ident including the solar farm and Pathfinder; dust and distance hide debug loot rings unless you scan; ice/soil/wire scans unlock still fuel, planting, and cable/pump repair — not +12% XP. First-sol array cell stays ungated. No bench lab yet)
- Range estimate (O₂ **and** warmth round-trip; no full sunset packing list yet)
- Weather vs equipment damage (array sandblast + roof cable snap; no remote cable runs / extra machines yet)
- Diegetic HUD (console exists; default HUD still has meters)
- Story / delayed Earth (radio listens on a clear day; storms bury S-band. Placing is not Hello, Earth)

## NOT IMPLEMENTED

- Rover (drive/battery/storage)
- Repair diagnostics as a full signature (filter / other machines; still pump is in)
- Remote shelters, cart, suit upgrades
- Escape as an engineering project (MAV is still a place)
- Event director (random fair failures)
- Quality-tier renderer beyond mobile/desktop flags
