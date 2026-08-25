import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fail = [];

function must(cond, msg) {
  if (!cond) fail.push(msg);
}

const game = readFileSync(resolve(root, "src/game.js"), "utf8");
must(game.includes("const result = trySleep(player, world)"), "sleep must call trySleep");
must(game.includes("preloadRest()"), "far Meshy models load in background");
must(game.includes("btn-scan-touch"), "phone scan button wired");

const models = readFileSync(resolve(root, "src/models.js"), "utf8");
must(models.includes("import.meta.env.BASE_URL"), "GLB URLs must respect Vite base for GitHub Pages");

must(existsSync(resolve(root, "public/manifest.webmanifest")), "PWA manifest");
must(existsSync(resolve(root, "public/sw.js")), "service worker");
must(existsSync(resolve(root, "public/icons/icon-192.png")), "192 icon");
must(existsSync(resolve(root, "src/device.js")), "shared mobile detector");
must(existsSync(resolve(root, ".github/workflows/pages.yml")), "Pages workflow");
must(game.includes("NoToneMapping"), "phones skip ACES so the desert does not crush to black");
must(game.includes("failIfMajorPerformanceCaveat: false"), "iOS must not abort WebGL");

const gfx = readFileSync(resolve(root, "src/gfx.js"), "utf8");
must(gfx.includes("MeshLambertMaterial"), "phones use Lambert, not PBR");
must(gfx.includes("isMobileView"), "gfx reads phone flag without importing world");

const html = readFileSync(resolve(root, "index.html"), "utf8");
must(html.includes('rel="manifest"'), "html links manifest");
must(html.includes("menu-scrim"), "mobile menus close via scrim");

if (fail.length) {
  console.error(fail.map((m) => `FAIL ${m}`).join("\n"));
  process.exit(1);
}
console.log("smoke ok");
