import * as THREE from "three";
import { t, getLang, loc } from "./i18n.js";
import { ITEMS, RECIPES, SURVIVAL } from "./data.js";
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
    if (btn) handlers.consume(btn.dataset.item);
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
    li.innerHTML = `<button class="recipe ${ok ? "" : "locked"}" data-recipe="${rec.id}">
      <span><b>${loc(rec.title)}</b><small>${needLine(rec.need)}${rec.requireTool ? " · hammer" : ""}</small></span>
      <span>${ok ? "▸" : "–"}</span>
    </button>`;
    list.appendChild(li);
  }
}

export function renderStorage(world) {
  fillItemList($("storage-list"), world.locker.storage, false);
}

export function renderInv(player) {
  const list = $("inv-list");
  list.innerHTML = "";
  if (player.tools.hammer) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${getLang() === "ru" ? "Молоток" : "Hammer"}</span><span>tool</span>`;
    list.appendChild(li);
  }
  fillItemList(list, player.inv, true);
  if (totalShown(player) === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${getLang() === "ru" ? "пусто — шкаф у двери Hab" : "empty — locker by the Hab door"}</span>`;
    list.appendChild(li);
  }
}

function totalShown(player) {
  return Object.values(player.inv).reduce((s, n) => s + n, 0) + (player.tools.hammer ? 1 : 0);
}

function fillItemList(list, bag, eat) {
  for (const [id, n] of Object.entries(bag)) {
    if (!n) continue;
    const li = document.createElement("li");
    const use = eat && (id === "potato" || id === "water");
    li.innerHTML = `<button class="recipe" data-item="${id}"><span>${itemName(id)}</span><span>${n}${use ? (getLang() === "ru" ? " · съесть" : " · use") : ""}</span></button>`;
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

  const leak = world.habSealed ? (world.powered ? "SEALED + PWR" : "SEALED") : "LEAK";
  $("hab-status").textContent = leak;
  $("hab-status").style.color = world.habSealed ? "#8fd3b0" : "#ff5a3c";

  const near = nearestOutpost(world, player.root.position);
  $("location-label").textContent =
    near.dist < 22 ? near.outpost.short[getLang()] : getLang() === "ru" ? "ПУСТЫНЯ" : "OPEN DESERT";

  const headings = getLang() === "ru" ? "С  СВ  В  ЮВ  Ю  ЮЗ  З  СЗ  " : "N  NE  E  SE  S  SW  W  NW  ";
  $("compass-strip").textContent = (headings + headings + headings).repeat(3);
  const px = ((player.yaw / (Math.PI * 2) + 10) % 1) * 220;
  $("compass-strip").style.transform = `translateX(${-80 - px}px)`;

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
  let best = null;
  let bestD = 4.8;
  for (const node of world.nodes) {
    if (node.taken) continue;
    const d = Math.hypot(p.x - node.mesh.position.x, p.z - node.mesh.position.z);
    if (d < bestD) {
      bestD = d;
      const hammered = node.needHammer;
      best = {
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
  if (best) {
    const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
    if (lockerD < 3.6) return { kind: "locker", label: t("locker") };
    return best;
  }
  const lockerD = Math.hypot(p.x - world.locker.x, p.z - world.locker.z);
  if (lockerD < 5.2) return { kind: "locker", label: t("locker") };
  if (isInsideHab(player)) return { kind: "sleep", label: t("sleep") };
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
  if (!scanning || !camera) return;
  const lang = getLang();
  const targets = [
    ...world.outposts.map((o) => ({
      x: o.x,
      y: o.group.position.y + 4,
      z: o.z,
      title: o.short[lang],
      sub: loc(o.name),
    })),
    ...world.nodes
      .filter((n) => !n.taken)
      .map((n) => ({
        x: n.mesh.position.x,
        y: n.mesh.position.y + 1.4,
        z: n.mesh.position.z,
        title: itemName(n.type),
        sub: "",
      })),
  ];
  const v = new THREE.Vector3();
  for (const item of targets) {
    v.set(item.x, item.y, item.z);
    v.project(camera);
    if (v.z > 1) continue;
    const el = document.createElement("div");
    el.className = "scan-tag";
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
