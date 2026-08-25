/**
 * Generate a humanoid Watney, auto-rig it, and download walk/idle/run GLBs.
 * Never logs the API key.
 *
 *   MESHY_API_KEY=... npm run meshy:motion
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.MESHY_API_KEY;
const T2D = "https://api.meshy.ai/openapi/v2/text-to-3d";
const RIG = "https://api.meshy.ai/openapi/v1/rigging";
const ANIM = "https://api.meshy.ai/openapi/v1/animations";

if (!KEY) {
  console.error("MESHY_API_KEY is missing.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

function errText(json) {
  if (!json || typeof json !== "object") return "unknown error";
  return json.message || json.task_error?.message || json.status || "request failed";
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${errText(json)}`);
  const id = json.result || json.id;
  if (!id) throw new Error("no task id");
  return id;
}

async function poll(url, id) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    const res = await fetch(`${url}/${id}`, { headers });
    const task = await res.json().catch(() => ({}));
    const status = task.status || "UNKNOWN";
    console.log(`  ${id.slice(0, 8)} ${status} ${task.progress ?? 0}%`);
    if (status === "SUCCEEDED") return task;
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`${status}: ${errText(task)}`);
    }
  }
  throw new Error("timed out");
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`saved ${dest.replace(ROOT + "/", "")} (${buf.length} bytes)`);
}

console.log("== watney preview ==");
const previewId = await post(T2D, {
  mode: "preview",
  prompt:
    "Game-ready low-poly astronaut in a dusty orange NASA EVA suit, gold visor helmet, white life-support backpack, standing in a clear A-pose with arms out, full body, realistic PBR, isolated character, no ground plane, no extra limbs",
  art_style: "realistic",
  should_remesh: true,
  target_polycount: 18000,
  target_formats: ["glb"],
  pose_mode: "a-pose",
  negative_prompt: "low quality, extra limbs, missing helmet, sitting, weapon, base platform, crowd",
});
await poll(T2D, previewId);

console.log("== watney refine ==");
const refineId = await post(T2D, {
  mode: "refine",
  preview_task_id: previewId,
  target_formats: ["glb"],
  auto_size: true,
});
const refined = await poll(T2D, refineId);
const stillUrl = refined.model_urls?.glb;
if (stillUrl) await download(stillUrl, resolve(ROOT, "public/models/watney.glb"));

console.log("== rig ==");
const rigId = await post(RIG, {
  input_task_id: refineId,
  height_meters: 1.75,
  generate_basic_animations: true,
});
const rigged = await poll(RIG, rigId);
const result = rigged.result || {};
const basic = result.basic_animations || {};
if (result.rigged_character_glb_url) {
  await download(result.rigged_character_glb_url, resolve(ROOT, "public/models/watney-rig.glb"));
}
if (basic.walking_glb_url) {
  await download(basic.walking_glb_url, resolve(ROOT, "public/models/watney-walk.glb"));
}
if (basic.running_glb_url) {
  await download(basic.running_glb_url, resolve(ROOT, "public/models/watney-run.glb"));
}

async function animate(actionId, dest) {
  console.log(`== animation ${actionId} ==`);
  const id = await post(ANIM, { rig_task_id: rigId, action_id: actionId });
  const task = await poll(ANIM, id);
  const url = task.result?.animation_glb_url || task.animation_glb_url;
  if (!url) throw new Error(`no animation url for ${actionId}`);
  await download(url, dest);
}

await animate(0, resolve(ROOT, "public/models/watney-idle.glb"));
console.log("Done. Watney walk/idle/run GLBs are ready.");
