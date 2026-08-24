/** Salvage sites from Ares III. You loot them; you do not deliver between them. */

export const OUTPOSTS = [
  { id: "hab", kind: "hab", x: 0, z: 8, name: { en: "Ares III Hab", ru: "Жилой модуль Арис III" }, short: { en: "HAB", ru: "HAB" } },
  { id: "rover", kind: "rover", x: 86, z: -46, name: { en: "Rover wreck", ru: "Обломки марсохода" }, short: { en: "ROVER", ru: "ROVER" } },
  { id: "farm", kind: "farm", x: -78, z: 62, name: { en: "Soil flats", ru: "Грунтовая низина" }, short: { en: "SOIL", ru: "ГРУНТ" } },
  { id: "solar", kind: "solar", x: 48, z: 108, name: { en: "Solar graveyard", ru: "Кладбище панелей" }, short: { en: "SOLAR", ru: "СОЛНЦЕ" } },
  { id: "pathfinder", kind: "pathfinder", x: -138, z: -92, name: { en: "Pathfinder", ru: "Pathfinder" }, short: { en: "PATHFINDER", ru: "PATHFINDER" } },
  { id: "mav", kind: "mav", x: 196, z: -158, name: { en: "Schiaparelli MAV", ru: "МАВ Скиапарелли" }, short: { en: "MAV", ru: "МАВ" } },
];

export const ITEMS = {
  scrap: { color: 0xb8b0a4, name: { en: "Scrap", ru: "Металлолом" } },
  rock: { color: 0x6b3b28, name: { en: "Rock", ru: "Камень" } },
  ice: { color: 0xb9d4e8, name: { en: "Ice", ru: "Лёд" } },
  fabric: { color: 0xe8dcc8, name: { en: "Canvas", ru: "Брезент" } },
  tape: { color: 0xc9a227, name: { en: "Duct tape", ru: "Скотч" } },
  soil: { color: 0x5a3318, name: { en: "Regolith", ru: "Реголит" } },
  potato: { color: 0xc4a05a, name: { en: "Potato", ru: "Картофель" } },
  water: { color: 0x4aa0c8, name: { en: "Water", ru: "Вода" } },
  solar: { color: 0x1c2430, name: { en: "Solar cell", ru: "Солнечный элемент" } },
  wire: { color: 0xc76b2a, name: { en: "Wire", ru: "Провод" } },
  comms: { color: 0xc9a227, name: { en: "Comms board", ru: "Плата связи" } },
  hydrazine: { color: 0x8fd3b0, name: { en: "Hydrazine", ru: "Гидразин" } },
};

export const CONSUME = {
  potato: { hunger: 16, thirst: -14, o2: 0 },
  water: { hunger: 2, thirst: 26, o2: 3 },
};

/** Seconds-ish rates per second of game time. Walking and storms cost more. */
export const SURVIVAL = {
  pocketMax: 8,
  hungerWalk: 0.95,
  hungerIdle: 0.48,
  hungerHab: 0.26,
  thirstWalk: 1.45,
  thirstIdle: 0.82,
  thirstHab: 0.44,
  o2Outside: 0.48,
  o2Storm: 0.95,
  warmthNight: 8.5,
  warmthDay: 1.6,
  starveSlow: 0.52,
};

export const NODE_SPAWNS = [
  { type: "scrap", x: 7, z: 16 },
  { type: "scrap", x: -8, z: 14 },
  { type: "rock", x: -5, z: 20 },
  { type: "rock", x: 16, z: 22 },
  { type: "rock", x: 9, z: 4 },
  { type: "fabric", x: 3, z: 6 },
  { type: "fabric", x: -4, z: 5 },
  { type: "tape", x: 1, z: 12 },
  { type: "ice", x: 18, z: 28 },
  { type: "ice", x: -14, z: 24 },
  { type: "ice", x: 22, z: 8 },
  { type: "scrap", x: 12, z: 11, needHammer: true, amount: 2 },
  { type: "scrap", x: 80, z: -42, needHammer: true, amount: 2 },
  { type: "scrap", x: 90, z: -50, needHammer: true, amount: 2 },
  { type: "hydrazine", x: 88, z: -40 },
  { type: "soil", x: -74, z: 58 },
  { type: "soil", x: -82, z: 68 },
  { type: "soil", x: -70, z: 66 },
  { type: "soil", x: -86, z: 56 },
  { type: "solar", x: 46, z: 104, needHammer: true },
  { type: "solar", x: 52, z: 112, needHammer: true },
  { type: "solar", x: 42, z: 110 },
  { type: "wire", x: 50, z: 106 },
  { type: "wire", x: 54, z: 100 },
  { type: "comms", x: -136, z: -88 },
  { type: "wire", x: -142, z: -94 },
  { type: "scrap", x: 192, z: -154, needHammer: true, amount: 2 },
  { type: "scrap", x: 200, z: -160, needHammer: true, amount: 2 },
];

export const LOCKER_START = { potato: 2, tape: 1 };

export const RECIPES = [
  {
    id: "hammer",
    kind: "tool",
    tool: "hammer",
    need: { scrap: 1, rock: 1 },
    title: { en: "Crude hammer", ru: "Грубый молоток" },
    brief: { en: "Scrap + rock. You need this to build stations.", ru: "Лом + камень. Без него станции не поставить." },
  },
  {
    id: "seal",
    kind: "place",
    station: "seal",
    near: "hab",
    need: { fabric: 2, tape: 1 },
    title: { en: "Hab seal", ru: "Заплата Hab" },
    brief: { en: "Canvas + tape. Patch the hole or the O₂ keeps leaving.", ru: "Брезент + скотч. Заделай дыру, или кислород уйдёт." },
  },
  {
    id: "still",
    kind: "place",
    station: "still",
    requireTool: "hammer",
    need: { scrap: 2, fabric: 1, ice: 1 },
    title: { en: "Water still", ru: "Дистиллятор" },
    brief: { en: "Hammer + scrap, canvas, ice. Fuel with ice or hydrazine, then drink.", ru: "Молоток + лом, брезент, лёд. Заправь льдом или гидразином и пей." },
  },
  {
    id: "plot",
    kind: "place",
    station: "plot",
    requireTool: "hammer",
    need: { soil: 2, scrap: 1 },
    title: { en: "Farm plot", ru: "Грядка" },
    brief: { en: "Regolith box. Plant a potato, wait, harvest more.", ru: "Ящик с реголитом. Посади картофель, подожди, сними урожай." },
  },
  {
    id: "solar",
    kind: "place",
    station: "solar",
    requireTool: "hammer",
    need: { solar: 2, wire: 1 },
    title: { en: "Solar patch", ru: "Солнечная латка" },
    brief: { en: "Power the Hab through the night.", ru: "Дай Hab электричество на ночь." },
  },
  {
    id: "radio",
    kind: "place",
    station: "radio",
    near: "pathfinder",
    requireTool: "hammer",
    need: { comms: 1, wire: 2, scrap: 1 },
    title: { en: "Pathfinder radio", ru: "Рация Pathfinder" },
    brief: { en: "Place it at Pathfinder. Hello, Earth.", ru: "Поставь у Pathfinder. Привет, Земля." },
  },
];

export const GOALS = [
  {
    id: "gather",
    sol: 19,
    title: { en: "Scavenge", ru: "Собирай" },
    brief: {
      en: "The crew is gone. Loot scrap and rock around the Hab. Wreck piles need a hammer. Potatoes are in the locker — ration them.",
      ru: "Экипаж ушёл. Собери лом и камень у Hab. Кучи обломков — только молотком. Картошка в шкафу: экономь.",
    },
    log: {
      from: "WATNEY",
      en: "I'm alive. That's going to be a problem for NASA's paperwork. First job: loot my own wreck.",
      ru: "Я жив. Для NASA это будет неприятный документ. Первая задача: обшарить собственные обломки.",
    },
  },
  {
    id: "hammer",
    sol: 19,
    title: { en: "Make a hammer", ru: "Сделай молоток" },
    brief: {
      en: "Open craft (C). Scrap plus rock. No hammer, no stations — same as being stranded with empty hands.",
      ru: "Открой крафт (C). Лом плюс камень. Без молотка нет станций — как сидеть с пустыми руками.",
    },
    log: {
      from: "WATNEY",
      en: "I am going to have to science the shit out of this. Starting with a rock on a stick, essentially.",
      ru: "Придётся выкручиваться наукой. Начну с камня на палке, по сути.",
    },
  },
  {
    id: "seal",
    sol: 20,
    title: { en: "Seal the Hab", ru: "Запечатай Hab" },
    brief: {
      en: "Two canvas, one tape. Place the seal at the Hab or the oxygen leak wins.",
      ru: "Два брезента, один скотч. Поставь заплату у Hab, иначе утечка победит.",
    },
    log: {
      from: "WATNEY",
      en: "The Hab is a tent on a planet that wants me dead. Duct tape is a human miracle.",
      ru: "Hab — это палатка на планете, которая хочет меня убить. Скотч — чудо человечества.",
    },
  },
  {
    id: "water",
    sol: 26,
    title: { en: "Make water", ru: "Добудь воду" },
    brief: {
      en: "Craft a still, fuel it with ice (or hydrazine from the rover), then drink. Thirst kills first.",
      ru: "Скрафть дистиллятор, заправь льдом (или гидразином с марсохода) и выпей. Жажда убивает первой.",
    },
    log: {
      from: "WATNEY",
      en: "There's water in the fuel if you're willing to be extremely irresponsible. I am.",
      ru: "В топливе есть вода, если ты готов быть крайне безответственным. Я готов.",
    },
  },
  {
    id: "farm",
    sol: 32,
    title: { en: "Farm potatoes", ru: "Вырасти картошку" },
    brief: {
      en: "Two potatoes in the Hab locker — last one is seed. Soil flats west. Build a plot, plant, harvest copies.",
      ru: "В шкафу Hab две картофелины, последняя — семена. Грунт к западу: грядка, посадка, урожай.",
    },
    log: {
      from: "WATNEY",
      en: "I am the greatest botanist on this planet. Sample size: one.",
      ru: "Я лучший ботаник этой планеты. Выборка: один человек.",
    },
  },
  {
    id: "power",
    sol: 41,
    title: { en: "Restore power", ru: "Верни энергию" },
    brief: {
      en: "Salvage cells at the solar graveyard north of Hab. Night without power will freeze you.",
      ru: "Сними элементы на кладбище панелей к северу. Ночь без энергии тебя заморозит.",
    },
    log: {
      from: "NASA",
      en: "Watney, if the arrays die, the farm dies. Keep the lights on.",
      ru: "Уотни, если панели умрут, умрёт ферма. Не гаси свет.",
    },
  },
  {
    id: "contact",
    sol: 54,
    title: { en: "Hello, Earth", ru: "Привет, Земля" },
    brief: {
      en: "Pathfinder is southwest. Loot the comms board, craft a radio, place it there.",
      ru: "Pathfinder на юго-западе. Возьми плату, скрафть рацию, поставь её там.",
    },
    log: {
      from: "LEWIS",
      en: "Mark. We left you. I'm sorry. We're turning around. Stay alive.",
      ru: "Марк. Мы тебя оставили. Прости. Мы разворачиваемся. Живи.",
    },
  },
  {
    id: "escape",
    sol: 141,
    title: { en: "Reach the MAV", ru: "Доберись до МАВ" },
    brief: {
      en: "Schiaparelli, far southeast. Bring water and a potato. Hermes is coming.",
      ru: "Скиапарелли, далеко на юго-восток. Возьми воду и картофель. «Гермес» уже летит.",
    },
    log: {
      from: "HERMES",
      en: "We see your beacon. One more walk and we bring you home.",
      ru: "Видим маяк. Ещё один переход — и мы везём тебя домой.",
    },
  },
];
