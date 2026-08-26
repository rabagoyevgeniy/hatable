/**
 * Visual-terrain grounding and Hab collision (no Three).
 * Mesh sampling matches THREE.PlaneGeometry: vertices.push(x, -y, 0) then rotateX(-π/2).
 */
import { HAB_POS } from "../data.js";

export { HAB_POS };

/** Main living-module hull. */
export const HAB_WALL_R = 6.95;
export const HAB_INNER_R = 6.48;
export const HAB_FLOOR_LIFT = 0.1;
export const PLAYER_RADIUS = 0.38;
/** Soles sit on the sand, not in it. Physics Y, not a camera cheat. */
export const FOOT_OFFSET = 0.07;
export const TERRAIN_SIZE = 620;
export const MOBILE_TERRAIN_SEGS = 96;
export const DESKTOP_TERRAIN_SEGS = 168;

/** Dedicated airlock tunnel in world XZ — only legal door (+Z). */
export const AIRLOCK = {
  minX: -1.32,
  maxX: 1.32,
  minZ: 13.5,
  maxZ: 19.92,
};

/** Adjacent lab module west of the Hab. */
export const LAB = { x: -12.35, z: 8, r: 3.28 };
export const LAB_TUBE = {
  minX: -12.5,
  maxX: -6.05,
  minZ: 6.82,
  maxZ: 9.18,
};

export const TERRAIN_HALF = TERRAIN_SIZE / 2;

export function segsForMobile(mobile) {
  return mobile ? MOBILE_TERRAIN_SEGS : DESKTOP_TERRAIN_SEGS;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * World XZ of a PlaneGeometry vertex after rotateX(-π/2).
 * Three.js pushes (x, -y, 0) with y = iy * cell - half, so iy=0 → worldZ = -half.
 */
export function meshVertexWorld(ix, iy, segments) {
  const half = TERRAIN_HALF;
  const cell = TERRAIN_SIZE / segments;
  return {
    x: ix * cell - half,
    z: iy * cell - half,
  };
}

export function meshHeightAt(x, z, segments, heightFn) {
  const segs = Math.max(1, segments | 0);
  const half = TERRAIN_HALF;
  const cell = TERRAIN_SIZE / segs;
  const fx = clamp((x + half) / cell, 0, segs);
  const fy = clamp((z + half) / cell, 0, segs);
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const ix1 = Math.min(ix + 1, segs);
  const iy1 = Math.min(iy + 1, segs);
  const aPos = meshVertexWorld(ix, iy, segs);
  const bPos = meshVertexWorld(ix1, iy, segs);
  const cPos = meshVertexWorld(ix, iy1, segs);
  const dPos = meshVertexWorld(ix1, iy1, segs);
  const a = heightFn(aPos.x, aPos.z);
  const b = heightFn(bPos.x, bPos.z);
  const c = heightFn(cPos.x, cPos.z);
  const d = heightFn(dPos.x, dPos.z);
  const top = a * (1 - tx) + b * tx;
  const bot = c * (1 - tx) + d * tx;
  return top * (1 - ty) + bot * ty;
}

/** Same function the terrain mesh is built from, then bilinear like the GPU triangles. */
export function terrainHeightAt(x, z, segments, heightFn) {
  return meshHeightAt(x, z, segments, heightFn);
}

export function habFloorY(heightFn) {
  return heightFn(HAB_POS.x, HAB_POS.z) + HAB_FLOOR_LIFT;
}

export function habRadial(x, z) {
  return Math.hypot(x - HAB_POS.x, z - HAB_POS.z);
}

export function inAirlockCorridor(x, z) {
  return x >= AIRLOCK.minX && x <= AIRLOCK.maxX && z >= AIRLOCK.minZ && z <= AIRLOCK.maxZ;
}

export function inLabTube(x, z) {
  return x >= LAB_TUBE.minX && x <= LAB_TUBE.maxX && z >= LAB_TUBE.minZ && z <= LAB_TUBE.maxZ;
}

export function isInsideLab(x, z) {
  return Math.hypot(x - LAB.x, z - LAB.z) < LAB.r - 0.22;
}

export function isInsideHabHull(x, z) {
  return habRadial(x, z) < HAB_INNER_R;
}

export function isSheltered(x, z) {
  return isInsideHabHull(x, z) || inAirlockCorridor(x, z) || isInsideLab(x, z) || inLabTube(x, z);
}

export function groundYAt(x, z, segments, heightFn) {
  if (isSheltered(x, z)) return habFloorY(heightFn);
  return terrainHeightAt(x, z, segments, heightFn);
}

const PUSH_ITERS = 10;
const SKIN = 0.03;

function resolveRing(pos, cx, cz, inner, outer, rPlayer, skip) {
  if (skip) return;
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const r = Math.hypot(dx, dz) || 1e-6;
  const nx = dx / r;
  const nz = dz / r;
  const out = outer + rPlayer;
  const inn = inner - rPlayer;
  if (r < out && r > inn) {
    const toOuter = out - r;
    const toInner = r - inn;
    const target = toOuter <= toInner ? out : inn;
    pos.x = cx + nx * target;
    pos.z = cz + nz * target;
  }
}

function resolveTubeSides(p, rPlayer) {
  if (p.x < LAB_TUBE.minX || p.x > LAB_TUBE.maxX) return;
  const midZ = (LAB_TUBE.minZ + LAB_TUBE.maxZ) / 2;
  const half = (LAB_TUBE.maxZ - LAB_TUBE.minZ) / 2;
  const inner = half - rPlayer;
  const outer = half + rPlayer;
  const d = p.z - midZ;
  const ad = Math.abs(d);
  if (ad <= inner || ad >= outer) return;
  const sign = d >= 0 ? 1 : -1;
  const toOut = outer - ad;
  const toIn = ad - inner;
  p.z = midZ + sign * (toOut <= toIn ? outer : inner);
}

export function resolveHabCollision(pos, radius = PLAYER_RADIUS) {
  let x = pos.x;
  let z = pos.z;
  const rPlayer = radius + SKIN;

  for (let i = 0; i < PUSH_ITERS; i++) {
    const side = { x, z };
    resolveTubeSides(side, rPlayer);
    x = side.x;
    z = side.z;
    if (inAirlockCorridor(x, z)) {
      const lo = AIRLOCK.minX + rPlayer;
      const hi = AIRLOCK.maxX - rPlayer;
      if (x < lo) x = lo;
      if (x > hi) x = hi;
      continue;
    }
    if (inLabTube(x, z)) {
      const lo = LAB_TUBE.minZ + rPlayer;
      const hi = LAB_TUBE.maxZ - rPlayer;
      if (z < lo) z = lo;
      if (z > hi) z = hi;
      continue;
    }
    const p = { x, z };
    resolveRing(p, HAB_POS.x, HAB_POS.z, HAB_INNER_R, HAB_WALL_R, rPlayer, false);
    resolveRing(p, LAB.x, LAB.z, LAB.r - 0.38, LAB.r + 0.12, rPlayer, false);
    x = p.x;
    z = p.z;
  }

  pos.x = x;
  pos.z = z;
  return pos;
}

/** Simple circle blockers: locker (yard) + bunk/desk/crates (interior). */
export const BLOCKERS = [
  { x: 4.15, z: 18.35, r: 0.52 },
  { x: -3.45, z: 4.15, r: 1.05 },
  { x: 3.55, z: 10.35, r: 0.68 },
  { x: 3.4, z: 5.2, r: 0.42 },
  { x: -2.6, z: 10.8, r: 0.34 },
];

export function resolveBlockers(pos, radius = PLAYER_RADIUS) {
  for (const b of BLOCKERS) {
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    const min = b.r + radius;
    if (d < min) {
      pos.x = b.x + (dx / d) * min;
      pos.z = b.z + (dz / d) * min;
    }
  }
  return pos;
}

export function resolvePlayerXZ(pos, radius = PLAYER_RADIUS) {
  resolveHabCollision(pos, radius);
  resolveBlockers(pos, radius);
  resolveHabCollision(pos, radius);
  return pos;
}

const SINK_EPS = 0.04;

export function snapToGround(pos, segments, heightFn) {
  pos.y = groundYAt(pos.x, pos.z, segments, heightFn) + FOOT_OFFSET;
  return pos.y;
}

export function emergencyUnground(pos, segments, heightFn) {
  const gy = groundYAt(pos.x, pos.z, segments, heightFn) + FOOT_OFFSET;
  if (pos.y < gy - SINK_EPS) {
    pos.y = gy;
    return true;
  }
  return false;
}

export function stepGrounded(pos, dx, dz, segments, heightFn, radius = PLAYER_RADIUS) {
  pos.x += dx;
  pos.z += dz;
  const r = Math.hypot(pos.x, pos.z);
  if (r > 270) {
    pos.x *= 270 / r;
    pos.z *= 270 / r;
  }
  resolvePlayerXZ(pos, radius);
  snapToGround(pos, segments, heightFn);
  emergencyUnground(pos, segments, heightFn);
  return isSheltered(pos.x, pos.z);
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, Math.max(0, t));
}
