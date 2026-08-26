/** Discovery database. Scanning identifies; it does not grant XP. */

export const SCAN_DB = {
  scrap: {
    en: "Aluminum-lithium wreckage. Structural salvage.",
    ru: "Обломки Al-Li. Конструкционный лом.",
  },
  rock: {
    en: "Basaltic regolith clast. Hammer head, ballast.",
    ru: "Базальтовый обломок. Боёк молотка, балласт.",
  },
  ice: {
    en: "Exposed H₂O ice. Still feedstock.",
    ru: "Открытый лёд H₂O. Сырьё для дистиллятора.",
  },
  fabric: {
    en: "EVA canvas. Patch material.",
    ru: "Брезент EVA. Материал заплаты.",
  },
  tape: {
    en: "Polymer adhesive. Pressure seals.",
    ru: "Полимерный скотч. Герметика.",
  },
  soil: {
    en: "Perchlorate-bearing regolith. Crop substrate if washed.",
    ru: "Реголит с перхлоратами. Субстрат, если промыть.",
  },
  potato: {
    en: "Solanum tuberosum. Calories if you can keep it alive.",
    ru: "Solanum tuberosum. Калории, если выживет.",
  },
  water: {
    en: "Processed H₂O. Drink, irrigate, life support.",
    ru: "Обработанная H₂O. Пить, полив, жизнеобеспечение.",
  },
  solar: {
    en: "Photovoltaic cell. Roof array is missing several of these.",
    ru: "Фотоэлемент. В кровельном массиве не хватает нескольких.",
  },
  wire: {
    en: "Copper run. Power and repair.",
    ru: "Медная жила. Питание и ремонт.",
  },
  comms: {
    en: "S-band board. Pathfinder-class radio.",
    ru: "Плата S-диапазона. Рация класса Pathfinder.",
  },
  hydrazine: {
    en: "N₂H₄. Irresponsible chemistry. Excellent still fuel.",
    ru: "N₂H₄. Безответственная химия. Отличное топливо для дистиллятора.",
  },
  hab: {
    en: "Habitat hull. Internal pressure below spec. Leak on the north skin.",
    ru: "Корпус Hab. Давление ниже нормы. Утечка на северной обшивке.",
  },
  leak: {
    en: "Hull puncture. Pressure falling. Canvas + tape.",
    ru: "Пробой корпуса. Давление падает. Брезент + скотч.",
  },
  solaryard: {
    en: "Ares III solar farm. Spare cells and copper. The roof-cable splice lives here.",
    ru: "Солнечная ферма Арис III. Запасные элементы и медь. Здесь жила для кабеля крыши.",
  },
  pathfinder: {
    en: "Ares III Pathfinder. S-band uplink if you bring a radio. Storms bury the signal.",
    ru: "Pathfinder Арис III. S-диапазон, если принесёшь рацию. Буря хоронит сигнал.",
  },
};

import { STORM_GRACE_S } from "./weather.js";

export const DUST_HIDES_BEACONS = 0.42;
/** Further than this, even a clear day has no cheat ring — scan or walk in. */
export const LOOT_RING_RANGE = 22;

/** Debug loot rings. Dust eats them; distance eats them; hold F / Scan to see. */
export function lootBeaconVisible({
  starter = false,
  storm = 0,
  scanning = false,
  playTime = 0,
  dist = 0,
} = {}) {
  if (scanning) return true;
  if (starter && (playTime || 0) < STORM_GRACE_S) return true;
  if (storm >= DUST_HIDES_BEACONS) return false;
  if (!starter && dist > LOOT_RING_RANGE) return false;
  return true;
}

export function createScience() {
  return { known: {} };
}

export function isKnown(world, id) {
  return !!(id && world?.science?.known?.[id]);
}

/** Ice / hydrazine is still feedstock only after a scan. Not a +12% buff. */
export function canFuelStill(world, fuelId) {
  return fuelId === "ice" || fuelId === "hydrazine" ? isKnown(world, fuelId) : false;
}

/** Perchlorate soil is crop substrate only after a scan. */
export function canPlantCrop(world) {
  return isKnown(world, "soil");
}

/** Copper run is electrical repair only after a scan. Leak patch stays ungated. */
export function canUseWire(world) {
  return isKnown(world, "wire");
}

export function noteScan(world, id) {
  if (!id) return null;
  if (!world.science) world.science = createScience();
  if (world.science.known[id]) return null;
  const entry = SCAN_DB[id];
  if (!entry) return null;
  world.science.known[id] = true;
  return entry;
}

export function scanCount(world) {
  return Object.keys(world.science?.known || {}).length;
}

/** What F identifies this frame. Loot underfoot beats a place. A held sample beats nothing. No XP. */
export function pickScanTarget({
  nodeType = null,
  nodeD = 99,
  inside = false,
  sealed = true,
  outpostKind = null,
  outpostD = 99,
  heldId = null,
  pocketIds = [],
} = {}) {
  if (nodeType && nodeD < 5.2) return nodeType;
  if (inside) return sealed ? "hab" : "leak";
  if (outpostKind && outpostKind !== "hab" && outpostD < 16) {
    return outpostKind === "solar" ? "solaryard" : outpostKind;
  }
  if (heldId && SCAN_DB[heldId]) return heldId;
  for (const id of pocketIds) {
    if (id && SCAN_DB[id]) return id;
  }
  return null;
}

/** Clear-day S-band listen after the radio is placed. Storms bury it. Placing is not Hello Earth. */
export const RADIO_CONTACT_S = 48;
export const SBAND_DAY = 0.28;

export function radioPlaced(world) {
  return (world.stations || []).some((s) => s.type === "radio");
}

export function radioCanListen(world) {
  if (!radioPlaced(world) || world.contacted) return false;
  if ((world.storm || 0) >= DUST_HIDES_BEACONS) return false;
  if ((world.daylight || 0) < SBAND_DAY) return false;
  return true;
}

export function tickRadio(world, dt) {
  if (!world || world.contacted) return;
  if (!radioPlaced(world)) return;
  if (!world.radio) world.radio = { listenS: 0 };
  if (!radioCanListen(world)) return;
  world.radio.listenS += dt;
  if (world.radio.listenS >= RADIO_CONTACT_S) {
    world.contacted = true;
    if (world.hab) world.hab.earthHeardEvent = true;
  }
}
