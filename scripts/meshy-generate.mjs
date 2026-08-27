/**
 * Offline Meshy pipeline. Never logs the API key.
 *
 *   MESHY_API_KEY must be in the environment (Cloud Agent secret).
 *   npm run meshy
 *   npm run meshy -- rover mav
 *
 * Default set is props/vehicles only. The walking astronaut stays procedural
 * so the walk cycle keeps named arms and legs.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.meshy.ai/openapi/v2/text-to-3d";
const KEY = process.env.MESHY_API_KEY;
const CONCURRENCY = 2;

const ASSETS = [
  {
    id: "still",
    file: "public/models/still.glb",
    prompt:
      "Game-ready low-poly NASA water still on Mars: rusted steel drum, copper pipe, glass condensation globe on top, dusty, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "plot",
    file: "public/models/plot.glb",
    prompt:
      "Game-ready low-poly Mars farm plot: wooden crate filled with red regolith soil and small green potato plants, dusty, realistic PBR, isolated prop, no people",
  },
  {
    id: "solar",
    file: "public/models/solar.glb",
    prompt:
      "Game-ready low-poly NASA solar panel array on a metal stand, dark photovoltaic cells, dusty Mars dirt on frame, realistic PBR, isolated prop, no people",
  },
  {
    id: "radio",
    file: "public/models/radio.glb",
    prompt:
      "Game-ready low-poly improvised radio transmitter from Pathfinder parts, gold foil, antenna dish, dusty Mars, realistic PBR, isolated prop, no people",
  },
  {
    id: "rover",
    file: "public/models/rover.glb",
    prompt:
      "Game-ready low-poly wrecked NASA Mars rover, six wheels, mast camera, dusty, damaged solar deck, realistic PBR, isolated vehicle, no people, no ground plane",
  },
  {
    id: "pathfinder",
    file: "public/models/pathfinder.glb",
    prompt:
      "Game-ready low-poly NASA Mars Pathfinder lander with tetrahedral gold-foil petals and tiny Sojourner rover, dusty, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "mav",
    file: "public/models/mav.glb",
    prompt:
      "Game-ready low-poly NASA Mars Ascent Vehicle rocket on landing legs, white hull with rust dust, engine bell, realistic PBR, isolated vehicle, no people, no ground plane",
  },
  {
    id: "ice",
    file: "public/models/ice.glb",
    prompt:
      "Game-ready low-poly chunk of translucent blue-white water ice sitting on Mars, dusty, crystalline, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "scrap",
    file: "public/models/scrap.glb",
    prompt:
      "Game-ready low-poly twisted NASA aluminum wreckage pile, torn habitat skin and struts, dusty Mars rust, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "rock",
    file: "public/models/rock.glb",
    prompt:
      "Game-ready low-poly Mars basalt rock, rust-red and dark, dusty, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "potato",
    file: "public/models/potato.glb",
    prompt:
      "Game-ready low-poly russet potato with eyes and dirt, realistic PBR, isolated food prop, no plate, no people",
  },
  {
    id: "fabric",
    file: "public/models/fabric.glb",
    prompt:
      "Game-ready low-poly folded dirty beige canvas tarp, NASA habitat cloth, dusty, realistic PBR, isolated prop, no people",
  },
  {
    id: "tape",
    file: "public/models/tape.glb",
    prompt:
      "Game-ready low-poly roll of silver duct tape, used, dusty, realistic PBR, isolated prop, no people",
  },
  {
    id: "hydrazine",
    file: "public/models/hydrazine.glb",
    prompt:
      "Game-ready low-poly green NASA hydrazine fuel cylinder tank with valve cap, dusty Mars, realistic PBR, isolated prop, no people",
  },
  {
    id: "locker",
    file: "public/models/locker.glb",
    prompt:
      "Game-ready low-poly white NASA Mars habitat storage locker cabinet with amber lamp, dusty, realistic PBR, isolated furniture, no people, no ground plane",
  },
  {
    id: "bunk",
    file: "public/models/bunk.glb",
    prompt:
      "Game-ready low-poly compact NASA habitat sleeping bunk with tan blanket and pillow, dusty, realistic PBR, isolated furniture, no people, no ground plane",
  },
  {
    id: "hammer",
    file: "public/models/hammer.glb",
    prompt:
      "Game-ready low-poly crude scrap-metal hammer with wooden handle, dusty, realistic PBR, isolated tool, no people",
  },
  {
    id: "soil",
    file: "public/models/soil.glb",
    prompt:
      "Game-ready low-poly pile of red Mars regolith soil, dusty, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "crate",
    file: "public/models/crate.glb",
    prompt:
      "Game-ready low-poly open NASA supply crate with metal edges, dusty beige, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "wire",
    file: "public/models/wire.glb",
    prompt:
      "Game-ready low-poly coil of orange copper electrical wire, dusty Mars, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "comms",
    file: "public/models/comms.glb",
    prompt:
      "Game-ready low-poly gold NASA Pathfinder communications circuit board with chips and antenna connector, dusty, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "solarcell",
    file: "public/models/solarcell.glb",
    prompt:
      "Game-ready low-poly single dusty NASA photovoltaic solar cell panel fragment, dark blue cells, metal frame, realistic PBR, isolated prop, no people, no ground plane",
  },
  {
    id: "desk",
    file: "public/models/desk.glb",
    prompt:
      "Game-ready low-poly compact NASA Mars habitat work desk with a rugged laptop, dusty, realistic PBR, isolated furniture, no people, no ground plane",
  },
  {
    id: "farm",
    file: "public/models/farm.glb",
    prompt:
      "Game-ready low-poly collapsed NASA greenhouse hoop tunnel on Mars, torn plastic sheeting, metal arcs, rows of red soil, dusty, realistic PBR, isolated structure, no people, no ground plane",
  },
];

if (!KEY) {
  console.error("MESHY_API_KEY is missing. Add the Cloud Agent secret, do not paste the key in chat.");
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

async function post(body) {
  const res = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meshy ${res.status}: ${errText(json)}`);
  const id = json.result || json.id;
  if (!id) throw new Error("Meshy returned no task id");
  return id;
}

async function poll(id) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    const res = await fetch(`${API}/${id}`, { headers });
    const task = await res.json().catch(() => ({}));
    const status = task.status || "UNKNOWN";
    console.log(`  ${id.slice(0, 8)} ${status} ${task.progress ?? 0}%`);
    if (status === "SUCCEEDED") return task;
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`Task ${status}: ${errText(task)}`);
    }
  }
  throw new Error("Task timed out");
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function generate(asset, force) {
  const dest = resolve(ROOT, asset.file);
  if (!force) {
    try {
      await access(dest);
      console.log(`\n== ${asset.id} == skip (already on disk)`);
      return;
    } catch {
      /* generate */
    }
  }
  console.log(`\n== ${asset.id} ==`);
  const previewId = await post({
    mode: "preview",
    prompt: asset.prompt,
    art_style: "realistic",
    should_remesh: true,
    target_polycount: 16000,
    target_formats: ["glb"],
    negative_prompt: "low quality, blurry, extra limbs, watermark, base platform, people",
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
  if (!glb) throw new Error(`No GLB for ${asset.id}`);
  await download(glb, resolve(ROOT, asset.file));
  console.log(`saved ${asset.file}`);
}

async function pool(items, n, fn) {
  const q = [...items];
  const workers = Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) {
      const item = q.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const force = process.argv.includes("--force");
const list = only.length ? ASSETS.filter((a) => only.includes(a.id)) : ASSETS;
if (!list.length) {
  console.error("No matching assets.");
  process.exit(1);
}

await pool(list, CONCURRENCY, (asset) => generate(asset, force));
console.log("\nDone. GLBs are in public/models/. The key can be deleted from secrets now.");
