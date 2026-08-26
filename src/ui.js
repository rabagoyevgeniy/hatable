import * as THREE from "three";
import { t, getLang, loc } from "./i18n.js";
import { ITEMS, RECIPES, SURVIVAL, GOALS, GOAL_DEST, YARD_PADS, HAB_DESK, HAB_BUNK, HAB_ARRAY, HAB_LEAK } from "./data.js";
import { count, canAfford, itemName, isInsideHab, pocketSlots, estimateRangeM } from "./player.js";
import { currentGoal, goalText } from "./journal.js";
import { nearestOutpost, resolvePlacement } from "./world.js";
import { habReadout, habStatusLine, cropFactors } from "./systems/habitat.js";
import { weatherLabel } from "./systems/weather.js";
import { hasSave } from "./systems/save.js";
import { pickInteriorAction, pickStillPadAction, pickStillMachineAction } from "./systems/interact.js";

const $ = (id) => document.getElementById(id);

export function bindUi(handlers) {
  $("btn-start").addEventListener("click", () => handlers.start(false));
  $("btn-continue")?.addEventListener("click", () => handlers.start(true));
  $("btn-lang").addEventListener("click", handlers.lang);
  $("btn-again").addEventListener("click", () => location.reload());
  $("craft-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-recipe]");
    if (btn) handlers.craft(btn.dataset.recipe);
  });
  $("inv-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-item]");
    if (!btn) return;
    if (btn.dataset.act === "stash") handlers.stash(btn.dataset.item);
    else handlers.consume(btn.dataset.item);
  });
  $("storage-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-item]");
    if (btn) handlers.takeStorage(btn.dataset.item);
  });
  $("hab-console")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hab]");
    if (btn) handlers.habAct(btn.dataset.hab);
  });
  document.querySelectorAll("[data-close-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenus();
    });
  });
  $("menu-scrim")?.addEventListener("click", () => closeMenus());
  refreshContinue();
}

export function refreshContinue() {
  const btn = $("btn-continue");
  if (!btn) return;
  btn.classList.toggle("hidden", !hasSave());
}

export function showHud() {
  $("title-screen").classList.add("hidden");
  $("hud").classList.remove("hidden");
  const hint = $("first-hint");
  if (hint && document.body.classList.contains("mobile")) {
    hint.textContent = t("firstHintTouch");
    window.setTimeout(() => hint.classList.add("hidden"), 9000);
  }
}

export function menusOpen() {
  return (
    !$("craft").classList.contains("hidden") ||
    !$("inv").classList.contains("hidden") ||
    !$("storage").classList.contains("hidden") ||
    ($("hab-console") && !$("hab-console").classList.contains("hidden"))
  );
}

export function toggleCraft(player) {
  $("inv").classList.add("hidden");
  $("storage").classList.add("hidden");
  $("craft").classList.toggle("hidden");
  renderCraft(player);
  syncMenuChrome();
  return !$("craft").classList.contains("hidden");
}

export function toggleInv(player) {
  $("craft").classList.add("hidden");
  $("inv").classList.toggle("hidden");
  renderInv(player);
  syncMenuChrome();
  return !$("inv").classList.contains("hidden");
}

export function toggleStorage(player, world) {
  $("craft").classList.add("hidden");
  $("storage").classList.toggle("hidden");
  if (!$("storage").classList.contains("hidden")) {
    $("inv").classList.remove("hidden");
    renderInv(player);
    renderStorage(world);
  }
  syncMenuChrome();
  return !$("storage").classList.contains("hidden");
}

export function storageOpen() {
  return !$("storage").classList.contains("hidden");
}

export function closeMenus() {
  $("craft").classList.add("hidden");
  $("inv").classList.add("hidden");
  $("storage").classList.add("hidden");
  $("hab-console")?.classList.add("hidden");
  syncMenuChrome();
}

export function toggleHabConsole(world) {
  $("craft").classList.add("hidden");
  $("inv").classList.add("hidden");
  $("storage").classList.add("hidden");
  const el = $("hab-console");
  if (!el) return false;
  el.classList.toggle("hidden");
  if (!el.classList.contains("hidden")) renderHabConsole(world);
  syncMenuChrome();
  return !el.classList.contains("hidden");
}

export function consoleOpen() {
  return $("hab-console") && !$("hab-console").classList.contains("hidden");
}

export function renderHabConsole(world) {
  const pre = $("hab-readout");
  if (pre) pre.textContent = habReadout(world, getLang());
  const heat = $("hab-heater");
  const lights = $("hab-lights");
  if (heat) heat.textContent = world.hab?.heaterOn ? t("heaterOn") : t("heaterOff");
  if (lights) lights.textContent = world.hab?.lightsOn ? t("lightsOn") : t("lightsOff");
}

function syncMenuChrome() {
  const open = menusOpen();
  $("menu-scrim")?.classList.toggle("hidden", !open);
  document.body.classList.toggle("menu-open", open);
}

export function renderCraft(player) {
  const list = $("craft-list");
  list.innerHTML = "";
  for (const rec of RECIPES) {
    const li = document.createElement("li");
    const ok =
      canAfford(player, rec.need) && (!rec.requireTool || player.tools[rec.requireTool]);
    li.className = rec.id === "hammer" && ok ? "ready" : "";
    li.innerHTML = `<button class="recipe ${ok ? "" : "locked"}" data-recipe="${rec.id}">
      <span><b>${loc(rec.title)}</b><small>${needLine(rec.need)}${rec.requireTool ? (getLang() === "ru" ? " · молоток" : " · hammer") : ""}</small></span>
      <span>${ok ? "▸" : "–"}</span>
    </button>`;
    list.appendChild(li);
  }
}

export function renderStorage(world) {
  const list = $("storage-list");
  list.innerHTML = "";
  fillItemList(list, world.locker.storage, false);
}

export function renderInv(player) {
  const list = $("inv-list");
  list.innerHTML = "";
  if (player.tools.hammer) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${getLang() === "ru" ? "Молоток" : "Hammer"}</span><span>tool</span>`;
    list.appendChild(li);
  }
  fillItemList(list, player.inv, { eat: true, stash: storageOpen() });
  if (totalShown(player) === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${getLang() === "ru" ? "пусто — шкаф у шлюза Hab" : "empty — locker by the Hab airlock"}</span>`;
    list.appendChild(li);
  }
}

function totalShown(player) {
  return Object.values(player.inv).reduce((s, n) => s + n, 0) + (player.tools.hammer ? 1 : 0);
}

function fillItemList(list, bag, opts) {
  const eat = opts === true || opts?.eat;
  const stash = opts?.stash;
  const take = opts === false;
  for (const [id, n] of Object.entries(bag)) {
    if (!n) continue;
    const li = document.createElement("li");
    const actions = [];
    if (stash) {
      actions.push(`<button class="chip" data-item="${id}" data-act="stash">${t("stash")}</button>`);
    }
    if (eat && (id === "potato" || id === "water")) {
      actions.push(
        `<button class="chip" data-item="${id}" data-act="eat">${id === "water" ? t("drink") : t("eat")}</button>`
      );
    }
    if (take) {
      actions.push(`<button class="chip" data-item="${id}" data-act="take">${t("take")}</button>`);
    }
    const btns = actions.length
      ? `<span class="item-acts">${actions.join("")}</span>`
      : `<span>${n}</span>`;
    li.innerHTML = `<div class="item-row"><span>${itemName(id)} ×${n}</span>${btns}</div>`;
    list.appendChild(li);
  }
}

function needLine(need) {
  return Object.entries(need)
    .map(([id, n]) => `${n} ${itemName(id)}`)
    .join(" + ");
}

export function updateHud({ player, world, journal, scanning, camera, inside }) {
  $("bar-o2").style.width = `${player.oxygen}%`;
  $("bar-hunger").style.width = `${player.hunger}%`;
  $("bar-thirst").style.width = `${player.thirst}%`;
  $("bar-warmth").style.width = `${player.warmth}%`;
  $("num-o2").textContent = String(Math.round(player.oxygen));
  $("num-hunger").textContent = String(Math.round(player.hunger));
  $("num-thirst").textContent = String(Math.round(player.thirst));
  $("num-warmth").textContent = String(Math.round(player.warmth));
  colorBar("bar-o2", player.oxygen);
  colorBar("bar-hunger", player.hunger);
  colorBar("bar-thirst", player.thirst);
  colorBar("bar-warmth", player.warmth);

  const warn = $("vital-warn");
  const alerts = [];
  if (player.thirst < 28 && inside && world.hab && world.hab.waterTank >= 0.35) alerts.push(t("warnTank"));
  else if (player.thirst < 22) alerts.push(t("warnThirst"));
  else if (player.hunger < 22 && count(player, "potato") <= 1 && !player.harvestedCrop) alerts.push(t("seedPotato"));
  else if (player.hunger < 22) alerts.push(t("warnHunger"));
  else if (player.oxygen < 22) alerts.push(t("warnO2"));
  else if (player.warmth < 22) alerts.push(t("warnWarmth"));
  if (!alerts.length && world.hab && !world.habSealed && inside) alerts.push(t("warnLeak"));
  if (!alerts.length && world.hab && world.hab.battery < 0.16) alerts.push(t("warnBattery"));
  warn.textContent = alerts[0] || "";

  const goal = currentGoal(journal);
  $("goal-step").textContent = `${Math.min(journal.index + 1, 8)} / 8`;
  if (goal) {
    const text = goalText(goal);
    $("order-title").textContent = text.title;
    $("order-brief").textContent = text.brief;
    const dest = GOAL_DEST[goal.id];
    const destEl = $("order-dest");
    if (destEl && dest) {
      const dx = dest.x - player.root.position.x;
      const dz = dest.z - player.root.position.z;
      const meters = Math.round(Math.hypot(dx, dz));
      destEl.textContent = meters < 6 ? t("here") : `${meters} м`;
    }
    $("sol-label").textContent = `SOL ${journal.sols}`;
  }
  const tod = $("tod-label");
  if (tod) tod.textContent = timeOfDay(world);
  const stormFlag = $("storm-flag");
  if (stormFlag) {
    const dusty = (world.weather?.state === "dust" && (world.weather?.warn || 0) > 0.4) || world.storm > 0.42;
    const storming = world.weather?.state === "storm" || world.storm > 0.62;
    stormFlag.classList.toggle("hidden", !dusty && !storming);
    stormFlag.textContent = storming ? t("storm") : t("dustWarn");
  }
  renderHotbar(player);
  const base = $("base-line");
  if (base) {
    const still = world.stations.find((s) => s.type === "still");
    const plot = world.stations.find((s) => s.type === "plot");
    const bits = [];
    if (world.hab) {
      bits.push(`P ${(world.hab.pressure * 100).toFixed(0)}%`);
      bits.push(`BAT ${(world.hab.battery * 100).toFixed(0)}%`);
    }
    bits.push(weatherLabel(world, getLang()));
    if (!inside) bits.push(`${t("range")} ${Math.max(0.1, estimateRangeM(player, world) / 1000).toFixed(1)} km`);
    if (still) bits.push(`${getLang() === "ru" ? "вода" : "still"} ${Math.floor(still.water)}`);
    if (plot?.planted) bits.push(`${getLang() === "ru" ? "рост" : "crop"} ${Math.floor(plot.grow * 100)}%`);
    base.textContent = bits.join(" · ");
  }
  const list = $("goal-list");
  if (list) {
    list.innerHTML = GOALS.map((g, i) => {
      const cls = i < journal.index ? "done" : i === journal.index ? "now" : "";
      const mark = i < journal.index ? "✓" : i === journal.index ? "▸" : "·";
      return `<li class="${cls}">${mark} ${loc(g.title)}</li>`;
    }).join("");
  }
  const hint = $("first-hint");
  if (hint) hint.classList.toggle("hidden", player.tools.hammer || player.gathered > 0);

  const leak = habStatusLine(world, getLang());
  $("hab-status").textContent = leak;
  const danger = !world.habSealed || (world.hab && (world.hab.battery < 0.18 || world.hab.pressure < 0.5));
  $("hab-status").style.color = danger ? "#ff5a3c" : "#8fd3b0";

  const near = nearestOutpost(world, player.root.position);
  $("location-label").textContent =
    near.dist < 22 ? near.outpost.short[getLang()] : getLang() === "ru" ? "ПУСТЫНЯ" : "OPEN DESERT";

  const deg = ((-player.yaw * 180) / Math.PI + 360) % 360;
  const dirs = getLang() === "ru" ? ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"] : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir = dirs[Math.round(deg / 45) % 8];
  $("compass-dir").textContent = dir;
  $("compass-deg").textContent = `${Math.round(deg)}°`;

  $("storm-overlay").style.opacity = String(world.storm * 0.85);
  $("night-overlay").style.opacity = document.body.classList.contains("mobile")
    ? "0"
    : String(Math.max(0, 0.55 - world.daylight));
  $("scan-overlay").style.opacity = scanning ? "1" : "0";
  document.body.classList.toggle("inside-hab", !!inside);
  document.body.classList.toggle("hab-leak", !world.habSealed);
  document.body.classList.toggle("low-o2", player.oxygen < 26);
  document.body.classList.toggle("cold", player.warmth < 26);

  if (!$("craft").classList.contains("hidden")) renderCraft(player);
  if (!$("inv").classList.contains("hidden")) renderInv(player);
  if (!$("storage").classList.contains("hidden")) renderStorage(world);
  if (consoleOpen()) renderHabConsole(world);

  updateScanLabels(player, world, camera, scanning);
  updatePrompt(player, world);
}

function timeOfDay(world) {
  const d = world.daylight;
  const ru = getLang() === "ru";
  if (world.weather?.state === "storm" || world.storm > 0.62) return ru ? "БУРЯ" : "STORM";
  if (world.weather?.state === "dust") return ru ? "ПЫЛЬ" : "DUST";
  if (d < 0.18) return ru ? "НОЧЬ" : "NIGHT";
  if (d < 0.38) return ru ? "СУМЕРКИ" : "DUSK";
  if (d > 0.82) return ru ? "ПОЛДЕНЬ" : "NOON";
  return ru ? "ДЕНЬ" : "DAY";
}

function renderHotbar(player) {
  const el = $("hotbar");
  if (!el) return;
  const slots = pocketSlots(player);
  if (!player.heldId && slots[0]) player.heldId = slots[0][0];
  el.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "hb-slot";
    const pair = slots[i];
    if (pair) {
      const [id, n] = pair;
      if (player.heldId === id) slot.classList.add("held");
      const hex = (ITEMS[id]?.color ?? 0xcccccc).toString(16).padStart(6, "0");
      slot.innerHTML = `<i style="background:#${hex}"></i><em>${n}</em><small>${i + 1}</small>`;
      slot.title = itemName(id);
    } else {
      slot.innerHTML = `<small>${i + 1}</small>`;
    }
    el.appendChild(slot);
  }
  if (player.tools.hammer) {
    const tool = document.createElement("div");
    tool.className = "hb-slot tool";
    tool.innerHTML = `<b>⚒</b>`;
    tool.title = getLang() === "ru" ? "Молоток" : "Hammer";
    el.appendChild(tool);
  }
}

function colorBar(id, v) {
  $(id).style.background = v < 22 ? "#ff5a3c" : v < 45 ? "#ffb15a" : "#8fd3b0";
}

export function findInteract(player, world) {
  if (player.placing) {
    const spot = resolvePlacement(world, player.placing, player);
    if (player.placing.station === "seal") {
      return { kind: "place", label: spot.valid ? t("patchLeak") : t("needLeak") };
    }
    return { kind: "place", label: spot.valid ? t("place") : t("needNear") };
  }
  const p = player.root.position;
  const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
  const inside = isInsideHab(player);

  let gather = null;
  let gatherD = 5.4;
  for (const node of world.nodes) {
    if (node.taken) continue;
    const d = Math.hypot(p.x - node.mesh.position.x, p.z - node.mesh.position.z);
    if (d < gatherD) {
      gatherD = d;
      const hammered = node.needHammer;
      gather = {
        kind: "gather",
        node,
        label: hammered ? `${t("salvage")}  ·  ${itemName(node.type)}` : `${t("gather")}  ·  ${itemName(node.type)}`,
      };
    }
  }

  const stillRec = RECIPES.find((r) => r.station === "still");
  const stillPad = YARD_PADS.find((p) => p.station === "still");
  const stillAct = pickStillPadAction({
    padD: stillPad ? Math.hypot(p.x - stillPad.x, p.z - stillPad.z) : 99,
    gatherD,
    hasHammer: !!player.tools.hammer,
    canBuild: !!(stillRec && canAfford(player, stillRec.need)),
    hasStill: world.stations.some((s) => s.type === "still"),
  });
  if (stillAct?.kind === "build-still") return { kind: "build-still", label: t("buildStill") };
  if (stillAct?.kind === "still-hint") return { kind: "still-hint", label: t("stillHint") };

  for (const st of world.stations) {
    const d = Math.hypot(p.x - st.x, p.z - st.z);
    if (d > 4.2) continue;
    if (st.type === "still") {
      const act = pickStillMachineAction({
        d,
        water: st.water || 0,
        fuel: st.fuel || 0,
        fault: st.fault || null,
        gridOn: !!world.hab?.gridOn,
        hasIce: count(player, "ice") > 0,
        hasHydrazine: count(player, "hydrazine") > 0,
        canRepair: !!(player.tools.hammer && count(player, "wire") > 0 && count(player, "scrap") > 0),
      });
      if (act?.kind === "still-take") {
        return { kind: "still-take", station: st, label: `${t("drinkStill")}  ·  ${Math.floor(st.water)}` };
      }
      if (act?.kind === "still-repair") return { kind: "still-repair", station: st, label: t("repairPump") };
      if (act?.kind === "still-diag") return { kind: "still-diag", station: st, label: t("pumpFail") };
      if (act?.kind === "still-wait") return { kind: "still-wait", station: st, label: t("stillNoPower") };
      if (act?.kind === "still-fuel") return { kind: "still-fuel", station: st, label: t("fuel") };
      if (act?.kind === "still-drip") return { kind: "still-drip", station: st, label: t("stillDrip") };
    }
    if (st.type === "plot") {
      if (!st.planted && count(player, "potato") > 0) return { kind: "plant", station: st, label: t("plant") };
      if (st.planted && st.grow < 1 && count(player, "water") > 0) {
        return { kind: "water-plot", station: st, label: `${t("waterPlot")}  ·  ${Math.floor(st.grow * 100)}%` };
      }
      if (st.grow >= 1) return { kind: "harvest-plot", station: st, label: t("harvestReady") };
      if (st.planted) {
        const f = cropFactors(world);
        const wet = st.moisture ?? 0;
        let why = `${t("growing")}  ·  ${Math.floor(st.grow * 100)}%`;
        if (f.light < 0.35) why += ` · ${t("lowLight")}`;
        else if (f.temp < 0.35) why += ` · ${t("lowTemp")}`;
        else if (wet < 0.25) why += ` · ${t("lowMoist")}`;
        return { kind: "wait-plot", station: st, label: why };
      }
    }
  }

  const deskD = Math.hypot(p.x - HAB_DESK.x, p.z - HAB_DESK.z);
  const bunkD = Math.hypot(p.x - HAB_BUNK.x, p.z - HAB_BUNK.z);
  const arrayD = Math.hypot(p.x - HAB_ARRAY.x, p.z - HAB_ARRAY.z);
  const leakD = Math.hypot(p.x - HAB_LEAK.x, p.z - HAB_LEAK.z);

  const interior = pickInteriorAction({
    deskD,
    bunkD,
    lockerD,
    gatherD,
    leakD,
    inside,
    usedConsole: !!player.usedConsole,
    sealed: !!world.habSealed,
    canPatch: canAfford(player, { fabric: 2, tape: 1 }),
  });
  if (interior?.kind === "gather") return gather;
  if (interior?.kind === "patch") return { kind: "patch", label: t("patchLeak") };
  if (interior?.kind === "leak-hint") return { kind: "leak-hint", label: t("leakHint") };
  if (interior?.kind === "console") return { kind: "console", label: t("console") };
  if (interior?.kind === "sleep") return { kind: "sleep", label: t("sleep") };
  if (interior?.kind === "locker") {
    const lockerLabel = interior.hintDeeper ? `${t("locker")}  ·  ${t("consoleDeeper")}` : t("locker");
    return { kind: "locker", label: lockerLabel };
  }

  if (arrayD < 3.4 && count(player, "solar") > 0 && (world.hab?.arrayHealth ?? 1) < 0.97) {
    return { kind: "repair-array", label: `${t("repairArray")}  ·  ${Math.round((world.hab?.arrayHealth || 0) * 100)}%` };
  }
  if (lockerD < 3.6) return { kind: "locker", label: t("locker") };
  if (gather) return gather;
  return null;
}

function updatePrompt(player, world) {
  const prompt = $("prompt");
  const hit = findInteract(player, world);
  if (!hit) {
    prompt.classList.add("hidden");
    return;
  }
  prompt.classList.remove("hidden");
  prompt.textContent = hit.label;
}

function updateScanLabels(player, world, camera, scanning) {
  const mobile = document.body.classList.contains("mobile");
  const root = $("scan-labels");
  root.innerHTML = "";
  if (!camera) return;
  const lang = getLang();
  const p = player.root.position;
  const targets = [];

  if (mobile && !scanning) {
    const hit = findInteract(player, world);
    if (hit?.node) {
      targets.push({
        x: hit.node.mesh.position.x,
        y: hit.node.mesh.position.y + 0.95,
        z: hit.node.mesh.position.z,
        title: itemName(hit.node.type),
        loot: true,
      });
    } else if (hit?.kind === "locker") {
      targets.push({
        x: world.locker.x,
        y: world.locker.mesh.position.y + 2.2,
        z: world.locker.z,
        title: lang === "ru" ? "ШКАФ" : "LOCKER",
        loot: true,
      });
    } else if (hit?.kind === "build-still" || hit?.kind === "still-hint") {
      const pad = YARD_PADS.find((p) => p.station === "still");
      if (pad) {
        targets.push({
          x: pad.x,
          y: 3.2,
          z: pad.z,
          title: pad.label[lang] || pad.label.en,
          loot: true,
        });
      }
    } else if (hit?.station) {
      targets.push({
        x: hit.station.x,
        y: hit.station.mesh.position.y + 2.2,
        z: hit.station.z,
        title: hit.label,
        loot: true,
      });
    }
  } else {
    const lootRange = mobile ? 10 : 18;
    const outpostRange = mobile ? 28 : 42;
    for (const o of world.outposts) {
      const d = Math.hypot(p.x - o.x, p.z - o.z);
      if (scanning || d < outpostRange) {
        targets.push({
          x: o.x,
          y: o.group.position.y + 4.6,
          z: o.z,
          title: o.short[lang],
          sub: loc(o.name),
          far: d > 22,
        });
      }
    }
    for (const n of world.nodes) {
      if (n.taken) continue;
      const d = Math.hypot(p.x - n.mesh.position.x, p.z - n.mesh.position.z);
      if (d > lootRange && !scanning) continue;
      if (d > 48) continue;
      targets.push({
        x: n.mesh.position.x,
        y: n.mesh.position.y + 0.95,
        z: n.mesh.position.z,
        title: itemName(n.type),
        sub: n.needHammer ? (lang === "ru" ? "молоток" : "needs hammer") : "",
        loot: true,
      });
    }
    for (const st of world.stations) {
      const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d > (mobile ? 10 : 22) && !scanning) continue;
      const names = {
        still: { ru: "Дистиллятор", en: "Still" },
        plot: { ru: "Грядка", en: "Plot" },
        seal: { ru: "Заплата", en: "Seal" },
        solar: { ru: "Панель", en: "Solar" },
        radio: { ru: "Рация", en: "Radio" },
      };
      const title = names[st.type]?.[lang] || st.type;
      const sub =
        st.type === "still"
          ? String(Math.floor(st.water))
          : st.planted
            ? `${Math.floor(st.grow * 100)}%`
            : "";
      targets.push({ x: st.x, y: st.mesh.position.y + 2.2, z: st.z, title, sub, loot: true });
    }
    for (const pad of world.pads || YARD_PADS) {
      const occupied = world.stations.some((s) => s.type === pad.station && Math.hypot(s.x - pad.x, s.z - pad.z) < 2.2);
      if (occupied) continue;
      const d = Math.hypot(p.x - pad.x, p.z - pad.z);
      if (d > lootRange && !scanning) continue;
      targets.push({
        x: pad.x,
        y: 3.15,
        z: pad.z,
        title: pad.label[lang] || pad.label.en,
        sub: lang === "ru" ? "янтарное кольцо" : "amber ring",
        loot: true,
      });
    }
    const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
    if (lockerD < (mobile ? 10 : 18) || scanning) {
      targets.push({
        x: world.locker.x,
        y: world.locker.mesh.position.y + 2.4,
        z: world.locker.z,
        title: lang === "ru" ? "ШКАФ" : "LOCKER",
        sub: "",
        loot: true,
      });
    }
    if (!mobile && Math.hypot(p.x, p.z - 8) < 16) {
      if (!world.habSealed) {
        targets.push({
          x: HAB_LEAK.x,
          y: 2.05,
          z: HAB_LEAK.z,
          title: lang === "ru" ? "УТЕЧКА" : "LEAK",
          sub: lang === "ru" ? "слева от шлюза" : "left of hatch",
          loot: true,
        });
      }
      targets.push({
        x: HAB_BUNK.x,
        y: 2.2,
        z: HAB_BUNK.z,
        title: lang === "ru" ? "КОЙКА · СОН" : "BUNK · SLEEP",
        sub: "",
        loot: true,
      });
      targets.push({
        x: HAB_DESK.x,
        y: 2.2,
        z: HAB_DESK.z,
        title: lang === "ru" ? "КОНСОЛЬ HAB" : "HAB CONSOLE",
        sub: world.hab ? `P ${(world.hab.pressure * 100).toFixed(0)}%` : "",
        loot: true,
      });
    }
  }

  const v = new THREE.Vector3();
  const hudBottom = mobile ? 0.28 : 0;
  for (const item of targets) {
    v.set(item.x, item.y, item.z);
    v.project(camera);
    if (v.z > 1) continue;
    const top = -v.y * 0.5 + 0.5;
    if (top > 1 - hudBottom) continue;
    const el = document.createElement("div");
    el.className = `scan-tag${item.loot ? " loot" : ""}${item.far ? " far" : ""}`;
    el.innerHTML = `${item.title}${item.sub ? `<small>${item.sub}</small>` : ""}`;
    el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${top * 100}%`;
    root.appendChild(el);
  }
}

export function pushLog(from, body) {
  const card = document.createElement("div");
  card.className = "log-card";
  card.innerHTML = `<b>${from}</b><p>${body}</p>`;
  const log = $("log");
  log.prepend(card);
  while (log.children.length > 3) log.lastChild.remove();
  setTimeout(() => card.remove(), 18000);
}

export function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

export function showEnd(journal, player) {
  closeMenus();
  $("hud").classList.add("hidden");
  $("end-screen").classList.remove("hidden");
  $("end-copy").textContent = t("endCopy");
  const km = (player.distance / 1000).toFixed(2);
  $("end-stats").textContent =
    getLang() === "ru"
      ? `Sol ${journal.sols} · ${km} км по ржавчине`
      : `Sol ${journal.sols} · ${km} km of rust`;
}

export { ITEMS, SURVIVAL };
