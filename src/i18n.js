import { isMobileView } from "./device.js";

const strings = {
  en: {
    eyebrow: "ARES III — ACIDALIA PLANITIA",
    tagline: "You were left for dead. Scavenge. Craft. Survive. Science the shit out of it.",
    begin: "WAKE UP",
    clickHint: "WASD walk · mouse look · E gather · C craft · Tab pockets. Cyan rings on the ground are starter loot.",
    clickHintTouch: "Joystick to walk. Gather picks up loot. Craft makes the hammer. Scan shows labels.",
    firstHint: "1. Cyan rings ahead — walk up, E to pick scrap and rock.  2. C crafts a hammer (1 scrap + 1 rock).  3. White crate by the airlock is the locker.",
    firstHintTouch: "Rings on the ground. Gather scrap + rock, then Craft the hammer.",
    installHint: "Phone: Safari/Chrome → Share or menu → Add to Home Screen. Then open the icon like an app.",
    journal: "JOURNAL",
    o2: "O₂",
    hunger: "FOOD",
    thirst: "WATER",
    warmth: "WARMTH",
    inv: "POCKETS",
    craft: "CRAFT",
    invHint: "Eat / drink with the button. Stash only while the locker is open.",
    craftHint: "Hammer first. Then stations. Place with E. Esc cancels.",
    craftHintTouch: "First the hammer. Then a station. Gather places it. Tap empty to close.",
    helpMove: "walk",
    helpUse: "gather / use",
    helpCraft: "craft",
    helpInv: "pockets",
    helpScan: "scan",
    helpSleep: "sleep in Hab",
    eat: "eat",
    drink: "drink",
    stash: "stash",
    take: "take",
    satiety: "FOOD",
    hydration: "WATER",
    gather: "E  GATHER",
    salvage: "E  SALVAGE (HAMMER)",
    needTool: "Need a hammer for this wreck",
    pocketsFull: "Pockets full — stash in the Hab locker",
    locker: "E  LOCKER",
    lockerTitle: "HAB LOCKER",
    lockerHint: "Take from the crate. In pockets, use Stash — eat is a separate button.",
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
    dropped: "DROPPED",
    planted: "PLANTED",
    watered: "WATERED",
    fueled: "STILL FUELED",
    waterPlot: "E  WATER CROP",
    growing: "GROWING — sleep or water",
    here: "HERE",
    continue: "CONTINUE",
    console: "E  HAB CONSOLE",
    consoleTitle: "HAB SYSTEMS",
    heaterOn: "HEATER ON",
    heaterOff: "HEATER OFF",
    lightsOn: "LIGHTS ON",
    lightsOff: "LIGHTS OFF",
    drinkTank: "DRINK FROM TANK",
    repairArray: "E  REPAIR ARRAY (SOLAR CELL)",
    arrayRepaired: "ARRAY CELL REPLACED",
    warnLeak: "PRESSURE FALLING — patch the hull",
    warnBattery: "BATTERY CRITICAL — cut load or wait for sun",
    dustWarn: "DUST RISING",
    range: "O₂ RANGE",
    lowLight: "low light",
    lowTemp: "too cold",
    lowMoist: "dry soil",
    drankTank: "DRANK — Hab tank",
    tankEmpty: "Hab tank empty",
    scanned: "SCAN",
    enterHab: "Keep walking in. Cyan screen on the right is the Hab console.",
    consoleDeeper: "deeper — cyan screen",
  },
  ru: {
    eyebrow: "АРИС III — РАВНИНА АЦИДАЛИЯ",
    tagline: "Тебя оставили умирать. Собирай. Крафть. Выживай. Выкручивайся наукой.",
    begin: "ПРОСНУТЬСЯ",
    clickHint: "WASD — шаг · мышь — взгляд · E — собрать · C — крафт · Tab — карманы. Голубые кольца на земле — стартовый лут.",
    clickHintTouch: "Джойстик — ходить. Сбор — подобрать. Крафт — молоток. Скан — подписи.",
    firstHint: "1. Голубые кольца впереди — подойди, E: лом и камень.  2. C — молоток (1 лом + 1 камень).  3. Белый ящик у шлюза — шкаф с картошкой.",
    firstHintTouch: "Кольца на земле. Сбор — лом и камень, потом Крафт — молоток.",
    installHint: "Телефон: Safari/Chrome → Поделиться / меню → На экран «Домой». Потом открывай ярлык как приложение.",
    journal: "ЖУРНАЛ",
    o2: "O₂",
    hunger: "ЕДА",
    thirst: "ВОДА",
    warmth: "ТЕПЛО",
    inv: "КАРМАНЫ",
    craft: "КРАФТ",
    invHint: "Еда и вода — отдельной кнопкой. В шкаф — только пока шкаф открыт.",
    craftHint: "Сначала молоток. Потом станции. Постановка — E. Esc — отмена.",
    craftHintTouch: "Сначала молоток. Потом станция. Сбор ставит. Тап по пустому — закрыть.",
    helpMove: "шаг",
    helpUse: "сбор / действие",
    helpCraft: "крафт",
    helpInv: "карманы",
    helpScan: "скан",
    helpSleep: "сон в Hab",
    eat: "съесть",
    drink: "пить",
    stash: "в шкаф",
    take: "взять",
    satiety: "ЕДА",
    hydration: "ВОДА",
    gather: "E  СОБРАТЬ",
    salvage: "E  РАЗОБРАТЬ (МОЛОТОК)",
    needTool: "Для этой кучи нужен молоток",
    pocketsFull: "Карманы полны — сложи в шкаф Hab",
    locker: "E  ШКАФ",
    lockerTitle: "ШКАФ HAB",
    lockerHint: "Клик по шкафу — взять. В карманах кнопка «в шкаф». «Съесть» — отдельно.",
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
    dropped: "БРОСИЛ",
    planted: "ПОСАДИЛ",
    watered: "ПОЛИЛ",
    fueled: "ЗАПРАВЛЕН",
    waterPlot: "E  ПОЛИТЬ",
    growing: "РАСТЁТ — сон или вода",
    here: "ЗДЕСЬ",
    continue: "ПРОДОЛЖИТЬ",
    console: "E  КОНСОЛЬ HAB",
    consoleTitle: "СИСТЕМЫ HAB",
    heaterOn: "ПЕЧЬ ВКЛ",
    heaterOff: "ПЕЧЬ ВЫКЛ",
    lightsOn: "СВЕТ ВКЛ",
    lightsOff: "СВЕТ ВЫКЛ",
    drinkTank: "ПИТЬ ИЗ БАКА",
    repairArray: "E  ЧИНИТЬ МАССИВ (ЭЛЕМЕНТ)",
    arrayRepaired: "ЯЧЕЙКА МАССИВА ЗАМЕНЕНА",
    warnLeak: "ДАВЛЕНИЕ ПАДАЕТ — заделай корпус",
    warnBattery: "БАТАРЕЯ НА ИСХОДЕ — снизь нагрузку или жди солнце",
    dustWarn: "ПЫЛЬ РАСТЁТ",
    range: "О₂ ЗАПАС",
    lowLight: "мало света",
    lowTemp: "холодно",
    lowMoist: "сухо",
    drankTank: "ВЫПИЛ — бак Hab",
    tankEmpty: "Бак Hab пуст",
    scanned: "СКАН",
    enterHab: "Иди вглубь. Голубой экран справа — консоль Hab.",
    consoleDeeper: "глубже — голубой экран",
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
  const pack = strings[lang] || strings.en;
  const touchKey = `${key}Touch`;
  let s = isMobileView() && pack[touchKey] ? pack[touchKey] : pack[key] ?? strings.en[key] ?? key;
  if (isMobileView() && typeof s === "string") s = s.replace(/^E\s+/, "");
  return s;
}

export function applyDom() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const value = t(key);
    if (value) el.textContent = value;
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
