/**
 * Offline Meshy (Mesh AI) pipeline.
 *
 * Put MESHY_API_KEY in the Cloud Agent environment secrets — never in git,
 * never in chat. Then:
 *
 *   npm run meshy
 *
 * Generates textured GLBs into public/models/. The game loads them if present
 * and falls back to procedural meshes if a file is missing.
 *
 * Docs: https://docs.meshy.ai/en/api/text-to-3d
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.meshy.ai/openapi/v2/text-to-3d";
const KEY = process.env.MESHY_API_KEY;

const ASSETS = [
  {
    id: "still",
    file: "public/models/still.glb",
    prompt:
      "Game-ready low-poly NASA water still on Mars: rusted steel drum, copper pipe, glass condensation globe on top, dusty, realistic PBR, no people, isolated prop, A-pose not needed",
  },
  {
    id: "plot",
    file: "public/models/plot.glb",
    prompt:
      "Game-ready low-poly Mars farm plot: wooden crate filled with red regolith soil and small green potato plants, dusty, realistic PBR, isolated prop",
  },
  {
    id: "solar",
    file: "public/models/solar.glb",
    prompt:
      "Game-ready low-poly NASA solar panel array on a metal stand, dark photovoltaic cells, dusty Mars dirt on frame, realistic PBR, isolated prop",
  },
  {
    id: "radio",
    file: "public/models/radio.glb",
    prompt:
      "Game-ready low-poly improvised radio transmitter made from Pathfinder parts, gold foil, antenna dish, dusty Mars, realistic PBR, isolated prop",
  },
  {
    id: "rover",
    file: "public/models/rover.glb",
    prompt:
      "Game-ready low-poly wrecked NASA Mars rover, six wheels, mast cam, dusty, damaged solar deck, realistic PBR, isolated vehicle",
  },
  {
    id: "pathfinder",
    file: "public/models/pathfinder.glb",
    prompt:
      "Game-ready low-poly NASA Mars Pathfinder lander with tetrahedral gold-foil petals and tiny Sojourner rover, dusty, realistic PBR, isolated prop",
  },
  {
    id: "mav",
    file: "public/models/mav.glb",
    prompt:
      "Game-ready low-poly NASA Mars Ascent Vehicle rocket on landing legs, white hull with rust dust, engine bell, realistic PBR, isolated vehicle",
  },
  {
    id: "watney",
    file: "public/models/watney.glb",
    prompt:
      "Game-ready low-poly astronaut in dusty orange NASA EVA suit, gold visor, white backpack life support, standing A-pose, realistic PBR, no base",
    pose: "a-pose",
  },
];

if (!KEY) {
  console.error("MESHY_API_KEY is missing.");
  console.error("Add it as a Cloud Agent environment secret, then re-run `npm run meshy`.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function post(body) {
  const res = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meshy ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.result || json.id;
}

async function poll(id) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    const res = await fetch(`${API}/${id}`, { headers });
    const task = await res.json();
    const status = task.status;
    process.stdout.write(`  ${id.slice(0, 8)}… ${status} ${task.progress ?? 0}%\n`);
    if (status === "SUCCEEDED") return task;
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`Task ${id} ${status}: ${task.task_error?.message || ""}`);
    }
  }
  throw new Error(`Task ${id} timed out`);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const list = only.length ? ASSETS.filter((a) => only.includes(a.id)) : ASSETS;

for (const asset of list) {
  console.log(`\n== ${asset.id} ==`);
  const previewId = await post({
    mode: "preview",
    prompt: asset.prompt,
    art_style: "realistic",
    should_remesh: true,
    target_polycount: 18000,
    target_formats: ["glb"],
    negative_prompt: "low quality, blurry, extra limbs, watermark, base platform",
    ...(asset.pose ? { pose_mode: asset.pose } : {}),
  });
  await poll(previewId);
  const refineId = await post({
    mode: "refine",
    preview_task_id: previewId,
    target_formats: ["glb"],
    auto_size: true,
  });
  const done = await poll(refineId);
  const glb = done.model_urls?.glb;
  if (!glb) throw new Error(`No GLB url for ${asset.id}`);
  const dest = resolve(ROOT, asset.file);
  await download(glb, dest);
  console.log(`saved ${asset.file}`);
}

console.log("\nDone. Restart the game — models load from public/models/ if present.");
