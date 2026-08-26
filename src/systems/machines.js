/** Station faults and headless station state. Repair uses existing salvage, not XP. */

export const STILL_PUMP_FAIL = 56;

export function makeStation(type, x = 0, z = 0) {
  return {
    type,
    x,
    z,
    water: 0,
    fuel: 0,
    planted: false,
    grow: 0,
    moisture: type === "plot" ? 0.2 : 0,
    runtime: 0,
    fault: null,
    repaired: false,
    condition: 1,
  };
}

/** Same flags and station records as `placeStation`, without meshes. */
export function placeStationSim(world, type, x = 0, z = 0) {
  if (type === "seal") {
    world.habSealed = true;
    const st = makeStation("seal", 0, 8);
    world.stations.push(st);
    return st;
  }
  const st = makeStation(type, x, z);
  world.stations.push(st);
  if (type === "solar") world.powered = true;
  if (type === "radio" && !world.radio) world.radio = { listenS: 0 };
  return st;
}

/** Compressed still work for a slept Sol — same numbers as the live `advanceSol`. */
export function tickStillOnSleep(world) {
  for (const st of world.stations || []) {
    if (!stillCanRun(st, world)) continue;
    st.water += 5;
    st.fuel = Math.max(0, st.fuel - 10);
    st.runtime = (st.runtime || 0) + 40;
    if (!st.repaired && st.runtime >= STILL_PUMP_FAIL) st.fault = "pump";
    if (world.hab && !st.fault) world.hab.waterTank = Math.min(40, world.hab.waterTank + 2.4);
  }
}

export function stillCanRun(st, world) {
  return !!(st && st.type === "still" && st.fuel > 0 && !st.fault && world.hab?.gridOn);
}

export function tickStillMachine(st, dt, world) {
  if (!st || st.type !== "still") return;
  if (!stillCanRun(st, world)) return;
  st.fuel -= dt;
  st.runtime = (st.runtime || 0) + dt;
  st.water += dt * 0.045;
  if (!st.repaired && st.runtime >= STILL_PUMP_FAIL) st.fault = "pump";
}

export function repairStillPump(st) {
  if (!st) return;
  st.fault = null;
  st.repaired = true;
  st.condition = 1;
}

export function repairArrayCable(hab) {
  if (!hab) return;
  hab.cableFault = false;
  hab.cableStress = 0;
}
