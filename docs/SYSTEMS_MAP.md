# Systems map (as implemented)

```
TIME (world.clock 0–1 per ~220s)
  → daylight / sun / sky
  → solar kW
  → outside temperature

WEATHER (world.weather.state: clear|dust|storm)
  → world.storm (visuals + audio)
  → solar efficiency (while it blows)
  → outside cold
  → suit O₂ / warmth drain
  → crop light/temp
  → after grace: sandblasts arrayHealth (permanent until a cell)
  → hard storm snaps roof cable (roof kW = 0 until wire splice)

HABITAT (world.hab)
  leak until seal station
    → pressure
    → Hab O₂ tank
    → suit O₂ while inside (refill only if sealed AND pressure > 0.48)
  solar (damaged roof arrayHealth + placed panels)
    → battery (kWh compressed per Sol)
    → gridOn
  heater / lights (console toggles)
    → load kW
    → inside temperature
    → player warmth while inside
  roof array
    → cableFault: roof kW = 0; HUD names the cable before deficit
    → arrayHealth sandblasted in storms; replace cells
  still (fueled AND grid live)
    → station.water tap
    → hab.waterTank (starts as ~2 L leftover; still is the real supply)
    → extra load on the battery at night
  potatoes
    → eat one; last tuber is seed until harvest
    → eating dries thirst; tank sip at console, then ice → still
  plot
    → grow = light × temp × moisture × (soil scan bonus)
    → sleep uses a day of light (not wake-up night)
    → temp = Hab inside °C if sealed + gridOn, else outside
    → storm cuts light; dead grid freezes the greenhouse

PLAYER
  suit O₂, hunger, thirst, warmth
  pockets, hammer, sleep (bunk)
  round-trip range = min(O₂ time, warmth time) × actual walk / 2
  walk speed shared with the body; storm shove derates the estimate
  solar-wreck wire is outside a storm-night leash

SCIENCE
  world.science.known[type] from scanner
  ice → still efficiency
  soil → crop rate
  solaryard → first ident of the copper/cell wreck (not XP)
  dust/storm hides loot rings unless scanning (starter rings survive the first emergency)

WORLD
  nodes (loot), stations, locker, outposts
```

`world.habSealed` = leak patch (journal + visuals).  
`world.powered` = player built a solar **station** (journal).  
`world.hab.gridOn` = live electrical state.
