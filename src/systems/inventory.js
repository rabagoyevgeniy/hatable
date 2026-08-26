/** Pocket math — no Three.js. */

import { SURVIVAL } from "../data.js";

export function count(player, id) {
  return player.inv[id] || 0;
}

export function totalItems(player) {
  return Object.values(player.inv).reduce((s, n) => s + n, 0);
}

export function addItem(player, id, n = 1) {
  if (totalItems(player) + n > SURVIVAL.pocketMax) return false;
  player.inv[id] = (player.inv[id] || 0) + n;
  player.gathered = (player.gathered || 0) + n;
  return true;
}

export function transfer(fromInv, toInv, id, n = 1, cap = Infinity) {
  if ((fromInv[id] || 0) < n) return false;
  const toTotal = Object.values(toInv).reduce((s, v) => s + v, 0);
  if (toTotal + n > cap) return false;
  fromInv[id] -= n;
  toInv[id] = (toInv[id] || 0) + n;
  return true;
}

export function takeItems(player, need) {
  for (const [id, n] of Object.entries(need)) {
    if (count(player, id) < n) return false;
  }
  for (const [id, n] of Object.entries(need)) player.inv[id] -= n;
  return true;
}

export function canAfford(player, need) {
  return Object.entries(need).every(([id, n]) => count(player, id) >= n);
}
