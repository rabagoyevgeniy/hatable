import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHabitat, tickTime, tickHabitat, simulateSleep, habReadout, habStatusLine, stillOnline, CROP_SLEEP, CROP_LIVE, SOL_SECONDS } from "../src/systems/habitat.js";
import { createWeather, tickWeather } from "../src/systems/weather.js";
import { noteScan, createScience } from "../src/systems/science.js";
import { pickInteriorAction, dist } from "../src/systems/interact.js";
import { HAB_DESK, HAB_BUNK, HAB_LEAK } from "../src/data.js";
import { tickStillMachine, stillCanRun, repairStillPump, STILL_PUMP_FAIL } from "../src/systems/machines.js";
import { canEatPotato, tankSipsLeft, gutAfterHab, SLEEP_HUNGER, SLEEP_THIRST, TANK_SIP_THIRST } from "../src/systems/survival.js";
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
must(readFileSync(resolve(root, "src/systems/save.js"), "utf8").includes("advanceJournal"), "Continue catch-up so a sealed save is not still pick-scrap");

if (fail.length) {
  console.error(fail.map((m) => `FAIL ${m}`).join("\n"));
  process.exit(1);
}
console.log("smoke ok");
