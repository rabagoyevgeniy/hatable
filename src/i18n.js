const strings = {
  en: {
    eyebrow: "ARES III — ACIDALIA PLANITIA",
    tagline: "You were left for dead. The planet is empty. Walk, carry, connect.",
    begin: "BEGIN EXPEDITION",
    clickHint: "Click the desert to look around. WASD to walk. Shift to brace the load.",
    link: "ARES LINK",
    likes: "LIKES",
    order: "ORDER",
    o2: "O₂",
    stamina: "STAMINA",
    balance: "BALANCE",
    cargo: "CARGO",
    pack: "BACKPACK",
    packHint: "Q drops the top crate. Condition falls if you stumble or walk through a storm.",
    helpMove: "walk",
    helpBrace: "brace",
    helpUse: "use",
    helpDrop: "drop",
    helpScan: "scan",
    helpPack: "pack",
    endEyebrow: "HERMES RENDEZVOUS",
    endTitle: "KEEP ON KEEPING ON",
    again: "WALK IT AGAIN",
    pickup: "E  PICK UP",
    deliver: "E  DELIVER",
    rest: "E  REST / LINK",
    dest: "DESTINATION",
    connected: "LINK ONLINE",
    storm: "DUST STORM",
    stumble: "STUMBLE — CARGO LOOSE",
    likesGain: "LIKES",
    endCopy:
      "The MAV is stacked, the Link is live, and Hermes is coming home for one very stubborn botanist. You scienced the shit out of it — one crate at a time.",
  },
  ru: {
    eyebrow: "АРИС III — РАВНИНА АЦИДАЛИЯ",
    tagline: "Тебя оставили умирать. Планета пуста. Иди, неси, связывай.",
    begin: "НАЧАТЬ ЭКСПЕДИЦИЮ",
    clickHint: "Клик по пустыне — осмотр. WASD — шаг. Shift — удержать груз.",
    link: "СЕТЬ АРИС",
    likes: "ЛАЙКИ",
    order: "ЗАКАЗ",
    o2: "O₂",
    stamina: "ВЫНОСЛИВОСТЬ",
    balance: "БАЛАНС",
    cargo: "ГРУЗ",
    pack: "РЮКЗАК",
    packHint: "Q — сбросить верхний ящик. Состояние падает при падении и в буре.",
    helpMove: "шаг",
    helpBrace: "упор",
    helpUse: "действие",
    helpDrop: "сброс",
    helpScan: "скан",
    helpPack: "рюкзак",
    endEyebrow: "ВСТРЕЧА С ГЕРМЕСОМ",
    endTitle: "KEEP ON KEEPING ON",
    again: "ПРОЙТИ СНОВА",
    pickup: "E  ПОДНЯТЬ",
    deliver: "E  СДАТЬ",
    rest: "E  ОТДЫХ / СВЯЗЬ",
    dest: "ПУНКТ",
    connected: "СВЯЗЬ В ЭФИРЕ",
    storm: "ПЫЛЕВАЯ БУРЯ",
    stumble: "СРЫВ — ГРУЗ ОСЫПАЛСЯ",
    likesGain: "ЛАЙКИ",
    endCopy:
      "МАВ собран, сеть жива, «Гермес» возвращается за одним упрямым ботаником. Ты выкрутился наукой — ящик за ящиком.",
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
