import * as THREE from "three";
import { heightAt, fbm } from "./noise.js";
import { OUTPOSTS, ITEMS, NODE_SPAWNS, LOCKER_START } from "./data.js";

const TERRAIN_SIZE = 620;
const SEGMENTS = 140;

export function createWorld(scene) {
  scene.background = new THREE.Color(0xb56a45);
  scene.fog = new THREE.FogExp2(0xb56a45, 0.012);

  const hemi = new THREE.HemisphereLight(0xf0c8a0, 0x5a2a18, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a8, 1.15);
  sun.position.set(80, 70, -40);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6a3a18, 0.28));

  scene.add(makeTerrain());
  scene.add(makeRocks());
  scene.add(makeMountains());
  const dust = makeDust();
  scene.add(dust);
  const scanRing = makeScanRing();
  scene.add(scanRing);

  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.2, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xffb15a, transparent: true, opacity: 0.35 })
  );
  ghost.visible = false;
  scene.add(ghost);

  const outposts = OUTPOSTS.map((data) => {
    const group = buildOutpost(data);
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    scene.add(group);
    return { ...data, group, beacon: group.userData.beacon };
  });

  const world = {
    scene,
    sun,
    hemi,
    dust,
    scanRing,
    ghost,
    outposts,
    nodes: [],
    stations: [],
    locker: { x: 7.2, z: 8.4, storage: { ...LOCKER_START } },
    storm: 0,
    stormTarget: 0.05,
    clock: 0.35,
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
  const group = new THREE.Group();
  group.add(lootMesh(type, def.color, wreck));
  if (!wreck) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.35, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe0a8 })
    );
    stem.position.y = 1.0;
    group.add(stem);
  }
  group.position.set(x, heightAt(x, z) + (wreck ? 0.2 : 0.32), z);
  world.scene.add(group);
  const node = {
    type,
    mesh: group,
    taken: false,
    needHammer: wreck,
    amount: extra.amount || 1,
  };
  world.nodes.push(node);
  return node;
}

function lootMesh(type, color, wreck) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: wreck ? 0.12 : 0.32,
    roughness: 0.75,
    metalness: type === "scrap" || type === "wire" ? 0.35 : 0.05,
    flatShading: true,
  });
  if (wreck || type === "scrap") {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(wreck ? 1.6 : 0.7, wreck ? 0.7 : 0.4, wreck ? 1.1 : 0.55), mat);
    a.rotation.y = 0.4;
    g.add(a);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.8), mat));
    return g;
  }
  if (type === "rock") return new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), mat);
  if (type === "ice") return new THREE.Mesh(new THREE.OctahedronGeometry(0.42), mat);
  if (type === "fabric") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.6), mat);
    m.rotation.z = 0.2;
    return m;
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
    color: 0xf4eee4,
    emissive: 0xfff6e8,
    emissiveIntensity: 0.22,
    roughness: 0.4,
    metalness: 0.12,
  });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffb15a, emissive: 0xffb15a, emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.7), white);
  body.position.y = 0.85;
  g.add(body);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), amber);
  lamp.position.set(0, 1.7, 0.2);
  g.add(lamp);
  g.position.set(x, heightAt(x, z), z);
  return g;
}

export function placeStation(world, station, x, z) {
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
  if (station === "seal") world.habSealed = true;
  if (station === "solar") world.powered = true;
  if (station === "radio") world.contacted = true;
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
    g.add(mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({ color: 0x4aa0c8 }), 0.55, 2, 0));
  } else if (type === "plot") {
    g.add(mesh(new THREE.BoxGeometry(2.2, 0.35, 2.2), rust, 0, 0.2, 0));
    g.add(mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), soil, 0, 0.4, 0));
    const plant = mesh(new THREE.ConeGeometry(0.18, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x5d8a4a }), 0, 0.85, 0);
    plant.visible = false;
    plant.name = "plant";
    g.add(plant);
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

export function updateWorld(world, dt, playerPos, scanning) {
  world.clock = (world.clock + dt / 160) % 1;
  world.daylight = 0.5 + 0.5 * Math.sin(world.clock * Math.PI * 2);
  const night = 1 - world.daylight;
  world.sun.intensity = 0.25 + world.daylight * 1.05;
  world.hemi.intensity = 0.25 + world.daylight * 0.7;
  const fogCol = new THREE.Color().setRGB(0.55 * world.daylight + 0.08, 0.28 * world.daylight + 0.04, 0.16);
  world.scene.background.copy(fogCol);
  world.scene.fog.color.copy(fogCol);
  world.scene.fog.density = 0.01 + night * 0.008 + world.storm * 0.02;

  world.storm += (world.stormTarget - world.storm) * Math.min(1, dt * 0.45);
  if (Math.random() < dt * 0.02) world.stormTarget = Math.random() < 0.22 ? 0.8 : 0.05;

  const dustPos = world.dust.geometry.attributes.position;
  const n = world.dust.userData.n;
  for (let i = 0; i < n; i++) {
    let x = dustPos.getX(i) + dt * (4 + world.storm * 18);
    let z = dustPos.getZ(i) + dt * (1 + world.storm * 6);
    if (x > 110) x -= 220;
    if (z > 110) z -= 220;
    dustPos.setXYZ(i, x, dustPos.getY(i), z);
  }
  dustPos.needsUpdate = true;
  world.dust.position.set(playerPos.x, playerPos.y, playerPos.z);
  world.dust.material.opacity = 0.18 + world.storm * 0.5 + night * 0.1;

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
    node.mesh.position.y = heightAt(node.mesh.position.x, node.mesh.position.z) + 0.35 + Math.sin(performance.now() / 380) * 0.05;
  }

  for (const st of world.stations) {
    if (st.type === "still" && st.fuel > 0) {
      st.fuel -= dt;
      st.water += dt * 0.028;
    }
    if (st.type === "plot" && st.planted && st.grow < 1) {
      st.grow += dt * (0.022 + world.daylight * 0.02);
      const plant = st.mesh.getObjectByName("plant");
      if (plant) {
        plant.visible = true;
        plant.scale.setScalar(0.4 + st.grow * 0.9);
      }
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
    g.add(cyl(white, 4.2, 3.2, 0, 1.6, 0));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dome.position.y = 3.2;
    g.add(dome);
    g.add(box(white, 1.6, 1.8, 2.2, 4.2, 0.9, 0));
  } else if (data.kind === "rover") {
    g.add(box(white, 3.6, 1.1, 2.2, 0, 1.1, 0));
    g.add(box(dark, 1.4, 0.8, 1.6, -1.4, 1.7, 0));
    for (const wx of [-1.2, 0.2, 1.3]) {
      for (const wz of [-1.2, 1.2]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 10), dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.45, wz);
        g.add(wheel);
      }
    }
  } else if (data.kind === "farm") {
    const gh = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 8, 12, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x7ec98a, transparent: true, opacity: 0.28, roughness: 0.2 })
    );
    gh.rotation.z = Math.PI / 2;
    gh.position.y = 2;
    g.add(gh);
  } else if (data.kind === "solar") {
    for (let i = -2; i <= 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.6), dark);
      panel.position.set(i * 1.1, 1.4, 0);
      panel.rotation.x = -0.5;
      g.add(panel);
    }
  } else if (data.kind === "pathfinder") {
    const tetra = new THREE.Mesh(new THREE.TetrahedronGeometry(1.6), gold);
    tetra.position.y = 2.4;
    g.add(tetra);
    g.add(cyl(white, 0.18, 2.2, 0, 1.1, 0));
  } else if (data.kind === "mav") {
    g.add(cyl(white, 1.3, 11, 0, 6, 0));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 10), white);
    nose.position.y = 13.1;
    g.add(nose);
  }

  const beacon = new THREE.PointLight(0xffb15a, 0.45, 18);
  beacon.position.y = 5;
  g.add(beacon);
  g.userData.beacon = beacon;
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
