const strings = {
  en: {
    eyebrow: "ARES III — ACIDALIA PLANITIA",
    tagline: "You were left for dead. Scavenge. Craft. Survive. Science the shit out of it.",
    begin: "WAKE UP",
    clickHint: "WASD to walk. E to gather. C to craft. Tab for pockets. Click the desert to look.",
    journal: "JOURNAL",
    o2: "O₂",
    hunger: "FOOD",
    thirst: "WATER",
    warmth: "WARMTH",
    inv: "POCKETS",
    craft: "CRAFT",
    invHint: "Click potato or water to eat / drink. 8 pocket slots. Last potato is seed.",
    craftHint: "Need a hammer to build and to crack wreck piles. Place with E. Esc cancels.",
    helpMove: "walk",
    helpUse: "gather / use",
    helpCraft: "craft",
    helpInv: "pockets",
    helpScan: "scan",
    helpSleep: "sleep in Hab",
    satiety: "FOOD",
    hydration: "WATER",
    gather: "E  GATHER",
    salvage: "E  SALVAGE (HAMMER)",
    needTool: "Need a hammer for this wreck",
    pocketsFull: "Pockets full — stash in the Hab locker",
    locker: "E  LOCKER",
    lockerTitle: "HAB LOCKER",
    lockerHint: "Click to take. With locker open, click pockets to stash. Two potatoes. Ration them.",
    sleep: "E  SLEEP (costs food & water)",
    slept: "SLEPT — one sol closer",
    tooWeak: "Too weak to sleep — eat or drink",
    warnHunger: "STARVING — ration the potatoes",
    warnThirst: "DEHYDRATED — still or ice",
    warnO2: "O₂ CRITICAL — get inside",
    warnWarmth: "FREEZING — Hab / power",
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
    hunger: "ЕДА",
    thirst: "ВОДА",
    warmth: "ТЕПЛО",
    inv: "КАРМАНЫ",
    craft: "КРАФТ",
    invHint: "Кликни картофель или воду. 8 слотов. Последняя картошка — семена.",
    craftHint: "Молоток — чтобы строить и разбирать кучи. Постановка — E. Esc — отмена.",
    helpMove: "шаг",
    helpUse: "сбор / действие",
    helpCraft: "крафт",
    helpInv: "карманы",
    helpScan: "скан",
    helpSleep: "сон в Hab",
    satiety: "ЕДА",
    hydration: "ВОДА",
    gather: "E  СОБРАТЬ",
    salvage: "E  РАЗОБРАТЬ (МОЛОТОК)",
    needTool: "Для этой кучи нужен молоток",
    pocketsFull: "Карманы полны — сложи в шкаф Hab",
    locker: "E  ШКАФ",
    lockerTitle: "ШКАФ HAB",
    lockerHint: "Клик — взять. При открытом шкафе клик по карманам — сложить. Две картошки. Экономь.",
    sleep: "E  СОН (тратит еду и воду)",
    slept: "СОН — сола меньше до Гермеса",
    tooWeak: "Слишком слаб для сна — еда или вода",
    warnHunger: "ГОЛОД — не ешь последнюю картошку",
    warnThirst: "ЖАЖДА — дистиллятор или лёд",
    warnO2: "O₂ НА ИСХОДЕ — в Hab",
    warnWarmth: "ХОЛОД — Hab / энергия",
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

let lang = "ru";

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
  document.documentElement.lang = lang;
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
