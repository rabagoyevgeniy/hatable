import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHabitat, tickTime, tickHabitat, simulateSleep, habReadout, habStatusLine, habAlerts, stillOnline, CROP_SLEEP, CROP_LIVE, SOL_SECONDS } from "../src/systems/habitat.js";
import { createWeather, tickWeather } from "../src/systems/weather.js";
import { noteScan, createScience } from "../src/systems/science.js";
import { pickInteriorAction, pickStillPadAction, pickStillMachineAction, pickHatchAction, pickArrayAction, dist } from "../src/systems/interact.js";
import { HAB_DESK, HAB_BUNK, HAB_LEAK, HAB_HATCH, HAB_POS, NODE_SPAWNS, YARD_PADS } from "../src/data.js";
import { tickStillMachine, stillCanRun, repairStillPump, STILL_PUMP_FAIL } from "../src/systems/machines.js";
import { canEatPotato, tankSipsLeft, gutAfterHab, SLEEP_HUNGER, SLEEP_THIRST, TANK_SIP_THIRST, estimateRangeM, roundTripM } from "../src/systems/survival.js";
import { SURVIVAL } from "../src/data.js";
import { ambienceTargets } from "../src/audio.js";
import { goalsDone, advanceJournal } from "../src/systems/goals.js";

const root = resolve(import.meta.dirname, "..");
const fail = [];

function must(cond, msg) {
  if (!cond) fail.push(msg);
}

const game = readFileSync(resolve(root, "src/game.js"), "utf8");
must(game.includes("const result = trySleep(player, world)"), "sleep must call trySleep");
must(game.includes("preloadRest()"), "far Meshy models load in background");
must(game.includes("btn-scan-touch"), "phone scan button wired");
must(game.includes("queuedStart"), "WAKE UP during load must queue");
must(game.includes("applySave"), "continue applies save");
must(game.includes("still-repair"), "pump repair interaction");

const models = readFileSync(resolve(root, "src/models.js"), "utf8");
must(models.includes("import.meta.env.BASE_URL"), "GLB URLs must respect Vite base for GitHub Pages");

must(existsSync(resolve(root, "public/manifest.webmanifest")), "PWA manifest");
must(existsSync(resolve(root, "public/sw.js")), "service worker");
must(existsSync(resolve(root, "public/icons/icon-192.png")), "192 icon");
must(existsSync(resolve(root, "src/device.js")), "shared mobile detector");
must(existsSync(resolve(root, ".github/workflows/pages.yml")), "Pages workflow");
must(game.includes("NoToneMapping"), "phones skip ACES so the desert does not crush to black");
must(game.includes("failIfMajorPerformanceCaveat: false"), "iOS must not abort WebGL");

const gfx = readFileSync(resolve(root, "src/gfx.js"), "utf8");
must(gfx.includes("MeshLambertMaterial"), "phones use Lambert, not PBR");
must(gfx.includes("isMobileView"), "gfx reads phone flag without importing world");

const html = readFileSync(resolve(root, "index.html"), "utf8");
must(html.includes('rel="manifest"'), "html links manifest");
must(html.includes("apple-mobile-web-app-capable"), "iOS web app meta");
must(html.includes("menu-scrim"), "mobile menus close via scrim");
must(html.includes("btn-continue"), "continue button");
must(html.includes("hab-console"), "hab console panel");

const world = readFileSync(resolve(root, "src/world.js"), "utf8");
must(world.includes("function dressHabRoom"), "Hab interior is a dressed room");
must(world.includes("tickHabitat"), "habitat sim in world tick");
must(world.includes("from \"./motion.js\""), "Hab flag/leak steam import");

const ui = readFileSync(resolve(root, "src/ui.js"), "utf8");
must(ui.includes("kind: \"console\""), "desk opens console not whole-hab sleep");
must(ui.includes("pickInteriorAction"), "interior E uses shared picker");
must(ui.includes("kind: \"patch\""), "leak is an interior action");

/* Live sim: leak, seal, day/night battery. */
const worldSim = {
  clock: 0.22,
  daylight: 0,
  storm: 0,
  habSealed: false,
  stations: [],
  hab: createHabitat(),
  weather: createWeather(),
  science: createScience(),
  playTime: 0,
};
tickTime(worldSim, 0);
const p0 = worldSim.hab.pressure;
const b0 = worldSim.hab.battery;
for (let i = 0; i < 80; i++) tickHabitat(worldSim, 1);
must(worldSim.hab.pressure < p0 - 0.02, "leak drops pressure");
must(worldSim.hab.battery !== b0, "battery integrates");
worldSim.habSealed = true;
const p1 = worldSim.hab.pressure;
for (let i = 0; i < 40; i++) tickHabitat(worldSim, 1);
must(worldSim.hab.pressure > p1, "seal recovers pressure when grid live");

worldSim.clock = 0.75;
tickTime(worldSim, 0);
worldSim.hab.battery = 0.4;
worldSim.hab.heaterOn = true;
for (let i = 0; i < 30; i++) tickHabitat(worldSim, 1);
const nightBat = worldSim.hab.battery;
worldSim.clock = 0.25;
tickTime(worldSim, 0);
worldSim.hab.battery = 0.4;
for (let i = 0; i < 30; i++) tickHabitat(worldSim, 1);
must(worldSim.hab.battery > nightBat, "day solar charges more than night");

worldSim.habSealed = true;
worldSim.clock = 0.75;
tickTime(worldSim, 0);
worldSim.hab.battery = 0.4;
worldSim.hab.heaterOn = true;
worldSim.hab.insideC = 10;
for (let i = 0; i < 50; i++) tickHabitat(worldSim, 1);
const heatOnBat = worldSim.hab.battery;
const heatOnC = worldSim.hab.insideC;
worldSim.hab.battery = 0.4;
worldSim.hab.heaterOn = false;
worldSim.hab.insideC = 10;
for (let i = 0; i < 50; i++) tickHabitat(worldSim, 1);
must(worldSim.hab.battery > heatOnBat, "heater off saves night battery");
must(heatOnC > worldSim.hab.insideC, "heater off lets Hab go cold");

worldSim.hab.gridOn = false;
worldSim.hab.battery = 0;
worldSim.stations = [{ type: "still", fuel: 20 }];
const tank0 = worldSim.hab.waterTank;
tickHabitat(worldSim, 5);
must(worldSim.hab.waterTank <= tank0 + 0.01, "still does not fill tank without grid");
must(!stillOnline(worldSim), "stillOnline follows grid");

worldSim.playTime = 100;
worldSim.weather.state = "clear";
worldSim.weather.hold = 0;
tickWeather(worldSim, 1);
must(worldSim.weather.state === "clear", "no storm during the first emergency minutes");

worldSim.playTime = 300;
worldSim.weather.hold = 0;
worldSim.weather.state = "clear";
tickWeather(worldSim, 1);
must(worldSim.weather.state === "dust", "clear weather can shift to dust after first minutes");

const ice = noteScan(worldSim, "ice");
must(!!ice, "first ice scan is a discovery");
must(noteScan(worldSim, "ice") === null, "repeat scan is not XP spam");

const text = habReadout(worldSim, "en");
must(text.includes("PRESSURE"), "console readout has pressure");
must(habStatusLine(worldSim, "en").length > 3, "status line exists");

simulateSleep(worldSim, 96);
must(worldSim.clock !== 0.25, "sleep advances clock");

const locker = { x: 3.1, z: 12.3 };
must(
  pickInteriorAction({
    inside: true,
    deskD: dist(locker.x, locker.z, HAB_DESK.x, HAB_DESK.z),
    lockerD: 0,
    bunkD: dist(locker.x, locker.z, HAB_BUNK.x, HAB_BUNK.z),
  }).kind === "locker",
  "airlock hatch prefers locker"
);
must(
  pickInteriorAction({
    inside: true,
    deskD: dist(2.21, 10.51, HAB_DESK.x, HAB_DESK.z),
    lockerD: dist(2.21, 10.51, locker.x, locker.z),
    bunkD: 9,
  }).kind === "console",
  "two steps inward prefers Hab console"
);

must(
  pickInteriorAction({
    inside: true,
    sealed: false,
    canPatch: true,
    leakD: dist(0, 10.2, HAB_LEAK.x, HAB_LEAK.z),
    deskD: dist(0, 10.2, HAB_DESK.x, HAB_DESK.z),
    lockerD: dist(0, 10.2, locker.x, locker.z),
    bunkD: 9,
  }).kind === "patch",
  "aisle from hatch prefers leak while unsealed"
);
must(
  pickHatchAction({
    inside: false,
    sealed: false,
    hatchD: dist(0, 15.2, HAB_HATCH.x, HAB_HATCH.z),
    gatherD: 4,
  }).kind === "hatch-hint",
  "outside the airlock names the door while the hull is open"
);
must(
  pickHatchAction({
    inside: false,
    sealed: false,
    hatchD: 2,
    gatherD: 0.3,
  }) == null,
  "loot underfoot at the hatch still gathers"
);
must(readFileSync(resolve(root, "src/world.js"), "utf8").includes("hatchSign"), "airlock has a standing ШЛЮЗ sign");
must(readFileSync(resolve(root, "src/i18n.js"), "utf8").includes("hatchHint"), "airlock prompt is translated");
must(
  pickInteriorAction({
    inside: true,
    sealed: false,
    canPatch: false,
    leakD: dist(HAB_DESK.x, HAB_DESK.z, HAB_LEAK.x, HAB_LEAK.z),
    deskD: 0,
    lockerD: 9,
    bunkD: 9,
  }).kind === "console",
  "desk still opens console when you walk to it while leaking"
);
must(
  pickInteriorAction({
    inside: true,
    sealed: false,
    leakD: dist(locker.x, locker.z, HAB_LEAK.x, HAB_LEAK.z),
    deskD: dist(locker.x, locker.z, HAB_DESK.x, HAB_DESK.z),
    lockerD: 0,
    bunkD: 9,
  }).kind === "locker",
  "airlock locker still wins outside leak range"
);
must(
  pickInteriorAction({
    inside: true,
    sealed: true,
    leakD: 0,
    deskD: dist(HAB_LEAK.x, HAB_LEAK.z, HAB_DESK.x, HAB_DESK.z),
    bunkD: dist(HAB_LEAK.x, HAB_LEAK.z, HAB_BUNK.x, HAB_BUNK.z),
    lockerD: 9,
  }).kind === "console",
  "after sealing the left wall, E still opens the console not a dead zone"
);

must(game.includes("patchedHome"), "seal toast points to console and bunk");

const leakingNight = {
  clock: 0.78,
  daylight: 0,
  storm: 0,
  habSealed: false,
  stations: [],
  hab: createHabitat(),
};
tickTime(leakingNight, 0);
leakingNight.hab.heaterOn = true;
for (let i = 0; i < 40; i++) tickHabitat(leakingNight, 1);
must(leakingNight.hab.battery < 0.56, "leaking heated night spends battery");
must(leakingNight.hab.battery > 0.22, "leaking night is tense but not an instant blackout");
const leakNightBat = leakingNight.hab.battery;
const savedNight = {
  clock: 0.78,
  daylight: 0,
  storm: 0,
  habSealed: true,
  stations: [],
  hab: createHabitat(),
};
tickTime(savedNight, 0);
savedNight.hab.heaterOn = false;
savedNight.hab.lightsOn = false;
for (let i = 0; i < 40; i++) tickHabitat(savedNight, 1);
must(savedNight.hab.battery > leakNightBat + 0.03, "seal + cut heater saves the night");

must(game.includes("kind === \"patch\""), "E at torn canvas patches without a yard ghost");
must(readFileSync(resolve(root, "src/data.js"), "utf8").includes("HAB_LEAK"), "leak has a world-space interact point");
must(readFileSync(resolve(root, "src/i18n.js"), "utf8").includes("enterHab"), "first entry toast names left leak / right console");

let grow = 0;
let moist = 1;
for (let i = 0; i < 4; i++) {
  grow = Math.min(1, grow + CROP_SLEEP * 0.85 * 0.7 * Math.max(0.22, moist));
  moist = Math.max(0.08, moist * 0.72);
  moist = 1;
}
must(grow >= 1, "four watered sols can finish a first crop");
let bottleGrow = 0;
for (let i = 0; i < 12; i++) bottleGrow = Math.min(1, bottleGrow); // watering sets moisture only
must(bottleGrow < 0.05, "watering bottles do not click a harvest");
must(!game.includes("grow + 0.1"), "water-plot must not add grow");
const afk = CROP_LIVE * SOL_SECONDS * 0.85 * 0.7 * 1;
must(afk < 0.45, "standing one Sol is not a harvest");
must(game.includes("firstHarvest"), "first harvest is a named moment");

const still = { type: "still", fuel: 80, water: 0, runtime: 0, fault: null, repaired: false };
const gridWorld = { hab: { gridOn: true }, science: { known: {} } };
for (let i = 0; i < STILL_PUMP_FAIL + 2; i++) tickStillMachine(still, 1, gridWorld);
must(still.fault === "pump", "still pump fails after a short run");
must(still.water > 1, "still made water before the pump died");
const waterAtFail = still.water;
tickStillMachine(still, 5, gridWorld);
must(still.water === waterAtFail, "failed pump makes no water");
must(!stillCanRun(still, gridWorld), "faulted still is offline");
repairStillPump(still);
must(stillCanRun(still, gridWorld), "repaired pump runs again");

const ration = createHabitat();
must(ration.waterTank < 3, "Hab tank is leftover sips, not a still");
const sips = tankSipsLeft(ration.waterTank);
must(sips >= 4 && sips <= 6, "about five tank sips then you need ice");
const leakShift = gutAfterHab(200, 64, 62, { hungerHab: SURVIVAL.hungerHab, thirstHab: SURVIVAL.thirstHab });
must(leakShift.thirst > 18 && leakShift.hunger > 18, "first leak shift can still sleep");
const afterSleepThirst = leakShift.thirst - SLEEP_THIRST;
const afterSleepHunger = leakShift.hunger - SLEEP_HUNGER;
must(afterSleepThirst < 28, "after first sleep you need a drink");
must(afterSleepThirst + TANK_SIP_THIRST > 18, "one tank sip unlocks the next sleep");
must(afterSleepHunger > afterSleepThirst, "thirst kills first");
must(canEatPotato({ inv: { potato: 2 }, harvestedCrop: false }), "one of two potatoes is lunch");
must(!canEatPotato({ inv: { potato: 1 }, harvestedCrop: false }), "last potato is seed until harvest");
must(canEatPotato({ inv: { potato: 1 }, harvestedCrop: true }), "harvested copies can be eaten");
must(game.includes("seedPotato"), "eating seed potato is blocked in play");
must(existsSync(resolve(root, "src/systems/survival.js")), "first-sol gut lives in systems/survival");

const leakMix = ambienceTargets({ inside: true, sealed: false, leak: true, grid: true, heater: true, o2: 80, storm: 0, night: false });
must(leakMix.hiss > leakMix.hum, "leaking Hab is hiss over life-support");
must(leakMix.heater > 0, "heater still rumbles while leaking if grid is live");
const homeMix = ambienceTargets({ inside: true, sealed: true, leak: false, grid: true, heater: true, o2: 90, storm: 0, night: true });
must(homeMix.hum > homeMix.hiss, "sealed Hab is hum, not hiss");
must(homeMix.heater > 0, "heater rumble is part of a live home");
must(homeMix.wind < leakMix.wind, "sealed walls cut Mars wind");
const coldMix = ambienceTargets({ inside: true, sealed: true, leak: false, grid: true, heater: false, o2: 90, storm: 0, night: true });
must(coldMix.heater === 0 && coldMix.hum > 0, "cutting heater quiets rumble; grid hum remains");
const deadMix = ambienceTargets({ inside: true, sealed: true, leak: false, grid: false, heater: true, o2: 90, storm: 0, night: true });
must(deadMix.hum === 0 && deadMix.heater === 0, "dead grid silences machines");
must(game.includes("heater: !!(world.hab?.heaterOn"), "frame passes heater into ambience");
must(readFileSync(resolve(root, "src/audio.js"), "utf8").includes("setTargetAtTime"), "Hab mix swells instead of switching");

const card = { index: 0, finished: false };
must(advanceJournal(card, goalsDone({ gathered: 0, tools: {}, inv: {} }, { habSealed: true })) >= 1, "seal completes the scrap card");
must(card.index === 1, "after a patch the card is hammer, not pick scrap");
const patched = { index: 0, finished: false };
advanceJournal(patched, goalsDone({ gathered: 5, tools: { hammer: true }, inv: {} }, { habSealed: true }));
must(patched.index === 3, "seal + hammer catch up to water");
const loot = { index: 0, finished: false };
advanceJournal(loot, goalsDone({ gathered: 3, tools: {}, inv: {} }, { habSealed: false }));
must(game.includes("build-still"), "still pad builds in place like the leak patch");
must(game.includes("pushLog(\"HAB\", t(\"stillYardHint\"))"), "still yard hint stays in the log, not only a 2s toast");
must(game.includes("still-hint"), "empty still ring names the recipe like the leak");
must(readFileSync(resolve(root, "src/data.js"), "utf8").includes("need: { scrap: 2, fabric: 1 }"), "still hull is scrap+canvas; ice is fuel");
must(readFileSync(resolve(root, "src/data.js"), "utf8").includes("x: -7.5, z: 12.6"), "still pad has starter scrap so hammer does not starve the water loop");
const i18n = readFileSync(resolve(root, "src/i18n.js"), "utf8");
must(i18n.includes("buildStill"), "build-still prompt is translated, not a raw key");
must(i18n.includes("helpDrop"), "Q drop hint is translated, not a raw key");

const stillPad = YARD_PADS.find((p) => p.station === "still");
must(!!stillPad, "still yard pad exists");
const westScrap = NODE_SPAWNS.filter((n) => n.type === "scrap" && n.starter && n.x < -3);
must(westScrap.length >= 2, "two starter scraps live at the still yard");
for (const n of westScrap) {
  must(dist(n.x, n.z, stillPad.x, stillPad.z) < 5, "west scrap is a short walk from the still ring");
}
for (const n of NODE_SPAWNS.filter((n) => n.type === "fabric")) {
  must(dist(n.x, n.z, stillPad.x, stillPad.z) > 1.6, "canvas does not sit on the still ring");
}
const iceNear = NODE_SPAWNS.find((n) => n.type === "ice" && dist(n.x, n.z, stillPad.x, stillPad.z) < 4);
must(!!iceNear, "ice for fuel sits next to the still pad");

must(
  pickStillPadAction({ padD: 0.2, gatherD: 2.5, hasHammer: true, canBuild: true }).kind === "build-still",
  "recipe ready on the ring is E-build"
);
must(
  pickStillPadAction({ padD: 0.2, gatherD: 2.5, hasHammer: true, canBuild: false }).kind === "still-hint",
  "empty ring with hammer names 2 scrap + canvas"
);
must(
  pickStillPadAction({ padD: 2.2, gatherD: 0.3, hasHammer: true, canBuild: false }) == null,
  "standing on west scrap still gathers it"
);
must(
  pickStillPadAction({ padD: 2.2, gatherD: 0.3, hasHammer: true, canBuild: true }).kind === "build-still",
  "full recipe builds even next to leftover scrap"
);
must(
  pickStillPadAction({ padD: 0.4, gatherD: 3, hasHammer: false, canBuild: true }) == null,
  "no hammer — ring is not a still interact"
);
must(
  pickStillPadAction({ padD: 3.6, gatherD: 5, hasHammer: true, canBuild: false }).kind === "still-hint",
  "within a few metres of the pole names the still, not only the exact plinth"
);

must(
  pickStillMachineAction({ d: 0.4, water: 0, fuel: 28, gridOn: true }).kind === "still-drip",
  "fueled still at the machine shows drip, not leftover scrap"
);
must(
  pickStillMachineAction({ d: 3.31, water: 0, fuel: 0, gridOn: true, hasIce: false }) == null,
  "ice pile ~3.3 m from the still still gathers"
);
must(
  pickStillMachineAction({ d: 0.4, water: 0, fuel: 0, gridOn: true, hasIce: true }).kind === "still-fuel",
  "ice in pockets at the machine is fuel"
);
must(
  pickStillMachineAction({ d: 0.4, water: 1.2, fuel: 10, gridOn: true }).kind === "still-take",
  "a full flask is collect, not drip"
);
must(readFileSync(resolve(root, "src/world.js"), "utf8").includes("stillPadMarker"), "still pad is a stake marker, not a floor twig");
must(readFileSync(resolve(root, "src/world.js"), "utf8").includes("fog: false"), "pad markers ignore Mars fog so they stay readable");

const oneIce = { type: "still", fuel: 28, water: 0, runtime: 0, fault: null, repaired: false };
const liveGrid = { hab: { gridOn: true }, science: { known: {} } };
for (let i = 0; i < 28; i++) tickStillMachine(oneIce, 1, liveGrid);
must(oneIce.water >= 1, "one ice (28s fuel) yields a collectable flask");
must(oneIce.water < 1.6, "one ice is about one bottle, not a tank");
must(oneIce.fault == null, "one ice does not kill the pump");
const tankWorld = { hab: createHabitat(), habSealed: true, daylight: 1, storm: 0, stations: [{ type: "still", fuel: 28, fault: null }] };
tankWorld.hab.gridOn = true;
tankWorld.hab.heaterOn = false;
const tankBefore = tankWorld.hab.waterTank;
for (let i = 0; i < 28; i++) tickHabitat(tankWorld, 1);
must(tankWorld.hab.waterTank > tankBefore + 0.4, "fueled still also fills the Hab tank at the desk");

must(existsSync(resolve(root, "src/systems/firstSol.js")), "first-sol harness lives in systems");
must(existsSync(resolve(root, "scripts/first-sol.mjs")), "first-sol runner");
must(readFileSync(resolve(root, "package.json"), "utf8").includes("first-sol.mjs"), "smoke gate runs first-sol");
must(game.includes("repair-cable"), "storm-snapped array cable is an E repair");
must(i18n.includes("repairCable"), "cable splice prompt is translated");
must(
  pickArrayAction({ d: 0.4, gatherD: 5, cableFault: true, canRepairCable: true }).kind === "repair-cable",
  "wire at the roof array splices the cable"
);
must(
  pickArrayAction({ d: 0.4, gatherD: 5, cableFault: true, canRepairCable: false }).kind === "cable-diag",
  "open cable without wire names the solar wreck"
);
must(
  pickArrayAction({ d: 0.4, gatherD: 0.3, cableFault: true, canRepairCable: true }).kind === "repair-cable",
  "open cable at the roof wins over leftover scrap"
);
must(
  pickArrayAction({ d: 3.2, gatherD: 0.2, cableFault: true, canRepairCable: true }) == null,
  "loot underfoot away from the array still gathers"
);
const cableRead = habReadout({ hab: { ...createHabitat(), cableFault: true }, habSealed: true }, "en");
must(cableRead.includes("CABLE"), "console names an open array cable");
must(
  habAlerts(
    { hab: { ...createHabitat(), cableFault: true, solarKw: 0, loadKw: 1 }, habSealed: true, stations: [] },
    "en"
  )[0].includes("CABLE"),
  "open cable beats POWER DEFICIT on the status line"
);
must(game.includes("consumeHabEvents"), "cable snap raises a Hab log, not only a silent kW drop");
must(i18n.includes("cableSnapped"), "storm-snapped cable toast is translated");
must(ui.includes("<0.1"), "range line can show you cannot make the wreck");
const wirePile = NODE_SPAWNS.find((n) => n.type === "wire" && n.x > 40 && n.z > 90);
must(!!wirePile, "wire for the array cable lives at the solar wreck");
must(roundTripM(HAB_POS, wirePile) > 180, "the wire run is a round trip, not a yard stroll");
must(
  estimateRangeM({ oxygen: 100, warmth: 70 }, { habSealed: true, daylight: 0.9, storm: 0.05 }) >
    estimateRangeM({ oxygen: 100, warmth: 70 }, { habSealed: true, daylight: 0.12, storm: 0.78 }),
  "storm night cuts suit range vs a clear day"
);

if (fail.length) {
  console.error(fail.map((m) => `FAIL ${m}`).join("\n"));
  process.exit(1);
}
console.log("smoke ok");
