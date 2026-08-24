const strings = {
  en: {
    eyebrow: "ARES III — ACIDALIA PLANITIA",
    tagline: "You were left for dead. Scavenge. Craft. Survive. Science the shit out of it.",
    begin: "WAKE UP",
    clickHint: "WASD to walk. E to gather. C to craft. Tab for pockets. Click the desert to look.",
    journal: "JOURNAL",
    o2: "O₂",
    hunger: "HUNGER",
    thirst: "THIRST",
    warmth: "WARMTH",
    inv: "POCKETS",
    craft: "CRAFT",
    invHint: "Click potato or water to eat / drink. Gather more from the wreck.",
    craftHint: "Need a hammer to build stations. Place with E. Esc cancels.",
    helpMove: "walk",
    helpUse: "gather / use",
    helpCraft: "craft",
    helpInv: "pockets",
    helpScan: "scan",
    endEyebrow: "HERMES RENDEZVOUS",
    endTitle: "KEEP ON KEEPING ON",
    again: "SURVIVE AGAIN",
    gather: "E  GATHER",
    place: "E  PLACE",
    fuel: "E  FUEL STILL",
    drinkStill: "E  COLLECT WATER",
    plant: "E  PLANT",
    harvest: "E  HARVEST",
    rest: "E  SHELTER",
    storm: "DUST STORM",
    night: "SOL NIGHT",
    endCopy:
      "The still runs, the potatoes copy themselves, Earth heard you, and the MAV is waiting. You lived like a botanist on an island of rust.",
    needMats: "Missing materials",
    needHammer: "Craft a hammer first",
    needNear: "Place this at the marked site",
    crafted: "CRAFTED",
    placed: "BUILT",
    ate: "ATE",
    drank: "DRANK",
    cancelPlace: "Placement cancelled",
  },
  ru: {
    eyebrow: "АРИС III — РАВНИНА АЦИДАЛИЯ",
    tagline: "Тебя оставили умирать. Собирай. Крафть. Выживай. Выкручивайся наукой.",
    begin: "ПРОСНУТЬСЯ",
    clickHint: "WASD — шаг. E — собрать. C — крафт. Tab — карманы. Клик по пустыне — взгляд.",
    journal: "ЖУРНАЛ",
    o2: "O₂",
    hunger: "ГОЛОД",
    thirst: "ЖАЖДА",
    warmth: "ТЕПЛО",
    inv: "КАРМАНЫ",
    craft: "КРАФТ",
    invHint: "Кликни картофель или воду, чтобы съесть / выпить.",
    craftHint: "Для станций нужен молоток. Постановка — E. Esc — отмена.",
    helpMove: "шаг",
    helpUse: "сбор / действие",
    helpCraft: "крафт",
    helpInv: "карманы",
    helpScan: "скан",
    endEyebrow: "ВСТРЕЧА С ГЕРМЕСОМ",
    endTitle: "KEEP ON KEEPING ON",
    again: "ВЫЖИТЬ СНОВА",
    gather: "E  СОБРАТЬ",
    place: "E  ПОСТАВИТЬ",
    fuel: "E  ЗАПРАВИТЬ",
    drinkStill: "E  НАБРАТЬ ВОДУ",
    plant: "E  ПОСАДИТЬ",
    harvest: "E  СНЯТЬ",
    rest: "E  УКРЫТИЕ",
    storm: "ПЫЛЕВАЯ БУРЯ",
    night: "НОЧЬ СОЛА",
    endCopy:
      "Дистиллятор капает, картошка копирует себя, Земля тебя услышала, МАВ ждёт. Ты выжил как ботаник на острове ржавчины.",
    needMats: "Не хватает материалов",
    needHammer: "Сначала скрафть молоток",
    needNear: "Ставь это у отмеченного места",
    crafted: "ГОТОВО",
    placed: "ПОСТРОЕНО",
    ate: "СЪЕЛ",
    drank: "ВЫПИЛ",
    cancelPlace: "Постройка отменена",
  },
};

let lang = "en";

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = next === "ru" ? "ru" : "en";
  document.documentElement.lang = lang;
  applyDom();
}

export function t(key) {
  return strings[lang][key] ?? strings.en[key] ?? key;
}

export function applyDom() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && strings[lang][key]) el.textContent = strings[lang][key];
  });
}

export function toggleLang() {
  setLang(lang === "en" ? "ru" : "en");
}

export function loc(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.en || "";
}
