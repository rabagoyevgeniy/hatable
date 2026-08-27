import { GOALS } from "./data.js";
import { loc } from "./i18n.js";
import { goalsDone, advanceJournal, playerAtMav } from "./systems/goals.js";

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
  return advanceJournal(journal, goalsDone(player, world)) > 0;
}

export function atMav(player) {
  return playerAtMav(player);
}

export function maybeAdvanceEscape(journal, player, world) {
  return checkProgress(journal, player, world);
}
