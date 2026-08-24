import { ORDERS } from "./data.js";
import { getLang } from "./i18n.js";

export function createCampaign() {
  return {
    index: 0,
    likes: 0,
    finished: false,
    deliveries: 0,
  };
}

export function currentOrder(campaign) {
  return ORDERS[campaign.index] || null;
}

export function orderText(order) {
  const lang = getLang();
  return {
    title: order.title[lang] || order.title.en,
    brief: order.brief[lang] || order.brief.en,
    log: order.log[lang] || order.log.en,
    from: order.log.from,
  };
}

export function spawnOrderCargo(world, order) {
  for (const s of order.spawn) {
    const exists = world.cargo.some(
      (c) => !c.taken && c.type === s.type && Math.hypot(c.mesh.position.x - s.x, c.mesh.position.z - s.z) < 1
    );
    if (!exists) world.spawnCargo(s.type, s.x, s.z);
  }
  world.stormTarget = order.storm ? 0.85 : 0.08;
}

export function completeOrder(campaign, delivered) {
  const order = currentOrder(campaign);
  if (!order) return { likes: 0 };
  const avg =
    delivered.reduce((s, c) => s + c.condition, 0) / Math.max(1, delivered.length);
  const likes = Math.round(80 + avg * 2.4);
  campaign.likes += likes;
  campaign.deliveries += 1;
  campaign.index += 1;
  if (campaign.index >= ORDERS.length) campaign.finished = true;
  return { likes, avg, order };
}
