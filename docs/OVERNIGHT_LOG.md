# Overnight log

## 2026-08-25 — director brief received

Autonomous overnight mode on. ChatGPT is Game Director. Ignore “stop after Phase 1”; keep going through the loop with quality gates.

### Cycle A — foundation docs + survive-the-first-Sol systems

- Added vision / map / status / architecture / backlog docs
- Habitat simulation: pressure, leak, solar kW, battery, inside/outside C
- Sleep ticks the grid instead of magically ignoring it
- Hab console at the desk
- Versioned localStorage save + Continue
- Tests: smoke, production build, then playtest first-sol loop

### Cycle B — wire Phase 1 into the playable loop (this session)

- Battery accounting fixed (a Sol is compressed hours; night can actually drain)
- HUD shows PRESSURE / BATTERY / POWER DEFICIT / NIGHT instead of a binary LEAK flag
- Desk = Hab console (heater, lights, drink from tank). Bunk = sleep. Whole interior is no longer “press E to sleep”.
- Continue / New Game (WAKE UP clears save)
- Autosave ~22s, on sleep, on place/repair, on pagehide
- Leak hiss inside unsealed Hab; breath swell when O₂ is low
- Damaged roof array visible; salvage a nearby solar cell + E to replace a cell
- Weather CLEAR → DUST (warning) → STORM after the first minutes of play; storms cut solar
- Crops: moisture × light × temperature; watering is not an instant harvest
- Scanner first-ID writes a discovery (ice / soil / leak…), no XP
- Suit O₂ round-trip range on the status line when outside
- Smoke now runs the habitat/weather/science sim, not only string checks

- Browser playtest: WAKE UP, HUD «УТЕЧКА · ДАВЛЕНИЕ ПАДАЕТ», walk on Mars, no JS errors after restoring `motion.js` import

### Cycle C — Hab console findable + first-night pacing

- Inside Hab, E picks the nearest of desk / bunk / locker (airlock locker no longer swallows the room)
- Camera moves closer inside so furniture is readable
- First entry toast: desk right / bunk left
- Console screen pulses while leaking
- Weather waits ~280s so the leak emergency is not also a storm
- Start battery 58%; leaking life-support load slightly lower (heater still the night decision)

### Cycle D — interact tests + first harvest pacing

- Extract `pickInteriorAction` (airlock locker vs desk) and lock it in smoke
- Sleep grows crops from current moisture first, then soil dries — four watered Sols can finish a plant
- Watering still not an instant harvest

### Cycle E — still needs the grid (night decision)

- Distiller produces and fills the Hab tank only while `gridOn`
- Dead battery drops still load so dawn can recover
- Prompt: «ДИСТИЛЛЯТОР СТОИТ — нет сети Hab»; console alert STILL OFFLINE
- Smoke: heater off saves night battery and lets the Hab go cold; still does not fill the tank without grid

### Cycle F — still pump diagnostic

- After ~56s of powered runtime the still pump dies (`fault: "pump"`)
- Repair: hammer + 1 wire + 1 scrap (wire at the solar graveyard)
- Failed pump makes no water and sheds load

### Cycle G — leak findable on the airlock path

- Torn canvas + steam + LEAK plate moved to the LEFT wall just inside the hatch (desk stays right)
- Aisle from the airlock prefers `ЗАЛАТАТЬ УТЕЧКУ` / leak hint while unsealed; walking to the desk still opens the console
- E at the hole with 2 canvas + tape patches without a yard ghost; craft-then-place still works
- First-entry toast names left leak / right console (was a missing `enterHab` string)
- Night feel: leaking + heater spends battery; seal + cut heater saves the night

### Cycle G playtest (browser, localhost)

- HUD: «УТЕЧКА · ДАВЛЕНИЕ ПАДАЕТ»
- Prompt in the aisle: «УТЕЧКА · 2 брезента + скотч из шкафа» then «ЗАЛАТАТЬ УТЕЧКУ» after tape + 2 canvas
- Toast: «КОРПУС ЗАДЕЛАН — давление держится»; pressure held at ~49% then recovered
- Desk console opened: ГЕРМЕТИКА, battery ~43%, load 0.99 kW with heater on
- Heater off: load dropped to 0.49 kW, «ПЕЧЬ ВЫКЛ» — night decision is readable

Next: water/food pacing if the first Sol stays readable. Rover still waits.

### Cycle H — leftover tank + seed potato

- Hab tank starts at 2.2 L (~5 sips at the desk), then ice by the STILL pad and the distiller
- Last uncopied potato cannot be eaten; HUD/toast say it is seed
- Eating a potato dries thirst (toast). After the first sleep you need a tank sip — thirst kills first
- Smoke locks: tank sips, first leak shift can still sleep, seed potato gate

### Cycle H playtest

- Ate one locker potato: toast «картошка сушит. Пей.»; thirst dropped; last tuber stayed in pockets
- Second eat blocked as seed (potato x1 remained)
- Ice prompt «СОБРАТЬ · Лёд» west of the hatch; HUD «ЖАЖДА — глоток из бака на консоли, потом лёд → дистиллятор»

Next: Hab-as-home audio if the gut loop stays stable. Rover still waits.

### Cycle I — Hab sounds like a machine you live in

- Mix is a swell (`setTargetAtTime`), not a hard switch — seal fades hiss, hum comes up
- Heater rumble only while inside + grid + heater on; cutting it is the night decision you hear
- Dead grid silences hum and heater. Sealed walls cut Mars wind
- Console heater/lights click (`switchTone`)
- Smoke locks leak hiss > hum, home hum > hiss, heater off vs grid dead

### Cycle J — first crop is a harvest, not a bottle mash

- Watering a plot only restores moisture; it no longer adds 10% grow
- Realtime growth is a trickle (a standing Sol is not a harvest); four watered sleeps still finish
- Ripe plot shows three tubers and prompt «УРОЖАЙ · 3 КАРТОФЕЛИНЫ»; first pick is a named toast and saves

### Cycle K — seal hands you the console, then the bunk

- After patching the left wall, E is no longer a dead zone: desk range covers the leak so the console opens
- Toast: справа консоль (печь), глубже слева койка
- Locker at the hatch still wins; leaking aisle still prefers the tear

### Cycle K playtest

- Toast after patch: «КОРПУС ЗАДЕЛАН — справа консоль (печь). Глубже слева — койка.»
- E at the left wall opened СИСТЕМЫ HAB without hunting the desk
- Bunk sleep: «СОН — сола меньше до Гермеса», Sol 19→20, O₂ 100, warmth 86; food/water spent

First-Sol path leak → seal → console → sleep is playable. Rover still waits.

### Cycle L — journal follows the hull

- Sealing the Hab completes the scrap card so the order is not «Подбери лом» over a patched tear
- Catch-up skips finished goals in one tick (patch + hammer → water)
- Journal still does not create the sim — it only stops lying about it
- Continue/applySave runs the same catch-up so an old sealed save is not stuck on scrap

### Cycle M — still pad builds like the leak

- On the amber STILL ring with hammer + 2 scrap + canvas + ice, E places the distiller (craft-then-place still works)
- Ice on the west pad is gather until you have the recipe; then the ring is the interact
- Ice is **fuel**, not a construction part — building no longer eats the first ice so the still sits dry

### Cycle N — scrap at the still pad

- Playtest: hammer ate the two spawn scraps; still needs two more and the west ring was a scavenger hunt
- Two starter scrap piles now sit with the canvas/ice on the STILL pad so ice → water is the left side of the hatch, not a second wreck tour

### Cycle O — still pad is findable (prompt, not a raw key)

- `buildStill` was missing from i18n — E on a ready pad showed the key `buildStill`, not «СТАВИТЬ ДИСТИЛЛЯТОР»
- Canvas sat on the amber ring and stole E. Moved west with the extra scrap
- Empty ring with a hammer now hints like the leak: «ДИСТИЛЛЯТОР · молоток + 2 лома + брезент»
- `pickStillPadAction` locked in smoke (build vs hint vs gather-underfoot)
- Fuel/take persist so a sip of ice is not lost on refresh

### Cycle P — still dripping is the interact, not leftover scrap

- After ice fuel, E at the machine is «ДИСТИЛЛЯТОР КАПАЕТ · бак Hab / колба» instead of gathering a nearby pile while the flask fills
- Ice ~3.3 m from the pad still gathers (drip range is tight)
- One ice ≈ one flask + extra sips in the Hab tank (smoke). Toast after fuel names the tank
- Pump still survives a single ice; two ices approach the pump fail clock

### Cycle Q — still pad readable from the hatch

- Playtest with hammer: amber floor ring vanished into Mars dirt; mobile hid the plate
- Empty pads now have a cream ring, a standing «ДИСТИЛЛЯТОР» sign, a pole beacon and a point light (still is hottest)
- Scan names empty amber rings. Taken pads dim and drop the beacon

### Cycle R — stake you can see, not a twig

- Replay: HUD label «ДИСТИЛЛЯТОР» sat on a tiny ground smear — 5 cm pole + fog ate the marker
- Still pad is now a dark plinth, thick unlit stake, lamp, and a double-sided sign that ignores fog

### Cycle R playtest (browser)

- From the Hab: cream stakes read as landmarks; HUD «ДИСТИЛЛЯТОР» sits on a pole, not bare dirt
- Plot pads also stake — the yard is a set of posts, not one camouflaged ring
- Next gate: actually E-build and ice-fuel now that the post is findable

### Cycle S — C again crafts the hammer

- Playtest of E-build died on the craft panel: C / ▶ closed the list with no toast, pockets still had scrap+rock
- Open craft, C (or Craft) again now makes the first ready tool. Ready hammer row says «СДЕЛАТЬ»

### Cycle S playtest (browser)

- C → список, кнопка «СДЕЛАТЬ»; C ещё раз → тост «ГОТОВО · Грубый молоток», молоток в карманах
- Страница иногда «Unresponsive» в этом раннере; стройка still на шесте не дошла — следующий проход

### Cycle T — still interact reaches the pole you can see

- Follow-up: hammer in pockets, cream pole on screen, prompt still «СОБРАТЬ · Камень» because E only armed on the 1.25 m plinth
- Pad range matches the machine (4.2 m): walk to the stake you can see, not a hidden tile under it

### Cycle U — still yard toasts the recipe

- First time you walk the west yard with a hammer: toast names 2 scrap + canvas and E at the pole (ice after), same idea as the leak entry toast

### Cycle U playtest

- C then C still makes the hammer (tool in slot 9). West walk underlined ДИСТИЛЛЯТОР in the world labels
- 1.8s toast vanished during a «Page Unresponsive» wait — hint now also writes the 18s log card; toasts last 3.2s
