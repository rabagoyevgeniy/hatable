import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHabitat, tickTime, tickHabitat, simulateSleep, habReadout, habStatusLine } from "../src/systems/habitat.js";
import { createWeather, tickWeather } from "../src/systems/weather.js";
import { noteScan, createScience } from "../src/systems/science.js";

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
must(game.includes("repair-array"), "roof array repair");

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
must(ui.includes("deskD < 3.6"), "desk console reachable from Hab center");

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

if (fail.length) {
  console.error(fail.map((m) => `FAIL ${m}`).join("\n"));
  process.exit(1);
}
console.log("smoke ok");
