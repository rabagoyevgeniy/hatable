import * as THREE from "three";
import { heightAt, fbm } from "./noise.js";
import { OUTPOSTS, CARGO_TYPES } from "./data.js";
import { getLang } from "./i18n.js";

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
  scene.add(new THREE.AmbientLight(0x6a3a28, 0.28));

  const terrain = makeTerrain();
  scene.add(terrain);

  const rocks = makeRocks();
  scene.add(rocks);

  const mountains = makeMountains();
  scene.add(mountains);

  const dust = makeDust();
  scene.add(dust);

  const scanRing = makeScanRing();
  scene.add(scanRing);

  const outposts = OUTPOSTS.map((data) => {
    const group = buildOutpost(data);
    group.position.set(data.x, heightAt(data.x, data.z), data.z);
    scene.add(group);
    return { ...data, group, connected: data.id === "hab", beacon: group.userData.beacon };
  });

  const cargo = [];

  return {
    scene,
    terrain,
    dust,
    scanRing,
    outposts,
    cargo,
    storm: 0,
    stormTarget: 0,
    spawnCargo(type, x, z) {
      const crate = makeCrate(type, x, z);
      scene.add(crate.mesh);
      cargo.push(crate);
      return crate;
    },
    nearestOutpost(pos) {
      let best = null;
      let bestD = Infinity;
      for (const o of outposts) {
        const d = Math.hypot(pos.x - o.x, pos.z - o.z);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      return { outpost: best, dist: bestD };
    },
    connectedCount() {
      return outposts.filter((o) => o.connected).length;
    },
  };
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
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.04,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function makeRocks() {
  const geo = new THREE.DodecahedronGeometry(1.1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b3b28, roughness: 1, flatShading: true });
  const count = 220;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
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
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  return mesh;
}

function makeMountains() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a4028, roughness: 1, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const r = 290 + (i % 3) * 18;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(28 + (i % 5) * 6, 22 + (i % 4) * 10, 5), mat);
    mesh.position.set(Math.cos(ang) * r, 8, Math.sin(ang) * r);
    group.add(mesh);
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
  const mat = new THREE.PointsMaterial({
    color: 0xe2b089,
    size: 0.28,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.n = n;
  return points;
}

function makeScanRing() {
  const geo = new THREE.RingGeometry(0.4, 0.55, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffb15a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

function makeCrate(type, x, z) {
  const def = CARGO_TYPES[type];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.55, 0.7),
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.1 })
  );
  mesh.position.set(x, heightAt(x, z) + 0.35, z);
  mesh.castShadow = true;
  return {
    type,
    mesh,
    weight: def.weight,
    condition: 100,
    taken: false,
    name: def.name,
  };
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
    g.add(box(rust, 0.3, 4.4, 0.3, -3.2, 2.2, 2.4));
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
    const gh = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({
      color: 0x7ec98a,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
    }));
    gh.rotation.z = Math.PI / 2;
    gh.position.y = 2;
    g.add(gh);
    g.add(box(white, 8.2, 0.3, 4.6, 0, 0.2, 0));
  } else if (data.kind === "solar") {
    for (let i = -2; i <= 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.6), dark);
      panel.position.set(i * 1.1, 1.4, 0);
      panel.rotation.x = -0.5;
      g.add(panel);
      g.add(box(white, 0.12, 1.4, 0.12, i * 1.1, 0.7, 0.6));
    }
  } else if (data.kind === "pathfinder") {
    const tetra = new THREE.Mesh(new THREE.TetrahedronGeometry(1.6), gold);
    tetra.position.y = 2.4;
    tetra.rotation.y = 0.4;
    g.add(tetra);
    g.add(cyl(white, 0.18, 2.2, 0, 1.1, 0));
    g.add(box(rust, 1.8, 0.25, 1.8, 0, 0.15, 0));
  } else if (data.kind === "mav") {
    g.add(cyl(white, 1.3, 11, 0, 6, 0));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 10), white);
    nose.position.y = 13.1;
    g.add(nose);
    g.add(box(rust, 0.2, 4, 1.8, -1.6, 3, 0));
    g.add(box(rust, 0.2, 4, 1.8, 1.6, 3, 0));
  }

  const beacon = new THREE.PointLight(0xffb15a, 0.4, 18);
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

export function updateWorld(world, dt, playerPos, scanning) {
  world.storm += (world.stormTarget - world.storm) * Math.min(1, dt * 0.6);
  const fog = 0.012 + world.storm * 0.018;
  world.scene.fog.density = fog;
  const dustPos = world.dust.geometry.attributes.position;
  const n = world.dust.userData.n;
  for (let i = 0; i < n; i++) {
    let x = dustPos.getX(i) + dt * (4 + world.storm * 18);
    let y = dustPos.getY(i);
    let z = dustPos.getZ(i) + dt * (1 + world.storm * 6);
    if (x > 110) x -= 220;
    if (z > 110) z -= 220;
    dustPos.setXYZ(i, x, y, z);
  }
  dustPos.needsUpdate = true;
  world.dust.position.set(playerPos.x, playerPos.y, playerPos.z);
  world.dust.material.opacity = 0.22 + world.storm * 0.45;

  if (scanning) {
    world.scanRing.position.set(playerPos.x, playerPos.y + 0.05, playerPos.z);
    world.scanRing.scale.x += dt * 18;
    world.scanRing.scale.y += dt * 18;
    world.scanRing.material.opacity = Math.max(0, 0.7 - world.scanRing.scale.x * 0.03);
    if (world.scanRing.scale.x > 22) {
      world.scanRing.scale.set(1, 1, 1);
    }
  } else {
    world.scanRing.material.opacity = 0;
    world.scanRing.scale.set(1, 1, 1);
  }

  for (const o of world.outposts) {
    o.beacon.color.set(o.connected ? 0x8fd3b0 : 0xffb15a);
    o.beacon.intensity = o.connected ? 1.1 : 0.35;
  }

  for (const c of world.cargo) {
    if (c.taken) continue;
    c.mesh.position.y = heightAt(c.mesh.position.x, c.mesh.position.z) + 0.35 + Math.sin(performance.now() / 400) * 0.04;
  }
}

export function cargoLabel(crate) {
  const lang = getLang();
  return crate.name[lang] || crate.name.en;
}
