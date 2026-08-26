/**
 * Visual-terrain grounding and Hab collision (no Three).
 * Mesh sampling matches THREE.PlaneGeometry after rotateX(-π/2) in world.makeTerrain.
 */
import { HAB_POS } from "../data.js";

export { HAB_POS };

export const HAB_WALL_R = 4.28;
export const HAB_INNER_R = 3.92;
export const HAB_FLOOR_LIFT = 0.08;
export const PLAYER_RADIUS = 0.38;
export const TERRAIN_SIZE = 620;
export const MOBILE_TERRAIN_SEGS = 80;
export const DESKTOP_TERRAIN_SEGS = 168;

/** Airlock corridor in world XZ — the only legal door (+Z hatch). */
export const AIRLOCK = {
  minX: -1.08,
  maxX: 1.08,
  minZ: 11.48,
  maxZ: 14.92,
};

/** Simple circle blockers: locker (yard) + bunk/desk/crate (interior). */
export const BLOCKERS = [
  { x: 3.1, z: 12.3, r: 0.48 },
  { x: -1.55, z: 6.45, r: 0.9 },
  { x: 1.55, z: 9.2, r: 0.58 },
  { x: 1.6, z: 6.55, r: 0.4 },
  { x: -0.2, z: 9.7, r: 0.32 },
];

export function segsForMobile(mobile) {
  return mobile ? MOBILE_TERRAIN_SEGS : DESKTOP_TERRAIN_SEGS;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * World XZ of a PlaneGeometry vertex after rotateX(-π/2) and y = heightAt(x,z).
 * iy=0 is +Z (worldZ = +half).
 */
export function meshVertexWorld(ix, iy, segments) {
  const half = TERRAIN_SIZE / 2;
  const cell = TERRAIN_SIZE / segments;
  return {
    x: ix * cell - half,
    z: half - iy * cell,
  };
}

export function meshHeightAt(x, z, segments, heightFn) {
  const segs = Math.max(1, segments | 0);
  const half = TERRAIN_SIZE / 2;
  const cell = TERRAIN_SIZE / segs;
  const fx = clamp((x + half) / cell, 0, segs);
  const fy = clamp((half - z) / cell, 0, segs);
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

export function habFloorY(heightFn) {
  return heightFn(HAB_POS.x, HAB_POS.z) + HAB_FLOOR_LIFT;
}

export function habRadial(x, z) {
  return Math.hypot(x - HAB_POS.x, z - HAB_POS.z);
}

export function inAirlockCorridor(x, z) {
  return x >= AIRLOCK.minX && x <= AIRLOCK.maxX && z >= AIRLOCK.minZ && z <= AIRLOCK.maxZ;
}

/** Strict hull interior — not the old 6.2 m “near Hab” circle. */
export function isInsideHabHull(x, z) {
  return habRadial(x, z) < HAB_INNER_R;
}

export function isSheltered(x, z) {
  return isInsideHabHull(x, z) || inAirlockCorridor(x, z);
}

export function groundYAt(x, z, segments, heightFn) {
  if (isSheltered(x, z)) return habFloorY(heightFn);
  return meshHeightAt(x, z, segments, heightFn);
}

const PUSH_ITERS = 10;
const SKIN = 0.03;

/**
 * Resolve Hab walls. Airlock corridor is the only passage.
 */
export function resolveHabCollision(pos, radius = PLAYER_RADIUS) {
  let x = pos.x;
  let z = pos.z;
  const rPlayer = radius + SKIN;

  for (let i = 0; i < PUSH_ITERS; i++) {
    if (inAirlockCorridor(x, z)) {
      const lo = AIRLOCK.minX + rPlayer;
      const hi = AIRLOCK.maxX - rPlayer;
      if (x < lo) x = lo;
      if (x > hi) x = hi;
      continue;
    }

    const dx = x - HAB_POS.x;
    const dz = z - HAB_POS.z;
    const r = Math.hypot(dx, dz) || 1e-6;
    const nx = dx / r;
    const nz = dz / r;
    const outer = HAB_WALL_R + rPlayer;
    const inner = HAB_INNER_R - rPlayer;

    if (r < outer && r > inner) {
      const toOuter = outer - r;
      const toInner = r - inner;
      const target = toOuter <= toInner ? outer : inner;
      x = HAB_POS.x + nx * target;
      z = HAB_POS.z + nz * target;
    }
  }

  pos.x = x;
  pos.z = z;
  return pos;
}

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

const SINK_EPS = 0.05;

export function snapToGround(pos, segments, heightFn) {
  pos.y = groundYAt(pos.x, pos.z, segments, heightFn);
  return pos.y;
}

export function emergencyUnground(pos, segments, heightFn) {
  const gy = groundYAt(pos.x, pos.z, segments, heightFn);
  if (pos.y < gy - SINK_EPS) {
    pos.y = gy;
    return true;
  }
  return false;
}

/**
 * One XZ step + Hab collision + visual-mesh snap. Used by the player and by tests.
 */
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
