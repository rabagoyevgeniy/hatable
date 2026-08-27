import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { lookRates, cameraLookXZ, clampPitch } from "../src/systems/orbit.js";
import { heightAt, rawHeight, stationPadHeight } from "../src/noise.js";
import { SPAWN, HAB_POS, HAB_HATCH, YARD_PADS } from "../src/data.js";
import { foundationMask, stationCoreMask } from "../src/systems/foundation.js";
import {
  AIRLOCK,
  BLOCKERS,
  FOOT_OFFSET,
  HAB_FLOOR_LIFT,
  HAB_INNER_R,
  HAB_WALL_R,
  LAB,
  MOBILE_TERRAIN_SEGS,
  PLAYER_RADIUS,
  TERRAIN_HALF,
  airlockRampT,
  emergencyUnground,
  groundYAt,
  habFloorY,
  habRadial,
  inAirlockCorridor,
  isInsideHabHull,
  isSheltered,
  meshHeightAt,
  meshVertexWorld,
  snapToGround,
  stepGrounded,
  terrainHeightAt,
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
must(html.includes("look-joy"), "right stick exists");
must(html.includes("look-cluster"), "actions sit with the look stick");
must(html.includes("primary-act"), "interact is the primary thumb button");

const css = readFileSync(resolve(root, "src/style.css"), "utf8");
must(css.includes("need-landscape"), "portrait lock class");
must(css.includes("#look-joy"), "right camera stick is styled");
must(css.includes("safe-area-inset-top"), "Dynamic Island inset");
must(css.includes("touch-action: none"), "sticks do not scroll the page");

const game = readFileSync(resolve(root, "src/game.js"), "utf8");
must(game.includes("syncPlayChrome"), "phone class and overlay follow resize/orientation");
must(game.includes("h > w ? 52 : 42"), "landscape mobile FOV leaves Mars in frame");
must(game.includes("15.4"), "exploration camera sits behind the astronaut");
must(game.includes("applyLookStick"), "right stick orbits the camera");
must(game.includes("tickStillSpatial"), "distiller hiss is spatial");
must(!game.includes("canvas.addEventListener(\"touchmove\""), "look is not a random screen drag");

const playerSrc = readFileSync(resolve(root, "src/player.js"), "utf8");
must(playerSrc.includes("snapToGround"), "player snaps to visual terrain");
must(playerSrc.includes("resolvePlayerXZ"), "player resolves Hab walls");
must(playerSrc.includes("facingYaw"), "character facing is split from camera yaw");
must(playerSrc.includes("if (moving && player.vel.lengthSq() > 0.12)"), "idle camera orbit does not spin the body");

/* Thumb-right looks to screen-right. At yaw=0 camera is on +Z; screen-right is +X. */
{
  const right = lookRates(1, 0);
  const left = lookRates(-1, 0);
  const up = lookRates(0, -1);
  const down = lookRates(0, 1);
  must(right.yawRate < 0, "thumb right decreases yaw");
  must(left.yawRate > 0, "thumb left increases yaw");
  let yaw = 0;
  yaw += right.yawRate * 0.35;
  const look = cameraLookXZ(yaw);
  must(look.x > 0.2, "after thumb-right the camera looks toward +X (screen right at spawn)");
  yaw = 0;
  yaw += left.yawRate * 0.35;
  must(cameraLookXZ(yaw).x < -0.2, "after thumb-left the camera looks toward −X (screen left)");
  must(up.pitchRate < 0, "thumb up lowers pitch (look skyward)");
  must(down.pitchRate > 0, "thumb down raises pitch (look toward the sand)");
  must(clampPitch(-9) === -0.22 && clampPitch(9) === 0.62, "pitch stays in orbit limits");
}

/* Forward relative to camera shows the astronaut's back (facing −Z when yaw=0). */
{
  const camYaw = 0;
  const forward = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
  const face = Math.atan2(forward.x, forward.z);
  must(Math.abs(Math.cos(face) + 1) < 1e-9, "forward run at spawn faces −Z, back to the camera");
}
must(!playerSrc.includes("Math.hypot(player.root.position.x - 0, player.root.position.z - 8) < 6.2"), "old 6.2 m Hab circle is gone");

const worldSrc = readFileSync(resolve(root, "src/world.js"), "utf8");
must(worldSrc.includes("terrainSegments()"), "mobile terrain matches collision grid");
must(!worldSrc.includes("isMobileView() ? 48 : 168"), "coarse 48-seg mobile mesh is gone");
must(worldSrc.includes("habBeacon"), "Hab has a night beacon");
must(worldSrc.includes("stillSteam"), "working still shows vapor");
must(!worldSrc.includes("packedYard"), "flat packedYard disc is not placed over the dunes");
must(!readFileSync(resolve(root, "src/gfx.js"), "utf8").includes("function packedYard"), "packedYard helper is gone");

const i18n = readFileSync(resolve(root, "src/i18n.js"), "utf8");
must(i18n.includes("LOAD ICE"), "ice load prompt is explicit");
must(i18n.includes("ЗАГРУЗИТЬ ЛЁД"), "ice load prompt is Russian");
must(i18n.includes("stillNeedIce"), "empty still asks for ice");

/* Three.js PlaneGeometry: iy=0 → worldZ = −half after rotateX(-π/2). */
{
  const v0 = meshVertexWorld(0, 0, segs);
  must(Math.abs(v0.z + TERRAIN_HALF) < 1e-9, "iy=0 vertex is −half, matching Three.js");
  const vMid = meshVertexWorld(segs / 2, segs / 2, segs);
  must(Math.abs(vMid.x) < 1e-6 && Math.abs(vMid.z) < 1e-6, "mesh center is world origin");
}

/* Mesh sample equals analytic height at vertices. */
{
  const v = meshVertexWorld(41, 37, segs);
  const meshY = meshHeightAt(v.x, v.z, segs, heightAt);
  must(Math.abs(meshY - heightAt(v.x, v.z)) < 1e-9, "mesh vertex height matches heightAt");
  must(Math.abs(terrainHeightAt(v.x, v.z, segs, heightAt) - meshY) < 1e-9, "terrainHeightAt is the render height");
}

/* Bilinear stays between the four corners. */
{
  const x = SPAWN.x + 2.35;
  const z = SPAWN.z - 1.1;
  const y = meshHeightAt(x, z, segs, heightAt);
  const cell = (TERRAIN_HALF * 2) / segs;
  const fx = (x + TERRAIN_HALF) / cell;
  const fy = (z + TERRAIN_HALF) / cell;
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
  must(Math.abs(pos.y - (gy + FOOT_OFFSET)) < 1e-9, "spawn Y is terrain + foot offset");
  must(pos.y >= gy - 1e-9, "spawn is not below terrain");
}

/* Emergency recovery if Y is forced underground. */
{
  const pos = { x: SPAWN.x, y: groundYAt(SPAWN.x, SPAWN.z, segs, heightAt) - 2.4, z: SPAWN.z };
  must(emergencyUnground(pos, segs, heightAt), "sink guard fires");
  must(Math.abs(pos.y - (groundYAt(pos.x, pos.z, segs, heightAt) + FOOT_OFFSET)) < 1e-9, "sink guard restores feet");
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

/* Crossing height cells after a rotate still sits on the mesh. */
{
  const pos = { x: SPAWN.x, y: 0, z: SPAWN.z };
  snapToGround(pos, segs, heightAt);
  for (let i = 0; i < 240; i++) stepGrounded(pos, 0.14, 0.04, segs, heightAt);
  const gy = groundYAt(pos.x, pos.z, segs, heightAt);
  must(pos.y >= gy - 1e-6, "chunk/cell crossing does not bury the feet");
}

/* Hab perimeter: walls block except the airlock. Start outside lab+hab. */
{
  let leaked = 0;
  const startR = Math.hypot(LAB.x - HAB_POS.x, LAB.z - HAB_POS.z) + LAB.r + 2.4;
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2;
    const pos = {
      x: HAB_POS.x + Math.sin(ang) * startR,
      y: 0,
      z: HAB_POS.z + Math.cos(ang) * startR,
    };
    snapToGround(pos, segs, heightAt);
    for (let s = 0; s < 120; s++) {
      stepGrounded(pos, Math.sin(ang) * -0.12, Math.cos(ang) * -0.12, segs, heightAt);
    }
    const door = inAirlockCorridor(pos.x, pos.z) || Math.abs(Math.atan2(pos.x - HAB_POS.x, pos.z - HAB_POS.z)) < 0.38;
    if (isInsideHabHull(pos.x, pos.z) && !door) leaked++;
  }
  must(leaked === 0, `perimeter walk entered hull besides the airlock (${leaked})`);
}

/* Enter only through the airlock, then leave the same way. */
{
  const pos = { x: HAB_HATCH.x, y: 0, z: HAB_HATCH.z + 2.4 };
  snapToGround(pos, segs, heightAt);
  must(!isInsideHabHull(pos.x, pos.z), "hatch approach starts outside");
  for (let i = 0; i < 200; i++) stepGrounded(pos, 0, -0.07, segs, heightAt);
  must(isSheltered(pos.x, pos.z), "airlock walk reaches shelter");
  must(isInsideHabHull(pos.x, pos.z), "airlock walk reaches hull interior");

  pos.x = HAB_POS.x;
  for (let i = 0; i < 240; i++) stepGrounded(pos, 0, 0.08, segs, heightAt);
  must(!isInsideHabHull(pos.x, pos.z), "exit through the airlock leaves the hull");
  must(pos.z >= AIRLOCK.maxZ - 0.4, "exit comes out the hatch, not a wall");

  const side = { x: HAB_POS.x + HAB_WALL_R + 2.4, y: 0, z: HAB_POS.z };
  snapToGround(side, segs, heightAt);
  for (let i = 0; i < 80; i++) stepGrounded(side, -0.1, 0, segs, heightAt);
  must(!isInsideHabHull(side.x, side.z), "side wall is not a door");
  must(habRadial(side.x, side.z) >= HAB_WALL_R - 0.05, "side approach stays on the exterior");
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

/* Hab living module connects to the lab through the tube, not the desert. */
{
  const pos = { x: HAB_POS.x, y: 0, z: HAB_POS.z };
  snapToGround(pos, segs, heightAt);
  for (let i = 0; i < 200; i++) stepGrounded(pos, -0.08, 0, segs, heightAt);
  must(isSheltered(pos.x, pos.z), "lab tube stays sheltered");
  must(pos.x < LAB.x + 1.5, "west walk from the Hab reaches the lab");
}

must(worldSrc.includes("habDeck"), "Hab sits on a raised deck over footings");
must(worldSrc.includes("HAB_FLOOR_LIFT"), "visual Hab deck uses the same lift as player floor");
must(worldSrc.includes("foundationMask"), "terrain mesh samples the station foundation");
must(!worldSrc.includes("CircleGeometry(32"), "no stamped circular yard overlay");

must(BLOCKERS.length >= 4, "locker and major furniture have collision");
must(existsSync(resolve(root, "src/systems/collision.js")), "collision module");
must(existsSync(resolve(root, "src/systems/foundation.js")), "foundation mask module");

/* Graded mission site: same heightAt for mesh, player, and pads. */
{
  const pad = stationPadHeight();
  must(Math.abs(heightAt(HAB_POS.x, HAB_POS.z) - pad) < 0.08, "Hab origin is graded to the pad");
  must(foundationMask(HAB_POS.x, HAB_POS.z) > 0.98, "Hab origin is inside the foundation core");
  must(foundationMask(HAB_HATCH.x, HAB_HATCH.z) > 0.95, "airlock mouth is on prepared ground");
  must(stationCoreMask(HAB_HATCH.x, HAB_HATCH.z) > 0.7, "airlock mouth is in the station core");
  must(foundationMask(LAB.x, LAB.z) > 0.9, "lab sits on the foundation");
  must(foundationMask(-14.6, 2.4) > 0.75, "greenhouse zone is graded");
  const still = YARD_PADS.find((p) => p.station === "still");
  must(still && foundationMask(still.x, still.z) > 0.85, "still pad is on prepared ground");
  must(Math.abs(heightAt(still.x, still.z) - pad) < 0.12, "still pad Y matches station grade");
  must(foundationMask(100, 100) < 1e-4, "far dunes are not flattened");
  must(Math.abs(heightAt(100, 100) - rawHeight(100, 100)) < 1e-9, "untouched terrain equals rawHeight");
}

/* Mesh bilinear agrees with heightAt at a vertex on the pad. */
{
  const v = meshVertexWorld(48, 49, segs);
  must(Math.abs(meshHeightAt(v.x, v.z, segs, heightAt) - heightAt(v.x, v.z)) < 1e-9, "pad vertex mesh Y is heightAt");
}

/* Player on the site stands on the same function as the mesh. */
{
  const pos = { x: HAB_HATCH.x, y: -40, z: HAB_HATCH.z + 2.6 };
  snapToGround(pos, segs, heightAt);
  const meshY = meshHeightAt(pos.x, pos.z, segs, heightAt);
  must(Math.abs(pos.y - (meshY + FOOT_OFFSET)) < 1e-9, "hatch approach feet use mesh height");
  const site = { x: 6.2, y: 0, z: 8 };
  snapToGround(site, segs, heightAt);
  must(Math.abs(site.y - (groundYAt(site.x, site.z, segs, heightAt) + FOOT_OFFSET)) < 1e-9, "yard feet match groundYAt");
}

/* Envelope blend has no cliff walking out from the Hab. */
{
  let cliff = 0;
  let prev = heightAt(HAB_POS.x, HAB_POS.z);
  for (let d = 0.5; d <= 42; d += 0.5) {
    const z = HAB_POS.z + d;
    const h = heightAt(HAB_POS.x, z);
    if (Math.abs(h - prev) > 0.55) cliff++;
    prev = h;
  }
  must(cliff === 0, `foundation falloff is a cliff (${cliff} steps)`);
}

/* Airlock is a ramp, not a vertical teleport. */
{
  must(HAB_FLOOR_LIFT > 0.15 && HAB_FLOOR_LIFT < 0.5, "Hab deck is a short step, not a tower");
  const mouth = groundYAt(0, AIRLOCK.maxZ, segs, heightAt);
  const door = groundYAt(0, AIRLOCK.minZ, segs, heightAt);
  const floor = habFloorY(heightAt);
  must(Math.abs(door - floor) < 0.04, "airlock inner end meets Hab floor");
  must(Math.abs(mouth - meshHeightAt(0, AIRLOCK.maxZ, segs, heightAt)) < 0.04, "airlock mouth meets graded sand");
  must(door > mouth + 0.08, "airlock rises onto the deck");
  must(airlockRampT(AIRLOCK.maxZ) < 0.02, "ramp starts at 0 at the hatch");
  must(airlockRampT(AIRLOCK.minZ) > 0.98, "ramp finishes at 1 at the Hab door");
  let prev = mouth;
  for (let z = AIRLOCK.maxZ; z >= AIRLOCK.minZ; z -= 0.2) {
    const y = groundYAt(0, z, segs, heightAt);
    must(y + 1e-4 >= prev - 0.01, "airlock ramp is monotonic inward");
    prev = y;
  }
}

if (fail.length) {
  console.error("PLAYABILITY FAIL");
  for (const f of fail) console.error(" -", f);
  process.exit(1);
}
console.log("playability ok — dual-stick, visual ground, station walls, airlock door");
