/**
 * Graded Ares III mission site. Mask only — final Y lives in noise.heightAt.
 * Inner cores stay level; a wide irregular envelope blends back into dunes.
 */
import { HAB_POS, HAB_HATCH, LOCKER_POS, YARD_PADS } from "../data.js";

function fade(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function blob(x, z, cx, cz, rx, rz) {
  const ang = Math.atan2(z - cz, x - cx);
  const wobble = 1 + 0.07 * Math.sin(ang * 3.1 + cx * 0.15) + 0.04 * Math.sin(ang * 5.7);
  const dx = (x - cx) / (rx * wobble);
  const dz = (z - cz) / (rz * wobble);
  const d = Math.hypot(dx, dz);
  if (d >= 1) return 0;
  if (d <= 0.52) return 1;
  return fade(1 - (d - 0.52) / 0.48);
}

const STILL = YARD_PADS.find((p) => p.station === "still") || { x: -11.8, z: 17.4 };
const SOLAR = YARD_PADS.find((p) => p.station === "solar") || { x: 13.6, z: 2.6 };
const PLOT = YARD_PADS.find((p) => p.station === "plot") || { x: -15.6, z: 3.2 };
const PLOT2 = YARD_PADS.find((p) => p.id === "plot2") || { x: -18.2, z: 7.4 };

/** Soft-union cores: Hab, airlock, lab, greenhouse, service yards. */
export function stationCoreMask(x, z) {
  const hab = blob(x, z, HAB_POS.x, HAB_POS.z, 9.6, 8.8);
  const air = blob(x, z, HAB_HATCH.x, HAB_HATCH.z - 1.8, 5.2, 7.4);
  const lab = blob(x, z, -12.35, 8, 5.8, 5.4);
  const green = blob(x, z, -14.6, 2.4, 6.6, 5.6);
  const solar = blob(x, z, SOLAR.x, SOLAR.z, 6.4, 5.8);
  const still = blob(x, z, STILL.x, STILL.z, 5.4, 5.0);
  const plots = Math.max(blob(x, z, PLOT.x, PLOT.z, 4.4, 4.2), blob(x, z, PLOT2.x, PLOT2.z, 4.2, 4.0));
  const locker = blob(x, z, LOCKER_POS.x, LOCKER_POS.z, 3.4, 3.2);
  const parts = [hab, air, lab, green, solar, still, plots, locker];
  let u = 1;
  for (const p of parts) u *= 1 - p;
  return 1 - u;
}

/** Wide prepared terrace with an uneven rim — not a stamped circle. */
export function stationEnvelopeMask(x, z) {
  const dx = x - HAB_POS.x;
  const dz = z - HAB_POS.z;
  const d = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const inner = 16.5 + 2.4 * Math.sin(ang * 2.15 + 0.35) + 1.1 * Math.sin(ang * 4.8);
  const outer = 31.5 + 4.8 * Math.sin(ang * 2.15 + 0.35) + 2.6 * Math.sin(ang * 5.1 - 0.4);
  if (d <= inner) return 1;
  if (d >= outer) return 0;
  return fade(1 - (d - inner) / Math.max(0.8, outer - inner));
}

export function foundationMask(x, z) {
  return Math.max(stationCoreMask(x, z), stationEnvelopeMask(x, z));
}

/** Distant wrecks get a smaller grade so they do not hover on a single dune. */
export const OUTPOST_HUBS = [
  { x: 86, z: -46, inner: 8, outer: 16 },
  { x: -78, z: 62, inner: 8, outer: 16 },
  { x: 48, z: 108, inner: 8, outer: 16 },
  { x: -138, z: -92, inner: 7, outer: 14 },
  { x: 196, z: -158, inner: 9, outer: 18 },
];

export function radialFalloff(x, z, cx, cz, inner, outer) {
  const d = Math.hypot(x - cx, z - cz);
  if (d <= inner) return 1;
  if (d >= outer) return 0;
  return fade(1 - (d - inner) / (outer - inner));
}
