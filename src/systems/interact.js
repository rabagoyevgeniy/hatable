/** Pure interior action picking — no Three.js. */

export const DESK_RANGE = 3.6;
export const BUNK_RANGE = 3.0;
export const LOCKER_RANGE = 2.8;
export const GATHER_STEAL = 2.15;

export function pickInteriorAction({
  deskD = 99,
  bunkD = 99,
  lockerD = 99,
  gatherD = 99,
  inside = false,
  usedConsole = false,
} = {}) {
  if (gatherD < GATHER_STEAL) return { kind: "gather", d: gatherD };
  if (!inside) return null;
  const hits = [];
  if (deskD < DESK_RANGE) hits.push({ kind: "console", d: deskD });
  if (bunkD < BUNK_RANGE) hits.push({ kind: "sleep", d: bunkD });
  if (lockerD < LOCKER_RANGE) {
    hits.push({
      kind: "locker",
      d: lockerD,
      hintDeeper: !usedConsole && deskD < 5.5,
    });
  }
  hits.sort((a, b) => a.d - b.d);
  return hits[0] || null;
}

export function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
