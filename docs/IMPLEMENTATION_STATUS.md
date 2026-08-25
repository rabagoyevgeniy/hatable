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
- Still (ice/hydrazine → water, also pipes into Hab tank)
- Plot with persistent moisture / light / temperature factors
- Seal patch visual
- Journal 8-step (guidance only)
- RU/EN, mobile touch, PWA
- Hab interior furniture (bunk/desk/crates)
- Weather state machine CLEAR / DUST / STORM (after ~150s play)

## PARTIAL

- Scanner science (first-scan ident, no lab / recipes from samples yet)
- Range estimate (O₂ round-trip only; no thermal/sunset packing list)
- Weather vs equipment damage (solar derate + cold; no broken cables yet)
- Diegetic HUD (console exists; default HUD still has meters)
- Story / delayed Earth (journal logs only)

## NOT IMPLEMENTED

- Rover (drive/battery/storage)
- Repair diagnostics as a full signature (pump/filter failures)
- Remote shelters, cart, suit upgrades
- Escape as an engineering project (MAV is still a place)
- Event director (random fair failures)
- Quality-tier renderer beyond mobile/desktop flags
