/** Lightweight Hab machine: pressure, solar, battery, temperature, water. */

export const SOL_SECONDS = 220;
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
    waterTank: 5.5,
    arrayHealth: 0.31,
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
  const outside = world.hab?.outsideC ?? -20;
  const temp = Math.max(0.12, Math.min(1, (outside + 40) / 52));
  return { light, temp };
}

export function tickHabitat(world, dt) {
  const h = world.hab;
  if (!h) return;
  const day = Math.max(0, world.daylight || 0);
  const night = 1 - day;
  const storm = world.storm || 0;
  const solarCount = (world.stations || []).filter((s) => s.type === "solar").length;
  const iceBonus = world.science?.known?.ice ? 1.12 : 1;

  const roof = 2.85 * h.arrayHealth * day * (1 - storm * 0.82);
  const extra = solarCount * 1.7 * day * (1 - storm * 0.82);
  h.solarKw = roof + extra;

  let load = 0;
  if (h.lifeSupportOn) load += world.habSealed ? 0.38 : 0.58;
  if (h.heaterOn && (night > 0.5 || h.insideC < 16)) load += 0.5;
  if (h.lightsOn) load += 0.11;
  const stills = (world.stations || []).filter((s) => s.type === "still" && s.fuel > 0);
  load += stills.length * 0.32;
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
    h.pressure = Math.max(0.42, h.pressure - 0.0009 * dt);
  }

  h.outsideC = -64 + day * 52 - storm * 16;
  const targetIn = !world.habSealed ? -6 + day * 8 : h.gridOn && h.heaterOn ? 19 : 3 + day * 4;
  h.insideC += (targetIn - h.insideC) * Math.min(1, dt * 0.07);

  if (world.habSealed && h.lifeSupportOn && h.gridOn) {
    h.waterTank = Math.max(0, h.waterTank - 0.0028 * dt);
  }
  for (const st of stills) {
    h.waterTank = Math.min(40, h.waterTank + dt * 0.028 * iceBonus);
  }
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

export function habReadout(world, lang = "ru") {
  const h = world.hab;
  if (!h) return "";
  const ru = lang === "ru";
  const leak = world.habSealed ? (ru ? "ГЕРМЕТИКА" : "SEALED") : (ru ? "УТЕЧКА" : "LEAK");
  const grid = h.gridOn ? (ru ? "СЕТЬ ЖИВА" : "GRID LIVE") : (ru ? "СЕТЬ МЕРТВА" : "GRID DEAD");
  const heat = h.heaterOn ? (ru ? "ВКЛ" : "ON") : (ru ? "ВЫКЛ" : "OFF");
  const lights = h.lightsOn ? (ru ? "ВКЛ" : "ON") : (ru ? "ВЫКЛ" : "OFF");
  return [
    `${ru ? "ДАВЛЕНИЕ" : "PRESSURE"}  ${(h.pressure * 100).toFixed(0)}%   ${leak}`,
    `${ru ? "БАТАРЕЯ" : "BATTERY"}   ${(h.battery * 100).toFixed(0)}%   ${grid}`,
    `${ru ? "СОЛНЦЕ" : "SOLAR"}     ${h.solarKw.toFixed(2)} kW`,
    `${ru ? "НАГРУЗКА" : "LOAD"}     ${h.loadKw.toFixed(2)} kW`,
    `${ru ? "O₂ HAB" : "HAB O2"}    ${h.oxygenTank.toFixed(0)}%`,
    `${ru ? "ВОДА HAB" : "HAB H2O"}   ${h.waterTank.toFixed(1)} L`,
    `${ru ? "СНАРУЖИ" : "OUTSIDE"}   ${h.outsideC.toFixed(0)}°C`,
    `${ru ? "ВНУТРИ" : "INSIDE"}    ${h.insideC.toFixed(0)}°C`,
    `${ru ? "МАССИВ" : "ARRAY"}     ${(h.arrayHealth * 100).toFixed(0)}%`,
    `${ru ? "ПЕЧЬ" : "HEATER"}    ${heat}   ${ru ? "СВЕТ" : "LIGHTS"} ${lights}`,
  ].join("\n");
}

export function habAlerts(world, lang = "ru") {
  const h = world.hab;
  if (!h) return [];
  const ru = lang === "ru";
  const out = [];
  if (!world.habSealed) out.push(ru ? "УТЕЧКА · ДАВЛЕНИЕ ПАДАЕТ" : "LEAK · PRESSURE FALLING");
  else if (h.pressure < 0.55) out.push(ru ? `ДАВЛЕНИЕ ${(h.pressure * 100).toFixed(0)}%` : `PRESSURE ${(h.pressure * 100).toFixed(0)}%`);
  if (h.solarKw + 0.05 < h.loadKw) out.push(ru ? "ДЕФИЦИТ МОЩНОСТИ" : "POWER DEFICIT");
  if (h.battery < 0.2) out.push(ru ? `БАТАРЕЯ ${(h.battery * 100).toFixed(0)}%` : `BATTERY ${(h.battery * 100).toFixed(0)}%`);
  if ((world.daylight || 0) < 0.32 && h.solarKw < 0.08) out.push(ru ? "НОЧЬ · СОЛНЦА НЕТ" : "NIGHT · NO SOLAR");
  if (h.arrayHealth < 0.5) out.push(ru ? `МАССИВ ${(h.arrayHealth * 100).toFixed(0)}%` : `ARRAY ${(h.arrayHealth * 100).toFixed(0)}%`);
  if (h.waterTank < 1.2) out.push(ru ? "ВОДА HAB НИЗКАЯ" : "HAB WATER LOW");
  return out;
}

export function habStatusLine(world, lang = "ru") {
  const h = world.hab;
  if (!h) return lang === "ru" ? "НЕТ ДАННЫХ" : "NO DATA";
  const alerts = habAlerts(world, lang);
  if (alerts[0]) return alerts[0];
  return `P ${(h.pressure * 100).toFixed(0)}%  BAT ${(h.battery * 100).toFixed(0)}%  ${h.solarKw.toFixed(1)}kW`;
}
