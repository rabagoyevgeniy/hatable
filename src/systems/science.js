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
};

export function createScience() {
  return { known: {} };
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
