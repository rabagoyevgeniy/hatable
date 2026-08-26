import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { heightAt } from "../src/noise.js";
import { SPAWN, HAB_POS, HAB_HATCH } from "../src/data.js";
import {
  AIRLOCK,
  BLOCKERS,
  HAB_INNER_R,
  HAB_WALL_R,
  MOBILE_TERRAIN_SEGS,
  PLAYER_RADIUS,
  emergencyUnground,
  groundYAt,
  habRadial,
  inAirlockCorridor,
  isInsideHabHull,
  isSheltered,
  meshHeightAt,
  meshVertexWorld,
  snapToGround,
  stepGrounded,
} from "../src/systems/collision.js";

const root = resolve(import.meta.dirname, "..");
const fail = [];
const segs = MOBILE_TERRAIN_SEGS;

function must(cond, msg) {
  if (!cond) fail.push(msg);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
must(html.includes("rotate-phone"), "portrait overlay exists");
must(html.includes("Поверните телефон"), "portrait copy is Russian");
must(html.includes("hint-dismiss"), "quest hint can collapse");
must(html.includes("viewport-fit=cover"), "iPhone safe-area viewport");

const css = readFileSync(resolve(root, "src/style.css"), "utf8");
must(css.includes("need-landscape"), "portrait lock class");
must(css.includes("grid-template-columns: 1fr 1fr"), "landscape actions are a pad, not a wall");
must(css.includes("safe-area-inset-top"), "Dynamic Island inset");

const game = readFileSync(resolve(root, "src/game.js"), "utf8");
must(game.includes("needsLandscape()"), "portrait pauses gameplay");
must(game.includes("camera.fov = mobile ? (h > w ? 58 : 46)"), "landscape mobile FOV");
must(game.includes("9.2"), "landscape camera is pulled back");

const playerSrc = readFileSync(resolve(root, "src/player.js"), "utf8");
must(playerSrc.includes("snapToGround"), "player snaps to visual terrain");
must(playerSrc.includes("resolvePlayerXZ"), "player resolves Hab walls");
must(!playerSrc.includes("Math.hypot(player.root.position.x - 0, player.root.position.z - 8) < 6.2"), "old 6.2 m Hab circle is gone");

const worldSrc = readFileSync(resolve(root, "src/world.js"), "utf8");
must(worldSrc.includes("terrainSegments()"), "mobile terrain matches collision grid");
must(!worldSrc.includes("isMobileView() ? 48 : 168"), "coarse 48-seg mobile mesh is gone");

/* Mesh sample equals analytic height at vertices. */
{
  const v = meshVertexWorld(41, 37, segs);
  const meshY = meshHeightAt(v.x, v.z, segs, heightAt);
  must(Math.abs(meshY - heightAt(v.x, v.z)) < 1e-9, "mesh vertex height matches heightAt");
}

/* Bilinear stays between the four corners. */
{
  const x = SPAWN.x + 2.35;
  const z = SPAWN.z - 1.1;
  const y = meshHeightAt(x, z, segs, heightAt);
  const half = 620 / 2;
  const cell = 620 / segs;
  const fx = (x + half) / cell;
  const fy = (half - z) / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const corners = [
    meshVertexWorld(ix, iy, segs),
    meshVertexWorld(ix + 1, iy, segs),
    meshVertexWorld(ix, iy + 1, segs),
    meshVertexWorld(ix + 1, iy + 1, segs),
  ].map((p) => heightAt(p.x, p.z));
  const lo = Math.min(...corners) - 1e-6;
  const hi = Math.max(...corners) + 1e-6;
  must(y >= lo && y <= hi, "bilinear mesh height stays in the visual cell");
}

/* Spawn sits on the visual mesh, not under it. */
{
  const pos = { x: SPAWN.x, y: -99, z: SPAWN.z };
  snapToGround(pos, segs, heightAt);
  const gy = groundYAt(SPAWN.x, SPAWN.z, segs, heightAt);
  must(Math.abs(pos.y - gy) < 1e-9, "spawn Y equals visual ground");
  must(pos.y >= gy - 0.001, "spawn is not below terrain");
}

/* Emergency recovery if Y is forced underground. */
{
  const pos = { x: SPAWN.x, y: groundYAt(SPAWN.x, SPAWN.z, segs, heightAt) - 2.4, z: SPAWN.z };
  must(emergencyUnground(pos, segs, heightAt), "sink guard fires");
  must(Math.abs(pos.y - groundYAt(pos.x, pos.z, segs, heightAt)) < 1e-9, "sink guard restores feet");
}

/* Long walk on uneven ground never sinks. */
{
  const pos = { x: SPAWN.x, y: 0, z: SPAWN.z };
  snapToGround(pos, segs, heightAt);
  let sunk = 0;
  let maxDrop = 0;
  for (let i = 0; i < 9000; i++) {
    const a = i * 0.045;
    const step = 0.085;
    const gx = Math.cos(a) * step;
    const gz = Math.sin(a * 0.37) * step;
    stepGrounded(pos, gx, gz, segs, heightAt);
    const gy = groundYAt(pos.x, pos.z, segs, heightAt);
    const drop = gy - pos.y;
    if (drop > 0.05) sunk++;
    if (drop > maxDrop) maxDrop = drop;
  }
  must(sunk === 0, `walk sank below visual terrain (${sunk} frames, max ${maxDrop.toFixed(3)} m)`);
}

/* Hab perimeter: walls block except the airlock. */
{
  let leaked = 0;
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2;
    const pos = {
      x: HAB_POS.x + Math.sin(ang) * 6.1,
      y: 0,
      z: HAB_POS.z + Math.cos(ang) * 6.1,
    };
    snapToGround(pos, segs, heightAt);
    for (let s = 0; s < 40; s++) {
      stepGrounded(pos, Math.sin(ang) * -0.12, Math.cos(ang) * -0.12, segs, heightAt);
    }
    const door = inAirlockCorridor(pos.x, pos.z) || Math.abs(Math.atan2(pos.x - HAB_POS.x, pos.z - HAB_POS.z)) < 0.32;
    if (isInsideHabHull(pos.x, pos.z) && !door) leaked++;
  }
  must(leaked === 0, `perimeter walk entered hull besides the airlock (${leaked})`);
}

/* Enter only through the airlock, then leave the same way. */
{
  const pos = { x: HAB_HATCH.x, y: 0, z: HAB_HATCH.z + 2.2 };
  snapToGround(pos, segs, heightAt);
  must(!isInsideHabHull(pos.x, pos.z), "hatch approach starts outside");
  for (let i = 0; i < 160; i++) stepGrounded(pos, 0, -0.07, segs, heightAt);
  must(isSheltered(pos.x, pos.z), "airlock walk reaches shelter");
  must(isInsideHabHull(pos.x, pos.z), "airlock walk reaches hull interior");

  const side = { x: HAB_POS.x + 6.2, y: 0, z: HAB_POS.z };
  snapToGround(side, segs, heightAt);
  for (let i = 0; i < 80; i++) stepGrounded(side, -0.1, 0, segs, heightAt);
  must(!isInsideHabHull(side.x, side.z), "side wall is not a door");
  must(habRadial(side.x, side.z) >= HAB_WALL_R - 0.05, "side approach stays on the exterior");

  for (let i = 0; i < 180; i++) stepGrounded(pos, 0, 0.08, segs, heightAt);
  must(!isInsideHabHull(pos.x, pos.z), "exit through the airlock leaves the hull");
  must(pos.z >= AIRLOCK.maxZ - 0.4, "exit comes out the hatch, not a wall");
}

/* Interior back wall holds. */
{
  const pos = { x: HAB_POS.x, y: 0, z: HAB_POS.z };
  snapToGround(pos, segs, heightAt);
  must(isInsideHabHull(pos.x, pos.z), "center starts inside");
  for (let i = 0; i < 80; i++) stepGrounded(pos, 0, -0.1, segs, heightAt);
  must(isInsideHabHull(pos.x, pos.z), "back wall keeps the player inside");
  must(pos.z > HAB_POS.z - HAB_INNER_R + PLAYER_RADIUS * 0.5, "back wall does not eject into the desert");
}

must(BLOCKERS.length >= 4, "locker and major furniture have collision");
must(existsSync(resolve(root, "src/systems/collision.js")), "collision module");

if (fail.length) {
  console.error("PLAYABILITY FAIL");
  for (const f of fail) console.error(" -", f);
  process.exit(1);
}
console.log("playability ok — landscape overlay, visual ground, Hab walls, airlock door");
