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
must(existsSync(resolve(root, ".github/workflows/pages.yml")), "Pages workflow");

const html = readFileSync(resolve(root, "index.html"), "utf8");
must(html.includes('rel="manifest"'), "html links manifest");
must(html.includes("apple-mobile-web-app-capable"), "iOS web app meta");

if (fail.length) {
  console.error(fail.map((m) => `FAIL ${m}`).join("\n"));
  process.exit(1);
}
console.log("smoke ok");
