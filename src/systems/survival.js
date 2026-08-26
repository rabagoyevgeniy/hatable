/** First-Sol gut: leftover tank, seed potato, sleep, tank sip. No Three.js. */

import { SURVIVAL, HAB_POS, OUTPOSTS, NODE_SPAWNS } from "../data.js";
import { advanceSolSim, habCanRefillSuit } from "./habitat.js";

export const TANK_SIP_L = 0.4;
export const TANK_MIN_L = 0.35;
export const TANK_SIP_THIRST = 22;
export const SLEEP_HUNGER = 12;
export const SLEEP_THIRST = 16;
export const SLEEP_TOO_WEAK = 18;

function clamp100(v) {
  return Math.max(0, Math.min(100, v));
}

/** Last uncopied potato is seed, not lunch. */
export function canEatPotato(player) {
  const n = player.inv?.potato || 0;
  if (n <= 0) return false;
  if (n <= 1 && !player.harvestedCrop) return false;
  return true;
}

/** Escape cargo: water plus a potato that is not the last seed. Pockets only — the locker stays in the Hab. */
export function hasMavCargo(player) {
  return (player.inv?.water || 0) >= 1 && canEatPotato(player);
}

export function tankSipsLeft(liters, sip = TANK_SIP_L, min = TANK_MIN_L) {
  let n = 0;
  let t = liters;
  while (t >= min) {
    t -= sip;
    n += 1;
    if (n > 40) break;
  }
  return n;
}

export function gutAfterHab(seconds, hunger = 64, thirst = 62, rates = { hungerHab: 0.1, thirstHab: 0.12 }) {
  return {
    hunger: hunger - seconds * rates.hungerHab,
    thirst: thirst - seconds * rates.thirstHab,
  };
}

export function sipHabitatTank(world, player) {
  const tank = world.hab?.waterTank ?? 0;
  if (tank < TANK_MIN_L) return { ok: false, reason: "empty" };
  world.hab.waterTank = Math.max(0, tank - TANK_SIP_L);
  player.thirst = clamp100(player.thirst + TANK_SIP_THIRST);
  player.drank = true;
  return { ok: true };
}

/** Bunk sleep. `advance` defaults to the Three-free Sol tick. */
export function trySleepSol(player, world, advance = advanceSolSim) {
  if (player.hunger < SLEEP_TOO_WEAK || player.thirst < SLEEP_TOO_WEAK) return "tooWeak";
  advance(world);
  player.hunger = clamp100(player.hunger - SLEEP_HUNGER);
  player.thirst = clamp100(player.thirst - SLEEP_THIRST);
  if (habCanRefillSuit(world)) player.oxygen = 100;
  else player.oxygen = clamp100(player.oxygen + 12);
  player.warmth = clamp100(world.hab?.insideC > 12 ? 86 : player.warmth + 14);
  return "slept";
}

/** Flat-ground wish speed — same number the body uses. */
export const WALK_MPS = 5.8;

export function suitDrainRates(world) {
  const storm = world.storm || 0;
  const night = (world.daylight || 1) < 0.28;
  return {
    o2: SURVIVAL.o2Outside + (world.habSealed ? 0.05 : 0.22) + storm * SURVIVAL.o2Storm,
    warmth: (night ? SURVIVAL.warmthNight : SURVIVAL.warmthDay) * (storm + 0.55),
    thirst: SURVIVAL.thirstWalk,
    hunger: SURVIVAL.hungerWalk,
  };
}

export function walkMetersPerSecond(player, world) {
  const storm = world.storm || 0;
  let walk = WALK_MPS;
  if ((player.hunger ?? 100) < 18 || (player.thirst ?? 100) < 18) walk *= SURVIVAL.starveSlow;
  if ((player.warmth ?? 100) < 12) walk *= 0.7;
  if (storm > 0.4) walk *= Math.max(0.45, 1 - (storm - 0.4) * 0.5);
  return walk;
}

/** Round-trip metres you can survive on current O₂, warmth, thirst, and hunger. Missing gut stats assume full. */
export function estimateRangeM(player, world) {
  const rates = suitDrainRates(world);
  const o2Seconds = (player.oxygen ?? 0) / Math.max(0.08, rates.o2);
  const warmthSeconds = (player.warmth ?? 0) / Math.max(0.08, rates.warmth);
  const thirstSeconds = (player.thirst ?? 100) / Math.max(0.08, rates.thirst);
  const hungerSeconds = (player.hunger ?? 100) / Math.max(0.08, rates.hunger);
  const seconds = Math.min(o2Seconds, warmthSeconds, thirstSeconds, hungerSeconds);
  return (seconds * walkMetersPerSecond(player, world)) / 2;
}

export function roundTripM(from, to) {
  return Math.hypot((to.x ?? 0) - (from.x ?? 0), (to.z ?? 0) - (from.z ?? 0)) * 2;
}

export function canRoundTrip(player, world, dest, from = { x: 0, z: 8 }) {
  return estimateRangeM(player, world) + 0.01 >= roundTripM(from, dest);
}

/** Desk packing list: round-trips you can survive right now. No new HUD meters. */
export function packingDestinations() {
  const wire = NODE_SPAWNS.find((n) => n.type === "wire" && n.x > 40 && n.z > 90);
  const pathfinder = OUTPOSTS.find((o) => o.id === "pathfinder");
  const mav = OUTPOSTS.find((o) => o.id === "mav");
  return [
    { id: "wire", dest: wire, en: "WIRE", ru: "ПРОВОД" },
    { id: "pathfinder", dest: pathfinder, en: "PATHFINDER", ru: "PATHFINDER" },
    { id: "mav", dest: mav, en: "MAV", ru: "МАВ" },
  ].filter((d) => d.dest);
}

export function packingLines(player, world, lang = "en") {
  if (!player || !world) return [];
  if (!world.habSealed) return [];
  const ru = lang === "ru";
  const range = estimateRangeM(player, world);
  const out = [];
  for (const d of packingDestinations()) {
    const trip = roundTripM(HAB_POS, d.dest);
    const ok = range + 0.01 >= trip;
    const km = trip < 100 ? "<0.1" : (trip / 1000).toFixed(1);
    const name = ru ? d.ru : d.en;
    let flag = ok ? (ru ? "ДОСЯГАЕМ" : "IN RANGE") : ru ? "ДАЛЕКО" : "OUT OF RANGE";
    if (ok && d.id === "mav" && world.contacted && !hasMavCargo(player)) {
      flag = ru ? "НЕТ ГРУЗА" : "NO CARGO";
    }
    out.push(`${name}  ${km} km  ${flag}`);
  }
  return out;
}
