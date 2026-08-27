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

### Cycle V — airlock is a door you can name

- Playtest had hammer, tape, 2 canvas and stared at the exterior leak tag — never found the mouth
- Standing «ШЛЮЗ» sign on the hatch facing spawn; outside E is «ШЛЮЗ · рваный брезент СЛЕВА внутри» unless a pile is underfoot

### Cycle V playtest (browser)

- From spawn the hatch mouth shows **ARES III** and **ШЛЮЗ** together; locker to the right
- Did not finish patch this sitting (still on «Подбери лом»). Door is named; next sitting walks in and E the left tear

### Cycle W — First Sol closed by a headless harness

Director: finish the vertical slice; max two browser playtests; if Pointer Lock / Page Unresponsive hangs, do not polish geometry for the agent. Gate is a deterministic chain, then continue Master Vision.

- `scripts/first-sol.mjs` runs leak → repair → power → sleep → still → ice → water → drink → crop on the live sim (no Three)
- Sleep / tank sip / inventory / station place extracted so the harness cannot import `player.js` / `world.js`
- Crop sleep uses a **day** of growth, not the night you wake into. Sealed + live grid is a greenhouse; dead grid / open hull uses Mars-outside cold
- Stabilize gate (same runner): storm cuts solar, storm slows crops, grid death freezes the plot, dry soil is slower than watered
- `npm run smoke` now includes the first-sol runner. No new HUD/geometry polish

Browser E-build of the still is still unverified in a sitting. The sim chain is green. Rover still waits.

### Cycle W — Master Vision after the gate

- Coupled loop is now testable: dust/storm → kW → battery → `gridOn` → crop temp
- Next deepen: equipment damage in storms (cables), not rover, not Pathfinder

### Cycle X — storm leaves scars

Overnight loop: First Sol is gated; do not rewind to the desk/night checklist. Deepen **stabilize**.

- After the first ~280 s, a **storm** sandblasts `arrayHealth` (dust only derates kW while it blows)
- ~44 s of hard storm snaps the roof **cable** — roof kW goes to 0 until E-splice with hammer + wire at the array (wire still lives at the solar graveyard)
- Yard solar station bypasses a dead roof cable. Console says CABLE, not a silent blackout
- First-sol leak minutes are protected. Harness: grace, dust-is-not-a-scar, scar remains after clear, splice, yard bypass
- No rover. No Pointer Lock playtest this cycle

### Cycle Y — the snap is the diagnosis

Overnight timer still listed the old desk/night checklist. Repo: First Sol gated, storms already scar. Next was “felt in play.”

- HUD names **КАБЕЛЬ МАССИВА** before generic POWER DEFICIT
- Sleeping through a storm snaps the cable and scars the array (harness)
- Rising-edge toast + HAB log: wire at the solar wreck. Roof cells go dark while the cable is open
- Save does not replay the snap toast
- No rover. No Pointer Lock playtest

### Cycle Z — the wire run is a leash

Overnight timer still listed desk/night. Repo: cable is a diagnosis. Next P1 was “felt in play” as a walk, not a rover.

- Suit range is now the tighter of O₂ and warmth (storm night is cold, not just thin air)
- HUD no longer floors the number at 0.1 km, so a suicide walk does not look safe
- Harness: clear day reaches the solar-wreck wire; storm night does not. Distance is the splice cost
- No rover. No Pointer Lock playtest

### Cycle AA — range is the walk you actually do

Overnight timer still listed desk/night. Repo: wire run exists but `WALK_MPS` was 3.05 while the body wishes 5.8.

- One walk constant for body and the range line
- Storm above 0.4 derates the estimate the way wind shoves you
- Starve / freezing slowdowns are in the number, not only in the legs
- Harness still: clear day reaches wire; storm night does not
- No rover. No Pointer Lock playtest

### Cycle AB — dust eats the debug rings

Overnight timer still listed desk/night. Repo: stabilize leash is honest. Next vision beat is **understand** (scanner), not rover.

- Loot rings vanish in dust/storm unless you hold F / Scan. The pile is still there; the cheat stick is not
- Starter cyan rings stay for the first ~280 s leak emergency
- Wire at the solar wreck is not starter — after a storm you scan for it, you do not follow a glowing cookie
- No rover. No Pointer Lock playtest

### Cycle AC — scan names the solar farm

Overnight timer still listed desk/night. Repo: dust hides rings. Next understand beat: the wreck is a place, not XP.

- F at the solar graveyard identifies the farm (spare cells + copper for the roof cable). Repeat scan is silent
- Wire underfoot still scans as wire. Shared `pickScanTarget` in the harness
- No rover. No Pointer Lock playtest

### Cycle AD — distant wrecks have no cookie in clear weather

Overnight timer still listed desk/night. P2: drop loot rings in clear weather too — but keep the yard.

- Further than 22 m, non-starter rings stay off until you scan or walk in. Solar-wreck wire is a landmark + F, not a glow on the horizon
- Yard ice/canvas still ring on a clear day. Dust still eats everything without scan
- No rover. No Pointer Lock playtest

### Cycle AE — scan is a recipe, not a buff

Overnight timer still listed desk/night. Repo: First Sol gated, scanner is a mode. P2 leftover was lab/recipes from samples.

- Unscanned ice in the still is a diagnosis (`F` identify), not fuel. Unscanned soil will not take the last potato
- F identifies a sample in hand / pockets when nothing is underfoot. The solar farm ident still beats a pocket sample
- Removed the +12% ice/soil rate bonuses — discovery unlocks the tool, not XP
- First-sol chain still leak → crop; ice and crop steps now require the scan
- No rover. No Pointer Lock playtest

### Cycle AF — copper is a recipe for the splice

Overnight timer still listed desk/night. Repo: ice/soil scans unlock tools. Next understand×stabilize beat: the wreck's copper, not another XP bump.

- Unidentified wire will not splice the roof cable or rebuild the still pump — F names copper first
- First-sol array cell stays ungated (pressure/power emergency is not a science quiz)
- Farm ident still beats a pocket sample. No rover. No Pointer Lock playtest

### Cycle AG — Earth is delayed, not a checkbox

Overnight timer still listed desk/night. P2 leftover after copper: delayed Earth after radio.

- Placing the Pathfinder radio starts an S-band listen. It does not set `contacted`
- Dust/storm and night pause the uplink. ~48 s of clear daylight (or a clear-day sleep) reaches Earth and raises a Hab log
- Sleeping through a storm misses Earth. Console names LISTEN / DUST / NIGHT / EARTH
- No rover. No Pointer Lock playtest

### Cycle AH — Pathfinder is a longer leash

Overnight timer still listed desk/night. Repo: Earth is delayed. Next reconnect beat: the walk, not a rover.

- F at Pathfinder names the lander and the S-band job. Comms underfoot still scan as the board. Repeat is silent
- Round trip is past the solar-wreck wire run. Clear day reaches; storm night does not
- No rover. No Pointer Lock playtest

### Cycle AI — the comms board is the radio recipe

Overnight timer still listed desk/night. Repo: Pathfinder is a leash. Next reconnect beat: scan unlocks the radio, not a craft checkbox.

- Unidentified comms board will not craft a radio. Hammer, still hull, and plot stay ungated for First Sol
- F the board (S-band), then C. Repeat scan is not XP. No rover. No Pointer Lock playtest

### Cycle AJ — leftover wrecks have names

Overnight timer still listed desk/night. Repo: radio is a recipe. F at the soil flats / rover / MAV was silent — a landmark with no ident.

- Soil flats name perchlorate. Rover wreck says batteries dead, not a taxi. MAV says ascent is a project
- Loot underfoot still wins. MAV is the longest leash: past Pathfinder, clear day reaches, storm night does not
- Did not start driving the rover. No Pointer Lock playtest

### Cycle AK — ident reach matches the ring

Overnight timer still listed desk/night. Repo: wrecks have names, but F stopped at 16 m while rings live to 22 m — a glow with no ident.

- Place ident uses the same 22 m as loot rings. Beyond that a pocket sample wins; the farm is not a horizon cheat
- No rover. No Pointer Lock playtest

### Cycle AL — the desk is the lab

Overnight timer still listed desk/night. P2 leftover: lab / samples. Do not add a new panel.

- Identified ice / soil / wire / comms / hydrazine write onto the Hab console. Empty desk stays empty
- Field toast still names the sample; the desk is where you review the recipe. No rover. No Pointer Lock playtest

### Cycle AM — the desk packs the walk

Overnight timer still listed desk/night. Range line existed; the packing list did not.

- Hab console lists wire / Pathfinder / MAV as IN RANGE or OUT OF RANGE from current O₂ and warmth. Storm night refuses the long walks
- No new HUD meters. No rover. No Pointer Lock playtest

### Cycle AN — leaking desk is not a packing list

Overnight timer still listed desk/night. Repo: packing list shipped. A leaking Hab console naming the MAV is clutter.

- Packing lines stay off until the hull is sealed. Pressure emergency is still pressure
- No rover. No Pointer Lock playtest

### Cycle AO — overlay is not a horizon atlas

Overnight timer still listed desk/night. Repo: ident reach is 22 m, but hold-F painted Pathfinder / MAV names out to 42 m.

- Overlay names a wreck only within ident reach, or after F. Hab stays home. Scanning is not an atlas
- No rover. No Pointer Lock playtest

### Cycle AP — overlay is not a loot inventory

Overnight timer still listed desk/night. Repo: wreck names gated; loot tags still printed ICE / WIRE to 48 m while F is held. The scan pulse is already 22 m.

- Overlay names a pile only inside ident/ring reach. Distant 3D rings may still glint; they do not caption copper
- No rover. No Pointer Lock playtest

### Cycle AQ — scan pulse is not a planet detector

Overnight timer still listed desk/night. Repo: overlay names gated to 22 m, but hold-F still lit 3D loot rings on the far wreck.

- Scan-mode rings share ident/pulse reach. Dust still hides yard rings unless F is in range. Walk to the wreck
- No rover. No Pointer Lock playtest

### Cycle AR — range includes the gut

Overnight timer still listed desk/night. Repo: scanner reach closed. Packing list still treated a thirsty EVA as an O₂ problem.

- Round-trip range is min(O₂, warmth, thirst, hunger). Dry mouth refuses Pathfinder on a clear day. No new HUD meters
- No rover. No Pointer Lock playtest

### Cycle AS — desk sip packs the walk

Overnight timer still listed desk/night. Repo: range includes gut. Thirsty packing refused Pathfinder, but the leftover tank was not the fix in the harness.

- Two console sips put Pathfinder back in range. An empty tank does not. No new HUD meters
- No rover. No Pointer Lock playtest

### Cycle AT — sleep can finish Earth; the journal waits

Overnight timer still listed desk/night. Repo: desk sip packs the walk. Reconnect leftover: clear-day sleep already ticked S-band, but the harness only locked storm-sleep-misses.

- Sleeping a clear noon finishes the listen and names EARTH on the desk. Placing the radio does not complete «Hello, Earth»
- No rover. No Pointer Lock playtest

### Cycle AU — MAV packing wants cargo

Overnight timer still listed desk/night. Repo: journal waits for Earth. Escape still needs water + potato, but the desk treated range as the win.

- After Earth, the MAV line is NO CARGO until pockets hold water and a potato. Storm night still refuses the walk. No rover
- No Pointer Lock playtest

### Cycle AV — the last seed is not MAV cargo

Overnight timer still listed desk/night. Repo: MAV packing wanted a potato. The last tuber is seed until harvest — walking it to Schiaparelli is eating the farm.

- Desk NO CARGO and the escape card both wait for a harvested copy. No rover
- No Pointer Lock playtest

### Cycle AW — overlay is not a station atlas

Overnight timer still listed desk/night. Repo: last seed is not MAV cargo. Hold-F still captioned Radio / Locker across the map.

- Stations, pads, locker, and hatch share the ident/pulse name gate. Scanning is not a waypoint list
- No rover. No Pointer Lock playtest

### Cycle AX — leaking desk is not a lab

Overnight timer still listed desk/night. Repo: packing stays off until sealed; identified ice still printed FEEDSTOCK on a dying hull.

- Lab lines wait for the patch. Pressure emergency is still pressure
- No rover. No Pointer Lock playtest

### Cycle AY — overnight prompt matches the repo

Timer still listed desk/night. Repo: First Sol is closed in sim; scanner is not an atlas; range includes gut; leaking desk is not packing/lab; MAV wants harvested cargo.

- Next high-value is not another micro-gate. Suit tablet needs a real player. Storm→wire and still E-build need human eyes. Rover waits
- No Pointer Lock playtest

### Cycle AZ — tank sip is not a MAV flask

Overnight timer: hunt couplings, no new HUD. Desk drink packs thirst for Pathfinder; escape still needs a still flask in pockets.

- Hydrated + harvested without `inv.water` stays NO CARGO. No rover
- No Pointer Lock playtest

### Cycle BA — dead grid kills the still, not the leftover tank

Overnight: hunt couplings, no new HUD. Storm → battery → grid death already froze crops; the still went with it, but the tank sip did not.

- Fueled still is offline without `gridOn`. Desk leftover sips still wet the mouth. No rover
- No Pointer Lock playtest

### Cycle BB — dead grid does not steal a full flask

Overnight: hunt couplings, no new HUD. Tank sips survived grid death; water already in the still flask is physical too.

- E on a full flask is still-take even when `gridOn` is false. Empty fueled still waits. No rover
- No Pointer Lock playtest

### Cycle BC — dead still does not phantom-load the grid

Overnight: hunt couplings, no new HUD. Grid death already froze the still, the flask, and the tank trickle — but noon still drew 0.32 kW with nothing to show for it.

- Fueled still loads the battery only while `gridOn`. Dawn recovery is not slower because an offline machine is sitting in the yard. Live grid still draws. No rover
- No Pointer Lock playtest

### Cycle BD — dead grid steals the indoor refill

Overnight: hunt couplings, no new HUD. A patched hull is not free O₂ if life support is dark. Dead-grid bleed already floored at 0.42; the suit refill asked for > 0.48.

- `habCanRefillSuit` is sealed ∩ pressure. Night blackout crosses that line; a leaking hull never refills. No new HUD. No rover
- No Pointer Lock playtest

### Cycle BE — cold heater holds the noon blackout

Overnight: hunt couplings, no new HUD. First Sol already taught heater-off saves the night. A cold dead Hab still calls for 0.5 kW at noon, and the starting array cannot climb that hill.

- Heater left on keeps `gridOn` false through a Sol of sun. Shedding it lets noon recover. No new HUD. No rover
- No Pointer Lock playtest

### Cycle BF — bunk is not a magic O₂ tank

Overnight: hunt couplings, no new HUD. Standing inside already needed sealed ∩ pressure. The bunk still filled to 100 on a sealed flag, even after a blackout bled the house below refill.

- `trySleepSol` uses `habCanRefillSuit`. Live First Sol bunk still fills. Blackout and leak share the trickle. No rover
- No Pointer Lock playtest

### Cycle BG — locker is not your hands

Overnight: hunt a different coupling, not another grid-death lock. MAV cargo and plot water already read pockets; the crate was untested.

- Empty pockets at the MAV with a full locker stay NO CARGO / not escape. Plot E waters only with a flask in hand. No new HUD. No rover
- No Pointer Lock playtest

### Cycle BH — storm pauses S-band, it does not rewind

Overnight: not another grid or locker lock. Storms already buried Earth; they did not say whether a half-heard reply survived the dust.

- Half listen + storm + clear finishes without starting over. `listenS` holds. No new HUD. No rover
- No Pointer Lock playtest

### Cycle BI — heater-off cools the greenhouse

Overnight: not another dead-grid / locker / S-band lock. First Sol already traded heater for night battery. The plot uses Hab inside °C while sealed ∩ live grid — that air cools when the stove is off.

- Live grid + heater-off slows sleep growth vs a warm house, and still beats Mars-outside. No new HUD. No rover
- No Pointer Lock playtest

### 2026-08-27 — P0.1 packedYard + inverted look stick

Human playtest: astronaut looked buried around Hab; right stick left/right was inverted.

- Removed `packedYard` (`CircleGeometry` 32 m disc at Hab height). It was a second flat mesh over the real dunes, so feet on terrain still vanished under the disc. No replacement plane.
- Look stick now matches mouse: thumb right looks right (`yawRate` negative at +stickX; camera at +Z, screen-right is +X). Up/down: thumb up lowers pitch (look skyward).
- Tuning: dead 0.11, curve 1.28, damp 16, camera follow `1-exp(-16 dt)`, equal 104 px sticks on landscape.
- Automated: playability lookRates + packedYard absent + grounding/airlock. Human phone still required for dual-stick feel.
- STOP. No rover.








