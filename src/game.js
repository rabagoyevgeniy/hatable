import * as THREE from "three";
import { applyDom, toggleLang, t, loc } from "./i18n.js";
import { startAudio, setAmbience, pickupTone, deliverTone, sleepTone, tickStill } from "./audio.js";
import { RECIPES, SURVIVAL } from "./data.js";
import { createWorld, updateWorld, placeStation, resolvePlacement, setGhost, spawnNode, updatePlotVisual } from "./world.js";
import {
  createPlayer,
  updatePlayer,
  addItem,
  takeItems,
  canAfford,
  consumeItem,
  count,
  transfer,
  trySleep,
  attachHammer,
  pocketSlots,
} from "./player.js";
import { createJournal, currentGoal, goalText, checkProgress } from "./journal.js";
import { heightAt } from "./noise.js";
import { preloadModels } from "./models.js";
import { bakeEnvironment } from "./gfx.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  bindUi,
  showHud,
  updateHud,
  findInteract,
  pushLog,
  toast,
  showEnd,
  toggleCraft,
  toggleInv,
  closeMenus,
  menusOpen,
  renderCraft,
  toggleStorage,
  storageOpen,
  renderStorage,
  renderInv,
} from "./ui.js";

export async function boot() {
  applyDom();

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(12.5, 6.8, 31.5);

  await preloadModels();
  const world = createWorld(scene);
  const player = createPlayer(scene);
  const journal = createJournal();
  scene.environment = bakeEnvironment(renderer);
  scene.environmentIntensity = 0.78;

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.42, 0.84);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const keys = new Set();
  let playing = false;
  let scanning = false;
  let lookX = 0;
  let last = performance.now();
  const touchMove = { x: 0, y: 0 };
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  bindUi({
    start() {
      startAudio();
      playing = true;
      showHud();
      const g = currentGoal(journal);
      if (g) pushLog(goalText(g).from, goalText(g).log);
      const touchUi = document.getElementById("touch-ui");
      if (coarse && touchUi) touchUi.classList.remove("hidden");
      if (!coarse) canvas.requestPointerLock?.();
    },
    lang() {
      toggleLang();
      renderCraft(player);
    },
    craft: onCraft,
    consume(id) {
      if (id === "potato" && count(player, "potato") <= 1 && !player.harvestedCrop) {
        toast(t("warnHunger"));
      }
      if (consumeItem(player, id)) {
        pickupTone();
        toast(id === "water" ? t("drank") : t("ate"));
        maybeGoal();
        renderInv(player);
      }
    },
    stash(id) {
      if (!storageOpen()) return;
      if (transfer(player.inv, world.locker.storage, id, 1)) {
        pickupTone();
        renderInv(player);
        renderStorage(world);
      }
    },
    takeStorage(id) {
      if (!transfer(world.locker.storage, player.inv, id, 1, SURVIVAL.pocketMax)) {
        toast(t("pocketsFull"));
        return;
      }
      pickupTone();
      renderInv(player);
      renderStorage(world);
    },
  });

  canvas.addEventListener("click", () => {
    if (playing && !menusOpen()) canvas.requestPointerLock?.();
  });

  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas || !playing) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch + e.movementY * 0.0016, -0.35, 0.85);
    lookX = e.movementX;
  });

  document.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (!playing) return;
    if (e.code === "Tab") {
      e.preventDefault();
      const open = toggleInv(player);
      if (open) document.exitPointerLock?.();
      else canvas.requestPointerLock?.();
    }
    if (e.code === "KeyC") {
      const open = toggleCraft(player);
      if (open) document.exitPointerLock?.();
      else canvas.requestPointerLock?.();
    }
    if (e.code === "Escape") {
      if (player.placing) {
        player.placing = null;
        setGhost(world, null);
        toast(t("cancelPlace"));
      }
      closeMenus();
    }
    if (e.code === "KeyE" && !menusOpen()) interact();
    if (e.code === "KeyQ" && !menusOpen()) dropHeld();
    if (e.code.startsWith("Digit") && !menusOpen()) {
      const n = Number(e.code.slice(5));
      const slots = pocketSlots(player);
      if (n >= 1 && n <= slots.length) player.heldId = slots[n - 1][0];
    }
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

  bindTouch();

  function onCraft(id) {
    const rec = RECIPES.find((r) => r.id === id);
    if (!rec) return;
    if (rec.requireTool && !player.tools[rec.requireTool]) {
      toast(t("needHammer"));
      return;
    }
    if (!canAfford(player, rec.need)) {
      toast(t("needMats"));
      return;
    }
    if (rec.kind === "tool") {
      takeItems(player, rec.need);
      player.tools[rec.tool] = true;
      attachHammer(player);
      closeMenus();
      canvas.requestPointerLock?.();
      deliverTone();
      toast(`${t("crafted")} · ${loc(rec.title)}`);
      maybeGoal();
      return;
    }
    player.placing = rec;
    closeMenus();
    canvas.requestPointerLock?.();
    toast(t("place"));
  }

  function interact() {
    const hit = findInteract(player, world);
    if (!hit) return;
    if (hit.kind === "place") {
      const rec = player.placing;
      const spot = resolvePlacement(world, rec, player);
      if (!spot.valid) {
        toast(t("needNear"));
        return;
      }
      if (!takeItems(player, rec.need)) {
        toast(t("needMats"));
        return;
      }
      placeStation(world, rec.station, spot.x, spot.z);
      player.placing = null;
      setGhost(world, null);
      deliverTone();
      toast(`${t("placed")} · ${loc(rec.title)}`);
      maybeGoal();
      return;
    }
    if (hit.kind === "gather") {
      if (hit.node.needHammer && !player.tools.hammer) {
        toast(t("needTool"));
        return;
      }
      if (!addItem(player, hit.node.type, hit.node.amount || 1)) {
        toast(t("pocketsFull"));
        return;
      }
      hit.node.taken = true;
      world.scene.remove(hit.node.mesh);
      pickupTone(hit.node.type);
      player.heldId = hit.node.type;
      maybeGoal();
      return;
    }
    if (hit.kind === "locker") {
      const open = toggleStorage(player, world);
      if (open) document.exitPointerLock?.();
      else canvas.requestPointerLock?.();
      return;
    }
    if (hit.kind === "sleep") {
      if (result === "slept") {
        sleepTone();
        journal.sols += 1;
        const plot = world.stations.find((s) => s.type === "plot" && s.planted);
        toast(plot ? `${t("slept")} · ${Math.floor(plot.grow * 100)}%` : t("slept"));
      } else {
        toast(t(result));
      }
      return;
    }
    if (hit.kind === "still-fuel") {
      const fuel = count(player, "hydrazine") > 0 ? "hydrazine" : "ice";
      takeItems(player, { [fuel]: 1 });
      hit.station.fuel += fuel === "hydrazine" ? 50 : 28;
      pickupTone(fuel);
      toast(t("fueled"));
      return;
    }
    if (hit.kind === "still-take") {
      hit.station.water -= 1;
      addItem(player, "water", 1);
      pickupTone("water");
      player.heldId = "water";
      maybeGoal();
      return;
    }
    if (hit.kind === "plant") {
      takeItems(player, { potato: 1 });
      hit.station.planted = true;
      hit.station.grow = 0;
      pickupTone("potato");
      toast(t("planted"));
      return;
    }
    if (hit.kind === "water-plot") {
      takeItems(player, { water: 1 });
      hit.station.grow = Math.min(1, hit.station.grow + 0.42);
      updatePlotVisual(hit.station);
      pickupTone("water");
      toast(t("watered"));
      return;
    }
    if (hit.kind === "harvest-plot") {
      let n = 3;
      while (n && !addItem(player, "potato", n)) n -= 1;
      if (!n) {
        toast(t("pocketsFull"));
        return;
      }
      player.harvestedCrop = true;
      hit.station.planted = false;
      hit.station.grow = 0;
      updatePlotVisual(hit.station);
      deliverTone();
      maybeGoal();
    }
  }

  function maybeGoal() {
    const prev = currentGoal(journal);
    if (!checkProgress(journal, player, world)) return;
    if (journal.finished) {
      showEnd(journal, player);
      playing = false;
      document.exitPointerLock?.();
      return;
    }
    const next = currentGoal(journal);
    if (next) pushLog(goalText(next).from, goalText(next).log);
    if (prev) toast(loc(prev.title));
  }

  function dropHeld() {
    const id = player.heldId || pocketSlots(player)[0]?.[0];
    if (!id || count(player, id) < 1) return;
    player.inv[id] -= 1;
    const x = player.root.position.x - Math.sin(player.yaw) * 1.7;
    const z = player.root.position.z - Math.cos(player.yaw) * 1.7;
    spawnNode(world, id, x, z);
    pickupTone(id);
    toast(t("dropped"));
    if (count(player, id) < 1) player.heldId = pocketSlots(player)[0]?.[0] || null;
  }

  function inputState() {
    return {
      forward: keys.has("KeyW") || keys.has("ArrowUp") || touchMove.y < -0.28,
      back: keys.has("KeyS") || keys.has("ArrowDown") || touchMove.y > 0.28,
      left: keys.has("KeyA") || keys.has("ArrowLeft") || touchMove.x < -0.28,
      right: keys.has("KeyD") || keys.has("ArrowRight") || touchMove.x > 0.28,
      lookX,
    };
  }

  function bindTouch() {
    const joy = document.getElementById("joy");
    const knob = document.getElementById("joy-knob");
    const use = document.getElementById("btn-use");
    const craftBtn = document.getElementById("btn-craft-touch");
    const invBtn = document.getElementById("btn-inv-touch");
    let joyId = null;
    let lookId = null;
    let lookLast = { x: 0, y: 0 };

    function setJoy(dx, dy) {
      const max = 46;
      const len = Math.hypot(dx, dy) || 1;
      const s = Math.min(1, len / max);
      touchMove.x = (dx / len) * s;
      touchMove.y = (dy / len) * s;
      if (knob) knob.style.transform = `translate(${touchMove.x * max}px, ${touchMove.y * max}px)`;
    }

    function resetJoy() {
      joyId = null;
      touchMove.x = 0;
      touchMove.y = 0;
      if (knob) knob.style.transform = "translate(0, 0)";
    }

    joy?.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joyId = t.identifier;
        const r = joy.getBoundingClientRect();
        setJoy(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
      },
      { passive: false }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId && joy) {
            const r = joy.getBoundingClientRect();
            setJoy(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
          }
          if (t.identifier === lookId) {
            player.yaw -= (t.clientX - lookLast.x) * 0.0048;
            player.pitch = THREE.MathUtils.clamp(player.pitch + (t.clientY - lookLast.y) * 0.0034, -0.35, 0.85);
            lookLast = { x: t.clientX, y: t.clientY };
          }
        }
      },
      { passive: true }
    );
    window.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) resetJoy();
        if (t.identifier === lookId) lookId = null;
      }
    });

    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (!playing || menusOpen()) return;
        const t = e.changedTouches[0];
        if (t.target.closest?.("#touch-ui")) return;
        lookId = t.identifier;
        lookLast = { x: t.clientX, y: t.clientY };
      },
      { passive: true }
    );

    use?.addEventListener("click", (e) => {
      e.preventDefault();
      if (playing && !menusOpen()) interact();
    });
    craftBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!playing) return;
      const open = toggleCraft(player);
      if (open) document.exitPointerLock?.();
    });
    invBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!playing) return;
      const open = toggleInv(player);
      if (open) document.exitPointerLock?.();
    });
  }

  function placeCamera(dt) {
    const inside = Math.hypot(player.root.position.x, player.root.position.z - 8) < 6.4;
    const dist = inside ? 6.3 : 9.2;
    const height = (inside ? 2.2 : 2.55) + player.pitch * 1.15;
    const target = new THREE.Vector3(
      player.root.position.x + Math.sin(player.yaw) * dist,
      player.root.position.y + height,
      player.root.position.z + Math.cos(player.yaw) * dist
    );
    camera.position.lerp(target, 1 - Math.pow(0.00025, dt));
    const minY = heightAt(camera.position.x, camera.position.z) + 1.55;
    if (camera.position.y < minY) camera.position.y = minY;
    if (!inside) {
      const habDx = camera.position.x;
      const habDz = camera.position.z - 8;
      const habR = Math.hypot(habDx, habDz);
      if (habR < 5.1 && camera.position.y < 4.2) {
        camera.position.x = (habDx / (habR || 1)) * 5.1;
        camera.position.z = 8 + (habDz / (habR || 1)) * 5.1;
      }
    }
    const lx = world.locker.x;
    const lz = world.locker.z;
    const ldx = camera.position.x - lx;
    const ldz = camera.position.z - lz;
    const lr = Math.hypot(ldx, ldz);
    if (lr < 1.7) {
      camera.position.x = lx + (ldx / (lr || 1)) * 1.7;
      camera.position.z = lz + (ldz / (lr || 1)) * 1.7;
    }
    camera.lookAt(player.root.position.x, player.root.position.y + 1.32, player.root.position.z);
  }

  window.addEventListener("resize", () => {
    const w = innerWidth;
    const h = innerHeight;
    if (w < 8 || h < 8) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
  });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scanning = playing && keys.has("KeyF");

    if (player.placing) {
      const spot = resolvePlacement(world, player.placing, player);
      setGhost(world, player.placing, spot);
    } else {
      setGhost(world, null);
    }

    if (playing) {
      const result = updatePlayer(player, dt, inputState(), world);
      if (result.blackout) toast(t("warnO2"));
      updateWorld(world, dt, player.root.position, scanning, true);
      tickStill(
        dt,
        world.stations.some((s) => s.type === "still" && s.fuel > 0)
      );
      setAmbience({
        storm: world.storm,
        inside: result.inside,
        sealed: world.habSealed,
        night: world.daylight < 0.28,
      });
      placeCamera(dt);
      if (currentGoal(journal)?.id === "escape") maybeGoal();
      updateHud({ player, world, journal, scanning, camera, inside: result.inside });
    } else {
      const drift = now * 0.00007;
      camera.position.set(12.4 + Math.sin(drift) * 2.6, 6.55 + Math.sin(drift * 0.6) * 0.35, 30.5 + Math.cos(drift) * 2.1);
      camera.lookAt(0.6, 1.85, 13.2);
      updateWorld(world, dt, { x: 0, y: 0, z: 8 }, false, false);
    }

    renderer.toneMappingExposure = 0.74 + world.daylight * 0.4 - world.storm * 0.12;
    lookX *= 0.6;
    composer.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
