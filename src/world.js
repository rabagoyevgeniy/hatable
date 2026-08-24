import * as THREE from "three";
import { heightAt, fbm } from "./noise.js";
import { OUTPOSTS, ITEMS, NODE_SPAWNS, LOCKER_START, YARD_PADS } from "./data.js";

const TERRAIN_SIZE = 620;
const SEGMENTS = 140;

export function createWorld(scene) {
  scene.background = new THREE.Color(0xb56a45);
  scene.fog = new THREE.FogExp2(0xb56a45, 0.011);

  const hemi = new THREE.HemisphereLight(0xf0c8a0, 0x5a2a18, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a8, 1.35);
  sun.position.set(80, 70, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 240;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0007;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0x6a3a18, 0.22));

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0 })
  );
  scene.add(sunMesh);
  const stars = makeStars();
  scene.add(stars);

  const terrain = makeTerrain();
  terrain.receiveShadow = true;
  scene.add(terrain);
  scene.add(makeRocks());
  scene.add(makeMountains());
  scene.add(makeDebris());
  const dust = makeDust();
  scene.add(dust);
  const scanRing = makeScanRing();
  scene.add(scanRing);

  const ghost = new THREE.Group();
  scene.add(ghost);

  const pads = YARD_PADS.map((p) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.42, 28),
      new THREE.MeshBasicMaterial({ color: 0xffb15a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, heightAt(p.x, p.z) + 0.07, p.z);
    scene.add(ring);
    const plate = makePlate(p.label.ru, 1.6, 0.28);
    plate.position.set(p.x, heightAt(p.x, p.z) + 0.04, p.z + 0.02);
    plate.rotation.x = -Math.PI / 2;
    scene.add(plate);
    return { ...p, ring, taken: false };
  });

  const outposts = OUTPOSTS.map((data) => {
    const group = buildOutpost(data);
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    scene.add(group);
    return { ...data, group, beacon: group.userData.beacon };
  });

  const world = {
    scene,
    sun,
    sunMesh,
    hemi,
    stars,
    dust,
    scanRing,
    ghost,
    pads,
    outposts,
    nodes: [],
    stations: [],
    locker: { x: 3.1, z: 12.3, storage: { ...LOCKER_START } },
    storm: 0,
    stormTarget: 0.05,
    playTime: 0,
    daylight: 1,
    habSealed: false,
    powered: false,
    contacted: false,
  };

  for (const spawn of NODE_SPAWNS) spawnNode(world, spawn.type, spawn.x, spawn.z, spawn);
  world.locker.mesh = makeLocker(world.locker.x, world.locker.z);
  world.scene.add(world.locker.mesh);
  return world;
}

export function spawnNode(world, type, x, z, extra = {}) {
  const def = ITEMS[type];
  const wreck = !!extra.needHammer;
  const starter = !!extra.starter;
  const group = new THREE.Group();
  group.add(lootMesh(type, def.color, wreck));

  const beaconCol = wreck ? 0xff4a32 : starter ? 0x7ee8ff : def.beacon || 0xffe0a8;
  const stemH = wreck ? 1.9 : starter ? 3.15 : 2.15;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(starter ? 0.06 : 0.04, starter ? 0.08 : 0.045, stemH, 6),
    new THREE.MeshBasicMaterial({ color: beaconCol })
  );
  stem.position.y = stemH * 0.5 + 0.15;
  group.add(stem);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(starter ? 0.18 : wreck ? 0.14 : 0.11, 10, 8),
    new THREE.MeshBasicMaterial({ color: beaconCol })
  );
  bulb.position.y = stemH + 0.28;
  group.add(bulb);

  if (starter) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.78, 24),
      new THREE.MeshBasicMaterial({ color: 0x7ee8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    const light = new THREE.PointLight(0x7ee8ff, 1.4, 15);
    light.position.y = 2.1;
    group.add(light);
  }

  group.position.set(x, heightAt(x, z) + (wreck ? 0.16 : 0.3), z);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  world.scene.add(group);
  const node = {
    type,
    mesh: group,
    taken: false,
    needHammer: wreck,
    starter,
    amount: extra.amount || 1,
  };
  world.nodes.push(node);
  return node;
}

function lootMesh(type, color, wreck) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: wreck ? 0.2 : 0.58,
    roughness: 0.52,
    metalness: type === "scrap" || type === "wire" ? 0.48 : 0.08,
    flatShading: true,
  });
  if (wreck || type === "scrap") {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(wreck ? 1.7 : 0.95, wreck ? 0.75 : 0.48, wreck ? 1.15 : 0.7), mat);
    a.rotation.y = 0.4;
    g.add(a);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.85), mat));
    return g;
  }
  if (type === "rock") return new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), mat);
  if (type === "ice") {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48),
      new THREE.MeshStandardMaterial({
        color: 0xd4f0ff,
        emissive: 0x7ec8e8,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.12,
        transparent: true,
        opacity: 0.82,
      })
    );
  }
  if (type === "fabric") {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.8, 3, 2), mat);
    cloth.rotation.set(-0.9, 0.2, 0.35);
    cloth.position.y = 0.15;
    g.add(cloth);
    return g;
  }
  if (type === "tape") return new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.07, 8, 12), mat);
  if (type === "potato") return new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  if (type === "soil") return new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 5), mat);
  if (type === "solar") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), mat);
    m.rotation.x = -0.4;
    return m;
  }
  if (type === "wire") return new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.04, 40, 6), mat);
  if (type === "comms") return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), mat);
  if (type === "hydrazine") return new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), mat);
  return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat);
}

function makeLocker(x, z) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({
    color: 0xf7f1e8,
    emissive: 0xfff6e8,
    emissiveIntensity: 0.35,
    roughness: 0.38,
    metalness: 0.14,
  });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffb15a, emissive: 0xffb15a, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.75, 0.82), white);
  body.position.y = 0.95;
  g.add(body);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), amber);
  lamp.position.set(0, 1.95, 0.28);
  g.add(lamp);
  const light = new THREE.PointLight(0xffc878, 1.1, 10);
  light.position.set(0, 2.1, 0.4);
  g.add(light);
  const plate = makePlate("LOCKER", 1.1, 0.28);
  plate.position.set(0, 1.25, 0.43);
  g.add(plate);
  g.position.set(x, heightAt(x, z), z);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function makePlate(text, w, h) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#f4ebe2";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
  );
}

export function padTaken(world, pad) {
  return world.stations.some((s) => s.type === pad.station && Math.hypot(s.x - pad.x, s.z - pad.z) < 2.2);
}

export function resolvePlacement(world, rec, player) {
  const raw = placementSpot(player);
  if (rec.station === "seal") {
    const d = Math.hypot(player.root.position.x, player.root.position.z - 8);
    return { x: 0, z: 3.6, y: heightAt(0, 3.6), valid: d < 16 && !world.habSealed, snap: true };
  }
  if (rec.station === "radio") {
    const site = OUTPOSTS.find((o) => o.id === "pathfinder");
    const d = Math.hypot(raw.x - site.x, raw.z - site.z);
    return { ...raw, valid: d < 16 };
  }
  const pads = (world.pads || YARD_PADS).filter((p) => p.station === rec.station && !padTaken(world, p));
  let best = null;
  let bestD = 7.5;
  for (const pad of pads) {
    const d = Math.hypot(raw.x - pad.x, raw.z - pad.z);
    if (d < bestD) {
      bestD = d;
      best = pad;
    }
  }
  if (best) return { x: best.x, z: best.z, y: heightAt(best.x, best.z), valid: true, snap: true, pad: best };
  const habD = Math.hypot(raw.x, raw.z - 8);
  const free = habD < 22 && habD > 5.8;
  return { ...raw, valid: free };
}

export function setGhost(world, rec, spot) {
  if (!rec) {
    world.ghost.visible = false;
    world.ghost.userData.kind = null;
    return;
  }
  if (world.ghost.userData.kind !== rec.station) {
    while (world.ghost.children.length) world.ghost.remove(world.ghost.children[0]);
    const preview = rec.station === "seal" ? makeSealGhost() : buildStation(rec.station);
    preview.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.42;
        o.material.depthWrite = false;
      }
    });
    world.ghost.add(preview);
    world.ghost.userData.kind = rec.station;
  }
  world.ghost.visible = true;
  world.ghost.position.set(spot.x, spot.y, spot.z);
  const col = spot.valid ? 0x8fd3b0 : 0xff5a3c;
  world.ghost.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) o.material.color.setHex(col);
  });
}

function makeSealGhost() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8dcc8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  m.position.y = 1.6;
  g.add(m);
  return g;
}

export function placeStation(world, station, x, z) {
  if (station === "seal") {
    world.habSealed = true;
    const hab = world.outposts.find((o) => o.kind === "hab");
    const leak = hab?.group.getObjectByName("leak");
    const patch = hab?.group.getObjectByName("patch");
    if (leak) leak.visible = false;
    if (patch) patch.visible = true;
    const st = { type: "seal", mesh: hab?.group, x: 0, z: 8, water: 0, fuel: 0, planted: false, grow: 0 };
    world.stations.push(st);
    return st;
  }
  const mesh = buildStation(station);
  mesh.position.set(x, heightAt(x, z), z);
  world.scene.add(mesh);
  const st = {
    type: station,
    mesh,
    x,
    z,
    water: 0,
    fuel: 0,
    planted: false,
    grow: 0,
  };
  world.stations.push(st);
  if (station === "solar") {
    world.powered = true;
    const hab = world.outposts.find((o) => o.kind === "hab");
    hab?.group.traverse((o) => {
      if (o.name === "habWindow" && o.material) o.material.emissiveIntensity = 0.85;
    });
  }
  if (station === "radio") world.contacted = true;
  const pad = (world.pads || []).find((p) => p.station === station && Math.hypot(p.x - x, p.z - z) < 2.2);
  if (pad) {
    pad.taken = true;
    if (pad.ring) pad.ring.material.opacity = 0.18;
  }
  return st;
}

function buildStation(type) {
  const g = new THREE.Group();
  const scrap = new THREE.MeshStandardMaterial({ color: 0xc2bbb0, roughness: 0.55, metalness: 0.2 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.9 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x5a3318, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.35, metalness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.5 });
  if (type === "still") {
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.4, 10), scrap, 0, 0.8, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8), rust, 0.55, 1.4, 0));
    const globe = mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0x4aa0c8,
        emissive: 0x1a6088,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.85,
      }),
      0.55,
      2,
      0
    );
    globe.name = "stillGlobe";
    g.add(globe);
    const gauge = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0x4ec4e8, emissive: 0x4ec4e8, emissiveIntensity: 0.4 }), -0.35, 0.55, 0.5);
    gauge.name = "waterGauge";
    g.add(gauge);
  } else if (type === "plot") {
    g.add(mesh(new THREE.BoxGeometry(2.2, 0.35, 2.2), rust, 0, 0.2, 0));
    g.add(mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), soil, 0, 0.4, 0));
    const plant = mesh(new THREE.ConeGeometry(0.18, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x5d8a4a }), 0, 0.85, 0);
    plant.visible = false;
    plant.name = "plant";
    g.add(plant);
    const plant2 = mesh(new THREE.ConeGeometry(0.14, 0.55, 5), new THREE.MeshStandardMaterial({ color: 0x6a9a4a }), 0.35, 0.75, 0.2);
    plant2.visible = false;
    plant2.name = "plant2";
    g.add(plant2);
    const tuber = mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc4a05a }), 0.1, 0.55, -0.15);
    tuber.visible = false;
    tuber.name = "tuber";
    g.add(tuber);
  } else if (type === "solar") {
    const panel = mesh(new THREE.BoxGeometry(2.4, 0.08, 1.3), dark, 0, 1.1, 0);
    panel.rotation.x = -0.45;
    g.add(panel);
    g.add(mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), scrap, 0, 0.55, 0.4));
  } else if (type === "seal") {
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.4, 0.12), new THREE.MeshStandardMaterial({ color: 0xe8dcc8 }), 0, 1.1, 0));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), gold, 0.6, 1.4, 0.08));
  } else if (type === "radio") {
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), scrap, 0, 0.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), gold, 0, 2.1, 0));
    g.add(mesh(new THREE.TetrahedronGeometry(0.45), gold, 0, 3.8, 0));
  }
  return g;
}

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function placementSpot(player) {
  const x = player.root.position.x - Math.sin(player.yaw) * 3.2;
  const z = player.root.position.z - Math.cos(player.yaw) * 3.2;
  return { x, z, y: heightAt(x, z) };
}

export function updateWorld(world, dt, playerPos, scanning, playing = true) {
  if (playing) {
    world.clock = (world.clock + dt / 220) % 1;
    world.playTime = (world.playTime || 0) + dt;
  }
  world.daylight = 0.5 + 0.5 * Math.sin(world.clock * Math.PI * 2);
  const night = 1 - world.daylight;
  const ang = world.clock * Math.PI * 2;
  world.sun.position.set(Math.cos(ang) * 110, 12 + Math.max(4, Math.sin(ang) * 85), -40);
  world.sun.target.position.set(playerPos.x, 0, playerPos.z);
  world.sun.intensity = Math.max(0.04, world.daylight * 1.35);
  world.hemi.intensity = 0.16 + world.daylight * 0.72;
  if (world.sunMesh) {
    world.sunMesh.position.copy(world.sun.position).setLength(320);
    world.sunMesh.visible = world.daylight > 0.12;
  }
  if (world.stars) world.stars.material.opacity = Math.max(0, night * 0.9 - 0.15);

  const dusk = Math.max(0, 1 - Math.abs(world.daylight - 0.45) * 3);
  const fogCol = new THREE.Color().setRGB(
    0.08 + 0.5 * world.daylight + 0.18 * dusk,
    0.04 + 0.24 * world.daylight + 0.04 * dusk,
    0.1 + 0.08 * world.daylight + 0.12 * night
  );
  world.scene.background.copy(fogCol);
  world.scene.fog.color.copy(fogCol);
  world.scene.fog.density = 0.009 + night * 0.007 + world.storm * 0.022;

  world.storm += (world.stormTarget - world.storm) * Math.min(1, dt * 0.35);
  if (!playing || (world.playTime || 0) < 160) {
    world.stormTarget = 0.04;
    world.storm = Math.min(world.storm, 0.12);
  } else if (Math.random() < dt * 0.0032) {
    world.stormTarget = Math.random() < 0.18 ? 0.82 : 0.04;
  }

  const dustPos = world.dust.geometry.attributes.position;
  const n = world.dust.userData.n;
  for (let i = 0; i < n; i++) {
    let x = dustPos.getX(i) + dt * (4 + world.storm * 22);
    let z = dustPos.getZ(i) + dt * (1 + world.storm * 8);
    if (x > 110) x -= 220;
    if (z > 110) z -= 220;
    dustPos.setXYZ(i, x, dustPos.getY(i), z);
  }
  dustPos.needsUpdate = true;
  world.dust.position.set(playerPos.x, playerPos.y, playerPos.z);
  world.dust.material.opacity = 0.16 + world.storm * 0.55 + night * 0.08;

  if (scanning) {
    world.scanRing.position.set(playerPos.x, playerPos.y + 0.05, playerPos.z);
    world.scanRing.scale.x += dt * 18;
    world.scanRing.scale.y += dt * 18;
    world.scanRing.material.opacity = Math.max(0, 0.7 - world.scanRing.scale.x * 0.03);
    if (world.scanRing.scale.x > 22) world.scanRing.scale.set(1, 1, 1);
  } else {
    world.scanRing.material.opacity = 0;
    world.scanRing.scale.set(1, 1, 1);
  }

  for (const node of world.nodes) {
    if (node.taken) continue;
    const bob = node.needHammer ? 0 : 0.06 * Math.sin(performance.now() / 380 + node.mesh.position.x);
    node.mesh.position.y = heightAt(node.mesh.position.x, node.mesh.position.z) + (node.needHammer ? 0.16 : 0.32) + bob;
  }

  const hab = world.outposts.find((o) => o.kind === "hab");
  const inner = hab?.group.getObjectByName("innerLight");
  if (inner) inner.intensity = (world.habSealed ? 1.1 : 0.45) + (world.powered ? 0.5 : 0) + night * 0.4;

  for (const st of world.stations) {
    if (st.type === "still" && st.fuel > 0) {
      st.fuel -= dt;
      st.water += dt * 0.045;
      const globe = st.mesh.getObjectByName("stillGlobe");
      if (globe) globe.material.emissiveIntensity = 0.55 + Math.sin(performance.now() / 280) * 0.25;
      const gauge = st.mesh.getObjectByName("waterGauge");
      if (gauge) gauge.scale.set(1, 1 + Math.min(6, st.water * 0.4), 1);
    }
    if (st.type === "plot" && st.planted && st.grow < 1) {
      st.grow += dt * (0.018 + world.daylight * 0.016);
      updatePlotVisual(st);
    }
  }
}

export function updatePlotVisual(st) {
  const plant = st.mesh.getObjectByName("plant");
  const plant2 = st.mesh.getObjectByName("plant2");
  const tuber = st.mesh.getObjectByName("tuber");
  if (plant) {
    plant.visible = st.planted;
    plant.scale.setScalar(0.35 + st.grow * 1.1);
  }
  if (plant2) {
    plant2.visible = st.planted && st.grow > 0.35;
    plant2.scale.setScalar(0.3 + st.grow * 0.9);
  }
  if (tuber) tuber.visible = st.grow >= 1;
}

export function advanceSol(world) {
  world.clock = (world.clock + 0.42) % 1;
  for (const st of world.stations) {
    if (st.type === "plot" && st.planted) {
      st.grow = Math.min(1, st.grow + 0.55);
      updatePlotVisual(st);
    }
    if (st.type === "still" && st.fuel > 0) {
      st.water += 6;
      st.fuel = Math.max(0, st.fuel - 12);
    }
  }
}

function makeTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = fbm(x * 0.02, z * 0.02);
    color.setRGB(0.55 + n * 0.12, 0.28 + n * 0.06, 0.16 + n * 0.03);
    if (y > 6) color.lerp(new THREE.Color(0x8a5a40), 0.35);
    if (y < -1) color.lerp(new THREE.Color(0x6a3318), 0.25);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.04 })
  );
}

function makeRocks() {
  const geo = new THREE.DodecahedronGeometry(1.1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b3b28, roughness: 1, flatShading: true });
  const count = 220;
  const meshInst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 4000) {
    guard++;
    const x = (Math.random() - 0.5) * 540;
    const z = (Math.random() - 0.5) * 540;
    if (OUTPOSTS.some((o) => Math.hypot(x - o.x, z - o.z) < 24)) continue;
    dummy.position.set(x, heightAt(x, z) + 0.2, z);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    const s = 0.6 + Math.random() * 2.4;
    dummy.scale.set(s, s * (0.5 + Math.random()), s);
    dummy.updateMatrix();
    meshInst.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  return meshInst;
}

function makeMountains() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a4028, roughness: 1, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const r = 290 + (i % 3) * 18;
    const m = new THREE.Mesh(new THREE.ConeGeometry(28 + (i % 5) * 6, 22 + (i % 4) * 10, 5), mat);
    m.position.set(Math.cos(ang) * r, 8, Math.sin(ang) * r);
    group.add(m);
  }
  return group;
}

function makeDust() {
  const n = 1600;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = Math.random() * 14;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xe2b089, size: 0.28, transparent: true, opacity: 0.35, depthWrite: false })
  );
  points.userData.n = n;
  return points;
}

function makeStars() {
  const n = 1400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 420;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.08 + Math.random() * 0.72);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xfff4e8, size: 1.4, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false })
  );
  return stars;
}

function makeDebris() {
  const g = new THREE.Group();
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.92, flatShading: true });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd8cfc4, roughness: 0.6, metalness: 0.2, flatShading: true });
  const spots = [
    [6.5, 6.2, 1.4, 0.35, rust],
    [-7.2, 4.8, 1.1, 0.5, pale],
    [9.4, 11.5, 0.9, 0.4, rust],
    [-5.8, 2.2, 1.8, 0.25, pale],
    [11.2, 7.8, 0.7, 0.55, rust],
    [-12.4, 10.2, 1.2, 0.3, pale],
  ];
  for (const [x, z, w, h, mat] of spots) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7), mat);
    m.position.set(x, heightAt(x, z) + h * 0.5, z);
    m.rotation.y = x * 0.3;
    m.castShadow = true;
    g.add(m);
  }
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6), pale);
  strut.position.set(-3.4, heightAt(-3.4, 3.2) + 0.4, 3.2);
  strut.rotation.z = 1.05;
  g.add(strut);
  return g;
}

function makeScanRing() {
  const geo = new THREE.RingGeometry(0.4, 0.55, 48);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xffb15a, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
}

function buildOutpost(data) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.55, metalness: 0.12 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.4, metalness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.55 });

  if (data.kind === "hab") {
    const hull = new THREE.MeshStandardMaterial({
      color: 0xece6dc,
      roughness: 0.46,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1c2228,
      roughness: 0.2,
      metalness: 0.55,
      emissive: 0x142028,
      emissiveIntensity: 0.35,
    });
    const orange = new THREE.MeshStandardMaterial({
      color: 0xe07030,
      roughness: 0.45,
      emissive: 0xe07030,
      emissiveIntensity: 0.35,
    });
    const bunkMat = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.8 });
    const sheet = new THREE.MeshStandardMaterial({ color: 0xd8c8b0, roughness: 0.7 });

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 3.15, 28, 1, true, Math.PI * 0.18, Math.PI * 1.64),
      hull
    );
    wall.position.y = 1.55;
    g.add(wall);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 24, 12, Math.PI * 0.18, Math.PI * 1.64, 0, Math.PI / 2),
      hull
    );
    dome.position.y = 3.12;
    g.add(dome);
    for (const y of [0.5, 1.55, 2.6]) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(4.22, 0.08, 8, 28, Math.PI * 1.64),
        ribMat
      );
      rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.18);
      rib.position.y = y;
      g.add(rib);
    }
    for (const a of [2.35, 3.55, 4.7]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.08), glassMat);
      w.position.set(Math.sin(a) * 4.16, 1.72, Math.cos(a) * 4.16);
      w.lookAt(0, 1.72, 0);
      w.name = "habWindow";
      g.add(w);
    }
    g.add(box(hull, 2.15, 2.2, 2.5, 0, 1.1, 5.15));
    g.add(box(hull, 0.28, 2.2, 0.16, -1.0, 1.1, 6.42));
    g.add(box(hull, 0.28, 2.2, 0.16, 1.0, 1.1, 6.42));
    g.add(box(hull, 2.15, 0.26, 0.16, 0, 2.1, 6.42));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.2), orange);
    lamp.position.set(0, 2.28, 6.52);
    g.add(lamp);
    const airLight = new THREE.PointLight(0xffb15a, 1.55, 18);
    airLight.position.set(0, 2.3, 6.2);
    g.add(airLight);
    const inner = new THREE.PointLight(0xffe0b0, 0.8, 12);
    inner.position.set(0, 2.1, 0.4);
    inner.name = "innerLight";
    g.add(inner);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.05, 28),
      new THREE.MeshStandardMaterial({ color: 0xc8b8a4, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    g.add(floor);
    g.add(box(bunkMat, 2.1, 0.35, 0.95, -1.6, 0.38, -1.6));
    g.add(box(sheet, 1.9, 0.12, 0.8, -1.6, 0.58, -1.6));
    g.add(box(hull, 1.2, 0.08, 0.7, 1.5, 0.72, -1.4));
    g.add(box(hull, 0.08, 0.7, 0.08, 1.05, 0.38, -1.15));
    g.add(box(hull, 0.08, 0.7, 0.08, 1.95, 0.38, -1.65));
    const deskLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), orange);
    deskLamp.position.set(1.7, 1.05, -1.35);
    g.add(deskLamp);
    g.add(box(new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.7 }), 0.7, 0.55, 0.5, 1.6, 0.4, 1.1));
    const plate = makePlate("ARES III", 2.3, 0.55);
    plate.position.set(0, 2.55, 6.55);
    g.add(plate);
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 14),
      new THREE.MeshStandardMaterial({
        color: 0x1a0c08,
        emissive: 0x501808,
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    hole.position.set(0, 1.65, -4.15);
    hole.rotation.y = Math.PI;
    hole.name = "leak";
    g.add(hole);
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.7 })
    );
    patch.position.set(0, 1.65, -4.12);
    patch.rotation.y = Math.PI;
    patch.name = "patch";
    patch.visible = false;
    g.add(patch);
  } else if (data.kind === "rover") {
    g.add(box(white, 4.2, 1.15, 2.4, 0.2, 1.15, 0));
    g.add(box(dark, 1.6, 0.9, 1.8, -1.7, 1.85, 0));
    g.add(box(rust, 0.9, 0.4, 1.1, 1.8, 1.5, 0.4));
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), gold);
    dish.position.set(-1.5, 2.55, 0);
    dish.rotation.x = 0.6;
    g.add(dish);
    for (const wx of [-1.4, 0.3, 1.6]) {
      for (const wz of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.32, 12), dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.52, wz);
        g.add(wheel);
      }
    }
    g.add(box(rust, 1.2, 0.35, 0.8, 2.6, 0.3, 1.4));
  } else if (data.kind === "farm") {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.08, 6, 20, Math.PI),
      white
    );
    hoop.rotation.z = Math.PI / 2;
    hoop.position.y = 0.2;
    g.add(hoop);
    const hoop2 = hoop.clone();
    hoop2.position.z = 2.2;
    g.add(hoop2);
    const plastic = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 6, 12, 1, true, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x7ec98a, transparent: true, opacity: 0.22, roughness: 0.15, side: THREE.DoubleSide })
    );
    plastic.rotation.z = Math.PI / 2;
    plastic.position.y = 2;
    g.add(plastic);
    const dirt = new THREE.MeshStandardMaterial({ color: 0x5a3318, roughness: 1 });
    g.add(box(dirt, 2.4, 0.25, 6.5, 0, 0.2, 0));
    g.add(box(dirt, 2.4, 0.25, 6.5, 2.8, 0.2, 0));
    g.add(box(dirt, 2.4, 0.25, 6.5, -2.8, 0.2, 0));
  } else if (data.kind === "solar") {
    for (let i = -3; i <= 3; i++) {
      const broken = i === -1 || i === 2;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 1.5), broken ? rust : dark);
      panel.position.set(i * 1.05, broken ? 0.9 : 1.45, (i % 2) * 0.4);
      panel.rotation.x = broken ? -1.1 : -0.55;
      g.add(panel);
      g.add(box(white, 0.08, 1.2, 0.08, i * 1.05, 0.6, 0.5));
    }
  } else if (data.kind === "pathfinder") {
    const tetra = new THREE.Mesh(new THREE.TetrahedronGeometry(1.35), gold);
    tetra.position.y = 2.1;
    g.add(tetra);
    g.add(cyl(white, 0.16, 2.0, 0, 1.0, 0));
    for (const a of [0, 2.1, 4.2]) {
      const petal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.1), dark);
      petal.position.set(Math.cos(a) * 1.3, 0.55, Math.sin(a) * 1.3);
      petal.rotation.set(-0.7, a, 0);
      g.add(petal);
    }
  } else if (data.kind === "mav") {
    g.add(cyl(white, 1.35, 12, 0, 6.4, 0));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.4, 12), white);
    nose.position.y = 14.1;
    g.add(nose);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 10), dark);
    bell.position.y = 0.4;
    g.add(bell);
    for (const a of [0, 2.1, 4.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 6), rust);
      leg.position.set(Math.cos(a) * 2.4, 1.4, Math.sin(a) * 2.4);
      leg.rotation.z = Math.cos(a) * 0.45;
      leg.rotation.x = Math.sin(a) * 0.45;
      g.add(leg);
    }
  }

  const beacon = new THREE.PointLight(0xffb15a, 0.45, 18);
  beacon.position.y = 5;
  g.add(beacon);
  g.userData.beacon = beacon;
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function cyl(mat, r, h, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  m.position.set(x, y, z);
  return m;
}

function box(mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function nearestOutpost(world, pos) {
  let best = null;
  let bestD = Infinity;
  for (const o of world.outposts) {
    const d = Math.hypot(pos.x - o.x, pos.z - o.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return { outpost: best, dist: bestD };
}
