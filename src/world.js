import * as THREE from "three";
import { heightAt, fbm, normalAt } from "./noise.js";
import { OUTPOSTS, ITEMS, NODE_SPAWNS, LOCKER_START, YARD_PADS } from "./data.js";
import { maps, makeSky, makeSunHalo, packedYard, std, phys, makeHaze, dustSprite } from "./gfx.js";
import { takeModel, hasModel } from "./models.js";
import { tickMotion, makeLeakSteam, makeClothFlag } from "./motion.js";
import { createHabitat, tickTime, tickHabitat, simulateSleep, cropFactors } from "./systems/habitat.js";
import { createWeather, tickWeather } from "./systems/weather.js";
import { createScience } from "./systems/science.js";
import { isMobileView } from "./device.js";

export { isMobileView };

const TERRAIN_SIZE = 620;
const SEGMENTS = 168;
const LOOT_FIT = {
  ice: 0.88,
  scrap: 1.18,
  rock: 0.95,
  potato: 0.4,
  fabric: 1.12,
  tape: 0.36,
  hydrazine: 0.72,
  soil: 0.7,
  wire: 0.5,
  comms: 0.55,
  solar: 0.82,
  solarcell: 0.7,
};

export function createWorld(scene) {
  const mobile = isMobileView();
  scene.background = new THREE.Color(mobile ? 0xd48958 : 0xc47a4a);
  scene.fog = new THREE.FogExp2(mobile ? 0xd48958 : 0xc47a4a, mobile ? 0.0065 : 0.0085);

  const sky = makeSky();
  scene.add(sky.mesh);

  const hemi = new THREE.HemisphereLight(0xffe0c8, mobile ? 0xa05028 : 0x5a2a18, mobile ? 2.2 : 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8d0, mobile ? 1.65 : 1.7);
  sun.position.set(80, 90, -40);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffc8a0, mobile ? 0.85 : 0.48);
  fill.position.set(-50, 40, 40);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xc47848, mobile ? 0.95 : 0.32));

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(9, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false })
  );
  scene.add(sunMesh);
  const sunHalo = makeSunHalo();
  scene.add(sunHalo);
  const stars = makeStars();
  scene.add(stars);

  const terrain = makeTerrain();
  terrain.receiveShadow = true;
  scene.add(terrain);
  const yard = packedYard();
  yard.position.set(0, heightAt(0, 8) + 0.03, 8);
  scene.add(yard);
  scene.add(makeRocks());
  scene.add(makePebbles());
  scene.add(makeYardDressing());
  scene.add(makeMountains());
  scene.add(makeDebris());
  const dust = makeDust();
  scene.add(dust);
  const haze = mobile ? null : makeHaze();
  if (haze) scene.add(haze);
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
    if (!mobile) {
      const plate = makePlate(p.label.ru, 1.6, 0.28);
      plate.position.set(p.x, heightAt(p.x, p.z) + 0.04, p.z + 0.02);
      plate.rotation.x = -Math.PI / 2;
      scene.add(plate);
    }
    return { ...p, ring, taken: false };
  });

  const outposts = OUTPOSTS.map((data) => {
    const group = buildOutpost(data);
    const y = heightAt(data.x, data.z);
    group.position.set(data.x, y, data.z);
    scene.add(group);
    return { ...data, group, beacon: group.userData.beacon, baseY: y };
  });

  const world = {
    scene,
    sun,
    sunMesh,
    sunHalo,
    skyUniforms: sky.uniforms,
    sky: sky.mesh,
    fill,
    hemi,
    stars,
    dust,
    haze,
    scanRing,
    clock: mobile ? 0.25 : 0.22,
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
    hab: createHabitat(),
    weather: createWeather(),
    science: createScience(),
  };
  world._tickWeather = tickWeather;

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
  addLootMarker(group, { starter, wreck, color: def.beacon || 0xffe0a8 });

  group.position.set(x, heightAt(x, z) + (wreck ? 0.02 : starter ? 0.05 : 0.02), z);
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

function lootModelId(type, wreck) {
  if (wreck) return "scrap";
  if (type === "solar" && hasModel("solarcell")) return "solarcell";
  return type;
}

function addLootMarker(group, { starter, wreck, color }) {
  const col = wreck ? 0xff4a32 : starter ? 0x7ee8ff : color;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(starter ? 0.62 : wreck ? 0.9 : 0.4, starter ? 0.84 : wreck ? 1.14 : 0.54, 28),
    new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: starter ? 0.88 : 0.52 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.name = "lootMark";
  group.add(ring);
  if (starter) {
    const light = new THREE.PointLight(col, 1.35, 14);
    light.position.y = 1.15;
    group.add(light);
  }
}

function lootMesh(type, color, wreck) {
  const id = lootModelId(type, wreck);
  const fit = wreck ? 2.05 : LOOT_FIT[id] || LOOT_FIT[type] || 0.8;
  const ready = takeModel(id, fit);
  if (ready) {
    ready.name = "lootSpin";
    return ready;
  }
  const tex = maps();
  const mat = std({
    color,
    map: type === "scrap" || type === "wire" ? tex.metal : type === "rock" ? tex.rock : null,
    emissive: color,
    emissiveIntensity: wreck ? 0.12 : 0.42,
    roughness: 0.52,
    metalness: type === "scrap" || type === "wire" ? 0.55 : 0.06,
    flatShading: type !== "ice",
  });
  if (wreck || type === "scrap") {
    const g = new THREE.Group();
    g.name = "lootSpin";
    const a = new THREE.Mesh(new THREE.BoxGeometry(wreck ? 1.7 : 0.95, wreck ? 0.75 : 0.48, wreck ? 1.15 : 0.7), mat);
    a.rotation.y = 0.4;
    g.add(a);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.85), mat));
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(wreck ? 0.45 : 0.22), mat);
    shard.position.set(0.4, 0.35, 0.2);
    g.add(shard);
    return g;
  }
  if (type === "rock") {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), mat);
    m.name = "lootSpin";
    return m;
  }
  if (type === "ice") {
    const ice = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 1),
      phys({
        color: 0xd4f0ff,
        emissive: 0x7ec8e8,
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.08,
        transmission: 0.35,
        thickness: 0.4,
        transparent: true,
        opacity: 0.88,
      })
    );
    ice.name = "lootSpin";
    return ice;
  }
  if (type === "fabric") {
    const g = new THREE.Group();
    g.name = "lootSpin";
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.8, 6, 4),
      std({ color: 0xf4ead8, map: tex.hull, roughness: 0.85, side: THREE.DoubleSide })
    );
    cloth.rotation.set(-0.9, 0.2, 0.35);
    cloth.position.y = 0.15;
    g.add(cloth);
    return g;
  }
  if (type === "tape") {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.07, 10, 16), mat);
    m.name = "lootSpin";
    return m;
  }
  if (type === "potato") {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
    p.scale.set(1, 0.82, 1.12);
    p.name = "lootSpin";
    return p;
  }
  if (type === "soil") {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 7), mat);
    m.name = "lootSpin";
    return m;
  }
  if (type === "solar") {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.06, 0.6),
      std({ color: 0x1a2838, map: tex.solar, roughness: 0.25, metalness: 0.45 })
    );
    m.rotation.x = -0.4;
    m.name = "lootSpin";
    return m;
  }
  if (type === "wire") {
    const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.04, 48, 8), mat);
    m.name = "lootSpin";
    return m;
  }
  if (type === "comms") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), mat);
    m.name = "lootSpin";
    return m;
  }
  if (type === "hydrazine") {
    const g = new THREE.Group();
    g.name = "lootSpin";
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12), mat));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), std({ color: 0xc8c0b4, metalness: 0.6, roughness: 0.3 }));
    cap.position.y = 0.4;
    g.add(cap);
    return g;
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat);
  box.name = "lootSpin";
  return box;
}

function makeLocker(x, z) {
  const g = new THREE.Group();
  const meshy = takeModel("locker", 1.85);
  if (meshy) {
    g.add(meshy);
  } else {
    const tex = maps();
    const white = std({
      color: 0xf7f1e8,
      map: tex.hull,
      emissive: 0xfff6e8,
      emissiveIntensity: 0.28,
      roughness: 0.38,
      metalness: 0.16,
    });
    const amber = std({ color: 0xffb15a, emissive: 0xffb15a, emissiveIntensity: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.75, 0.82), white);
    body.position.y = 0.95;
    g.add(body);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.35, 0.06), std({ color: 0xddd4c8, metalness: 0.22, roughness: 0.4 }));
    door.position.set(-0.32, 0.92, 0.42);
    g.add(door);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), amber);
    lamp.position.set(0, 1.95, 0.28);
    g.add(lamp);
  }
  const light = new THREE.PointLight(0xffc878, 1.25, 11);
  light.position.set(0, 2.1, 0.4);
  g.add(light);
  if (!isMobileView()) {
    const plate = makePlate("LOCKER", 1.1, 0.28);
    plate.position.set(0, 1.25, 0.43);
    g.add(plate);
  }
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
    std({ map: tex, roughness: 0.55 })
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
    moisture: 0.2,
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
  const ready = takeModel(type);
  if (ready) {
    ready.userData.motion = type;
    if (type === "still") {
      const glow = new THREE.PointLight(0x6ec8e8, 0.25, 6);
      glow.name = "stillGlow";
      glow.position.set(0, 1.35, 0);
      ready.add(glow);
    }
    if (type === "radio") {
      const blink = new THREE.PointLight(0x7ed8f0, 0.55, 8);
      blink.name = "radioBlink";
      blink.position.set(0, 1.85, 0);
      ready.add(blink);
    }
    return ready;
  }
  const g = new THREE.Group();
  const tex = maps();
  const scrap = std({ color: 0xc2bbb0, map: tex.metal, roughness: 0.45, metalness: 0.38 });
  const rust = std({ color: 0x8a4a2a, map: tex.rock, roughness: 0.88 });
  const soil = std({ color: 0x5a3318, map: tex.mars, roughness: 1 });
  const dark = std({ color: 0x1c2430, map: tex.solar, roughness: 0.28, metalness: 0.48 });
  const gold = std({ color: 0xc9a227, roughness: 0.28, metalness: 0.62 });
  if (type === "still") {
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.4, 14), scrap, 0, 0.8, 0));
    g.add(mesh(new THREE.TorusGeometry(0.58, 0.05, 8, 16), rust, 0, 1.35, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 10), rust, 0.55, 1.45, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), scrap, -0.4, 1.1, 0.2));
    const globe = mesh(
      new THREE.SphereGeometry(0.3, 14, 12),
      phys({
        color: 0x6ec4e0,
        emissive: 0x1a6088,
        emissiveIntensity: 0.4,
        roughness: 0.12,
        transmission: 0.45,
        thickness: 0.3,
        transparent: true,
        opacity: 0.88,
      }),
      0.55,
      2.08,
      0
    );
    globe.name = "stillGlobe";
    g.add(globe);
    const gauge = mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12),
      std({ color: 0x4ec4e8, emissive: 0x4ec4e8, emissiveIntensity: 0.5 }),
      -0.35,
      0.55,
      0.5
    );
    gauge.name = "waterGauge";
    g.add(gauge);
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), std({ color: 0x7ed8f0, emissive: 0x4ec4e8, emissiveIntensity: 0.8 }), 0.55, 1.72, 0));
  } else if (type === "plot") {
    g.add(mesh(new THREE.BoxGeometry(2.25, 0.38, 2.25), rust, 0, 0.2, 0));
    g.add(mesh(new THREE.BoxGeometry(1.95, 0.22, 1.95), soil, 0, 0.42, 0));
    const leaf = std({ color: 0x5d8a4a, roughness: 0.7 });
    const plant = mesh(new THREE.ConeGeometry(0.2, 0.75, 6), leaf, 0, 0.88, 0);
    plant.visible = false;
    plant.name = "plant";
    g.add(plant);
    const plant2 = mesh(new THREE.ConeGeometry(0.16, 0.58, 6), std({ color: 0x6a9a4a, roughness: 0.7 }), 0.35, 0.78, 0.2);
    plant2.visible = false;
    plant2.name = "plant2";
    g.add(plant2);
    const tuber = mesh(new THREE.SphereGeometry(0.13, 10, 8), std({ color: 0xc4a05a }), 0.1, 0.55, -0.15);
    tuber.visible = false;
    tuber.name = "tuber";
    g.add(tuber);
  } else if (type === "solar") {
    const panel = mesh(new THREE.BoxGeometry(2.5, 0.07, 1.35), dark, 0, 1.15, 0);
    panel.rotation.x = -0.48;
    g.add(panel);
    g.add(mesh(new THREE.BoxGeometry(2.6, 0.04, 1.45), scrap, 0, 1.12, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.15, 8), scrap, 0, 0.55, 0.42));
    g.add(mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), rust, 0, 0.08, 0.42));
  } else if (type === "seal") {
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.4, 0.12), std({ color: 0xe8dcc8, map: tex.hull }), 0, 1.1, 0));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), gold, 0.6, 1.4, 0.08));
  } else if (type === "radio") {
    g.add(mesh(new THREE.BoxGeometry(0.85, 0.48, 0.65), scrap, 0, 0.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 10), gold, 0, 2.15, 0));
    const dish = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), gold, 0, 3.7, 0);
    dish.rotation.x = 0.7;
    g.add(dish);
    g.add(mesh(new THREE.TetrahedronGeometry(0.28), gold, 0, 3.95, 0));
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
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
  const mobile = isMobileView();
  if (playing) {
    tickTime(world, dt);
    world.playTime = (world.playTime || 0) + dt;
  }
  world.daylight = 0.5 + 0.5 * Math.sin(world.clock * Math.PI * 2);
  const night = 1 - world.daylight;
  const ang = world.clock * Math.PI * 2;
  world.sun.position.set(
    playerPos.x + Math.cos(ang) * 70,
    14 + Math.max(6, Math.sin(ang) * 88),
    playerPos.z + Math.sin(ang) * 36 - 28
  );
  world.sun.target.position.set(playerPos.x, playerPos.y, playerPos.z);
  world.sun.intensity = Math.max(mobile ? 0.95 : 0.12, world.daylight * (mobile ? 1.55 : 1.7));
  world.hemi.intensity = (mobile ? 1.15 : 0.32) + world.daylight * (mobile ? 1.05 : 0.85);
  if (world.fill) world.fill.intensity = (mobile ? 0.55 : 0.22) + world.daylight * 0.28 + night * 0.22;
  const sunDir = world.sun.position.clone().sub(new THREE.Vector3(playerPos.x, 0, playerPos.z)).normalize();
  if (world.sunMesh) {
    world.sunMesh.position.copy(sunDir).multiplyScalar(380);
    world.sunMesh.visible = world.daylight > 0.1;
  }
  if (world.sunHalo) {
    world.sunHalo.position.copy(sunDir).multiplyScalar(360);
    world.sunHalo.visible = world.daylight > 0.08;
    world.sunHalo.material.opacity = Math.max(0.15, world.daylight);
  }
  if (world.stars) world.stars.material.opacity = Math.max(0, night * 0.95 - 0.12);
  const dusk = Math.max(0, 1 - Math.abs(world.daylight - 0.42) * 2.8);
  if (world.skyUniforms) {
    world.skyUniforms.sunDir.value.copy(sunDir);
    world.skyUniforms.night.value = night;
    world.skyUniforms.storm.value = world.storm;
    world.skyUniforms.dusk.value = dusk;
  }

  const fogCol = new THREE.Color().setRGB(
    0.1 + 0.55 * world.daylight + 0.16 * dusk,
    0.05 + 0.28 * world.daylight + 0.05 * dusk,
    0.08 + 0.1 * world.daylight + 0.1 * night
  );
  if (mobile) {
    const warm = new THREE.Color(0xd48958);
    fogCol.copy(warm).lerp(new THREE.Color(0x6a3a28), Math.min(0.42, night * 0.5 + world.storm * 0.25));
    world.scene.background.copy(fogCol);
    world.scene.fog.color.copy(fogCol);
    world.scene.fog.density = 0.0055 + world.storm * 0.01;
  } else {
    world.scene.background.copy(fogCol);
    world.scene.fog.color.copy(fogCol);
    world.scene.fog.density = 0.0074 + night * 0.006 + world.storm * 0.022;
  }
  if (world.haze?.material) {
    world.haze.material.color.copy(fogCol);
    world.haze.material.opacity = 0.22 + world.storm * 0.28 + night * 0.12;
  }

  world.storm += (world.stormTarget - world.storm) * Math.min(1, dt * 0.35);
  if (playing) {
    tickWeather(world, dt);
    tickHabitat(world, dt);
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
    const bob = node.needHammer ? 0 : 0.035 * Math.sin(performance.now() / 420 + node.mesh.position.x);
    const lift = node.needHammer ? 0.02 : node.starter ? 0.05 : 0.02;
    node.mesh.position.y = heightAt(node.mesh.position.x, node.mesh.position.z) + lift + bob;
  }

  const hab = world.outposts.find((o) => o.kind === "hab");
  const inner = hab?.group.getObjectByName("innerLight");
  const bat = world.hab?.battery ?? 0.3;
  const live = world.hab?.gridOn;
  const lights = world.hab?.lightsOn !== false;
  if (inner) {
    if (!live || !lights) inner.intensity = live ? 0.16 : 0.08;
    else inner.intensity = (world.habSealed ? 1.35 : 0.48) + bat * 0.7;
    inner.color?.setHex(!live || bat < 0.12 ? 0xff3a18 : 0xffe0b0);
  }
  const consoleGlow = hab?.group.getObjectByName("habConsole");
  if (consoleGlow?.material) {
    consoleGlow.material.emissiveIntensity = live ? (isMobileView() ? 1.1 : 0.55) : 0.08;
  }
  for (let i = 0; i < 3; i++) {
    const cell = hab?.group.getObjectByName(`roofCell${i}`);
    if (!cell?.material) continue;
    const ok = (world.hab?.arrayHealth ?? 0) > 0.22 + i * 0.24;
    cell.material.color?.setHex(ok ? 0x243044 : 0x1a1210);
    if (cell.material.emissive) cell.material.emissive.setHex(ok && world.daylight > 0.2 ? 0x1a3050 : 0x000000);
  }

  for (const st of world.stations) {
    if (st.type === "still" && st.fuel > 0) {
      st.fuel -= dt;
      st.water += dt * 0.045 * (world.science?.known?.ice ? 1.12 : 1);
      const globe = st.mesh.getObjectByName("stillGlobe");
      if (globe) globe.material.emissiveIntensity = 0.55 + Math.sin(performance.now() / 280) * 0.25;
      const stillGlow = st.mesh.getObjectByName("stillGlow");
      if (stillGlow) stillGlow.intensity = 0.55 + Math.sin(performance.now() / 280) * 0.35;
      const gauge = st.mesh.getObjectByName("waterGauge");
      if (gauge) gauge.scale.set(1, 1 + Math.min(6, st.water * 0.4), 1);
    }
    if (st.type === "plot" && st.planted && st.grow < 1) {
      const f = cropFactors(world);
      st.moisture = Math.max(0, (st.moisture ?? 0.4) - dt * 0.007);
      const soil = world.science?.known?.soil ? 1.12 : 1;
      st.grow += dt * 0.01 * f.light * f.temp * Math.max(0.12, st.moisture) * soil;
      updatePlotVisual(st);
    }
  }
  tickMotion(world, dt);
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
  simulateSleep(world, 96);
  const f = cropFactors(world);
  const soil = world.science?.known?.soil ? 1.12 : 1;
  for (const st of world.stations) {
    if (st.type === "plot" && st.planted) {
      st.moisture = Math.max(0.05, (st.moisture ?? 0.4) * 0.62);
      st.grow = Math.min(1, st.grow + 0.34 * f.light * f.temp * Math.max(0.2, st.moisture) * soil);
      updatePlotVisual(st);
    }
    if (st.type === "still" && st.fuel > 0) {
      st.water += 5;
      st.fuel = Math.max(0, st.fuel - 10);
      if (world.hab) world.hab.waterTank = Math.min(40, world.hab.waterTank + 2.4);
    }
  }
}

function makeTerrain() {
  const segs = isMobileView() ? 48 : 168;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  const crest = new THREE.Color(0xd4a078);
  const rock = new THREE.Color(0x5a2e1c);
  const gully = new THREE.Color(0x6a3318);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const nrm = normalAt(x, z);
    const slope = 1 - nrm[1];
    const n = fbm(x * 0.018, z * 0.018);
    color.setRGB(0.58 + n * 0.16, 0.3 + n * 0.08, 0.16 + n * 0.04);
    if (isMobileView()) color.setRGB(0.82 + n * 0.14, 0.46 + n * 0.1, 0.24 + n * 0.06);
    color.lerp(crest, Math.max(0, y / 14) * 0.45);
    color.lerp(gully, Math.max(0, -y / 6) * 0.4);
    color.lerp(rock, Math.min(1, slope * 1.8));
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    std({
      map: maps().mars,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0.03,
      ...(isMobileView() ? { emissive: 0xb86a38, emissiveIntensity: 0.55 } : {}),
    })
  );
}

function makeRocks() {
  const geo = new THREE.DodecahedronGeometry(1.15, 0);
  const mat = std({ color: 0xffffff, map: maps().rock, roughness: 0.95, flatShading: true });
  const count = isMobileView() ? 22 : 240;
  const meshInst = new THREE.InstancedMesh(geo, mat, count);
  meshInst.castShadow = true;
  meshInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 5000) {
    guard++;
    const x = (Math.random() - 0.5) * 540;
    const z = (Math.random() - 0.5) * 540;
    if (Math.hypot(x, z - 8) < 9) continue;
    if (OUTPOSTS.some((o) => o.kind !== "hab" && Math.hypot(x - o.x, z - o.z) < 18)) continue;
    dummy.position.set(x, heightAt(x, z) + 0.18, z);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    const s = 0.55 + Math.random() * 2.6;
    dummy.scale.set(s, s * (0.45 + Math.random() * 0.7), s);
    dummy.updateMatrix();
    meshInst.setMatrixAt(placed, dummy.matrix);
    tint.setHSL(0.045, 0.42 + Math.random() * 0.22, 0.22 + Math.random() * 0.16);
    meshInst.setColorAt(placed, tint);
    placed++;
  }
  if (meshInst.instanceColor) meshInst.instanceColor.needsUpdate = true;
  return meshInst;
}

function makePebbles() {
  const geo = new THREE.TetrahedronGeometry(0.28);
  const mat = std({ color: 0x8a4a2c, map: maps().rock, roughness: 1, flatShading: true });
  const count = isMobileView() ? 48 : 420;
  const meshInst = new THREE.InstancedMesh(geo, mat, count);
  meshInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 70;
    const z = 8 + (Math.random() - 0.5) * 70;
    dummy.position.set(x, heightAt(x, z) + 0.04, z);
    dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    dummy.scale.setScalar(0.4 + Math.random() * 1.4);
    dummy.updateMatrix();
    meshInst.setMatrixAt(i, dummy.matrix);
  }
  return meshInst;
}

function makeYardDressing() {
  const g = new THREE.Group();
  const rock = std({
    color: 0x8a4a2c,
    map: maps().rock,
    roughness: 1,
    flatShading: true,
    emissive: 0x4a2414,
    emissiveIntensity: 0.22,
  });
  const spots = [
    [8.6, 16.4, 1.05],
    [-6.4, 21.2, 1.35],
    [11.2, 23.1, 0.72],
    [-9.8, 14.2, 1.15],
    [5.8, 26.4, 1.55],
    [-3.6, 28.2, 0.85],
    [13.8, 12.4, 1.2],
    [-12.2, 19.5, 0.95],
  ];
  for (const [x, z, s] of spots) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), rock);
    m.position.set(x, heightAt(x, z) + 0.12, z);
    m.scale.set(s, s * 0.52, s);
    m.rotation.set(0.25, x * 0.3, 0.18);
    g.add(m);
  }
  const scar = new THREE.MeshBasicMaterial({
    color: 0x5a2a14,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const [x, z, r] of [
    [-14, 24, 3.1],
    [16.5, 28, 2.3],
    [3.2, 33, 3.8],
  ]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r, 22), scar);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, heightAt(x, z) + 0.045, z);
    g.add(ring);
  }
  return g;
}

function makeMountains() {
  const group = new THREE.Group();
  const mat = std({ color: 0x7a4028, map: maps().rock, roughness: 1, flatShading: true });
  const dark = std({ color: 0x4a2416, map: maps().rock, roughness: 1, flatShading: true });
  const peaks = isMobileView() ? 10 : 26;
  for (let i = 0; i < peaks; i++) {
    const ang = (i / peaks) * Math.PI * 2;
    const r = 285 + (i % 5) * 16;
    const m = new THREE.Mesh(new THREE.ConeGeometry(22 + (i % 6) * 8, 18 + (i % 5) * 12, 6), i % 2 ? mat : dark);
    m.position.set(Math.cos(ang) * r, 6, Math.sin(ang) * r);
    m.rotation.y = ang;
    m.scale.z = 1.6 + (i % 3) * 0.4;
    group.add(m);
  }
  return group;
}

function makeDust() {
  const n = isMobileView() ? 120 : 2800;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 220;
    positions[i * 3 + 1] = Math.random() * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    const k = 0.7 + Math.random() * 0.3;
    colors[i * 3] = k;
    colors[i * 3 + 1] = k * 0.7;
    colors[i * 3 + 2] = k * 0.42;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: dustSprite(),
      vertexColors: true,
      size: 0.55,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    })
  );
  points.userData.n = n;
  return points;
}

function makeStars() {
  const n = 1800;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 470;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.05 + Math.random() * 0.78);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xfff6ea,
      size: 1.55,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: false,
      fog: false,
    })
  );
}

function makeDebris() {
  const g = new THREE.Group();
  const rust = std({ color: 0x8a4a2a, map: maps().rock, roughness: 0.9, flatShading: true });
  const pale = std({ color: 0xd8cfc4, map: maps().metal, roughness: 0.5, metalness: 0.28, flatShading: true });
  const meshySpots = [
    ["scrap", 1.35, 6.5, 6.2, 0.5],
    ["rock", 0.95, -7.2, 4.8, 1.2],
    ["scrap", 1.1, 9.4, 11.5, -0.4],
    ["crate", 0.72, -5.8, 2.2, 0.8],
    ["rock", 1.25, 11.2, 7.8, 0.2],
    ["scrap", 1.0, -12.4, 10.2, 2.1],
    ["rock", 0.7, 4.2, 19.6, 0.9],
    ["ice", 0.55, 8.4, 20.2, 0.3],
  ];
  let used = 0;
  const spots = isMobileView() ? meshySpots.slice(0, 4) : meshySpots;
  for (const [id, fit, x, z, rot] of spots) {
    const m = takeModel(id, fit);
    if (!m) continue;
    m.position.set(x, heightAt(x, z), z);
    m.rotation.y = rot;
    g.add(m);
    used++;
  }
  if (!used) {
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

function dressHabRoom(g, { hull, orange, bunkMat, sheet, tex }) {
  const mobile = isMobileView();
  const pad = std({ color: 0x5a3a22, map: tex.floor, roughness: 0.9, emissive: 0x3a2010, emissiveIntensity: 0.18 });
  g.add(box(pad, 2.4, 0.04, 2.4, 0, 0.08, 0.2));

  const insulation = std({
    color: 0xc45c2a,
    map: tex.eva,
    roughness: 0.7,
    emissive: 0x6a2a10,
    emissiveIntensity: mobile ? 0.35 : 0.12,
  });
  for (const a of [-1.15, 0, 1.15]) {
    const panel = box(insulation, 1.15, 1.35, 0.06, Math.sin(a) * 3.55, 1.35, Math.cos(a) * 3.55 - 0.4);
    panel.lookAt(0, 1.35, 0);
    g.add(panel);
  }

  const metal = std({ color: 0xd0c8bc, map: tex.metal, roughness: 0.45, metalness: 0.28 });
  const blanket = std({
    color: 0xe07030,
    map: tex.eva,
    roughness: 0.55,
    emissive: 0x802010,
    emissiveIntensity: mobile ? 0.4 : 0.12,
  });
  const pillow = std({ color: 0xf4ead8, roughness: 0.85, emissive: 0x8a7050, emissiveIntensity: 0.2 });
  g.add(box(metal, 2.25, 0.42, 1.05, -1.55, 0.32, -1.55));
  g.add(box(sheet, 2.05, 0.16, 0.92, -1.55, 0.58, -1.55));
  g.add(box(blanket, 1.55, 0.1, 0.88, -1.35, 0.68, -1.55));
  g.add(box(pillow, 0.42, 0.16, 0.55, -2.35, 0.72, -1.55));
  g.add(box(metal, 0.08, 0.55, 1.05, -2.62, 0.55, -1.55));
  const bunkTag = makePlate(mobile ? "СОН" : "BUNK", 0.7, 0.18);
  bunkTag.position.set(-1.55, 0.95, -1.0);
  g.add(bunkTag);

  g.add(box(hull, 1.35, 0.08, 0.72, 1.55, 0.78, -1.35));
  g.add(box(hull, 0.08, 0.72, 0.08, 1.05, 0.4, -1.1));
  g.add(box(hull, 0.08, 0.72, 0.08, 2.05, 0.4, -1.6));
  const screen = std({ color: 0x1a2830, emissive: 0x4ec4e8, emissiveIntensity: mobile ? 1.1 : 0.55 });
  const consoleMesh = box(screen, 0.42, 0.28, 0.04, 1.55, 1.08, -1.55);
  consoleMesh.name = "habConsole";
  g.add(consoleMesh);
  const consoleTag = makePlate(mobile ? "SYS" : "CONSOLE", 0.7, 0.16);
  consoleTag.position.set(1.55, 0.95, -0.95);
  g.add(consoleTag);
  const deskLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), orange);
  deskLamp.position.set(1.95, 1.02, -1.2);
  g.add(deskLamp);
  const deskGlow = new THREE.PointLight(0xffc070, mobile ? 1.15 : 0.55, 6);
  deskGlow.position.set(1.7, 1.1, -1.25);
  g.add(deskGlow);

  const crateMat = std({ color: 0x8a6a40, map: tex.hull, roughness: 0.7, emissive: 0x4a3010, emissiveIntensity: 0.16 });
  g.add(box(crateMat, 0.72, 0.58, 0.52, 1.6, 0.38, 1.15));
  g.add(box(crateMat, 0.55, 0.42, 0.42, -0.2, 0.28, 1.7));
  g.add(box(std({ color: 0xc9a05a, roughness: 0.65 }), 0.22, 0.14, 0.16, 1.55, 0.74, 1.05));

  const strip = std({ color: 0xffe8c0, emissive: 0xffd090, emissiveIntensity: mobile ? 1.35 : 0.7 });
  g.add(box(strip, 2.4, 0.06, 0.12, 0, 2.72, 0.2));
  g.add(box(strip, 0.12, 0.06, 1.8, -1.4, 2.72, -0.4));
  g.add(box(strip, 0.12, 0.06, 1.8, 1.4, 2.72, -0.4));

  const frame = std({ color: 0xd8d0c4, map: tex.hull, roughness: 0.5 });
  g.add(box(frame, 0.16, 2.35, 0.16, -1.15, 1.2, 3.95));
  g.add(box(frame, 0.16, 2.35, 0.16, 1.15, 1.2, 3.95));
  g.add(box(frame, 2.46, 0.16, 0.16, 0, 2.38, 3.95));
}

function buildOutpost(data) {
  const g = new THREE.Group();
  const tex = maps();
  const white = std({ color: 0xe8e2d8, map: tex.hull, roughness: 0.48, metalness: 0.16 });
  const rust = std({ color: 0x8a4a2a, map: tex.rock, roughness: 0.9 });
  const dark = std({ color: 0x222830, map: tex.solar, roughness: 0.32, metalness: 0.42 });
  const gold = std({ color: 0xc9a227, roughness: 0.28, metalness: 0.62 });

  if (data.kind === "hab") {
    const habSegs = isMobileView() ? 18 : 36;
    const hull = std({
      color: 0xece6dc,
      map: tex.hull,
      roughness: 0.46,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    const ribMat = std({ color: 0x8a4a2a, map: tex.rock, roughness: 0.82 });
    const glassMat = std({
      color: 0x1c2228,
      roughness: 0.12,
      metalness: 0.72,
      emissive: 0xffc070,
      emissiveIntensity: isMobileView() ? 0.85 : 0.4,
    });
    const orange = std({
      color: 0xe07030,
      roughness: 0.42,
      emissive: 0xe07030,
      emissiveIntensity: 0.4,
    });
    const bunkMat = std({ color: 0x6a3a22, roughness: 0.8 });
    const sheet = std({ color: 0xd8c8b0, roughness: 0.7 });

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 3.15, habSegs, 1, true, Math.PI * 0.18, Math.PI * 1.64),
      hull
    );
    wall.position.y = 1.55;
    g.add(wall);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, isMobileView() ? 16 : 32, isMobileView() ? 10 : 16, Math.PI * 0.18, Math.PI * 1.64, 0, Math.PI / 2),
      hull
    );
    dome.position.y = 3.12;
    g.add(dome);
    for (const y of [0.5, 1.55, 2.6]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(4.22, 0.09, 8, habSegs, Math.PI * 1.64), ribMat);
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
    const airLight = new THREE.PointLight(0xffb15a, 1.7, 20);
    airLight.position.set(0, 2.3, 6.2);
    g.add(airLight);
    const inner = new THREE.PointLight(0xffe0b0, isMobileView() ? 2.35 : 0.9, isMobileView() ? 16 : 13);
    inner.position.set(0, 2.1, 0.4);
    inner.name = "innerLight";
    g.add(inner);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.05, habSegs),
      std({
        color: isMobileView() ? 0xe2d2bc : 0xc8b8a4,
        map: tex.floor,
        roughness: 0.82,
        emissive: 0x6a4a28,
        emissiveIntensity: isMobileView() ? 0.28 : 0.08,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.06;
    g.add(floor);
    dressHabRoom(g, { hull, orange, bunkMat, sheet, tex });
    const flag = makeClothFlag();
    flag.position.set(2.05, 2.55, 6.48);
    flag.rotation.y = 0.35;
    g.add(flag);
    g.add(cyl(std({ color: 0xd8d2c6, map: tex.metal, metalness: 0.4, roughness: 0.35 }), 0.28, 1.6, 3.6, 0.85, 1.8));
    g.add(cyl(std({ color: 0xd8d2c6, map: tex.metal, metalness: 0.4, roughness: 0.35 }), 0.28, 1.6, 3.6, 0.85, 2.5));
    const antenna = cyl(std({ color: 0xc8c0b4, metalness: 0.5, roughness: 0.3 }), 0.04, 2.4, -2.8, 4.4, -1.2);
    antenna.name = "habAntenna";
    g.add(antenna);
    const plate = makePlate("ARES III", 2.3, 0.55);
    plate.position.set(0, 2.55, 6.55);
    g.add(plate);
    const cellMat = std({ color: 0x243044, map: tex.solar, roughness: 0.32, metalness: 0.42 });
    const deadMat = std({ color: 0x1a1210, roughness: 0.7, metalness: 0.15 });
    for (let i = 0; i < 3; i++) {
      const ok = i === 0;
      const cell = box((ok ? cellMat : deadMat).clone(), 1.15, 0.05, 0.72, (i - 1) * 1.28, 4.58, -1.15);
      cell.rotation.x = ok ? -0.12 : -0.38;
      cell.name = `roofCell${i}`;
      g.add(cell);
    }
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 16),
      std({
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
    g.add(makeLeakSteam());
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), std({ color: 0xe8dcc8, map: tex.hull, roughness: 0.7 }));
    patch.position.set(0, 1.65, -4.12);
    patch.rotation.y = Math.PI;
    patch.name = "patch";
    patch.visible = false;
    g.add(patch);
  } else if (data.kind === "rover") {
    const ready = takeModel("rover", 5.5);
    if (ready) g.add(ready);
    else {
      g.add(box(white, 4.2, 1.15, 2.4, 0.2, 1.15, 0));
      g.add(box(dark, 1.6, 0.9, 1.8, -1.7, 1.85, 0));
      g.add(box(rust, 0.9, 0.4, 1.1, 1.8, 1.5, 0.4));
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 14), gold);
      dish.position.set(-1.5, 2.55, 0);
      dish.rotation.x = 0.6;
      g.add(dish);
      const mast = cyl(white, 0.06, 1.4, -1.6, 2.4, 0);
      g.add(mast);
      for (const wx of [-1.4, 0.3, 1.6]) {
        for (const wz of [-1.35, 1.35]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.32, 14), dark);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.52, wz);
          g.add(wheel);
        }
      }
      g.add(box(rust, 1.2, 0.35, 0.8, 2.6, 0.3, 1.4));
    }
    const roverScrap = takeModel("scrap", 1.85);
    if (roverScrap) {
      roverScrap.position.set(3.4, 0, 2.1);
      roverScrap.rotation.y = 0.8;
      g.add(roverScrap);
    }
    const roverCrate = takeModel("crate", 0.8);
    if (roverCrate) {
      roverCrate.position.set(-2.6, 0, 1.8);
      roverCrate.rotation.y = -0.5;
      g.add(roverCrate);
    }
  } else if (data.kind === "farm") {
    const greenhouse = takeModel("farm", 9.5);
    if (greenhouse) {
      g.add(greenhouse);
    } else {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.08, 8, 24, Math.PI), white);
      hoop.rotation.z = Math.PI / 2;
      hoop.position.y = 0.2;
      g.add(hoop);
      const hoop2 = hoop.clone();
      hoop2.position.z = 2.2;
      g.add(hoop2);
      const plastic = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, 6, 16, 1, true, 0, Math.PI),
        std({ color: 0x7ec98a, transparent: true, opacity: 0.22, roughness: 0.12, side: THREE.DoubleSide })
      );
      plastic.rotation.z = Math.PI / 2;
      plastic.position.y = 2;
      g.add(plastic);
    }
    const dirt = std({ color: 0x5a3318, map: tex.mars, roughness: 1 });
    const leaf = std({ color: 0x4a7a38, roughness: 0.7 });
    let plots = 0;
    const beds = [
      [-2.2, -1.6],
      [0, -1.4],
      [2.2, -1.8],
      [-2.0, 1.8],
      [0.3, 2.0],
      [2.1, 1.5],
    ];
    for (const [x, z] of beds) {
      const plot = takeModel("plot", 2.15);
      if (plot) {
        plot.position.set(x, 0, z);
        plot.rotation.y = x * 0.15;
        g.add(plot);
        plots++;
      }
    }
    const soilA = takeModel("soil", 1.15);
    if (soilA) {
      soilA.position.set(-3.4, 0, 0.2);
      g.add(soilA);
    }
    const soilB = takeModel("soil", 0.9);
    if (soilB) {
      soilB.position.set(3.2, 0, 2.4);
      g.add(soilB);
    }
    if (!plots) {
      g.add(box(dirt, 2.4, 0.25, 6.5, 0, 0.2, 0));
      g.add(box(dirt, 2.4, 0.25, 6.5, 2.8, 0.2, 0));
      g.add(box(dirt, 2.4, 0.25, 6.5, -2.8, 0.2, 0));
      for (const x of [-2.2, 0, 2.2]) {
        for (const z of [-2, 0, 2]) {
          g.add(mesh(new THREE.ConeGeometry(0.18, 0.55, 5), leaf, x, 0.55, z));
        }
      }
    }
    const crate = takeModel("crate", 0.95);
    if (crate) {
      crate.position.set(3.6, 0, -0.4);
      crate.rotation.y = 0.4;
      g.add(crate);
    }
  } else if (data.kind === "solar") {
    let panels = 0;
    for (let i = -3; i <= 3; i++) {
      const broken = i === -1 || i === 2;
      const panel = takeModel("solar", 3.35);
      if (panel) {
        panel.position.set(i * 2.15, 0, (i % 2) * 0.85);
        panel.rotation.y = i * 0.12;
        if (broken) {
          panel.rotation.z = 0.55;
          panel.rotation.x = 0.18;
          panel.position.y = 0.05;
        }
        g.add(panel);
        panels++;
      } else {
        const fallback = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 1.5), broken ? rust : dark);
        fallback.position.set(i * 1.05, broken ? 0.9 : 1.45, (i % 2) * 0.4);
        fallback.rotation.x = broken ? -1.1 : -0.55;
        g.add(fallback);
        g.add(box(white, 0.08, 1.2, 0.08, i * 1.05, 0.6, 0.5));
      }
    }
    if (panels) {
      const scrapPile = takeModel("scrap", 1.6);
      if (scrapPile) {
        scrapPile.position.set(4.8, 0, 1.4);
        scrapPile.rotation.y = 0.7;
        g.add(scrapPile);
      }
    }
  } else if (data.kind === "pathfinder") {
    const ready = takeModel("pathfinder", 4.2);
    if (ready) g.add(ready);
    else {
      const tetra = new THREE.Mesh(new THREE.TetrahedronGeometry(1.35), gold);
      tetra.position.y = 2.1;
      g.add(tetra);
      g.add(cyl(white, 0.16, 2.0, 0, 1.0, 0));
      for (const a of [0, 2.1, 4.2]) {
        const petal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.1), gold);
        petal.position.set(Math.cos(a) * 1.3, 0.55, Math.sin(a) * 1.3);
        petal.rotation.set(-0.7, a, 0);
        g.add(petal);
      }
      g.add(box(dark, 0.7, 0.28, 0.5, 1.6, 0.22, 0.8));
    }
  } else if (data.kind === "mav") {
    const ready = takeModel("mav", 16);
    if (ready) g.add(ready);
    else {
      g.add(cyl(white, 1.35, 12, 0, 6.4, 0));
      g.add(box(orangeStripe(), 2.72, 0.35, 0.12, 0, 8.2, 1.35));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.4, 16), white);
      nose.position.y = 14.1;
      g.add(nose);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 12), dark);
      bell.position.y = 0.4;
      g.add(bell);
      for (const a of [0, 2.1, 4.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 8), rust);
        leg.position.set(Math.cos(a) * 2.4, 1.4, Math.sin(a) * 2.4);
        leg.rotation.z = Math.cos(a) * 0.45;
        leg.rotation.x = Math.sin(a) * 0.45;
        g.add(leg);
      }
    }
  }

  const beacon = new THREE.PointLight(0xffb15a, 0.5, 20);
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

function orangeStripe() {
  return std({ color: 0xe07030, emissive: 0xe07030, emissiveIntensity: 0.25, roughness: 0.45 });
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

export function refreshOutpostModels(world) {
  for (const o of world.outposts) {
    if (o.kind === "hab") continue;
    const fresh = buildOutpost(o);
    fresh.position.copy(o.group.position);
    world.scene.remove(o.group);
    world.scene.add(fresh);
    o.group = fresh;
    o.beacon = fresh.userData.beacon;
  }
}
