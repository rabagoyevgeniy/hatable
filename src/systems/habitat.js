/** Lightweight Hab machine: pressure, solar, battery, temperature, water. */

import { tickStillOnSleep } from "./machines.js";
import { tickStormDamage } from "./weather.js";
import { tickRadio, radioPlaced, labLines } from "./science.js";

export const SOL_SECONDS = 220;
/** Suit O₂ refills inside only above this. Dead-grid bleed floors below it. */
export const HAB_REFILL_P = 0.48;
export const HAB_DEAD_P_FLOOR = 0.42;

export function habCanRefillSuit(world) {
  return !!(world?.habSealed && world.hab && world.hab.pressure > HAB_REFILL_P);
}

/** Cold Hab still calls for heat at noon — that load can hold a blackout. */
export const HEATER_INSIDE_C = 16;

export function heaterDrawsLoad(hab, daylight) {
  if (!hab?.heaterOn) return false;
  const day = Math.max(0, daylight || 0);
  return 1 - day > 0.5 || (hab.insideC ?? 0) < HEATER_INSIDE_C;
}
/** Sleep jump toward harvest. Four watered Sols can finish. */
export const CROP_SLEEP = 0.52;
/** Realtime trickle — standing a Sol is not a harvest. */
export const CROP_LIVE = 0.002;
/** One Sol compresses this many hours of energy accounting. Night should matter. */
const ENERGY_HOURS = 4.2;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function createHabitat() {
  return {
    pressure: 0.58,
    leakRate: 0.00115,
    oxygenTank: 36,
    battery: 0.58,
    capacityKwh: 7.5,
    solarKw: 0,
    loadKw: 0,
    outsideC: -18,
    insideC: 8,
    heaterOn: true,
    lightsOn: true,
    lifeSupportOn: true,
    waterTank: 2.2,
    arrayHealth: 0.31,
    cableFault: false,
    cableStress: 0,
    gridOn: true,
  };
}

export function tickTime(world, dt) {
  world.clock = (world.clock + dt / SOL_SECONDS) % 1;
  world.daylight = 0.5 + 0.5 * Math.sin(world.clock * Math.PI * 2);
}

export function cropFactors(world) {
  const storm = world.storm || 0;
  const light = Math.max(0.06, (world.daylight || 0) * (1 - storm * 0.78));
  const hab = world.hab;
  const sheltered = !!(world.habSealed && hab?.gridOn);
  const tC = sheltered ? hab?.insideC ?? 8 : hab?.outsideC ?? -20;
  const temp = Math.max(0.12, Math.min(1, (tC + 40) / 52));
  return { light, temp };
}

/**
 * A slept Sol is a day of growth, not the night you wake into.
 * Storm cuts light. Dead grid / unsealed hull uses Mars-outside cold.
 */
export function cropSleepFactors(world) {
  return cropFactors({ ...world, daylight: 0.85 });
}

export function tickHabitat(world, dt) {
  const h = world.hab;
  if (!h) return;
  tickStormDamage(world, dt);
  const day = Math.max(0, world.daylight || 0);
  const storm = world.storm || 0;
  const solarCount = (world.stations || []).filter((s) => s.type === "solar").length;
  const roof = h.cableFault ? 0 : 2.85 * h.arrayHealth * day * (1 - storm * 0.82);
  const extra = solarCount * 1.7 * day * (1 - storm * 0.82);
  h.solarKw = roof + extra;

  let load = 0;
  if (h.lifeSupportOn) load += world.habSealed ? 0.38 : 0.58;
  if (heaterDrawsLoad(h, day)) load += 0.5;
  if (h.lightsOn) load += 0.11;
  const stillsFueled = (world.stations || []).filter((s) => s.type === "still" && s.fuel > 0 && !s.fault);
  // Offline still is dark: no flask, no tank trickle, no phantom kW fighting dawn recovery.
  if (h.gridOn) load += stillsFueled.length * 0.32;
  h.loadKw = load;

  if (!h.gridOn) {
    h.solarKw = roof + extra;
  }

  const net = h.solarKw - h.loadKw;
  const kWh = (net * dt * ENERGY_HOURS) / SOL_SECONDS;
  h.battery = clamp01(h.battery + kWh / h.capacityKwh);
  h.gridOn = h.battery > 0.025;

  if (!world.habSealed) {
    h.pressure = Math.max(0.14, h.pressure - h.leakRate * dt);
    h.oxygenTank = Math.max(0, h.oxygenTank - 0.55 * dt);
  } else if (h.gridOn && h.lifeSupportOn) {
    h.pressure = Math.min(1, h.pressure + 0.018 * dt);
    h.oxygenTank = Math.min(100, h.oxygenTank + 0.85 * dt);
  } else {
    h.pressure = Math.max(HAB_DEAD_P_FLOOR, h.pressure - 0.0009 * dt);
  }

  h.outsideC = -64 + day * 52 - storm * 16;
  const targetIn = !world.habSealed ? -6 + day * 8 : h.gridOn && h.heaterOn ? 19 : 3 + day * 4;
  h.insideC += (targetIn - h.insideC) * Math.min(1, dt * 0.07);

  if (world.habSealed && h.lifeSupportOn && h.gridOn) {
    h.waterTank = Math.max(0, h.waterTank - 0.0028 * dt);
  }
  for (const st of stillsFueled) {
    if (h.gridOn) h.waterTank = Math.min(40, h.waterTank + dt * 0.028);
  }
  tickRadio(world, dt);
}

export function simulateSleep(world, seconds = 96) {
  const steps = 32;
  const dt = seconds / steps;
  const weatherTick = world._tickWeather;
  for (let i = 0; i < steps; i++) {
    tickTime(world, dt);
    world.playTime = (world.playTime || 0) + dt;
    if (typeof weatherTick === "function") weatherTick(world, dt);
    tickHabitat(world, dt);
  }
}

export function tickCropsOnSleep(world) {
  const f = cropSleepFactors(world);
  for (const st of world.stations || []) {
    if (st.type !== "plot" || !st.planted) continue;
    const moist = st.moisture ?? 0.4;
    st.grow = Math.min(1, st.grow + CROP_SLEEP * f.light * f.temp * Math.max(0.22, moist));
    st.moisture = Math.max(0.08, moist * 0.72);
  }
}

/** Three-free Sol advance used by bunk sleep and the first-sol harness. */
export function advanceSolSim(world) {
  simulateSleep(world, 96);
  tickCropsOnSleep(world);
  tickStillOnSleep(world);
}

export function habReadout(world, lang = "ru") {
  const h = world.hab;
  if (!h) return "";
  const ru = lang === "ru";
  const leak = world.habSealed ? (ru ? "ГЕРМЕТИКА" : "SEALED") : (ru ? "УТЕЧКА" : "LEAK");
  const grid = h.gridOn ? (ru ? "СЕТЬ ЖИВА" : "GRID LIVE") : (ru ? "СЕТЬ МЕРТВА" : "GRID DEAD");
  const heat = h.heaterOn ? (ru ? "ВКЛ" : "ON") : (ru ? "ВЫКЛ" : "OFF");
  const lights = h.lightsOn ? (ru ? "ВКЛ" : "ON") : (ru ? "ВЫКЛ" : "OFF");
  const lines = [
    `${ru ? "ДАВЛЕНИЕ" : "PRESSURE"}  ${(h.pressure * 100).toFixed(0)}%   ${leak}`,
    `${ru ? "БАТАРЕЯ" : "BATTERY"}   ${(h.battery * 100).toFixed(0)}%   ${grid}`,
    `${ru ? "СОЛНЦЕ" : "SOLAR"}     ${h.solarKw.toFixed(2)} kW`,
    `${ru ? "НАГРУЗКА" : "LOAD"}     ${h.loadKw.toFixed(2)} kW`,
    `${ru ? "O₂ HAB" : "HAB O2"}    ${h.oxygenTank.toFixed(0)}%`,
    `${ru ? "ВОДА HAB" : "HAB H2O"}   ${h.waterTank.toFixed(1)} L`,
    `${ru ? "СНАРУЖИ" : "OUTSIDE"}   ${h.outsideC.toFixed(0)}°C`,
    `${ru ? "ВНУТРИ" : "INSIDE"}    ${h.insideC.toFixed(0)}°C`,
    `${ru ? "МАССИВ" : "ARRAY"}     ${h.cableFault ? (ru ? "КАБЕЛЬ" : "CABLE") : `${(h.arrayHealth * 100).toFixed(0)}%`}`,
    `${ru ? "ПЕЧЬ" : "HEATER"}    ${heat}   ${ru ? "СВЕТ" : "LIGHTS"} ${lights}`,
    `${ru ? "ДИСТИЛЛ" : "STILL"}    ${h.gridOn ? (ru ? "СЕТЬ ОК" : "GRID OK") : (ru ? "НЕТ СЕТИ" : "NO GRID")}`,
  ];
  if (radioPlaced(world)) {
    let band = world.contacted ? (ru ? "ЗЕМЛЯ" : "EARTH") : ru ? "СЛУШАЕМ" : "LISTEN";
    if (!world.contacted && (world.storm || 0) >= 0.42) band = ru ? "ПЫЛЬ" : "DUST";
    else if (!world.contacted && (world.daylight || 0) < 0.28) band = ru ? "НОЧЬ" : "NIGHT";
    lines.push(`${ru ? "S-ДИАП" : "S-BAND"}    ${band}`);
  }
  lines.push(...labLines(world, lang));
  return lines.join("\n");
}

export function habAlerts(world, lang = "ru") {
  const h = world.hab;
  if (!h) return [];
  const ru = lang === "ru";
  const out = [];
  if (!world.habSealed) out.push(ru ? "УТЕЧКА · ДАВЛЕНИЕ ПАДАЕТ" : "LEAK · PRESSURE FALLING");
  else if (h.pressure < 0.55) out.push(ru ? `ДАВЛЕНИЕ ${(h.pressure * 100).toFixed(0)}%` : `PRESSURE ${(h.pressure * 100).toFixed(0)}%`);
  if (h.cableFault) out.push(ru ? "КАБЕЛЬ МАССИВА · ПРОВОД НА КЛАДБИЩЕ ПАНЕЛЕЙ" : "ARRAY CABLE OPEN — wire at the solar wreck");
  else if (h.arrayHealth < 0.5) out.push(ru ? `МАССИВ ${(h.arrayHealth * 100).toFixed(0)}%` : `ARRAY ${(h.arrayHealth * 100).toFixed(0)}%`);
  if (h.solarKw + 0.05 < h.loadKw) out.push(ru ? "ДЕФИЦИТ МОЩНОСТИ" : "POWER DEFICIT");
  if (h.battery < 0.2) out.push(ru ? `БАТАРЕЯ ${(h.battery * 100).toFixed(0)}%` : `BATTERY ${(h.battery * 100).toFixed(0)}%`);
  if ((world.daylight || 0) < 0.32 && h.solarKw < 0.08) out.push(ru ? "НОЧЬ · СОЛНЦА НЕТ" : "NIGHT · NO SOLAR");
  if (h.waterTank < 1.0) out.push(ru ? "ВОДА HAB НИЗКАЯ" : "HAB WATER LOW");
  const fueled = (world.stations || []).some((s) => s.type === "still" && s.fuel > 0);
  if (fueled && !h.gridOn) out.push(ru ? "ДИСТИЛЛЯТОР БЕЗ СЕТИ" : "STILL OFFLINE — NO POWER");
  if ((world.stations || []).some((s) => s.type === "still" && s.fault === "pump")) {
    out.push(ru ? "НАСОС ДИСТИЛЛЯТОРА" : "STILL PUMP FAILED");
  }
  if (radioPlaced(world) && !world.contacted) {
    if ((world.storm || 0) >= 0.42) out.push(ru ? "S-ДИАПАЗОН В ПЫЛИ" : "S-BAND BURIED IN DUST");
    else if ((world.daylight || 0) < 0.28) out.push(ru ? "S-ДИАПАЗОН · ЖДИ ДНЯ" : "S-BAND — WAIT FOR DAY");
    else out.push(ru ? "СЛУШАЕМ ЗЕМЛЮ" : "LISTENING FOR EARTH");
  }
  return out;
}

export function stillOnline(world) {
  return !!world.hab?.gridOn;
}

export function habStatusLine(world, lang = "ru") {
  const h = world.hab;
  if (!h) return lang === "ru" ? "НЕТ ДАННЫХ" : "NO DATA";
  const alerts = habAlerts(world, lang);
  if (alerts[0]) return alerts[0];
  return `P ${(h.pressure * 100).toFixed(0)}%  BAT ${(h.battery * 100).toFixed(0)}%  ${h.solarKw.toFixed(1)}kW`;
}

export function consumeHabEvents(hab) {
  const events = [];
  if (!hab) return events;
  if (hab.cableSnapEvent) {
    events.push("cable-snap");
    hab.cableSnapEvent = false;
  }
  if (hab.earthHeardEvent) {
    events.push("earth-heard");
    hab.earthHeardEvent = false;
  }
  return events;
}
