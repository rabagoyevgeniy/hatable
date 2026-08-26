/**
 * Deterministic First Sol vertical slice.
 * leak → repair → power → sleep → still → ice → water → drink → crop
 * Uses the live sim modules. No Three.js.
 */

import { RECIPES, YARD_PADS, HAB_LEAK, LOCKER_START } from "../data.js";
import { createHabitat, tickTime, tickHabitat, cropSleepFactors, CROP_SLEEP, simulateSleep, habStatusLine, habAlerts } from "./habitat.js";
import { createWeather, applyWeatherState, CABLE_SNAP_S } from "./weather.js";
import { createScience } from "./science.js";
import { tickStillMachine, placeStationSim, stillCanRun, repairArrayCable } from "./machines.js";
import { addItem, takeItems, canAfford, count } from "./inventory.js";
import { trySleepSol, sipHabitatTank, canEatPotato } from "./survival.js";
import { pickInteriorAction, pickStillPadAction, pickStillMachineAction, pickArrayAction, dist } from "./interact.js";
import { goalsDone, advanceJournal } from "./goals.js";

export const FIRST_SOL_CHAIN = ["leak", "repair", "power", "sleep", "still", "ice", "water", "drink", "crop"];

export function createHeadlessWorld() {
  const world = {
    clock: 0.22,
    daylight: 1,
    storm: 0,
    stormTarget: 0.05,
    playTime: 0,
    habSealed: false,
    powered: false,
    contacted: false,
    stations: [],
    hab: createHabitat(),
    weather: createWeather(),
    science: createScience(),
    locker: { storage: { ...LOCKER_START } },
  };
  tickTime(world, 0);
  return world;
}

export function createHeadlessPlayer() {
  return {
    x: 1.2,
    z: 18.5,
    inv: {},
    tools: {},
    hunger: 64,
    thirst: 62,
    oxygen: 88,
    warmth: 70,
    gathered: 0,
    harvestedCrop: false,
    drank: false,
  };
}

function fail(step, msg, extra) {
  const err = new Error(`[${step}] ${msg}`);
  err.step = step;
  err.extra = extra;
  throw err;
}

function recipe(id) {
  return RECIPES.find((r) => r.id === id);
}

function pad(station) {
  return YARD_PADS.find((p) => p.station === station);
}

export function runFirstSol() {
  const done = [];
  const world = createHeadlessWorld();
  const player = createHeadlessPlayer();
  const journal = { index: 0, finished: false };

  function mark(name) {
    done.push(name);
  }

  /* 1. LEAK — unsealed hull drops pressure on a live grid. */
  {
    world.habSealed = false;
    world.hab.gridOn = true;
    const p0 = world.hab.pressure;
    for (let i = 0; i < 8; i++) tickHabitat(world, 1);
    if (!(world.hab.pressure < p0 - 0.005)) {
      fail("leak", `pressure did not fall (${p0} → ${world.hab.pressure})`);
    }
    const aisle = pickInteriorAction({
      inside: true,
      sealed: false,
      canPatch: false,
      leakD: dist(0, 10.2, HAB_LEAK.x, HAB_LEAK.z),
      deskD: dist(0, 10.2, 1.55, 9.2),
      lockerD: 9,
      bunkD: 9,
    });
    if (aisle?.kind !== "leak-hint") fail("leak", `aisle should name the tear, got ${aisle?.kind}`);
    mark("leak");
  }

  /* 2. REPAIR — 2 canvas + tape, then pressure recovers. */
  {
    const rec = recipe("seal");
    if (!addItem(player, "fabric", rec.need.fabric) || !addItem(player, "tape", rec.need.tape)) {
      fail("repair", "could not pocket patch mats");
    }
    if (!canAfford(player, rec.need)) fail("repair", "patch recipe not affordable");
    const atTear = pickInteriorAction({
      inside: true,
      sealed: false,
      canPatch: true,
      leakD: 0.2,
      deskD: 9,
      lockerD: 9,
      bunkD: 9,
    });
    if (atTear?.kind !== "patch") fail("repair", `E at tear should patch, got ${atTear?.kind}`);
    if (!takeItems(player, rec.need)) fail("repair", "could not spend patch mats");
    placeStationSim(world, "seal", HAB_LEAK.x, HAB_LEAK.z);
    if (!world.habSealed) fail("repair", "hull not sealed");
    const p1 = world.hab.pressure;
    world.hab.gridOn = true;
    world.hab.lifeSupportOn = true;
    for (let i = 0; i < 12; i++) tickHabitat(world, 1);
    if (!(world.hab.pressure > p1)) fail("repair", "sealed pressure did not recover on live grid");
    advanceJournal(journal, goalsDone(player, world));
    mark("repair");
  }

  /* 3. POWER — array cell + night decision. Heater off saves the battery. */
  {
    if (!addItem(player, "solar", 1)) fail("power", "no pocket for a solar cell");
    if (!takeItems(player, { solar: 1 })) fail("power", "could not spend the cell");
    const health0 = world.hab.arrayHealth;
    world.hab.arrayHealth = Math.min(1, world.hab.arrayHealth + 0.24);
    if (!(world.hab.arrayHealth > health0 + 0.2)) fail("power", "array was not patched");

    world.clock = 0.78;
    tickTime(world, 0);
    world.hab.battery = 0.4;
    world.hab.heaterOn = true;
    world.hab.insideC = 10;
    for (let i = 0; i < 40; i++) tickHabitat(world, 1);
    const heatOnBat = world.hab.battery;
    world.hab.battery = 0.4;
    world.hab.heaterOn = false;
    world.hab.insideC = 10;
    for (let i = 0; i < 40; i++) tickHabitat(world, 1);
    if (!(world.hab.battery > heatOnBat + 0.02)) fail("power", "heater off did not save night battery");
    if (!world.hab.gridOn) fail("power", "grid died during the first night decision");
    world.hab.heaterOn = true;
    world.clock = 0.25;
    tickTime(world, 0);
    mark("power");
  }

  /* 4. SLEEP — bunk spends gut, sealed O₂ fills, clock moves. */
  {
    player.hunger = 64;
    player.thirst = 62;
    const clock0 = world.clock;
    const result = trySleepSol(player, world);
    if (result !== "slept") fail("sleep", `bunk refused (${result})`);
    if (player.hunger > 64 - 11) fail("sleep", "sleep did not spend hunger");
    if (player.thirst > 62 - 15) fail("sleep", "sleep did not spend thirst");
    if (player.oxygen !== 100) fail("sleep", "sealed sleep should refill O₂");
    if (world.clock === clock0) fail("sleep", "clock did not advance");
    mark("sleep");
  }

  /* 5. STILL BUILD — hammer + 2 scrap + canvas. Ice is fuel, not a girder. */
  {
    const rec = recipe("still");
    const stillPad = pad("still");
    player.tools.hammer = true;
    if (!addItem(player, "scrap", rec.need.scrap) || !addItem(player, "fabric", rec.need.fabric)) {
      fail("still", "could not pocket still hull mats");
    }
    if (!addItem(player, "ice", 2)) fail("still", "could not pocket ice for later fuel");
    const iceBefore = count(player, "ice");
    if (!canAfford(player, rec.need)) fail("still", "still hull not affordable");
    const act = pickStillPadAction({
      padD: 0.3,
      gatherD: 2.5,
      hasHammer: true,
      canBuild: true,
    });
    if (act?.kind !== "build-still") fail("still", `ready pad should E-build, got ${act?.kind}`);
    if (!takeItems(player, rec.need)) fail("still", "could not spend hull mats");
    placeStationSim(world, "still", stillPad.x, stillPad.z);
    const still = world.stations.find((s) => s.type === "still");
    if (!still) fail("still", "still was not placed");
    if (count(player, "ice") !== iceBefore) fail("still", "building the hull consumed ice — ice is fuel");
    if ((player.inv.scrap || 0) < 0) fail("still", "scrap went negative");
    mark("still");
  }

  /* 6. ICE — E at the machine loads 28s of fuel. */
  {
    const still = world.stations.find((s) => s.type === "still");
    const fuelAct = pickStillMachineAction({
      d: 0.4,
      water: still.water,
      fuel: still.fuel,
      gridOn: world.hab.gridOn,
      hasIce: count(player, "ice") > 0,
    });
    if (fuelAct?.kind !== "still-fuel") fail("ice", `machine should take ice, got ${fuelAct?.kind}`);
    if (!takeItems(player, { ice: 1 })) fail("ice", "no ice to fuel");
    still.fuel += 28;
    if (still.fuel < 28) fail("ice", "still did not take fuel");
    mark("ice");
  }

  /* 7. WATER — flask fills; Hab tank at the desk also rises. */
  {
    const still = world.stations.find((s) => s.type === "still");
    if (!stillCanRun(still, world)) fail("water", "still offline after fuel (need live grid)");
    const tank0 = world.hab.waterTank;
    for (let i = 0; i < 28; i++) {
      tickStillMachine(still, 1, world);
      tickHabitat(world, 1);
    }
    if (!(still.water >= 1)) fail("water", `flask did not fill (${still.water})`);
    if (!(world.hab.waterTank > tank0 + 0.4)) fail("water", "Hab tank did not rise from a fueled still");
    const takeAct = pickStillMachineAction({
      d: 0.4,
      water: still.water,
      fuel: still.fuel,
      gridOn: world.hab.gridOn,
    });
    if (takeAct?.kind !== "still-take") fail("water", `full flask should collect, got ${takeAct?.kind}`);
    still.water -= 1;
    if (!addItem(player, "water", 1)) fail("water", "pockets full — could not take flask");
    mark("water");
  }

  /* 8. DRINK — leftover / still-fed tank at the console. */
  {
    player.thirst = 20;
    const tank0 = world.hab.waterTank;
    const sip = sipHabitatTank(world, player);
    if (!sip.ok) fail("drink", "tank sip failed");
    if (!player.drank) fail("drink", "drank flag not set");
    if (!(player.thirst > 40)) fail("drink", "sip did not restore thirst");
    if (!(world.hab.waterTank < tank0)) fail("drink", "tank liters did not drop");
    advanceJournal(journal, goalsDone(player, world));
    mark("drink");
  }

  /* 9. CROP — plant seed, water is moisture, four watered sleeps, harvest ×3. */
  {
    const rec = recipe("plot");
    const plotPad = pad("plot");
    if (!addItem(player, "soil", rec.need.soil) || !addItem(player, "scrap", rec.need.scrap)) {
      fail("crop", "could not pocket plot mats");
    }
    if (!takeItems(player, rec.need)) fail("crop", "could not spend plot mats");
    const plot = placeStationSim(world, "plot", plotPad.x, plotPad.z);

    if (!addItem(player, "potato", 1)) fail("crop", "no seed potato");
    if (canEatPotato(player)) fail("crop", "last tuber must stay seed until harvest");
    if (!takeItems(player, { potato: 1 })) fail("crop", "could not plant");
    plot.planted = true;
    plot.grow = 0;
    plot.moisture = 0.85;

    const still = world.stations.find((s) => s.type === "still");
    if (count(player, "ice") < 1) {
      if (!addItem(player, "ice", 1)) fail("crop", "need a second ice for irrigation flasks");
    }
    if (!takeItems(player, { ice: 1 })) fail("crop", "could not fuel still for a second flask");
    still.fuel += 28;
    for (let i = 0; i < 28; i++) tickStillMachine(still, 1, world);
    if (still.water < 1) fail("crop", "second flask did not fill");
    still.water -= 1;
    if (!addItem(player, "water", 1)) fail("crop", "could not pocket second flask");

    still.fuel = 0;
    world.hab.heaterOn = false;
    world.hab.gridOn = true;
    world.hab.battery = 0.75;
    player.hunger = 80;
    player.thirst = 80;

    for (let sol = 0; sol < 4; sol++) {
      if (count(player, "water") > 0 && plot.grow < 1) {
        takeItems(player, { water: 1 });
        plot.moisture = 1;
      }
      const slept = trySleepSol(player, world);
      if (slept !== "slept") fail("crop", `sleep ${sol + 1} refused (${slept})`);
      player.hunger = Math.min(100, player.hunger + 20);
      player.thirst = Math.min(100, player.thirst + 20);
    }
    if (!(plot.grow >= 1)) {
      fail("crop", `four watered sleeps did not finish the crop (grow=${plot.grow.toFixed(3)})`);
    }

    let n = 3;
    while (n && !addItem(player, "potato", n)) n -= 1;
    if (n < 3) fail("crop", `harvest could not pocket 3 tubers (got ${n})`);
    player.harvestedCrop = true;
    plot.planted = false;
    plot.grow = 0;
    plot.moisture = 0.2;
    if (!canEatPotato(player)) fail("crop", "harvested copies must be edible");
    if (count(player, "potato") < 3) fail("crop", "harvest is three copies");
    advanceJournal(journal, goalsDone(player, world));
    if (journal.index < 5) fail("crop", `journal should reach farm, index=${journal.index}`);
    mark("crop");
  }

  if (done.join() !== FIRST_SOL_CHAIN.join()) {
    fail("chain", `incomplete chain: ${done.join(" → ")}`);
  }

  return { ok: true, done, world, player, journal };
}

/** Storm → solar → battery → heater/grid → crops. Master Vision after First Sol. */
export function runStabilizeCoupling() {
  const notes = [];

  const clear = createHeadlessWorld();
  clear.habSealed = true;
  clear.clock = 0.25;
  tickTime(clear, 0);
  applyWeatherState(clear, "clear");
  tickHabitat(clear, 1);
  const clearKw = clear.hab.solarKw;

  const storm = createHeadlessWorld();
  storm.habSealed = true;
  storm.clock = 0.25;
  tickTime(storm, 0);
  applyWeatherState(storm, "storm");
  tickHabitat(storm, 1);
  if (!(storm.hab.solarKw < clearKw * 0.55)) {
    fail("stabilize", `storm did not cut solar (${storm.hab.solarKw} vs clear ${clearKw})`);
  }
  notes.push("storm-cuts-solar");

  const nightClear = createHeadlessWorld();
  nightClear.habSealed = true;
  nightClear.clock = 0.78;
  tickTime(nightClear, 0);
  applyWeatherState(nightClear, "clear");
  nightClear.hab.heaterOn = true;
  nightClear.hab.battery = 0.4;
  for (let i = 0; i < 40; i++) tickHabitat(nightClear, 1);

  const nightStorm = createHeadlessWorld();
  nightStorm.habSealed = true;
  nightStorm.clock = 0.78;
  tickTime(nightStorm, 0);
  applyWeatherState(nightStorm, "storm");
  nightStorm.hab.heaterOn = true;
  nightStorm.hab.battery = 0.4;
  for (let i = 0; i < 40; i++) tickHabitat(nightStorm, 1);
  if (!(nightStorm.hab.battery <= nightClear.hab.battery + 0.002)) {
    fail("stabilize", "storm night should not charge more than a clear night");
  }
  notes.push("storm-night-battery");

  const farm = createHeadlessWorld();
  farm.habSealed = true;
  farm.hab.gridOn = true;
  farm.hab.insideC = 18;
  farm.hab.heaterOn = true;
  applyWeatherState(farm, "clear");
  const plot = placeStationSim(farm, "plot", -9.2, 5.4);
  plot.planted = true;
  plot.grow = 0;
  plot.moisture = 1;
  const fClear = cropSleepFactors(farm);
  const clearJump = CROP_SLEEP * fClear.light * fClear.temp * 1;

  applyWeatherState(farm, "storm");
  const fStorm = cropSleepFactors(farm);
  const stormJump = CROP_SLEEP * fStorm.light * fStorm.temp * Math.max(0.22, plot.moisture);
  if (!(stormJump < clearJump * 0.7)) {
    fail("stabilize", `storm should slow the crop (${stormJump} vs ${clearJump})`);
  }
  notes.push("storm-slows-crop");

  farm.hab.gridOn = false;
  farm.hab.battery = 0;
  farm.hab.insideC = 2;
  applyWeatherState(farm, "clear");
  const fDead = cropSleepFactors(farm);
  const deadJump = CROP_SLEEP * fDead.light * fDead.temp * 1;
  if (!(deadJump < clearJump * 0.45)) {
    fail("stabilize", `dead grid should freeze the greenhouse (${deadJump} vs ${clearJump})`);
  }
  notes.push("grid-death-freezes-crop");

  const dryJump = CROP_SLEEP * fClear.light * fClear.temp * 0.22;
  if (!(dryJump < clearJump * 0.4)) {
    fail("stabilize", "dry soil should grow slower than watered");
  }
  notes.push("moisture-gates-pace");

  const early = createHeadlessWorld();
  early.playTime = 10;
  early.hab.arrayHealth = 0.55;
  applyWeatherState(early, "storm");
  for (let i = 0; i < 50; i++) tickHabitat(early, 1);
  if (early.hab.arrayHealth < 0.549) fail("stabilize", "first emergency minutes are not a sandblast");
  if (early.hab.cableFault) fail("stabilize", "cable must not snap during the leak emergency");
  notes.push("grace-protects-first-sol");

  const dust = createHeadlessWorld();
  dust.playTime = 300;
  dust.hab.arrayHealth = 0.55;
  applyWeatherState(dust, "dust");
  for (let i = 0; i < 50; i++) tickHabitat(dust, 1);
  if (dust.hab.arrayHealth < 0.549) fail("stabilize", "dust derates kW, it does not scar the array");
  if (dust.hab.cableFault) fail("stabilize", "dust must not snap the cable");
  notes.push("dust-is-not-a-scar");

  const scar = createHeadlessWorld();
  scar.playTime = 300;
  scar.habSealed = true;
  scar.hab.arrayHealth = 0.55;
  applyWeatherState(scar, "storm");
  for (let i = 0; i < 50; i++) tickHabitat(scar, 1);
  if (!(scar.hab.arrayHealth < 0.5)) fail("stabilize", `storm did not scar the array (${scar.hab.arrayHealth})`);
  const scarred = scar.hab.arrayHealth;
  applyWeatherState(scar, "clear");
  for (let i = 0; i < 20; i++) tickHabitat(scar, 1);
  if (Math.abs(scar.hab.arrayHealth - scarred) > 0.002) fail("stabilize", "array scar must remain after the sky clears");
  notes.push("storm-scars-array");

  const cable = createHeadlessWorld();
  cable.playTime = 300;
  cable.habSealed = true;
  cable.clock = 0.25;
  tickTime(cable, 0);
  cable.hab.arrayHealth = 0.7;
  applyWeatherState(cable, "storm");
  for (let i = 0; i < CABLE_SNAP_S + 2; i++) tickHabitat(cable, 1);
  if (!cable.hab.cableFault) fail("stabilize", "a full storm should open the array cable");
  applyWeatherState(cable, "clear");
  tickHabitat(cable, 1);
  if (!(cable.hab.solarKw < 0.08)) fail("stabilize", `open cable should kill roof kW (${cable.hab.solarKw})`);
  notes.push("storm-snaps-cable");

  const splice = pickArrayAction({
    d: 0.4,
    gatherD: 5,
    cableFault: true,
    canRepairCable: true,
  });
  if (splice?.kind !== "repair-cable") fail("stabilize", "array with wire is E-splice");
  const hint = pickArrayAction({
    d: 0.4,
    gatherD: 5,
    cableFault: true,
    canRepairCable: false,
  });
  if (hint?.kind !== "cable-diag") fail("stabilize", "open cable without wire names the wreck");
  repairArrayCable(cable.hab);
  cable.clock = 0.25;
  tickTime(cable, 0);
  tickHabitat(cable, 1);
  if (cable.hab.cableFault) fail("stabilize", "splice did not clear the fault");
  if (!(cable.hab.solarKw > 0.4)) fail("stabilize", `spliced cable should restore roof kW (${cable.hab.solarKw})`);
  notes.push("wire-splices-cable");

  const bypass = createHeadlessWorld();
  bypass.playTime = 300;
  bypass.habSealed = true;
  bypass.clock = 0.25;
  tickTime(bypass, 0);
  bypass.hab.cableFault = true;
  applyWeatherState(bypass, "clear");
  tickHabitat(bypass, 1);
  const deadRoof = bypass.hab.solarKw;
  placeStationSim(bypass, "solar", 7.6, 3.8);
  tickHabitat(bypass, 1);
  if (!(bypass.hab.solarKw > deadRoof + 0.4)) fail("stabilize", "yard panel should bypass a dead roof cable");
  notes.push("yard-panel-bypasses-cable");

  const nap = createHeadlessWorld();
  nap.playTime = 300;
  nap.habSealed = true;
  nap.hab.arrayHealth = 0.7;
  nap.hab.heaterOn = false;
  applyWeatherState(nap, "storm");
  const napHealth = nap.hab.arrayHealth;
  simulateSleep(nap, 96);
  if (!nap.hab.cableFault) fail("stabilize", "sleeping through a storm should snap the cable");
  if (!(nap.hab.arrayHealth < napHealth - 0.04)) fail("stabilize", "sleeping through a storm should scar the array");
  if (!nap.hab.cableSnapEvent) fail("stabilize", "snap should raise a Hab event for the log");
  nap.hab.solarKw = 0;
  nap.hab.loadKw = 1;
  const why = habAlerts(nap, "en");
  if (!why[0] || !why[0].includes("CABLE")) {
    fail("stabilize", `HUD should name the cable before deficit, got ${why[0]}`);
  }
  if (!habStatusLine(nap, "en").includes("CABLE")) fail("stabilize", "status line should not hide the cable under POWER DEFICIT");
  notes.push("sleep-through-storm");

  return { ok: true, notes, clearKw, stormKw: storm.hab.solarKw, clearJump, stormJump, deadJump };
}
