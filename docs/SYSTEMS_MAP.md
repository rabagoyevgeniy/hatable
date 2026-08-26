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
    → grow = light × temp × moisture
    → sleep uses a day of light (not wake-up night)
    → temp = Hab inside °C if sealed + gridOn, else outside
    → storm cuts light; dead grid freezes the greenhouse

PLAYER
  suit O₂, hunger, thirst, warmth
  pockets, hammer, sleep (bunk)
  round-trip range = min(O₂ time, warmth time, thirst time, hunger time) × actual walk / 2
  walk speed shared with the body; storm shove derates the estimate
  solar-wreck wire is outside a storm-night leash
  desk packing list: wire / Pathfinder / MAV in-range vs out (only after the hull is sealed; storm night and a dry mouth refuse the long walks)
  leftover Hab tank sips restore packing range — drink, then walk; a tank sip is not a still flask for the MAV
  after Earth, MAV packing wants water + a potato that is not the last seed

SCIENCE
  world.science.known[type] from scanner
  ice scan → still accepts ice as feedstock (not a +12% buff)
  soil scan → plot accepts the seed potato (not a growth buff)
  wire scan → splice the roof cable / rebuild the still pump (first-sol cell replace stays ungated)
  F also identifies a sample in hand / pockets when nothing is underfoot
  desk console lists identified samples (ice/soil/wire/comms) — the lab is the desk, not a new panel; packing and lab stay off until the hull is sealed
  radio listen (after place; storms / night pause S-band)
  pathfinder scan → names the S-band lander (not XP)
  farm / rover / mav scans → name the leftover expedition (rover is not a taxi; MAV is a project)
  comms scan → radio recipe (hammer / still / plot stay ungated)
  contacted after RADIO_CONTACT_S of clear daylight — not on place; a clear-day sleep can finish the listen
  journal «Hello, Earth» waits for contacted, not the radio station
  dust/storm hides loot rings unless scanning **within 22 m** (starter rings survive the first emergency)
  distant (>22 m) rings stay off — even while holding F; walk in
  place ident uses the same 22 m as loot rings — F names the wreck you can see, not the horizon
  scan overlay names a wreck only within that 22 m, or after F; hold-F is not a horizon atlas (Hab stays named)
  scan overlay names loot only within that 22 m; 3D rings match the pulse, not a planet detector
  scan overlay names stations / pads / locker / hatch with the same reach — hold-F is not a radio atlas

WORLD
  nodes (loot), stations, locker, outposts
```

`world.habSealed` = leak patch (journal + visuals).  
`world.powered` = player built a solar **station** (journal).  
`world.hab.gridOn` = live electrical state.
