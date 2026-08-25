# Systems map (as implemented)

```
TIME (world.clock 0–1 per ~220s)
  → daylight / sun / sky
  → solar kW
  → outside temperature

WEATHER (world.weather.state: clear|dust|storm)
  → world.storm (visuals + audio)
  → solar efficiency
  → outside cold
  → suit O₂ / warmth drain
  → crop light/temp

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
  still (existing + piped)
    → station.water tap
    → hab.waterTank
  plot
    → grow = light × temp × moisture × (soil scan bonus)

PLAYER
  suit O₂, hunger, thirst, warmth
  pockets, hammer, sleep (bunk)
  estimated O₂ round-trip range

SCIENCE
  world.science.known[type] from scanner
  ice → still efficiency
  soil → crop rate

WORLD
  nodes (loot), stations, locker, outposts
```

`world.habSealed` = leak patch (journal + visuals).  
`world.powered` = player built a solar **station** (journal).  
`world.hab.gridOn` = live electrical state.
