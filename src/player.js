import * as THREE from "three";
import { heightAt, normalAt } from "./noise.js";
import { ITEMS, CONSUME, SURVIVAL, SPAWN } from "./data.js";
import { loc } from "./i18n.js";
import { footstep } from "./audio.js";
import { advanceSol, isMobileView, terrainSegments } from "./world.js";
import { maps, std, phys } from "./gfx.js";
import { takeCharacter, takeModel } from "./models.js";
import { canEatPotato, trySleepSol, estimateRangeM, WALK_MPS } from "./systems/survival.js";
import { habCanRefillSuit } from "./systems/habitat.js";
import { count, totalItems, addItem, takeItems, canAfford, transfer } from "./systems/inventory.js";
import {
  groundYAt,
  isSheltered,
  resolvePlayerXZ,
  snapToGround,
  emergencyUnground,
  PLAYER_RADIUS,
} from "./systems/collision.js";

export { canEatPotato, count, totalItems, addItem, takeItems, canAfford, transfer, estimateRangeM };

export function createPlayer(scene) {
  const root = new THREE.Group();
  const animated = takeCharacter(1.92);
  let armL;
  let armR;
  let legL;
  let legR;
  let mixer = null;
  let walkAction = null;
  let idleAction = null;
  let runAction = null;

  if (animated) {
    root.add(animated.root);
    mixer = animated.mixer;
    walkAction = animated.walkAction;
    idleAction = animated.idleAction;
    runAction = animated.runAction;
    armL = new THREE.Group();
    armL.position.set(-0.45, 1.2, 0.1);
    armR = new THREE.Group();
    armR.position.set(0.45, 1.2, 0.15);
    legL = new THREE.Group();
    legR = new THREE.Group();
    root.add(armL);
    root.add(armR);
    root.add(legL);
    root.add(legR);
  } else {
    const tex = maps();
  const suit = std({ color: 0xe07030, map: tex.eva, roughness: 0.55, metalness: 0.08 });
  const suitDark = std({ color: 0xb84818, map: tex.eva, roughness: 0.68, metalness: 0.06 });
  const white = std({ color: 0xeee8de, map: tex.hull, roughness: 0.4, metalness: 0.2 });
  const visor = phys({
    color: 0xc9a227,
    roughness: 0.06,
    metalness: 0.92,
    emissive: 0x3a2208,
    emissiveIntensity: 0.18,
    envMapIntensity: 1.6,
  });
  const packMat = std({ color: 0xd8d2c6, map: tex.metal, roughness: 0.45, metalness: 0.32 });
  const glove = std({ color: 0x2a2420, roughness: 0.85 });
  const boot = std({ color: 0x1c1814, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.62, 6, 14), suit);
    torso.position.y = 1.18;
    root.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.2), white);
    chest.position.set(0, 1.34, 0.3);
    root.add(chest);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), std({ color: 0x2a4a8a, emissive: 0x1a3060, emissiveIntensity: 0.2 }));
    flag.position.set(0.22, 1.36, 0.41);
    root.add(flag);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.5), white);
    stripe.position.y = 1.04;
    root.add(stripe);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), white);
    helmet.position.y = 1.86;
    root.add(helmet);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 12, 0, Math.PI), visor);
    glass.position.set(0, 1.84, 0.14);
    root.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 22), white);
    rim.position.set(0, 1.84, 0.16);
    root.add(rim);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.16, 12), white);
    neck.position.y = 1.62;
    root.add(neck);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.36), packMat);
    pack.position.set(0, 1.28, -0.44);
    root.add(pack);
    const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.72, 10), white);
    tankL.position.set(-0.16, 1.3, -0.66);
    root.add(tankL);
    const tankR = tankL.clone();
    tankR.position.x = 0.16;
    root.add(tankR);
    const hose = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.03, 6, 10, Math.PI),
      std({ color: 0x3a342e, roughness: 0.8 })
    );
    hose.position.set(0.28, 1.55, -0.2);
    hose.rotation.y = 0.6;
    root.add(hose);

    armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 10), suit);
    armL.position.set(-0.54, 1.18, 0);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glove);
    handL.position.set(0, -0.4, 0);
    armL.add(handL);
    root.add(armL);
    armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 10), suit);
    armR.position.set(0.54, 1.18, 0);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glove);
    handR.position.set(0, -0.4, 0);
    armR.add(handR);
    root.add(armR);

    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), std({ color: 0x1a1814, emissive: 0x3a80c8, emissiveIntensity: 0.45 }));
    wrist.position.set(0, -0.18, 0.08);
    armL.add(wrist);

    legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.52, 4, 10), suitDark);
    legL.position.set(-0.2, 0.48, 0);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), boot);
    bootL.position.set(0, -0.42, 0.05);
    legL.add(bootL);
    root.add(legL);
    legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.52, 4, 10), suitDark);
    legR.position.set(0.2, 0.48, 0);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), boot);
    bootR.position.set(0, -0.42, 0.05);
    legR.add(bootR);
    root.add(legR);
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = !isMobileView();
      o.receiveShadow = !isMobileView();
    }
  });

  root.position.set(SPAWN.x, groundYAt(SPAWN.x, SPAWN.z, terrainSegments(), heightAt), SPAWN.z);
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 18),
    new THREE.MeshBasicMaterial({ color: 0x2a1008, transparent: true, opacity: 0.42, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.035;
  blob.renderOrder = 1;
  root.add(blob);
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
    pitch: isMobileView() ? 0.08 : 0.18,
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
    enteredHab: false,
    usedConsole: false,
    sawStillYard: false,
    placing: null,
    heldId: null,
    hammerMesh: null,
    mixer,
    walkAction,
    idleAction,
    runAction,
  };
}


export function consumeItem(player, id) {
  const effect = CONSUME[id];
  if (!effect || count(player, id) < 1) return false;
  if (id === "potato" && !canEatPotato(player)) return false;
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
  return isSheltered(player.root.position.x, player.root.position.z);
}

function segsOf(world) {
  return world?.terrainSegments || terrainSegments();
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
    WALK_MPS *
    (1 - slope * 1.1) *
    (player.hunger < 18 || player.thirst < 18 ? SURVIVAL.starveSlow : 1) *
    (player.warmth < 12 ? 0.7 : 1);
  player.vel.lerp(wish.multiplyScalar(Math.max(0.8, speed)), 1 - Math.pow(0.0008, dt));

  const pos = player.root.position;
  const prevX = pos.x;
  const prevZ = pos.z;
  const segs = segsOf(world);
  pos.x += player.vel.x * dt;
  pos.z += player.vel.z * dt;
  const r = Math.hypot(pos.x, pos.z);
  if (r > 270) {
    pos.x *= 270 / r;
    pos.z *= 270 / r;
  }
  resolvePlayerXZ(pos, PLAYER_RADIUS);
  let inside = isInsideHab(player);
  if (world.storm > 0.4 && !inside) {
    pos.x += dt * world.storm * 0.9;
    pos.z += dt * world.storm * 0.35;
    resolvePlayerXZ(pos, PLAYER_RADIUS);
    inside = isInsideHab(player);
  }
  snapToGround(pos, segs, heightAt);
  emergencyUnground(pos, segs, heightAt);
  player.distance += Math.hypot(pos.x - prevX, pos.z - prevZ);

  if (player.mixer) {
    player.walkPhase += moving ? dt * (8 + speed) : 0;
    const spd = player.vel.length();
    const walkW = spd > 0.45 && spd < 6.2 ? 1 : 0;
    const runW = spd >= 6.2 ? 1 : 0;
    const idleW = spd <= 0.45 ? 1 : 0;
    if (player.idleAction) player.idleAction.setEffectiveWeight(THREE.MathUtils.lerp(player.idleAction.getEffectiveWeight(), idleW, 1 - Math.pow(0.02, dt)));
    if (player.walkAction) player.walkAction.setEffectiveWeight(THREE.MathUtils.lerp(player.walkAction.getEffectiveWeight(), walkW, 1 - Math.pow(0.02, dt)));
    if (player.runAction) player.runAction.setEffectiveWeight(THREE.MathUtils.lerp(player.runAction.getEffectiveWeight(), runW, 1 - Math.pow(0.02, dt)));
    player.mixer.update(dt);
    snapToGround(pos, segs, heightAt);
    emergencyUnground(pos, segs, heightAt);
    if (moving && player.walkPhase - player.lastStep > 1.6) {
      player.lastStep = player.walkPhase;
      footstep(inside);
    }
  } else if (moving) {
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
  const hab = world.hab;
  if (inside) {
    if (habCanRefillSuit(world)) player.oxygen = clamp(player.oxygen + dt * 8);
    else player.oxygen = clamp(player.oxygen - dt * (hab ? Math.max(0.08, (1 - hab.pressure) * 0.42) : 0.28));
    const tC = hab ? hab.insideC : 8;
    const targetW = Math.max(14, Math.min(96, 50 + tC * 2));
    player.warmth = clamp(player.warmth + (targetW - player.warmth) * Math.min(1, dt * 0.4));
    player.hunger = clamp(player.hunger - dt * SURVIVAL.hungerHab);
    player.thirst = clamp(player.thirst - dt * SURVIVAL.thirstHab);
  } else {
    player.oxygen = clamp(player.oxygen - dt * (SURVIVAL.o2Outside + (world.habSealed ? 0.05 : 0.22) + world.storm * SURVIVAL.o2Storm));
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
    player.root.position.set(SPAWN.x, groundYAt(SPAWN.x, SPAWN.z, segsOf(world), heightAt), SPAWN.z);
    player.oxygen = 38;
    player.warmth = 32;
    player.hunger = Math.max(8, player.hunger - 18);
    player.thirst = Math.max(8, player.thirst - 22);
  }
  return { blackout, inside, warnings };
}

export function trySleep(player, world) {
  return trySleepSol(player, world, advanceSol);
}

export function attachHammer(player) {
  if (player.hammerMesh) return;
  const meshy = takeModel("hammer", 0.58);
  if (meshy) {
    meshy.position.set(0.08, -0.38, 0.14);
    meshy.rotation.set(0.4, 0.2, -0.5);
    player.armR.add(meshy);
    player.hammerMesh = meshy;
    return;
  }
  const g = new THREE.Group();
  const wood = std({ color: 0x6a4428, roughness: 0.8 });
  const iron = std({ color: 0xc8c0b4, metalness: 0.45, roughness: 0.4 });
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
