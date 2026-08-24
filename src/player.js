import * as THREE from "three";
import { heightAt, normalAt } from "./noise.js";
import { CARGO_TYPES } from "./data.js";
import { getLang } from "./i18n.js";
import { footstep, stumbleTone } from "./audio.js";

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

  const cargoAnchor = new THREE.Group();
  cargoAnchor.position.set(0, 1.55, -0.58);
  root.add(cargoAnchor);

  root.position.set(4, heightAt(4, 14) + 0.02, 14);
  scene.add(root);

  return {
    root,
    armL,
    armR,
    legL,
    legR,
    cargoAnchor,
    yaw: 0,
    pitch: 0.18,
    vel: new THREE.Vector3(),
    cargo: [],
    stamina: 100,
    oxygen: 100,
    balance: 0,
    stunned: 0,
    walkPhase: 0,
    lastStep: 0,
    lastRestId: "hab",
    distance: 0,
  };
}

export function cargoWeight(player) {
  return player.cargo.reduce((s, c) => s + c.weight, 0);
}

export function updatePlayer(player, dt, input, world) {
  if (player.stunned > 0) player.stunned -= dt;

  const weight = cargoWeight(player);
  const overload = Math.max(0, weight - 28) / 40;
  const bracing = input.brace && player.stunned <= 0;

  let mx = 0;
  let mz = 0;
  if (player.stunned <= 0) {
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
  }
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
  const speed = (bracing ? 2.2 : 6.1) * (1 - overload * 0.55) * (1 - slope * 1.3) * (player.stamina < 8 ? 0.45 : 1);
  const target = wish.multiplyScalar(Math.max(0.6, speed));
  player.vel.lerp(target, 1 - Math.pow(0.0008, dt));

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

  if (world.storm > 0.35) {
    pos.x += dt * world.storm * 1.4;
    pos.z += dt * world.storm * 0.5;
  }

  const turnStress = moving ? Math.abs(input.lookX) * (0.4 + overload) : 0;
  const slopeStress = slope * (18 + weight * 0.35);
  const stormStress = world.storm * 8;
  if (bracing) {
    player.balance = Math.max(0, player.balance - dt * 38);
  } else {
    player.balance = Math.min(100, player.balance + dt * (slopeStress + turnStress * 40 + stormStress + overload * 10));
    if (!moving) player.balance = Math.max(0, player.balance - dt * 12);
  }

  if (moving) {
    player.stamina = Math.max(0, player.stamina - dt * (6 + weight * 0.18 + world.storm * 4));
    player.walkPhase += dt * (8 + speed);
    const swing = Math.sin(player.walkPhase) * (bracing ? 0.15 : 0.45);
    player.legL.rotation.x = swing;
    player.legR.rotation.x = -swing;
    player.armL.rotation.x = -swing * 0.7;
    player.armR.rotation.x = swing * 0.7;
    if (player.walkPhase - player.lastStep > 1.6) {
      player.lastStep = player.walkPhase;
      footstep();
    }
  } else {
    player.stamina = Math.min(100, player.stamina + dt * (bracing ? 22 : 14));
    player.legL.rotation.x *= 0.8;
    player.legR.rotation.x *= 0.8;
    player.armL.rotation.x *= 0.8;
    player.armR.rotation.x *= 0.8;
  }

  if (bracing) {
    player.armL.rotation.z = 0.7;
    player.armR.rotation.z = -0.7;
  } else {
    player.armL.rotation.z *= 0.8;
    player.armR.rotation.z *= 0.8;
  }

  player.root.rotation.y = yaw;
  player.root.rotation.x = overload * 0.12;
  player.root.rotation.z = THREE.MathUtils.lerp(player.root.rotation.z, (player.balance - 40) * 0.0015, 0.1);

  player.oxygen = Math.max(
    0,
    player.oxygen - dt * ((moving ? 1.1 : 0.35) + world.storm * 2.2)
  );

  let stumbled = false;
  if (player.balance >= 100) {
    stumbled = true;
    player.balance = 35;
    player.stunned = 1.15;
    stumbleTone();
    dropTopCargo(player, world, true);
    for (const c of player.cargo) c.condition = Math.max(20, c.condition - 18);
  }

  if (world.storm > 0.55 && moving) {
    for (const c of player.cargo) c.condition = Math.max(15, c.condition - dt * 4);
  }

  layoutBackpack(player);
  return { stumbled, blackout: player.oxygen <= 0 };
}

export function pickupCargo(player, crate) {
  if (player.cargo.length >= 5 || crate.taken) return false;
  crate.taken = true;
  crate.mesh.parent?.remove(crate.mesh);
  player.cargoAnchor.add(crate.mesh);
  crate.mesh.rotation.set(0, 0, 0);
  for (const m of crate.mesh.userData.marker || []) m.visible = false;
  player.cargo.push(crate);
  layoutBackpack(player);
  return true;
}

export function dropTopCargo(player, world, scatter) {
  const crate = player.cargo.pop();
  if (!crate) return null;
  world.scene.add(crate.mesh);
  crate.taken = false;
  const p = player.root.position;
  const ox = scatter ? (Math.random() - 0.5) * 2.4 : 0;
  const oz = scatter ? 1.4 + Math.random() : 1.2;
  const x = p.x - Math.sin(player.yaw) * oz + Math.cos(player.yaw) * ox;
  const z = p.z - Math.cos(player.yaw) * oz - Math.sin(player.yaw) * ox;
  crate.mesh.position.set(x, heightAt(x, z) + 0.45, z);
  for (const m of crate.mesh.userData.marker || []) m.visible = true;
  crate.condition = Math.max(20, crate.condition - (scatter ? 22 : 4));
  return crate;
}

function layoutBackpack(player) {
  player.cargo.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    c.mesh.position.set((col - 0.5) * 0.62, row * 0.52, 0);
    c.mesh.scale.setScalar(0.85);
  });
}

export function takeMatching(player, need) {
  const taken = [];
  const remaining = { ...need };
  player.cargo = player.cargo.filter((c) => {
    if (remaining[c.type] > 0) {
      remaining[c.type]--;
      taken.push(c);
      c.mesh.parent?.remove(c.mesh);
      return false;
    }
    return true;
  });
  layoutBackpack(player);
  return taken;
}

export function hasNeed(player, need) {
  const counts = {};
  for (const c of player.cargo) counts[c.type] = (counts[c.type] || 0) + 1;
  return Object.entries(need).every(([type, n]) => (counts[type] || 0) >= n);
}

export function cargoTitle(crate) {
  const lang = getLang();
  return crate.name[lang] || CARGO_TYPES[crate.type].name.en;
}

export function respawnAtLastRest(player, world) {
  const o = world.outposts.find((p) => p.id === player.lastRestId) || world.outposts[0];
  player.root.position.set(o.x + 4, heightAt(o.x + 4, o.z + 6), o.z + 6);
  player.oxygen = 70;
  player.stamina = 80;
  player.balance = 0;
  player.stunned = 0.4;
  for (const c of player.cargo) c.condition = Math.max(10, c.condition - 25);
}
