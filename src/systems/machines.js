/** Station faults. Repair uses existing salvage, not XP. */

export const STILL_PUMP_FAIL = 56;

export function stillCanRun(st, world) {
  return !!(st && st.type === "still" && st.fuel > 0 && !st.fault && world.hab?.gridOn);
}

export function tickStillMachine(st, dt, world) {
  if (!st || st.type !== "still") return;
  if (!stillCanRun(st, world)) return;
  const iceBonus = world.science?.known?.ice ? 1.12 : 1;
  st.fuel -= dt;
  st.runtime = (st.runtime || 0) + dt;
  st.water += dt * 0.045 * iceBonus;
  if (!st.repaired && st.runtime >= STILL_PUMP_FAIL) st.fault = "pump";
}

export function repairStillPump(st) {
  if (!st) return;
  st.fault = null;
  st.repaired = true;
  st.condition = 1;
}
