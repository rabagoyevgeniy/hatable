/** Pure interior action picking — no Three.js. */

export const DESK_RANGE = 3.9;
export const BUNK_RANGE = 3.0;
export const LOCKER_RANGE = 2.8;
export const GATHER_STEAL = 2.15;
export const LEAK_RANGE = 3.2;
export const STILL_PAD_RANGE = 2.8;

export function pickInteriorAction({
  deskD = 99,
  bunkD = 99,
  lockerD = 99,
  gatherD = 99,
  leakD = 99,
  inside = false,
  usedConsole = false,
  sealed = true,
  canPatch = false,
} = {}) {
  if (gatherD < GATHER_STEAL) return { kind: "gather", d: gatherD };
  if (!inside) return null;
  // Pressure emergency beats the desk while the hull is open — aisle from the hatch hits the leak.
  if (!sealed && leakD < LEAK_RANGE) {
    return { kind: canPatch ? "patch" : "leak-hint", d: leakD };
  }
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

/** Amber STILL ring west of the hatch — same pattern as the leak: hint until recipe, E-build when ready. */
export function pickStillPadAction({
  padD = 99,
  gatherD = 99,
  hasHammer = false,
  canBuild = false,
  hasStill = false,
} = {}) {
  if (hasStill) return null;
  if (padD >= STILL_PAD_RANGE) return null;
  if (canBuild && hasHammer) return { kind: "build-still", d: padD };
  if (!hasHammer) return null;
  // A loot pile underfoot still wins — you need those mats. Empty ring names the recipe.
  if (gatherD + 0.45 < padD) return null;
  if (padD + 0.2 <= gatherD) return { kind: "still-hint", d: padD };
  return null;
}

export function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
