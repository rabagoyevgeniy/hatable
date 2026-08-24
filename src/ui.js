import * as THREE from "three";
import { t, getLang, loc } from "./i18n.js";
import { ITEMS, RECIPES, SURVIVAL, GOALS } from "./data.js";
import { count, canAfford, itemName, isInsideHab } from "./player.js";
import { currentGoal, goalText } from "./journal.js";
import { nearestOutpost } from "./world.js";

const $ = (id) => document.getElementById(id);

export function bindUi(handlers) {
  $("btn-start").addEventListener("click", handlers.start);
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
}

export function showHud() {
  $("title-screen").classList.add("hidden");
  $("hud").classList.remove("hidden");
}

export function menusOpen() {
  return (
    !$("craft").classList.contains("hidden") ||
    !$("inv").classList.contains("hidden") ||
    !$("storage").classList.contains("hidden")
  );
}

export function toggleCraft(player) {
  $("inv").classList.add("hidden");
  $("craft").classList.toggle("hidden");
  renderCraft(player);
  return !$("craft").classList.contains("hidden");
}

export function toggleInv(player) {
  $("craft").classList.add("hidden");
  $("inv").classList.toggle("hidden");
  renderInv(player);
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
  return !$("storage").classList.contains("hidden");
}

export function storageOpen() {
  return !$("storage").classList.contains("hidden");
}

export function closeMenus() {
  $("craft").classList.add("hidden");
  $("inv").classList.add("hidden");
  $("storage").classList.add("hidden");
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
      <span><b>${loc(rec.title)}</b><small>${needLine(rec.need)}${rec.requireTool ? " · hammer" : ""}</small></span>
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

export function updateHud({ player, world, journal, scanning, camera }) {
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
  if (player.thirst < 22) warn.textContent = t("warnThirst");
  else if (player.hunger < 22) warn.textContent = t("warnHunger");
  else if (player.oxygen < 22) warn.textContent = t("warnO2");
  else if (player.warmth < 22) warn.textContent = t("warnWarmth");
  else warn.textContent = "";

  const goal = currentGoal(journal);
  $("goal-step").textContent = `${Math.min(journal.index + 1, 8)} / 8`;
  if (goal) {
    const text = goalText(goal);
    $("order-title").textContent = text.title;
    $("order-brief").textContent = text.brief;
    $("sol-label").textContent = `SOL ${text.sol}`;
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
  if (hint) hint.classList.toggle("hidden", player.tools.hammer);

  const leak = world.habSealed ? (world.powered ? "SEALED + PWR" : "SEALED") : "LEAK";
  $("hab-status").textContent = leak;
  $("hab-status").style.color = world.habSealed ? "#8fd3b0" : "#ff5a3c";

  const near = nearestOutpost(world, player.root.position);
  $("location-label").textContent =
    near.dist < 22 ? near.outpost.short[getLang()] : getLang() === "ru" ? "ПУСТЫНЯ" : "OPEN DESERT";

  const deg = ((-player.yaw * 180) / Math.PI + 360) % 360;
  const dirs = getLang() === "ru" ? ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"] : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir = dirs[Math.round(deg / 45) % 8];
  $("compass-dir").textContent = dir;
  $("compass-deg").textContent = `${Math.round(deg)}°`;

  $("storm-overlay").style.opacity = String(world.storm * 0.85);
  $("night-overlay").style.opacity = String(Math.max(0, 0.55 - world.daylight));
  $("scan-overlay").style.opacity = scanning ? "1" : "0";

  if (!$("craft").classList.contains("hidden")) renderCraft(player);
  if (!$("inv").classList.contains("hidden")) renderInv(player);
  if (!$("storage").classList.contains("hidden")) renderStorage(world);

  updateScanLabels(player, world, camera, scanning);
  updatePrompt(player, world);
}

function colorBar(id, v) {
  $(id).style.background = v < 22 ? "#ff5a3c" : v < 45 ? "#ffb15a" : "#8fd3b0";
}

export function findInteract(player, world) {
  if (player.placing) return { kind: "place", label: t("place") };
  const p = player.root.position;
  const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
  const inside = isInsideHab(player);
  const habD = Math.hypot(p.x, p.z - 8);

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

  for (const st of world.stations) {
    const d = Math.hypot(p.x - st.x, p.z - st.z);
    if (d > 4.2) continue;
    if (st.type === "still") {
      if (st.water >= 1) return { kind: "still-take", station: st, label: t("drinkStill") };
      if (count(player, "ice") > 0 || count(player, "hydrazine") > 0) {
        return { kind: "still-fuel", station: st, label: t("fuel") };
      }
    }
    if (st.type === "plot") {
      if (!st.planted && count(player, "potato") > 0) return { kind: "plant", station: st, label: t("plant") };
      if (st.grow >= 1) return { kind: "harvest-plot", station: st, label: t("harvest") };
    }
  }

  if (gather && gatherD < 3.2 && gatherD <= lockerD) return gather;
  if (lockerD < 4.0) return { kind: "locker", label: t("locker") };
  if (gather) return gather;
  if (inside && habD < 7.4) return { kind: "sleep", label: t("sleep") };
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
  const root = $("scan-labels");
  root.innerHTML = "";
  if (!camera) return;
  const lang = getLang();
  const p = player.root.position;
  const targets = [];
  for (const o of world.outposts) {
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    if (scanning || d < 42) {
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
    if (d > 18 && !scanning) continue;
    if (d > 48) continue;
    targets.push({
      x: n.mesh.position.x,
      y: n.mesh.position.y + 2.2,
      z: n.mesh.position.z,
      title: itemName(n.type),
      sub: n.needHammer ? (lang === "ru" ? "молоток" : "needs hammer") : "",
      loot: true,
    });
  }
  const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
  if (lockerD < 18 || scanning) {
    targets.push({
      x: world.locker.x,
      y: world.locker.mesh.position.y + 2.4,
      z: world.locker.z,
      title: lang === "ru" ? "ШКАФ" : "LOCKER",
      sub: "",
      loot: true,
    });
  }
  const v = new THREE.Vector3();
  for (const item of targets) {
    v.set(item.x, item.y, item.z);
    v.project(camera);
    if (v.z > 1) continue;
    const el = document.createElement("div");
    el.className = `scan-tag${item.loot ? " loot" : ""}${item.far ? " far" : ""}`;
    el.innerHTML = `${item.title}${item.sub ? `<small>${item.sub}</small>` : ""}`;
    el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
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
