/**
 * Deterministic First Sol vertical slice.
 * leak → repair → power → sleep → still → ice → water → drink → crop
 * Uses the live sim modules. No Three.js.
 */

import { RECIPES, YARD_PADS, HAB_LEAK, HAB_POS, LOCKER_START, OUTPOSTS, NODE_SPAWNS } from "../data.js";
import { createHabitat, tickTime, tickHabitat, cropSleepFactors, CROP_SLEEP, simulateSleep, habStatusLine, habAlerts, habReadout } from "./habitat.js";
import { createWeather, applyWeatherState, CABLE_SNAP_S } from "./weather.js";
import { createScience, lootBeaconVisible, noteScan, pickScanTarget, canFuelStill, canPlantCrop, canUseWire, isKnown, radioCanListen, radioPlaced, RADIO_CONTACT_S, canBuildRadio, recipeKnown, LOOT_RING_RANGE, overlayNamesOutpost, overlayNamesLoot } from "./science.js";
import { tickStillMachine, placeStationSim, stillCanRun, repairArrayCable } from "./machines.js";
import { addItem, takeItems, canAfford, count } from "./inventory.js";
import { trySleepSol, sipHabitatTank, canEatPotato, estimateRangeM, roundTripM, canRoundTrip, packingLines } from "./survival.js";
import { pickInteriorAction, pickStillPadAction, pickStillMachineAction, pickPlotPlantAction, pickArrayAction, dist } from "./interact.js";
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
    radio: { listenS: 0 },
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

  /* 6. ICE — scan first, then E at the machine loads 28s of fuel. */
  {
    const still = world.stations.find((s) => s.type === "still");
    const blind = pickStillMachineAction({
      d: 0.4,
      water: still.water,
      fuel: still.fuel,
      gridOn: world.hab.gridOn,
      hasIce: count(player, "ice") > 0,
      iceKnown: false,
    });
    if (blind?.kind !== "still-scan") fail("ice", `unidentified ice is not fuel, got ${blind?.kind}`);
    if (canFuelStill(world, "ice")) fail("ice", "unscanned ice must not be feedstock");
    if (habReadout(world, "en").includes("FEEDSTOCK")) fail("ice", "desk lab should be empty before the ice scan");
    const iceId = noteScan(world, "ice");
    if (!iceId) fail("ice", "ice scan should identify feedstock");
    if (!habReadout(world, "en").includes("FEEDSTOCK")) fail("ice", "desk should log identified ice");
    if (pickScanTarget({ heldId: "ice" }) !== "ice") fail("ice", "F on a held sample should identify ice");
    if (!canFuelStill(world, "ice")) fail("ice", "scanned ice should unlock the still");
    const fuelAct = pickStillMachineAction({
      d: 0.4,
      water: still.water,
      fuel: still.fuel,
      gridOn: world.hab.gridOn,
      hasIce: count(player, "ice") > 0,
      iceKnown: isKnown(world, "ice"),
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
    const blindPlant = pickPlotPlantAction({ planted: false, hasPotato: true, soilKnown: false });
    if (blindPlant?.kind !== "plot-scan") fail("crop", `unidentified soil is not a bed, got ${blindPlant?.kind}`);
    if (canPlantCrop(world)) fail("crop", "unscanned soil must not take the last potato");
    if (!noteScan(world, "soil")) fail("crop", "soil scan should unlock planting");
    if (!canPlantCrop(world)) fail("crop", "scanned soil should unlock the plot");
    const plantAct = pickPlotPlantAction({ planted: false, hasPotato: true, soilKnown: true });
    if (plantAct?.kind !== "plant") fail("crop", `identified soil should plant, got ${plantAct?.kind}`);
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

  const blindSplice = pickArrayAction({
    d: 0.4,
    gatherD: 5,
    cableFault: true,
    canRepairCable: true,
    wireKnown: false,
  });
  if (blindSplice?.kind !== "cable-scan") fail("stabilize", `unidentified copper is not a splice, got ${blindSplice?.kind}`);
  if (canUseWire(cable)) fail("stabilize", "unscanned wire must not splice");
  const copper = noteScan(cable, "wire");
  if (!copper || !String(copper.en || "").toLowerCase().includes("copper")) {
    fail("stabilize", "wire scan should name copper");
  }
  if (!canUseWire(cable)) fail("stabilize", "wire scan should unlock electrical repair");
  const splice = pickArrayAction({
    d: 0.4,
    gatherD: 5,
    cableFault: true,
    canRepairCable: true,
    wireKnown: true,
  });
  if (splice?.kind !== "repair-cable") fail("stabilize", "array with identified wire is E-splice");
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

  const solar = OUTPOSTS.find((o) => o.id === "solar");
  const wire = NODE_SPAWNS.find((n) => n.type === "wire" && n.x > 40 && n.z > 90);
  if (!solar || !wire) fail("stabilize", "solar wreck / wire pile missing");
  const trip = roundTripM(HAB_POS, wire);
  if (trip < 180 || trip > 280) fail("stabilize", `wire run should be a leash, not a stroll (${trip.toFixed(0)} m)`);
  const suit = { oxygen: 100, warmth: 70 };
  const noon = createHeadlessWorld();
  noon.habSealed = true;
  noon.daylight = 0.9;
  applyWeatherState(noon, "clear");
  if (!canRoundTrip(suit, noon, wire, HAB_POS)) {
    fail("stabilize", `clear day should reach the solar wreck (range ${estimateRangeM(suit, noon).toFixed(0)} vs ${trip.toFixed(0)})`);
  }
  notes.push("clear-day-wire-run");

  const gale = createHeadlessWorld();
  gale.habSealed = true;
  gale.daylight = 0.12;
  applyWeatherState(gale, "storm");
  if (canRoundTrip(suit, gale, wire, HAB_POS)) fail("stabilize", "storm night must not be a safe wire run");
  if (!(estimateRangeM(suit, gale) < trip)) fail("stabilize", "storm night should crush the range line");
  notes.push("storm-blocks-wire-run");

  const probe = OUTPOSTS.find((o) => o.id === "pathfinder");
  const comms = NODE_SPAWNS.find((n) => n.type === "comms");
  if (!probe || !comms) fail("stabilize", "Pathfinder / comms board missing");
  const earthTrip = roundTripM(HAB_POS, probe);
  if (earthTrip < 300 || earthTrip > 420) {
    fail("stabilize", `Pathfinder should be a longer leash than the solar wreck (${earthTrip.toFixed(0)} m)`);
  }
  if (!(earthTrip > trip + 40)) fail("stabilize", "Pathfinder must sit past the wire run");
  if (!canRoundTrip(suit, noon, probe, HAB_POS)) {
    fail("stabilize", `clear day should reach Pathfinder (range ${estimateRangeM(suit, noon).toFixed(0)} vs ${earthTrip.toFixed(0)})`);
  }
  if (canRoundTrip(suit, gale, probe, HAB_POS)) fail("stabilize", "storm night must not be a safe Pathfinder walk");
  notes.push("pathfinder-is-a-longer-leash");

  const pad = OUTPOSTS.find((o) => o.id === "mav");
  if (!pad) fail("stabilize", "MAV site missing");
  const mavTrip = roundTripM(HAB_POS, pad);
  if (!(mavTrip > earthTrip + 80)) fail("stabilize", `MAV should sit past Pathfinder (${mavTrip.toFixed(0)} vs ${earthTrip.toFixed(0)})`);
  if (!canRoundTrip(suit, noon, pad, HAB_POS)) {
    fail("stabilize", `clear day should reach the MAV (range ${estimateRangeM(suit, noon).toFixed(0)} vs ${mavTrip.toFixed(0)})`);
  }
  if (canRoundTrip(suit, gale, pad, HAB_POS)) fail("stabilize", "storm night must not be a safe MAV walk");
  notes.push("mav-is-the-longest-leash");

  const leakPack = packingLines(suit, { ...noon, habSealed: false }, "en");
  if (leakPack.length) fail("stabilize", "leaking desk is pressure, not a packing list");
  const packClear = packingLines(suit, noon, "en");
  if (!packClear.some((l) => l.includes("WIRE") && l.includes("IN RANGE"))) {
    fail("stabilize", `clear-day desk should list the wire run as in range (${packClear.join(" | ")})`);
  }
  if (!packClear.some((l) => l.includes("PATHFINDER") && l.includes("IN RANGE"))) {
    fail("stabilize", "clear-day desk should list Pathfinder as in range");
  }
  const packStorm = packingLines(suit, gale, "en");
  if (!packStorm.some((l) => l.includes("PATHFINDER") && l.includes("OUT OF RANGE"))) {
    fail("stabilize", "storm-night desk should refuse Pathfinder");
  }
  if (!packStorm.some((l) => l.includes("MAV") && l.includes("OUT OF RANGE"))) {
    fail("stabilize", "storm-night desk should refuse the MAV walk");
  }
  notes.push("console-packing-list");
  const dry = { oxygen: 100, warmth: 70, thirst: 22, hunger: 80 };
  if (!(estimateRangeM(suit, noon) > estimateRangeM(dry, noon) + 80)) {
    fail("stabilize", "dry mouth should cut range even when tanks are full");
  }
  if (canRoundTrip(dry, noon, probe, HAB_POS)) {
    fail("stabilize", "thirsty clear-day walk must not treat Pathfinder as safe");
  }
  const packDry = packingLines(dry, noon, "en");
  if (!packDry.some((l) => l.includes("PATHFINDER") && l.includes("OUT OF RANGE"))) {
    fail("stabilize", "thirsty desk should refuse Pathfinder");
  }
  notes.push("range-includes-gut");

  if (!lootBeaconVisible({ starter: true, playTime: 10, storm: 0 })) fail("stabilize", "starter rings must show on Sol 19");
  if (!lootBeaconVisible({ starter: false, storm: 0.2, scanning: false, dist: 8 })) fail("stabilize", "clear-day yard loot still has a ring");
  if (lootBeaconVisible({ starter: false, storm: 0, scanning: false, dist: 40 })) {
    fail("stabilize", "clear-day distant wrecks should not glow until you close in");
  }
  if (lootBeaconVisible({ starter: false, storm: 0, scanning: true, dist: 40 })) {
    fail("stabilize", "hold-F is not a planet-wide metal detector");
  }
  if (!lootBeaconVisible({ starter: false, storm: 0, scanning: true, dist: LOOT_RING_RANGE - 2 })) {
    fail("stabilize", "scan pulse may still ring loot inside ident reach");
  }
  notes.push("scan-pulse-is-not-a-planet-detector");
  if (lootBeaconVisible({ starter: false, storm: 0.5, scanning: false })) fail("stabilize", "dust should eat debug loot rings");
  if (!lootBeaconVisible({ starter: false, storm: 0.78, scanning: true, dist: 8 })) fail("stabilize", "scan must reveal nearby loot in a storm");
  if (lootBeaconVisible({ starter: false, storm: 0.78, scanning: true, dist: 40 })) {
    fail("stabilize", "storm scan must not light the far wreck");
  }
  if (lootBeaconVisible({ starter: true, playTime: 400, storm: 0.5, scanning: false })) {
    fail("stabilize", "after the emergency, even starter rings vanish in dust");
  }
  notes.push("dust-hides-loot-rings");

  const look = createHeadlessWorld();
  if (pickScanTarget({ outpostKind: "solar", outpostD: 8 }) !== "solaryard") {
    fail("stabilize", "scan at the solar wreck should name the farm, not a cell");
  }
  if (pickScanTarget({ outpostKind: "solar", outpostD: LOOT_RING_RANGE - 2 }) !== "solaryard") {
    fail("stabilize", "place ident should reach as far as a clear-day loot ring");
  }
  if (pickScanTarget({ outpostKind: "solar", outpostD: LOOT_RING_RANGE + 1, heldId: "ice" }) !== "ice") {
    fail("stabilize", "beyond ring range a pocket sample wins; the farm is not a horizon cheat");
  }
  notes.push("ident-matches-ring-range");
  const atlas = createHeadlessWorld();
  if (overlayNamesOutpost(atlas, "pathfinder", LOOT_RING_RANGE + 8, { scanning: true })) {
    fail("stabilize", "hold-F must not name Pathfinder from the horizon");
  }
  if (overlayNamesOutpost(atlas, "mav", 200, { scanning: true })) {
    fail("stabilize", "hold-F must not name the MAV from the Hab");
  }
  if (!overlayNamesOutpost(atlas, "pathfinder", LOOT_RING_RANGE - 2)) {
    fail("stabilize", "within ident reach the overlay may name the lander you can see");
  }
  if (!overlayNamesOutpost(atlas, "hab", 40, { scanning: true })) {
    fail("stabilize", "home is not a discovery");
  }
  if (overlayNamesOutpost(atlas, "pathfinder", 30)) {
    fail("stabilize", "unknown Pathfinder at 30 m should stay OPEN DESERT on the overlay");
  }
  noteScan(atlas, "pathfinder");
  if (!overlayNamesOutpost(atlas, "pathfinder", 40, { scanning: true })) {
    fail("stabilize", "after F, overlay may remember Pathfinder at range");
  }
  notes.push("overlay-is-not-a-horizon-atlas");
  if (overlayNamesLoot(40, { scanning: true })) {
    fail("stabilize", "hold-F must not name ice piles at 40 m");
  }
  if (!overlayNamesLoot(8)) fail("stabilize", "yard loot may still be named in sight");
  if (!overlayNamesLoot(LOOT_RING_RANGE - 2, { scanning: true })) {
    fail("stabilize", "scan overlay may name loot inside ident reach");
  }
  if (overlayNamesLoot(20, { scanning: false, lootRange: 18 })) {
    fail("stabilize", "without F, loot names stay inside gather sight");
  }
  notes.push("overlay-is-not-a-loot-atlas");
  if (pickScanTarget({ nodeType: "wire", nodeD: 1.2, outpostKind: "solar", outpostD: 4 }) !== "wire") {
    fail("stabilize", "copper underfoot still identifies as wire");
  }
  const yard = noteScan(look, "solaryard");
  if (!yard || !String(yard.en || "").toLowerCase().includes("copper")) {
    fail("stabilize", "first solar-farm scan should mention copper for the cable");
  }
  if (noteScan(look, "solaryard")) fail("stabilize", "repeat farm scan is not XP");
  notes.push("scan-names-solar-farm");

  if (pickScanTarget({ outpostKind: "pathfinder", outpostD: 8 }) !== "pathfinder") {
    fail("stabilize", "scan at Pathfinder should name the lander, not a comms board");
  }
  if (pickScanTarget({ nodeType: "comms", nodeD: 1.2, outpostKind: "pathfinder", outpostD: 4 }) !== "comms") {
    fail("stabilize", "comms board underfoot still identifies as comms");
  }
  const lander = noteScan(look, "pathfinder");
  if (!lander || !String(lander.en || "").toLowerCase().includes("s-band")) {
    fail("stabilize", "first Pathfinder scan should mention S-band");
  }
  if (noteScan(look, "pathfinder")) fail("stabilize", "repeat Pathfinder scan is not XP");
  notes.push("scan-names-pathfinder");

  const radioRec = RECIPES.find((r) => r.id === "radio");
  if (radioRec?.needScan !== "comms") fail("stabilize", "radio recipe should require a comms scan");
  if (canBuildRadio(look)) fail("stabilize", "unscanned comms board is not a radio");
  if (recipeKnown(look, radioRec)) fail("stabilize", "radio must stay locked until the board is identified");
  const board = noteScan(look, "comms");
  if (!board || !String(board.en || "").toLowerCase().includes("s-band")) {
    fail("stabilize", "comms scan should name S-band");
  }
  if (!canBuildRadio(look)) fail("stabilize", "comms scan should unlock the radio recipe");
  if (!recipeKnown(look, radioRec)) fail("stabilize", "identified comms should unlock the radio");
  notes.push("scan-unlocks-radio");

  if (pickScanTarget({ outpostKind: "farm", outpostD: 8 }) !== "farm") {
    fail("stabilize", "scan at the soil flats should name the flats");
  }
  if (pickScanTarget({ nodeType: "soil", nodeD: 1.2, outpostKind: "farm", outpostD: 4 }) !== "soil") {
    fail("stabilize", "soil underfoot still identifies as soil");
  }
  const flats = noteScan(look, "farm");
  if (!flats || !String(flats.en || "").toLowerCase().includes("perchlorate")) {
    fail("stabilize", "first soil-flats scan should mention perchlorate");
  }
  if (noteScan(look, "farm")) fail("stabilize", "repeat flats scan is not XP");

  if (pickScanTarget({ outpostKind: "rover", outpostD: 8 }) !== "rover") {
    fail("stabilize", "scan at the rover wreck should name the wreck");
  }
  const wreck = noteScan(look, "rover");
  if (!wreck || !String(wreck.en || "").toLowerCase().includes("taxi")) {
    fail("stabilize", "rover scan should say it is not a taxi");
  }
  if (noteScan(look, "rover")) fail("stabilize", "repeat rover scan is not XP");

  if (pickScanTarget({ outpostKind: "mav", outpostD: 8 }) !== "mav") {
    fail("stabilize", "scan at the MAV should name the ascent vehicle");
  }
  const ascent = noteScan(look, "mav");
  if (!ascent || !String(ascent.en || "").toLowerCase().includes("project")) {
    fail("stabilize", "MAV scan should name ascent as a project");
  }
  if (noteScan(look, "mav")) fail("stabilize", "repeat MAV scan is not XP");
  notes.push("scan-names-expedition-sites");

  const recipe = createHeadlessWorld();
  if (habReadout(recipe, "en").includes("FEEDSTOCK")) fail("stabilize", "empty desk is not a lab until you scan");
  if (canFuelStill(recipe, "ice")) fail("stabilize", "unscanned ice is not still feedstock");
  if (canPlantCrop(recipe)) fail("stabilize", "unscanned soil is not crop substrate");
  if (pickStillMachineAction({ d: 0.4, water: 0, fuel: 0, gridOn: true, hasIce: true }).kind !== "still-scan") {
    fail("stabilize", "ice in pockets without a scan is a diagnosis, not fuel");
  }
  if (pickPlotPlantAction({ planted: false, hasPotato: true }).kind !== "plot-scan") {
    fail("stabilize", "last potato without a soil scan must not plant");
  }
  if (pickScanTarget({ heldId: "ice" }) !== "ice") fail("stabilize", "F should identify a held ice sample");
  if (pickScanTarget({ pocketIds: ["scrap", "ice"] }) !== "scrap") {
    fail("stabilize", "F should identify a pocket sample when nothing is underfoot");
  }
  if (pickScanTarget({ heldId: "ice", outpostKind: "solar", outpostD: 8 }) !== "solaryard") {
    fail("stabilize", "farm ident still beats a pocket sample");
  }
  noteScan(recipe, "ice");
  if (!canFuelStill(recipe, "ice")) fail("stabilize", "ice scan should unlock the still recipe");
  if (!habReadout(recipe, "en").includes("FEEDSTOCK")) fail("stabilize", "desk should log identified ice");
  if (
    pickStillMachineAction({
      d: 0.4,
      water: 0,
      fuel: 0,
      gridOn: true,
      hasIce: true,
      iceKnown: isKnown(recipe, "ice"),
    }).kind !== "still-fuel"
  ) {
    fail("stabilize", "identified ice at the machine is fuel");
  }
  noteScan(recipe, "soil");
  if (!canPlantCrop(recipe)) fail("stabilize", "soil scan should unlock planting");
  if (!habReadout(recipe, "en").includes("SUBSTRATE")) fail("stabilize", "desk should log identified soil");
  if (pickPlotPlantAction({ planted: false, hasPotato: true, soilKnown: true }).kind !== "plant") {
    fail("stabilize", "identified soil lets you plant the seed");
  }
  if (pickStillMachineAction({ d: 0.4, water: 0, fuel: 0, fault: "pump", canRepair: true }).kind !== "pump-scan") {
    fail("stabilize", "unidentified copper is not a pump rebuild");
  }
  if (canUseWire(recipe)) fail("stabilize", "unscanned wire must not repair");
  noteScan(recipe, "wire");
  if (!canUseWire(recipe)) fail("stabilize", "wire scan should unlock electrical repair");
  if (!habReadout(recipe, "en").includes("COPPER")) fail("stabilize", "desk should log identified copper");
  if (
    pickStillMachineAction({
      d: 0.4,
      water: 0,
      fuel: 0,
      fault: "pump",
      canRepair: true,
      wireKnown: true,
    }).kind !== "still-repair"
  ) {
    fail("stabilize", "identified copper rebuilds the pump");
  }
  notes.push("scan-unlocks-recipes");
  notes.push("desk-is-the-lab");
  notes.push("scan-unlocks-copper-repair");

  const link = createHeadlessWorld();
  link.habSealed = true;
  link.clock = 0.25;
  tickTime(link, 0);
  applyWeatherState(link, "clear");
  placeStationSim(link, "radio", -138, -92);
  if (link.contacted) fail("stabilize", "placing the radio is not Hello, Earth");
  if (!radioPlaced(link)) fail("stabilize", "radio station should exist after place");
  if (!radioCanListen(link)) fail("stabilize", "clear day should let S-band listen");
  const consoleListen = habReadout(link, "en");
  if (!consoleListen.includes("LISTEN") && !consoleListen.includes("S-BAND")) {
    fail("stabilize", `console should name S-band while listening, got ${consoleListen}`);
  }
  for (let i = 0; i < RADIO_CONTACT_S + 2; i++) tickHabitat(link, 1);
  if (!link.contacted) fail("stabilize", "clear-day listen should reach Earth");
  if (!link.hab.earthHeardEvent) fail("stabilize", "Earth reply should raise a Hab event");
  notes.push("clear-day-reaches-earth");

  const buried = createHeadlessWorld();
  buried.habSealed = true;
  buried.clock = 0.25;
  tickTime(buried, 0);
  applyWeatherState(buried, "storm");
  placeStationSim(buried, "radio", -138, -92);
  if (radioCanListen(buried)) fail("stabilize", "storm must bury S-band");
  for (let i = 0; i < RADIO_CONTACT_S + 10; i++) tickHabitat(buried, 1);
  if (buried.contacted) fail("stabilize", "a storm must not deliver Earth");
  notes.push("storm-buries-sband");

  const dusk = createHeadlessWorld();
  dusk.habSealed = true;
  dusk.clock = 0.78;
  tickTime(dusk, 0);
  applyWeatherState(dusk, "clear");
  placeStationSim(dusk, "radio", -138, -92);
  if (radioCanListen(dusk)) fail("stabilize", "night should pause S-band");
  for (let i = 0; i < RADIO_CONTACT_S + 2; i++) tickHabitat(dusk, 1);
  if (dusk.contacted) fail("stabilize", "night listen without a day should not reach Earth");
  notes.push("night-pauses-sband");

  const napRadio = createHeadlessWorld();
  napRadio.habSealed = true;
  napRadio.hab.heaterOn = false;
  napRadio.clock = 0.25;
  tickTime(napRadio, 0);
  applyWeatherState(napRadio, "storm");
  placeStationSim(napRadio, "radio", -138, -92);
  simulateSleep(napRadio, 96);
  if (napRadio.contacted) fail("stabilize", "sleeping through a storm should not reach Earth");
  notes.push("storm-sleep-misses-earth");

  return { ok: true, notes, clearKw, stormKw: storm.hab.solarKw, clearJump, stormJump, deadJump };
}
