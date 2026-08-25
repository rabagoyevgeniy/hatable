# Architecture

Vite + Three.js r170. Entry: `src/main.js` → `src/game.js`.

| Module | Owns |
| --- | --- |
| `game.js` | renderer, input, camera, interact, save triggers, frame |
| `world.js` | scene, terrain, outposts, stations, clock visuals |
| `player.js` | body, inventory, suit vitals, sleep, O₂ range |
| `systems/habitat.js` | pressure, battery, solar, temperatures, water tank, sleep sim |
| `systems/weather.js` | CLEAR/DUST/STORM → `world.storm` |
| `systems/science.js` | scan discoveries |
| `systems/machines.js` | station faults (still pump) and repair helpers |
| `systems/survival.js` | seed potato + first-Sol thirst/tank pacing |
| `systems/save.js` | localStorage snapshot `stranded-mars-save-v1` |
| `ui.js` / `i18n.js` | HUD, menus, language, Hab console |
| `data.js` | items, recipes, spawns, goals, Hab interact points |
| `journal.js` | linear guidance (not the simulation) |
| `audio.js` | wind / hum / leak hiss / beeps |
| `models.js` / `gfx.js` | GLB + materials |

**Update order each frame (playing):** input → player vitals → `tickTime` → weather visual lerp → `tickWeather` → `tickHabitat` → stations/crops → HUD → render.

**Save boundary:** player vitals/inv/tools/pose, world.hab, weather, science.known, clock, storm, flags, locker, node taken flags, stations (type/pose/water/fuel/grow/moisture), journal index.

Do not grow `game.js` into a god object. New coupled sim goes in `src/systems/`.

**Design decision — battery:** kW integrated as `(net kW × dt × 4.2 h) / 220 s / 7.5 kWh` so a night can empty a weak battery without draining it in two real seconds.
