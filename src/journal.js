import { GOALS } from "./data.js";
import { loc } from "./i18n.js";
import { count, isInsideHab } from "./player.js";

export function createJournal() {
  return { index: 0, finished: false, sols: 19 };
}

export function currentGoal(journal) {
  return GOALS[journal.index] || null;
}

export function goalText(goal) {
  return {
    title: loc(goal.title),
    brief: loc(goal.brief),
    from: goal.log.from,
    log: loc(goal.log),
    sol: goal.sol,
  };
}

export function checkProgress(journal, player, world) {
  if (journal.finished) return false;
  const goal = currentGoal(journal);
  if (!goal) return false;
  const atMav = Math.hypot(player.root.position.x - 196, player.root.position.z + 158) < 14;
  const done = {
    gather: player.gathered >= 3,
    hammer: player.tools.hammer,
    seal: world.habSealed,
    water: player.drank,
    farm: player.harvestedCrop,
    power: world.powered,
    contact: world.contacted,
    escape: world.contacted && atMav && count(player, "water") >= 1 && count(player, "potato") >= 1,
  };
  if (!done[goal.id]) return false;
  journal.index += 1;
  if (journal.index >= GOALS.length) journal.finished = true;
  return true;
}

export function atMav(player) {
  return Math.hypot(player.root.position.x - 196, player.root.position.z + 158) < 14;
}

export function maybeAdvanceEscape(journal, player, world) {
  return checkProgress(journal, player, world);
}

export { isInsideHab };
