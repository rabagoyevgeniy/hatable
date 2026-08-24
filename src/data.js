/** The Acidalia map: six isolated Ares sites you reconnect on foot. */

export const OUTPOSTS = [
  {
    id: "hab",
    kind: "hab",
    x: 0,
    z: 8,
    name: { en: "Ares III Hab", ru: "Жилой модуль Арис III" },
    short: { en: "HAB", ru: "HAB" },
  },
  {
    id: "rover",
    kind: "rover",
    x: 86,
    z: -46,
    name: { en: "Rover Cache", ru: "Кэш марсохода" },
    short: { en: "ROVER", ru: "ROVER" },
  },
  {
    id: "farm",
    kind: "farm",
    x: -78,
    z: 62,
    name: { en: "Potato Farm", ru: "Картофельная ферма" },
    short: { en: "FARM", ru: "ФЕРМА" },
  },
  {
    id: "solar",
    kind: "solar",
    x: 48,
    z: 108,
    name: { en: "Solar Farm", ru: "Солнечная станция" },
    short: { en: "SOLAR", ru: "СОЛНЦЕ" },
  },
  {
    id: "pathfinder",
    kind: "pathfinder",
    x: -138,
    z: -92,
    name: { en: "Pathfinder", ru: "Pathfinder" },
    short: { en: "PATHFINDER", ru: "PATHFINDER" },
  },
  {
    id: "mav",
    kind: "mav",
    x: 196,
    z: -158,
    name: { en: "Schiaparelli MAV", ru: "МАВ Скиапарелли" },
    short: { en: "MAV", ru: "МАВ" },
  },
];

export const CARGO_TYPES = {
  emergency: { weight: 12, color: 0xff6a24, name: { en: "Emergency crate", ru: "Аварийный ящик" } },
  water: { weight: 16, color: 0x3d7ea6, name: { en: "Water drum", ru: "Бочка воды" } },
  fertilizer: { weight: 14, color: 0x6b4a2b, name: { en: "Fertilizer", ru: "Удобрение" } },
  solar: { weight: 18, color: 0x1c2430, name: { en: "Solar cells", ru: "Солнечные панели" } },
  comms: { weight: 10, color: 0xc9a227, name: { en: "Pathfinder package", ru: "Пакет Pathfinder" } },
  potatoes: { weight: 15, color: 0x8a6a3b, name: { en: "Potato crate", ru: "Ящик картофеля" } },
  lifesupport: { weight: 20, color: 0xd8d4cc, name: { en: "Life support", ru: "Жизнеобеспечение" } },
};

export const ORDERS = [
  {
    id: "first-steps",
    sol: 19,
    dest: "rover",
    need: { emergency: 1 },
    connect: "rover",
    spawn: [{ type: "emergency", x: 7, z: 16 }],
    title: { en: "First Steps", ru: "Первые шаги" },
    brief: {
      en: "The Hab survived the storm. Recover the emergency crate and walk it to the Rover Cache.",
      ru: "Жилой модуль пережил бурю. Подними аварийный ящик и донеси его до кэша марсохода.",
    },
    log: {
      from: "WATNEY",
      en: "I'm alive. That's an annoying amount of paperwork for NASA. First job: don't die on the walk to the rover.",
      ru: "Я жив. Для NASA это неприятный объём документов. Первая задача: не умереть по дороге к марсоходу.",
    },
  },
  {
    id: "botany",
    sol: 26,
    dest: "farm",
    need: { water: 1, fertilizer: 1 },
    connect: "farm",
    spawn: [
      { type: "water", x: -12, z: 2 },
      { type: "fertilizer", x: 16, z: -6 },
    ],
    title: { en: "Botany Lesson", ru: "Урок ботаники" },
    brief: {
      en: "Mars will not feed you unless you farm it. Haul water and fertilizer to the greenhouse.",
      ru: "Марс тебя не накормит, пока ты сам не начнёшь. Отнеси воду и удобрение в теплицу.",
    },
    log: {
      from: "WATNEY",
      en: "I am the greatest botanist on this planet. Sample size: one. Also the soil needs a little… human help.",
      ru: "Я лучший ботаник этой планеты. Выборка: один человек. Почве понадобится небольшая человеческая помощь.",
    },
  },
  {
    id: "power",
    sol: 37,
    dest: "solar",
    need: { solar: 1 },
    connect: "solar",
    spawn: [{ type: "solar", x: 22, z: 24 }],
    storm: true,
    title: { en: "Power Up", ru: "Энергия" },
    brief: {
      en: "Dust is eating the arrays. Carry spare cells to the solar farm before the next front.",
      ru: "Пыль съедает панели. Донеси запасные элементы на станцию до следующего фронта.",
    },
    log: {
      from: "NASA",
      en: "Watney, we see your power curve dropping. If the Link dies, so does the farm. Keep on keeping on.",
      ru: "Уотни, кривая мощности падает. Если сеть умрёт, умрёт и ферма. Keep on keeping on.",
    },
  },
  {
    id: "hello-world",
    sol: 51,
    dest: "pathfinder",
    need: { comms: 1 },
    connect: "pathfinder",
    spawn: [{ type: "comms", x: -18, z: 12 }],
    title: { en: "Hello, World", ru: "Hello, World" },
    brief: {
      en: "Pathfinder is a tomb with a radio. Deliver the comms package and talk to Earth.",
      ru: "Pathfinder — могила с рацией. Доставь пакет связи и заговори с Землёй.",
    },
    log: {
      from: "LEWIS",
      en: "Mark. We left you. I'm sorry. We're turning around. Just stay alive until we can pick you up.",
      ru: "Марк. Мы тебя оставили. Прости. Мы разворачиваемся. Просто оставайся жив, пока мы не заберём тебя.",
    },
  },
  {
    id: "stockpile",
    sol: 68,
    dest: "hab",
    need: { potatoes: 2 },
    connect: "hab",
    spawn: [
      { type: "potatoes", x: -70, z: 72 },
      { type: "potatoes", x: -86, z: 54 },
    ],
    title: { en: "Stockpile", ru: "Запас" },
    brief: {
      en: "Harvest two potato crates at the farm and walk them home. Calories are a countdown.",
      ru: "Собери два ящика картофеля на ферме и донеси их домой. Калории — это таймер.",
    },
    log: {
      from: "WATNEY",
      en: "I have made 92 potatoes. I have also named none of them, because I am not that lonely. Yet.",
      ru: "Я вырастил 92 картофелины. Ни одну не назвал: я ещё не настолько одинок. Пока.",
    },
  },
  {
    id: "long-walk",
    sol: 141,
    dest: "mav",
    need: { lifesupport: 1, potatoes: 1 },
    connect: "mav",
    spawn: [
      { type: "lifesupport", x: 6, z: -10 },
      { type: "potatoes", x: -8, z: 14 },
    ],
    storm: true,
    title: { en: "The Long Walk", ru: "Долгий путь" },
    brief: {
      en: "Schiaparelli is waiting. Carry life support and food to the MAV. Hermes is coming.",
      ru: "Скиапарелли ждёт. Донеси жизнеобеспечение и еду к МАВ. «Гермес» уже летит.",
    },
    log: {
      from: "HERMES",
      en: "Commander Lewis to Watney: we see your beacon. One more delivery and we bring you home.",
      ru: "Командир Льюис — Уотни: видим маяк. Ещё одна доставка — и мы везём тебя домой.",
    },
  },
];
