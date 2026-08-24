import * as THREE from "three";
import { heightAt, normalAt } from "./noise.js";
import { ITEMS, CONSUME, SURVIVAL } from "./data.js";
import { loc } from "./i18n.js";
import { footstep } from "./audio.js";

export function createPlayer(scene) {
  const root = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.55, metalness: 0.08 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xc45c2a, roughness: 0.5 });
  const visor = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.2, metalness: 0.7 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0xd5cfc4, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.7, 6, 10), suit);
  torso.position.y = 1.15;
  root.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), suit);
  helmet.position.y = 1.78;
  root.add(helmet);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI), visor);
  glass.position.set(0, 1.78, 0.12);
  root.add(glass);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.46), accent);
  stripe.position.y = 1.25;
  root.add(stripe);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28), packMat);
  pack.position.set(0, 1.25, -0.38);
  root.add(pack);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 6), suit);
  armL.position.set(-0.5, 1.2, 0);
  root.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.5;
  root.add(armR);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 6), suit);
  legL.position.set(-0.18, 0.45, 0);
  root.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  root.add(legR);

  root.position.set(4, heightAt(4, 14) + 0.02, 14);
  scene.add(root);

  const inv = {};
  for (const id of Object.keys(ITEMS)) inv[id] = 0;

  return {
    root,
    armL,
    armR,
    legL,
    legR,
    yaw: 0,
    pitch: 0.18,
    vel: new THREE.Vector3(),
    inv,
    tools: { hammer: false },
    oxygen: 72,
    hunger: 58,
    thirst: 48,
    warmth: 70,
    walkPhase: 0,
    lastStep: 0,
    distance: 0,
    gathered: 0,
    drank: false,
    harvestedCrop: false,
    placing: null,
  };
}

export function count(player, id) {
  return player.inv[id] || 0;
}

export function totalItems(player) {
  return Object.values(player.inv).reduce((s, n) => s + n, 0);
}

export function addItem(player, id, n = 1) {
  if (totalItems(player) + n > SURVIVAL.pocketMax) return false;
  player.inv[id] = (player.inv[id] || 0) + n;
  player.gathered += n;
  return true;
}

export function transfer(fromInv, toInv, id, n = 1, cap = Infinity) {
  if ((fromInv[id] || 0) < n) return false;
  const toTotal = Object.values(toInv).reduce((s, v) => s + v, 0);
  if (toTotal + n > cap) return false;
  fromInv[id] -= n;
  toInv[id] = (toInv[id] || 0) + n;
  return true;
}

export function takeItems(player, need) {
  for (const [id, n] of Object.entries(need)) {
    if (count(player, id) < n) return false;
  }
  for (const [id, n] of Object.entries(need)) player.inv[id] -= n;
  return true;
}

export function canAfford(player, need) {
  return Object.entries(need).every(([id, n]) => count(player, id) >= n);
}

export function consumeItem(player, id) {
  const effect = CONSUME[id];
  if (!effect || count(player, id) < 1) return false;
  player.inv[id] -= 1;
  player.hunger = clamp(player.hunger + effect.hunger);
  player.thirst = clamp(player.thirst + effect.thirst);
  player.oxygen = clamp(player.oxygen + effect.o2);
  if (id === "water") player.drank = true;
  return true;
}

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

export function isInsideHab(player) {
  return Math.hypot(player.root.position.x - 0, player.root.position.z - 8) < 9.5;
}

export function updatePlayer(player, dt, input, world) {
  let mx = 0;
  let mz = 0;
  if (input.forward) mz -= 1;
  if (input.back) mz += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  const yaw = player.yaw;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = new THREE.Vector3();
  wish.addScaledVector(forward, -mz);
  wish.addScaledVector(right, mx);
  if (wish.lengthSq() > 0) wish.normalize();

  const n = normalAt(player.root.position.x, player.root.position.z);
  const slope = 1 - n[1];
  const speed =
    5.8 *
    (1 - slope * 1.1) *
    (player.hunger < 18 || player.thirst < 18 ? SURVIVAL.starveSlow : 1) *
    (player.warmth < 12 ? 0.7 : 1);
  player.vel.lerp(wish.multiplyScalar(Math.max(0.8, speed)), 1 - Math.pow(0.0008, dt));

  const pos = player.root.position;
  const prevX = pos.x;
  const prevZ = pos.z;
  pos.x += player.vel.x * dt;
  pos.z += player.vel.z * dt;
  const r = Math.hypot(pos.x, pos.z);
  if (r > 270) {
    pos.x *= 270 / r;
    pos.z *= 270 / r;
  }
  pos.y = heightAt(pos.x, pos.z);
  player.distance += Math.hypot(pos.x - prevX, pos.z - prevZ);
  if (world.storm > 0.4) {
    pos.x += dt * world.storm * 0.9;
    pos.z += dt * world.storm * 0.35;
  }

  if (moving) {
    player.walkPhase += dt * (8 + speed);
    const swing = Math.sin(player.walkPhase) * 0.45;
    player.legL.rotation.x = swing;
    player.legR.rotation.x = -swing;
    player.armL.rotation.x = -swing * 0.7;
    player.armR.rotation.x = swing * 0.7;
    if (player.walkPhase - player.lastStep > 1.6) {
      player.lastStep = player.walkPhase;
      footstep();
    }
  } else {
    player.legL.rotation.x *= 0.8;
    player.legR.rotation.x *= 0.8;
    player.armL.rotation.x *= 0.8;
    player.armR.rotation.x *= 0.8;
  }
  player.root.rotation.y = yaw;

  const inside = isInsideHab(player);
  const night = world.daylight < 0.28;
  const leak = world.habSealed ? 0.18 : 1.55;
  if (inside) {
    player.oxygen = clamp(player.oxygen + dt * (world.habSealed ? 8 : -leak));
    player.warmth = clamp(player.warmth + dt * (world.powered ? 10 : night ? -3.2 : 3));
    player.hunger = clamp(player.hunger - dt * SURVIVAL.hungerHab);
    player.thirst = clamp(player.thirst - dt * SURVIVAL.thirstHab);
  } else {
    player.oxygen = clamp(player.oxygen - dt * (SURVIVAL.o2Outside + leak * 0.4 + world.storm * SURVIVAL.o2Storm));
    player.warmth = clamp(
      player.warmth - dt * (night ? SURVIVAL.warmthNight : SURVIVAL.warmthDay) * (world.storm + 0.55)
    );
    const hRate = moving ? SURVIVAL.hungerWalk : SURVIVAL.hungerIdle;
    const tRate = moving ? SURVIVAL.thirstWalk : SURVIVAL.thirstIdle;
    player.hunger = clamp(player.hunger - dt * hRate);
    player.thirst = clamp(player.thirst - dt * tRate);
  }
  if (player.thirst <= 0) player.oxygen = clamp(player.oxygen - dt * 5.5);
  if (player.hunger <= 0) player.warmth = clamp(player.warmth - dt * 4);
  if (player.warmth <= 0) player.oxygen = clamp(player.oxygen - dt * 4.5);

  const warnings = [];
  if (player.thirst < 22) warnings.push("thirst");
  if (player.hunger < 22) warnings.push("hunger");
  if (player.oxygen < 22) warnings.push("o2");
  if (player.warmth < 22) warnings.push("warmth");

  const blackout = player.oxygen <= 0;
  if (blackout) {
    player.root.position.set(4, heightAt(4, 14), 14);
    player.oxygen = 38;
    player.warmth = 32;
    player.hunger = Math.max(8, player.hunger - 18);
    player.thirst = Math.max(8, player.thirst - 22);
  }
  return { blackout, inside, warnings };
}

export function trySleep(player, world) {
  if (player.hunger < 18 || player.thirst < 18) return "tooWeak";
  world.clock = (world.clock + 0.32) % 1;
  player.hunger = clamp(player.hunger - 12);
  player.thirst = clamp(player.thirst - 16);
  if (world.habSealed) player.oxygen = 100;
  else player.oxygen = clamp(player.oxygen + 12);
  player.warmth = clamp(world.powered ? 88 : player.warmth + 18);
  return "slept";
}

export function itemName(id) {
  return loc(ITEMS[id]?.name) || id;
}
