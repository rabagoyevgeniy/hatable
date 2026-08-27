import { HAB_POS } from "./data.js";
import { foundationMask, OUTPOST_HUBS, radialFalloff } from "./systems/foundation.js";

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash(ix, iz) {
  let n = ix * 374761393 + iz * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0xfffffff) / 0xfffffff;
}

export function valueNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fz = fade(z - z0);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

export function fbm(x, z, octaves = 5) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, z * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return value;
}

export function rawHeight(x, z) {
  const dunes = fbm(x * 0.008, z * 0.008, 5) * 16;
  const ripples = fbm(x * 0.03 + 40, z * 0.03, 3) * 3.4;
  const rocks = Math.pow(fbm(x * 0.02 + 90, z * 0.02 - 20, 4), 3) * 7;
  return dunes + ripples + rocks - 8;
}

let stationPadY = null;
const outpostPadY = new Map();

/** Hab-site grade elevation: natural height at the Hab origin. */
export function stationPadHeight() {
  if (stationPadY == null) stationPadY = rawHeight(HAB_POS.x, HAB_POS.z);
  return stationPadY;
}

/**
 * Authoritative ground height. Mesh, player, loot, and props must all sample this
 * (then bilinear through the PlaneGeometry via meshHeightAt).
 */
export function heightAt(x, z) {
  let h = rawHeight(x, z);
  const site = foundationMask(x, z);
  if (site > 1e-4) {
    const packed = (fbm(x * 0.11 + 3, z * 0.11) - 0.5) * 0.05;
    h = lerp(h, stationPadHeight() + packed * Math.min(1, site * 1.4), site);
  }
  for (const hub of OUTPOST_HUBS) {
    const t = radialFalloff(x, z, hub.x, hub.z, hub.inner, hub.outer);
    if (t <= 1e-4) continue;
    let py = outpostPadY.get(hub.x);
    if (py == null) {
      py = rawHeight(hub.x, hub.z);
      outpostPadY.set(hub.x, py);
    }
    h = lerp(h, py, t);
  }
  return h;
}

export function normalAt(x, z, e = 0.7) {
  const hL = heightAt(x - e, z);
  const hR = heightAt(x + e, z);
  const hD = heightAt(x, z - e);
  const hU = heightAt(x, z + e);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
