import * as THREE from "three";
import { heightAt, normalAt } from "./noise.js";
import { ITEMS, CONSUME, SURVIVAL, SPAWN } from "./data.js";
import { loc } from "./i18n.js";
import { footstep } from "./audio.js";
import { advanceSol } from "./world.js";

export function createPlayer(scene) {
  const root = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xe07030, roughness: 0.58, metalness: 0.12 });
  const suitDark = new THREE.MeshStandardMaterial({ color: 0xb84818, roughness: 0.7, metalness: 0.08 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeee8de, roughness: 0.42, metalness: 0.18 });
  const visor = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    roughness: 0.08,
    metalness: 0.88,
    emissive: 0x3a2208,
    emissiveIntensity: 0.22,
  });
  const packMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.5, metalness: 0.28 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.85 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.62, 6, 12), suit);
  torso.position.y = 1.18;
  root.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.2), white);
  chest.position.set(0, 1.34, 0.3);
  root.add(chest);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.5), white);
  stripe.position.y = 1.04;
  root.add(stripe);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), white);
  helmet.position.y = 1.86;
  root.add(helmet);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI), visor);
  glass.position.set(0, 1.84, 0.14);
  root.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 18), white);
  rim.position.set(0, 1.84, 0.16);
  root.add(rim);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.36), packMat);
  pack.position.set(0, 1.28, -0.44);
  root.add(pack);
  const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.72, 8), white);
  tankL.position.set(-0.16, 1.3, -0.66);
  root.add(tankL);
  const tankR = tankL.clone();
  tankR.position.x = 0.16;
  root.add(tankR);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suit);
  armL.position.set(-0.54, 1.18, 0);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glove);
  handL.position.set(0, -0.4, 0);
  armL.add(handL);
  root.add(armL);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suit);
  armR.position.set(0.54, 1.18, 0);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glove);
  handR.position.set(0, -0.4, 0);
  armR.add(handR);
  root.add(armR);

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.52, 4, 8), suitDark);
  legL.position.set(-0.2, 0.48, 0);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), boot);
  bootL.position.set(0, -0.42, 0.05);
  legL.add(bootL);
  root.add(legL);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.52, 4, 8), suitDark);
  legR.position.set(0.2, 0.48, 0);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), boot);
  bootR.position.set(0, -0.42, 0.05);
  legR.add(bootR);
  root.add(legR);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  root.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z) + 0.02, SPAWN.z);
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
    oxygen: 82,
    hunger: 64,
    thirst: 62,
    warmth: 70,
    walkPhase: 0,
    lastStep: 0,
    distance: 0,
    gathered: 0,
    drank: false,
    harvestedCrop: false,
    placing: null,
    heldId: null,
    hammerMesh: null,
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
  return Math.hypot(player.root.position.x - 0, player.root.position.z - 8) < 8.8;
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
  const inside = isInsideHab(player);
  if (world.storm > 0.4 && !inside) {
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
      footstep(inside);
    }
  } else {
    player.legL.rotation.x *= 0.8;
    player.legR.rotation.x *= 0.8;
    player.armL.rotation.x *= 0.8;
    player.armR.rotation.x *= 0.8;
  }
  player.root.rotation.y = yaw;

  const night = world.daylight < 0.28;
  const leak = world.habSealed ? 0.12 : 0.52;
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
    player.root.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    player.oxygen = 38;
    player.warmth = 32;
    player.hunger = Math.max(8, player.hunger - 18);
    player.thirst = Math.max(8, player.thirst - 22);
  }
  return { blackout, inside, warnings };
}

export function trySleep(player, world) {
  if (player.hunger < 18 || player.thirst < 18) return "tooWeak";
  advanceSol(world);
  player.hunger = clamp(player.hunger - 12);
  player.thirst = clamp(player.thirst - 16);
  if (world.habSealed) player.oxygen = 100;
  else player.oxygen = clamp(player.oxygen + 12);
  player.warmth = clamp(world.powered ? 88 : player.warmth + 18);
  return "slept";
}

export function attachHammer(player) {
  if (player.hammerMesh) return;
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0xc8c0b4, metalness: 0.45, roughness: 0.4 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 6), wood);
  handle.rotation.z = 0.35;
  g.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), iron);
  head.position.set(0.14, 0.22, 0);
  g.add(head);
  g.position.set(0.1, -0.4, 0.16);
  g.rotation.set(0.4, 0.2, -0.5);
  g.scale.setScalar(1.35);
  player.armR.add(g);
  player.hammerMesh = g;
}

export function pocketSlots(player) {
  return Object.entries(player.inv).filter(([, n]) => n > 0);
}

export function itemName(id) {
  return loc(ITEMS[id]?.name) || id;
}
