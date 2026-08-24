import * as THREE from "three";
import { t, getLang } from "./i18n.js";
import { cargoWeight, cargoTitle, hasNeed } from "./player.js";
import { orderText } from "./campaign.js";
import { OUTPOSTS } from "./data.js";

const $ = (id) => document.getElementById(id);

export function bindUi(handlers) {
  $("btn-start").addEventListener("click", handlers.start);
  $("btn-lang").addEventListener("click", handlers.lang);
  $("btn-again").addEventListener("click", () => location.reload());
}

export function showHud() {
  $("title-screen").classList.add("hidden");
  $("hud").classList.remove("hidden");
}

export function updateHud({ player, world, campaign, order, scanning, camera }) {
  const weight = cargoWeight(player);
  $("bar-o2").style.width = `${player.oxygen}%`;
  $("bar-stamina").style.width = `${player.stamina}%`;
  $("bar-balance").style.width = `${player.balance}%`;
  $("bar-balance").style.background = player.balance > 70 ? "#ff5a3c" : "#ffb15a";
  $("weight-label").textContent = `${Math.round(weight)} kg`;
  $("likes-count").textContent = String(campaign.likes);
  $("link-status").textContent = `${world.connectedCount()} / ${world.outposts.length}`;

  if (order) {
    const text = orderText(order);
    $("order-title").textContent = text.title;
    $("order-brief").textContent = text.brief;
    const dest = OUTPOSTS.find((o) => o.id === order.dest);
    const lang = getLang();
    $("order-dest").textContent = `${t("dest")}: ${dest.name[lang]}`;
    $("sol-label").textContent = `SOL ${order.sol}`;
  }

  const near = world.nearestOutpost(player.root.position);
  const loc =
    near.dist < 22 ? near.outpost.short[getLang()] : getLang() === "ru" ? "ПУСТЫНЯ" : "OPEN DESERT";
  $("location-label").textContent = loc;

  const headings = getLang() === "ru" ? "С  СВ  В  ЮВ  Ю  ЮЗ  З  СЗ  " : "N  NE  E  SE  S  SW  W  NW  ";
  const strip = (headings + headings + headings).repeat(3);
  $("compass-strip").textContent = strip;
  const yaw = player.yaw;
  const px = ((yaw / (Math.PI * 2) + 10) % 1) * 220;
  $("compass-strip").style.transform = `translateX(${-80 - px}px)`;

  $("storm-overlay").style.opacity = String(world.storm * 0.85);
  $("scan-overlay").style.opacity = scanning ? "1" : "0";

  const list = $("pack-list");
  list.innerHTML = "";
  if (player.cargo.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${getLang() === "ru" ? "пусто" : "empty"}</span>`;
    list.appendChild(li);
  } else {
    for (const c of player.cargo) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${cargoTitle(c)}</span><span>${c.weight}kg · ${Math.round(c.condition)}%</span>`;
      list.appendChild(li);
    }
  }

  updateScanLabels(world, camera, scanning);
  updatePrompt(player, world, order);
}

function updatePrompt(player, world, order) {
  const prompt = $("prompt");
  const hit = findInteract(player, world, order);
  if (!hit) {
    prompt.classList.add("hidden");
    return;
  }
  prompt.classList.remove("hidden");
  prompt.textContent = hit.label;
}

export function findInteract(player, world, order) {
  const p = player.root.position;
  let best = null;
  let bestD = 3.4;

  for (const c of world.cargo) {
    if (c.taken) continue;
    const d = Math.hypot(p.x - c.mesh.position.x, p.z - c.mesh.position.z);
    if (d < bestD) {
      bestD = d;
      best = { kind: "pickup", crate: c, label: t("pickup") };
    }
  }

  const { outpost, dist } = world.nearestOutpost(p);
  if (outpost && dist < 7.5) {
    if (order && outpost.id === order.dest && hasNeed(player, order.need)) {
      return { kind: "deliver", outpost, label: t("deliver") };
    }
    if (dist < 6.5) {
      return { kind: "rest", outpost, label: t("rest") };
    }
  }
  return best;
}

function updateScanLabels(world, camera, scanning) {
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
      sub: o.connected ? t("connected") : o.name[lang],
    })),
    ...world.cargo
      .filter((c) => !c.taken)
      .map((c) => ({
        x: c.mesh.position.x,
        y: c.mesh.position.y + 1,
        z: c.mesh.position.z,
        title: cargoTitle(c),
        sub: `${c.weight}kg`,
      })),
  ];
  const v = new THREE.Vector3();
  for (const item of targets) {
    v.set(item.x, item.y, item.z);
    v.project(camera);
    if (v.z > 1) continue;
    const el = document.createElement("div");
    el.className = "scan-tag";
    el.innerHTML = `${item.title}<small>${item.sub}</small>`;
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
  setTimeout(() => card.remove(), 16000);
}

export function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

export function showEnd(campaign, player) {
  $("hud").classList.add("hidden");
  $("pack").classList.add("hidden");
  $("end-screen").classList.remove("hidden");
  $("end-copy").textContent = t("endCopy");
  const km = (player.distance / 1000).toFixed(2);
  $("end-stats").textContent =
    getLang() === "ru"
      ? `${campaign.likes} лайков · ${campaign.deliveries} доставок · ${km} км`
      : `${campaign.likes} likes · ${campaign.deliveries} deliveries · ${km} km walked`;
}

export function togglePack() {
  $("pack").classList.toggle("hidden");
}
