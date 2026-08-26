# Architecture

Vite + Three.js r170. Entry: `src/main.js` → `src/game.js`.

| Module | Owns |
| --- | --- |
| `game.js` | renderer, input, camera, interact, save triggers, frame |
| `world.js` | scene, terrain, outposts, stations, clock visuals |
| `player.js` | body, suit vitals, O₂ range; re-exports pocket helpers |
| `systems/inventory.js` | count / add / take / afford (no Three) |
| `systems/habitat.js` | pressure, battery, solar, temperatures, water tank, sleep Sol, crop factors |
| `systems/weather.js` | CLEAR/DUST/STORM → `world.storm`; `applyWeatherState`; storm array/cable damage |
| `systems/science.js` | scan discoveries; ice/soil/wire/comms scans unlock tools; desk lab lines; overlay names gated to ident reach; S-band listen after radio |
| `systems/machines.js` | station records, still pump, headless `placeStationSim` |
| `systems/survival.js` | seed potato, tank sip, bunk `trySleepSol`, suit range (O₂ ∩ warmth), console packing list |
| `systems/firstSol.js` | sequential First Sol + stabilize harness |
| `systems/save.js` | localStorage snapshot `stranded-mars-save-v1` |
| `ui.js` / `i18n.js` | HUD, menus, language, Hab console |
| `data.js` | items, recipes, spawns, goals, Hab interact points |
| `systems/goals.js` | journal catch-up (card follows the hull) |
| `journal.js` | linear guidance (not the simulation) |
| `audio.js` | wind / hum / leak hiss / heater rumble / beeps |
| `models.js` / `gfx.js` | GLB + materials |

**Update order each frame (playing):** input → player vitals → `tickTime` → weather visual lerp → `tickWeather` → `tickHabitat` → stations/crops → HUD → render.

**Save boundary:** player vitals/inv/tools/pose, world.hab, weather, science.known, clock, storm, flags, locker, node taken flags, stations (type/pose/water/fuel/grow/moisture), journal index.

Do not grow `game.js` into a god object. New coupled sim goes in `src/systems/`.

**Design decision — battery:** kW integrated as `(net kW × dt × 4.2 h) / 220 s / 7.5 kWh` so a night can empty a weak battery without draining it in two real seconds.

**Design decision — crop sleep:** `advanceSolSim` grows plots with daylight 0.85 (the Sol you slept), not the night clock you wake into. Temp uses Hab inside °C while sealed + `gridOn`, else outside Mars cold.

**Gate:** `npm run smoke` runs isolated sim checks then `scripts/first-sol.mjs` (leak → crop, then storm/grid coupling).
