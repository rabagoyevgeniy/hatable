/** Journal catch-up — no Three.js. Systems complete goals; the card follows. */

import { GOALS } from "../data.js";
import { hasMavCargo } from "./survival.js";

export const GOAL_IDS = GOALS.map((g) => g.id);

export function playerAtMav(player) {
  const x = player.root?.position?.x ?? player.x ?? 0;
  const z = player.root?.position?.z ?? player.z ?? 0;
  return Math.hypot(x - 196, z + 158) < 14;
}

export function goalsDone(player, world) {
  return {
    gather: (player.gathered || 0) >= 3 || !!world.habSealed,
    hammer: !!player.tools?.hammer,
    seal: !!world.habSealed,
    water: !!player.drank,
    farm: !!player.harvestedCrop,
    power: !!world.powered,
    contact: !!world.contacted,
    escape: !!(world.contacted && playerAtMav(player) && hasMavCargo(player)),
  };
}

export function advanceJournal(journal, done) {
  if (!journal || journal.finished) return 0;
  let n = 0;
  while (journal.index < GOAL_IDS.length) {
    const id = GOAL_IDS[journal.index];
    if (!done[id]) break;
    journal.index += 1;
    n += 1;
    if (journal.index >= GOAL_IDS.length) {
      journal.finished = true;
      break;
    }
  }
  return n;
}
