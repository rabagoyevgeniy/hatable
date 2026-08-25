/** First-Sol gut: leftover tank, seed potato. No Three.js. */

export const TANK_SIP_L = 0.4;
export const TANK_MIN_L = 0.35;
export const TANK_SIP_THIRST = 22;
export const SLEEP_HUNGER = 12;
export const SLEEP_THIRST = 16;

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
