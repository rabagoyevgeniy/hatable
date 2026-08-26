/** Pure interior action picking — no Three.js. */

export const DESK_RANGE = 3.9;
export const BUNK_RANGE = 3.0;
export const LOCKER_RANGE = 2.8;
export const GATHER_STEAL = 2.15;
export const LEAK_RANGE = 3.2;
export const STILL_PAD_RANGE = 4.2;
export const HATCH_RANGE = 3.4;

export function pickHatchAction({
  hatchD = 99,
  gatherD = 99,
  inside = false,
  sealed = true,
} = {}) {
  if (inside || sealed) return null;
  if (hatchD >= HATCH_RANGE) return null;
  if (gatherD + 0.35 < hatchD) return null;
  return { kind: "hatch-hint", d: hatchD };
}

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

export const STILL_MACHINE_RANGE = 4.2;
/** Close enough that leftover scrap does not steal E while the flask fills. Ice at ~3.3 m still gathers. */
export const STILL_DRIP_RANGE = 2.4;

export function pickStillMachineAction({
  d = 99,
  water = 0,
  fuel = 0,
  fault = null,
  gridOn = false,
  hasIce = false,
  hasHydrazine = false,
  iceKnown = false,
  hydrazineKnown = false,
  wireKnown = false,
  canRepair = false,
} = {}) {
  if (d > STILL_MACHINE_RANGE) return null;
  if (water >= 1) return { kind: "still-take", d };
  if (fault === "pump") {
    if (canRepair && wireKnown) return { kind: "still-repair", d };
    if (canRepair) return { kind: "pump-scan", d };
    return { kind: "still-diag", d };
  }
  if (fuel > 0 && !gridOn) return { kind: "still-wait", d };
  if ((hasHydrazine && hydrazineKnown) || (hasIce && iceKnown)) return { kind: "still-fuel", d };
  if (hasIce || hasHydrazine) return { kind: "still-scan", d };
  if (fuel > 0 && gridOn && d < STILL_DRIP_RANGE) return { kind: "still-drip", d };
  return null;
}

/** Empty plot: last potato is seed, but only after you know the soil. */
export function pickPlotPlantAction({
  planted = false,
  hasPotato = false,
  soilKnown = false,
} = {}) {
  if (planted || !hasPotato) return null;
  return { kind: soilKnown ? "plant" : "plot-scan" };
}

export const ARRAY_RANGE = 3.4;

export function pickArrayAction({
  d = 99,
  gatherD = 99,
  cableFault = false,
  canRepairCable = false,
  wireKnown = false,
  canReplaceCell = false,
  health = 1,
} = {}) {
  if (d >= ARRAY_RANGE) return null;
  if (gatherD + 0.35 < d) return null;
  if (cableFault) {
    if (canRepairCable && wireKnown) return { kind: "repair-cable", d };
    if (canRepairCable) return { kind: "cable-scan", d };
    return { kind: "cable-diag", d };
  }
  if (canReplaceCell && health < 0.97) return { kind: "repair-array", d };
  return null;
}

export function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
