/** First-Sol gut: leftover tank, seed potato, sleep, tank sip. No Three.js. */

import { SURVIVAL } from "../data.js";
import { advanceSolSim } from "./habitat.js";

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
  if (world.habSealed) player.oxygen = 100;
  else player.oxygen = clamp100(player.oxygen + 12);
  player.warmth = clamp100(world.hab?.insideC > 12 ? 86 : player.warmth + 14);
  return "slept";
}

/** Match the walk speed baked into the old O₂ range line. */
export const WALK_MPS = 3.05;

export function suitDrainRates(world) {
  const storm = world.storm || 0;
  const night = (world.daylight || 1) < 0.28;
  return {
    o2: SURVIVAL.o2Outside + (world.habSealed ? 0.05 : 0.22) + storm * SURVIVAL.o2Storm,
    warmth: (night ? SURVIVAL.warmthNight : SURVIVAL.warmthDay) * (storm + 0.55),
  };
}

/** Round-trip metres you can survive on current O₂ and warmth. */
export function estimateRangeM(player, world) {
  const rates = suitDrainRates(world);
  const o2Seconds = (player.oxygen ?? 0) / Math.max(0.08, rates.o2);
  const warmthSeconds = (player.warmth ?? 0) / Math.max(0.08, rates.warmth);
  const seconds = Math.min(o2Seconds, warmthSeconds);
  return (seconds * WALK_MPS) / 2;
}

export function roundTripM(from, to) {
  return Math.hypot((to.x ?? 0) - (from.x ?? 0), (to.z ?? 0) - (from.z ?? 0)) * 2;
}

export function canRoundTrip(player, world, dest, from = { x: 0, z: 8 }) {
  return estimateRangeM(player, world) + 0.01 >= roundTripM(from, dest);
}
