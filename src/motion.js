import * as THREE from "three";
import { std } from "./gfx.js";

/** Subtle live motion for Hab, Meshy props, stations, and the leak. */
export function tickMotion(world, dt) {
  const t = performance.now() / 1000;
  const wind = 0.7 + (world.storm || 0) * 2.8;

  const flag = world.scene.getObjectByName("habFlag");
  if (flag) {
    flag.rotation.z = Math.sin(t * 5.2 * wind) * 0.22;
    flag.rotation.y = Math.sin(t * 2.4 * wind) * 0.08;
  }
  const antenna = world.scene.getObjectByName("habAntenna");
  if (antenna) antenna.rotation.y = t * 0.35;

  const leak = world.scene.getObjectByName("leak");
  const steam = world.scene.getObjectByName("leakSteam");
  if (steam) {
    steam.visible = !world.habSealed && leak?.visible !== false;
    if (steam.visible) {
      const pos = steam.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (0.55 + (i % 5) * 0.08);
        if (y > 2.4) y = 0.05 * Math.random();
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 3 + i) * dt * 0.08);
      }
      pos.needsUpdate = true;
      steam.material.opacity = 0.38 + Math.sin(t * 4) * 0.1;
    }
  }

  for (const o of world.outposts || []) {
    const g = o.group;
    if (!g) continue;
    if (o.kind === "rover") {
      g.rotation.z = Math.sin(t * 0.9) * 0.012;
      g.rotation.x = Math.sin(t * 0.55 + 1) * 0.01;
    } else if (o.kind === "pathfinder") {
      g.rotation.y = Math.sin(t * 0.25) * 0.08;
    } else if (o.kind === "mav") {
      g.position.y = o.baseY + Math.sin(t * 0.8) * 0.04;
      const pulse = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3.2));
      g.traverse((m) => {
        if (m.isMesh && m.material && m.material.emissiveIntensity != null && m.material.emissive?.getHex?.() > 0) {
          m.material.emissiveIntensity = pulse;
        }
      });
    } else if (o.kind === "solar") {
      g.rotation.z = Math.sin(t * 0.4) * 0.015;
    }
  }

  for (const st of world.stations || []) {
    if (!st.mesh) continue;
    if (st.type === "still") {
      const spinning = st.fuel > 0;
      st.mesh.rotation.y += dt * (spinning ? 0.7 : 0.12);
      const globe = st.mesh.getObjectByName("stillGlobe");
      if (globe) globe.rotation.y += dt * 1.4;
    } else if (st.type === "solar") {
      const ang = (world.clock || 0) * Math.PI * 2;
      st.mesh.rotation.y = Math.atan2(Math.sin(ang), Math.cos(ang)) * 0.35;
    } else if (st.type === "radio") {
      st.mesh.rotation.y += dt * (world.contacted ? 0.9 : 0.15);
      const blink = st.mesh.getObjectByName("radioBlink");
      if (blink) {
        blink.intensity = world.contacted ? 0.45 + 0.7 * (0.5 + 0.5 * Math.sin(t * 9)) : 0.22;
      }
    } else if (st.type === "plot" && st.planted) {
      const sway = Math.sin(t * 1.8 + st.x) * 0.08;
      const plant = st.mesh.getObjectByName("plant");
      const plant2 = st.mesh.getObjectByName("plant2");
      if (plant) plant.rotation.z = sway;
      if (plant2) plant2.rotation.z = -sway * 0.7;
    }
  }

  for (const node of world.nodes || []) {
    if (node.taken || !node.mesh) continue;
    const spin = node.mesh.getObjectByName("lootSpin") || node.mesh.children[0];
    if (spin) spin.rotation.y += dt * (node.starter ? 0.55 : 0.28);
    const mark = node.mesh.getObjectByName("lootMark");
    if (mark?.material) {
      mark.material.opacity = (node.starter ? 0.62 : 0.38) + 0.22 * Math.sin(t * 2.6 + node.mesh.position.x);
    }
  }
}

export function makeLeakSteam() {
  const n = 48;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 1] = Math.random() * 1.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const steam = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xe8f0f8,
      size: 0.2,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  steam.name = "leakSteam";
  steam.position.set(0, 1.55, -4.05);
  return steam;
}

export function makeClothFlag() {
  const geo = new THREE.PlaneGeometry(1.15, 0.7, 8, 4);
  const mat = std({
    color: 0xe07030,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.05,
    emissive: 0x401808,
    emissiveIntensity: 0.12,
  });
  const flag = new THREE.Mesh(geo, mat);
  flag.name = "habFlag";
  flag.castShadow = true;
  return flag;
}
