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
- Still (ice/hydrazine → water **if grid is live**, pipes into Hab tank)
- Plot with persistent moisture / light / temperature; ~4 watered **sleeps** to harvest (watering is not a click)
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

- Scanner science (first-scan ident, no lab / recipes from samples yet)
- Range estimate (O₂ round-trip only; no thermal/sunset packing list)
- Weather vs equipment damage (solar derate + cold; no broken cables yet)
- Diegetic HUD (console exists; default HUD still has meters)
- Story / delayed Earth (journal logs only)

## NOT IMPLEMENTED

- Rover (drive/battery/storage)
- Repair diagnostics as a full signature (filter / other machines; still pump is in)
- Remote shelters, cart, suit upgrades
- Escape as an engineering project (MAV is still a place)
- Event director (random fair failures)
- Quality-tier renderer beyond mobile/desktop flags
