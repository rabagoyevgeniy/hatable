import { heightAt } from "../noise.js";
import { goalsDone, advanceJournal } from "./goals.js";
import { groundYAt, segsForMobile } from "./collision.js";
import { isMobileView } from "../device.js";

const KEY = "stranded-mars-save-v1";
export const SAVE_VERSION = 1;

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function collectSave(player, world, journal) {
  return {
    v: SAVE_VERSION,
    at: Date.now(),
    player: {
      x: player.root.position.x,
      z: player.root.position.z,
      yaw: player.yaw,
      inv: { ...player.inv },
      tools: { ...player.tools },
      oxygen: player.oxygen,
      hunger: player.hunger,
      thirst: player.thirst,
      warmth: player.warmth,
      gathered: player.gathered,
      drank: player.drank,
      harvestedCrop: player.harvestedCrop,
      enteredHab: player.enteredHab,
      usedConsole: player.usedConsole,
      sawStillYard: player.sawStillYard,
    },
    world: {
      clock: world.clock,
      storm: world.storm,
      stormTarget: world.stormTarget,
      playTime: world.playTime,
      habSealed: world.habSealed,
      powered: world.powered,
      contacted: world.contacted,
      radio: { listenS: world.radio?.listenS || 0 },
      hab: { ...world.hab, cableSnapEvent: false, earthHeardEvent: false },
      weather: world.weather ? { ...world.weather } : null,
      science: world.science ? { known: { ...world.science.known } } : { known: {} },
      locker: { ...world.locker.storage },
      nodes: world.nodes.map((n) => ({
        type: n.type,
        x: n.mesh.position.x,
        z: n.mesh.position.z,
        taken: !!n.taken,
        needHammer: !!n.needHammer,
        starter: !!n.starter,
        amount: n.amount,
      })),
      stations: world.stations.map((s) => ({
        type: s.type,
        x: s.x,
        z: s.z,
        water: s.water,
        fuel: s.fuel,
        planted: s.planted,
        grow: s.grow,
        moisture: s.moisture,
        runtime: s.runtime,
        fault: s.fault,
        repaired: s.repaired,
      })),
    },
    journal: { index: journal.index, finished: journal.finished, sols: journal.sols },
  };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(data, { player, world, journal, placeStation, updatePlotVisual }) {
  if (!data) return;
  const p = data.player;
  player.root.position.set(p.x, groundYAt(p.x, p.z, segsForMobile(isMobileView()), heightAt), p.z);
  player.yaw = p.yaw || 0;
  player.inv = { ...player.inv, ...p.inv };
  player.tools = { ...player.tools, ...p.tools };
  player.oxygen = p.oxygen;
  player.hunger = p.hunger;
  player.thirst = p.thirst;
  player.warmth = p.warmth;
  player.gathered = p.gathered || 0;
  player.drank = !!p.drank;
  player.harvestedCrop = !!p.harvestedCrop;
  player.enteredHab = !!p.enteredHab;
  player.usedConsole = !!p.usedConsole;
  player.sawStillYard = !!p.sawStillYard;

  const w = data.world;
  world.clock = w.clock;
  world.storm = w.storm || 0;
  world.stormTarget = w.stormTarget || 0.05;
  world.playTime = w.playTime || 0;
  world.habSealed = !!w.habSealed;
  world.powered = !!w.powered;
  world.contacted = !!w.contacted;
  world.radio = { listenS: w.radio?.listenS || 0 };
  if (w.hab) Object.assign(world.hab, w.hab);
  if (w.weather) Object.assign(world.weather, w.weather);
  if (w.science?.known) world.science.known = { ...w.science.known };
  if (w.locker) world.locker.storage = { ...world.locker.storage, ...w.locker };

  for (const snap of w.nodes || []) {
    const node = world.nodes.find(
      (n) => n.type === snap.type && Math.hypot(n.mesh.position.x - snap.x, n.mesh.position.z - snap.z) < 0.8
    );
    if (node && snap.taken) {
      node.taken = true;
      node.mesh.visible = false;
      if (node.mesh.parent) node.mesh.parent.remove(node.mesh);
    }
  }
  for (const s of w.stations || []) {
    if (s.type === "seal" && world.stations.some((st) => st.type === "seal")) continue;
    placeStation(world, s.type, s.x, s.z);
    const st = world.stations[world.stations.length - 1];
    if (!st) continue;
    st.water = s.water || 0;
    st.fuel = s.fuel || 0;
    st.planted = !!s.planted;
    st.grow = s.grow || 0;
    st.moisture = s.moisture ?? (st.planted ? 0.4 : 0.2);
    st.runtime = s.runtime || 0;
    st.fault = s.fault || null;
    st.repaired = !!s.repaired;
    if (st.type === "plot") updatePlotVisual(st);
  }

  journal.index = data.journal?.index || 0;
  journal.finished = !!data.journal?.finished;
  journal.sols = data.journal?.sols || 19;
  advanceJournal(journal, goalsDone(player, world));
}
