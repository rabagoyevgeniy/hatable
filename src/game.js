import * as THREE from "three";
import { applyDom, toggleLang, t, loc } from "./i18n.js";
import { startAudio, setAmbience, pickupTone, deliverTone, sleepTone, tickStillSpatial, switchTone } from "./audio.js";
import { RECIPES, SURVIVAL, HAB_LEAK, YARD_PADS } from "./data.js";
import { createWorld, updateWorld, placeStation, resolvePlacement, setGhost, spawnNode, updatePlotVisual, refreshOutpostModels, isMobileView } from "./world.js";
import { needsLandscape, syncOrientationClass } from "./device.js";
import { isSheltered, meshHeightAt } from "./systems/collision.js";
import { repairStillPump, stillCanRun, repairArrayCable } from "./systems/machines.js";
import { sipHabitatTank } from "./systems/survival.js";
import { consumeHabEvents } from "./systems/habitat.js";
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
  canEatPotato,
} from "./player.js";
import { createJournal, currentGoal, goalText, checkProgress } from "./journal.js";
import { heightAt } from "./noise.js";
import { preloadModels, preloadRest } from "./models.js";
import { bakeEnvironment } from "./gfx.js";
import {
  bindUi,
  showHud,
  updateHud,
  findInteract,
  pushLog,
  toast,
  showEnd,
  toggleCraft,
  craftOpen,
  firstReadyRecipe,
  toggleInv,
  closeMenus,
  menusOpen,
  renderCraft,
  toggleStorage,
  storageOpen,
  renderStorage,
  renderInv,
  toggleHabConsole,
  refreshContinue,
} from "./ui.js";
import { applySave, collectSave, writeSave, readSave, clearSave } from "./systems/save.js";
import { noteScan, pickScanTarget, canFuelStill, canPlantCrop, canUseWire, recipeKnown } from "./systems/science.js";

export async function boot() {
  try {
    await bootGame();
  } catch (err) {
    console.error(err);
    const status = document.getElementById("boot-status");
    if (status) status.textContent = String(err?.stack || err?.message || err);
  }
}

async function bootGame() {
  applyDom();
  const bootMobile = isMobileView();
  if (bootMobile) document.body.classList.add("mobile");
  function syncPlayChrome() {
    document.body.classList.toggle("mobile", isMobileView());
    syncOrientationClass();
    const touchUi = document.getElementById("touch-ui");
    if (touchUi && playing) touchUi.classList.toggle("hidden", !isMobileView());
  }

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !bootMobile,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    failIfMajorPerformanceCaveat: false,
  });
  const mobile = bootMobile;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(mobile ? 0xd48958 : 0xc47a4a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = mobile ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mobile ? 1.35 : 1.18;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (mobile) renderer.useLegacyLights = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 42 : 48, innerWidth / innerHeight, 0.12, mobile ? 720 : 900);
  camera.position.set(8.5, mobile ? 9.2 : 6.8, 24);

  let world;
  let player;
  let journal;
  let systemsReady = false;
  let queuedStart = null;
  const keys = new Set();
  let playing = false;
  let scanning = false;
  let lookX = 0;
  let last = performance.now();
  const touchMove = { x: 0, y: 0 };
  const touchLook = { x: 0, y: 0 };
  const coarse = isMobileView();
  let touchScan = false;
  let saveAcc = 0;
  let scanAcc = 0;
  syncPlayChrome();
  window.addEventListener("resize", syncPlayChrome);
  window.visualViewport?.addEventListener("resize", syncPlayChrome);
  window.addEventListener("orientationchange", syncPlayChrome);

  function beginPlay(load) {
    if (load) {
      const data = readSave();
      if (data) {
        applySave(data, { player, world, journal, placeStation, updatePlotVisual });
        if (player.tools.hammer) attachHammer(player);
      }
    } else {
      clearSave();
    }
    playing = true;
    showHud();
    startAudio();
    syncPlayChrome();
    try {
      screen.orientation?.lock?.("landscape").catch(() => {});
    } catch {
      /* iOS Safari ignores orientation lock; overlay handles portrait. */
    }
    const g = currentGoal(journal);
    if (g) pushLog(goalText(g).from, goalText(g).log);
    const touchUi = document.getElementById("touch-ui");
    if (coarse && touchUi) touchUi.classList.remove("hidden");
    try {
      if (!coarse) canvas.requestPointerLock?.();
    } catch {
      /* pointer lock is optional */
    }
    persist();
  }

  bindUi({
    start(load) {
      if (!systemsReady) {
        queuedStart = !!load;
        return;
      }
      beginPlay(load);
    },
    lang() {
      toggleLang();
      if (player) renderCraft(player, world);
    },
    craft: onCraft,
    consume(id) {
      if (id === "potato" && !canEatPotato(player)) {
        toast(t("seedPotato"));
        return;
      }
      if (consumeItem(player, id)) {
        pickupTone();
        if (id === "potato") toast(t("potatoDry"));
        else toast(id === "water" ? t("drank") : t("ate"));
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
    habAct(act) {
      if (!world.hab) return;
      if (act === "heater") {
        world.hab.heaterOn = !world.hab.heaterOn;
        switchTone();
        toast(world.hab.heaterOn ? t("heaterOn") : t("heaterOff"));
      } else if (act === "lights") {
        world.hab.lightsOn = !world.hab.lightsOn;
        switchTone();
        toast(world.hab.lightsOn ? t("lightsOn") : t("lightsOff"));
      } else if (act === "drink") {
        if (!sipHabitatTank(world, player).ok) {
          toast(t("tankEmpty"));
          return;
        }
        pickupTone("water");
        toast(t("drankTank"));
        maybeGoal();
      }
    },
  });

  await preloadModels();
  const status = document.getElementById("boot-status");
  if (status) status.textContent = "";
  world = createWorld(scene);
  player = createPlayer(scene);
  journal = createJournal();
  if (!mobile) {
    scene.environment = bakeEnvironment(renderer);
    scene.environmentIntensity = 0.85;
  } else {
    scene.environmentIntensity = 0;
  }
  if (!mobile) preloadRest().then(() => refreshOutpostModels(world));
  systemsReady = true;
  document.body.dataset.booted = "1";
  if (queuedStart !== null) beginPlay(queuedStart);

  canvas.addEventListener("click", () => {
    if (playing && !menusOpen()) canvas.requestPointerLock?.();
  });

  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas || !playing) return;
    player.camYaw -= e.movementX * 0.0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch + e.movementY * 0.0016, -0.28, 0.72);
    lookX = e.movementX;
  });

  document.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (!playing) {
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        document.getElementById("btn-start")?.click();
      }
      return;
    }
    if (e.code === "Tab") {
      e.preventDefault();
      const open = toggleInv(player);
      if (open) document.exitPointerLock?.();
      else canvas.requestPointerLock?.();
    }
    if (e.code === "KeyC") {
      if (craftOpen()) {
        const rec = firstReadyRecipe(player, world);
        if (rec) {
          onCraft(rec.id);
          return;
        }
      }
      const open = toggleCraft(player, world);
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
    if (!recipeKnown(world, rec)) {
      toast(t("needCommsScan"));
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
      toast(
        rec.station === "seal"
          ? t("patchedHome")
          : rec.station === "still"
            ? t("fuelStillHint")
            : rec.station === "radio"
              ? t("radioListening")
              : `${t("placed")} · ${loc(rec.title)}`
      );
      maybeGoal();
      persist();
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
    if (hit.kind === "console") {
      player.usedConsole = true;
      const open = toggleHabConsole(world, player);
      if (open) {
        toast(t("consoleTitle"));
        document.exitPointerLock?.();
      } else canvas.requestPointerLock?.();
      return;
    }
    if (hit.kind === "leak-hint") {
      toast(t("needPatchMats"));
      return;
    }
    if (hit.kind === "hatch-hint") {
      toast(t("hatchHint"));
      return;
    }
    if (hit.kind === "patch") {
      if (!takeItems(player, { fabric: 2, tape: 1 })) {
        toast(t("needPatchMats"));
        return;
      }
      placeStation(world, "seal", HAB_LEAK.x, HAB_LEAK.z);
      player.placing = null;
      setGhost(world, null);
      deliverTone();
      toast(t("patchedHome"));
      maybeGoal();
      persist();
      return;
    }
    if (hit.kind === "build-still") {
      const rec = RECIPES.find((r) => r.station === "still");
      const pad = YARD_PADS.find((p) => p.station === "still");
      if (!rec || !pad || !player.tools.hammer || !takeItems(player, rec.need)) {
        toast(t("needMats"));
        return;
      }
      placeStation(world, "still", pad.x, pad.z);
      player.placing = null;
      setGhost(world, null);
      deliverTone();
      toast(t("fuelStillHint"));
      maybeGoal();
      persist();
      return;
    }
    if (hit.kind === "repair-array") {
      if (!takeItems(player, { solar: 1 })) {
        toast(t("needMats"));
        return;
      }
      world.hab.arrayHealth = Math.min(1, world.hab.arrayHealth + 0.24);
      deliverTone();
      toast(`${t("arrayRepaired")} · ${Math.round(world.hab.arrayHealth * 100)}%`);
      persist();
      return;
    }
    if (hit.kind === "cable-diag") {
      toast(t("cableFailHint"));
      return;
    }
    if (hit.kind === "cable-scan") {
      toast(t("needWireScan"));
      return;
    }
    if (hit.kind === "repair-cable") {
      if (!canUseWire(world) || !player.tools.hammer || !takeItems(player, { wire: 1 })) {
        toast(canUseWire(world) ? t("needCableParts") : t("needWireScan"));
        return;
      }
      repairArrayCable(world.hab);
      deliverTone();
      toast(t("cableFixed"));
      persist();
      return;
    }
    if (hit.kind === "sleep") {
      const result = trySleep(player, world);
      if (result === "slept") {
        sleepTone();
        journal.sols += 1;
        const plot = world.stations.find((s) => s.type === "plot" && s.planted);
        toast(plot ? `${t("slept")} · ${Math.floor(plot.grow * 100)}%` : t("slept"));
        persist();
      } else {
        toast(t(result));
      }
      return;
    }
    if (hit.kind === "still-diag") {
      toast(t("pumpFailHint"));
      return;
    }
    if (hit.kind === "pump-scan") {
      toast(t("needWireScan"));
      return;
    }
    if (hit.kind === "still-repair") {
      if (!canUseWire(world) || !player.tools.hammer || !takeItems(player, { wire: 1, scrap: 1 })) {
        toast(canUseWire(world) ? t("needPumpParts") : t("needWireScan"));
        return;
      }
      repairStillPump(hit.station);
      deliverTone();
      toast(t("pumpFixed"));
      persist();
      return;
    }
    if (hit.kind === "still-hint") {
      toast(t("needStillMats"));
      return;
    }
    if (hit.kind === "still-drip") {
      toast(t("stillDripHint"));
      return;
    }
    if (hit.kind === "still-need-ice") {
      toast(t("stillNeedIceHint"));
      return;
    }
    if (hit.kind === "still-scan") {
      toast(t("needFuelScan"));
      return;
    }
    if (hit.kind === "still-fuel") {
      const fuel = count(player, "hydrazine") > 0 && canFuelStill(world, "hydrazine") ? "hydrazine" : "ice";
      if (!canFuelStill(world, fuel) || !takeItems(player, { [fuel]: 1 })) {
        toast(t("needFuelScan"));
        return;
      }
      hit.station.fuel += fuel === "hydrazine" ? 50 : 28;
      pickupTone(fuel);
      toast(t("fueled"));
      persist();
      return;
    }
    if (hit.kind === "still-take") {
      hit.station.water -= 1;
      addItem(player, "water", 1);
      pickupTone("water");
      player.heldId = "water";
      maybeGoal();
      persist();
      return;
    }
    if (hit.kind === "plot-scan") {
      toast(t("needSoilScan"));
      return;
    }
    if (hit.kind === "plant") {
      if (!canPlantCrop(world) || !takeItems(player, { potato: 1 })) {
        toast(t("needSoilScan"));
        return;
      }
      hit.station.planted = true;
      hit.station.grow = 0;
      hit.station.moisture = 0.85;
      pickupTone("potato");
      toast(t("planted"));
      persist();
      return;
    }
    if (hit.kind === "water-plot") {
      takeItems(player, { water: 1 });
      hit.station.moisture = 1;
      updatePlotVisual(hit.station);
      pickupTone("water");
      toast(t("watered"));
      persist();
      return;
    }
    if (hit.kind === "harvest-plot") {
      let n = 3;
      while (n && !addItem(player, "potato", n)) n -= 1;
      if (!n) {
        toast(t("pocketsFull"));
        return;
      }
      const first = !player.harvestedCrop;
      player.harvestedCrop = true;
      hit.station.planted = false;
      hit.station.grow = 0;
      hit.station.moisture = 0.2;
      updatePlotVisual(hit.station);
      deliverTone();
      toast(first ? t("firstHarvest") : `${t("harvested")} · ×${n}`);
      maybeGoal();
      persist();
      return;
    }
  }

  function persist() {
    writeSave(collectSave(player, world, journal));
    refreshContinue();
  }

  function maybeGoal() {
    if (!checkProgress(journal, player, world)) return;
    if (journal.finished) {
      showEnd(journal, player);
      playing = false;
      document.exitPointerLock?.();
      return;
    }
    const next = currentGoal(journal);
    if (next) {
      const text = goalText(next);
      pushLog(text.from, text.log);
      toast(text.title);
    }
  }

  function dropHeld() {
    const id = player.heldId || pocketSlots(player)[0]?.[0];
    if (!id || count(player, id) < 1) return;
    player.inv[id] -= 1;
    const x = player.root.position.x - Math.sin(player.facingYaw ?? player.yaw) * 1.7;
    const z = player.root.position.z - Math.cos(player.facingYaw ?? player.yaw) * 1.7;
    spawnNode(world, id, x, z);
    pickupTone(id);
    toast(t("dropped"));
    if (count(player, id) < 1) player.heldId = pocketSlots(player)[0]?.[0] || null;
  }

  function inputState() {
    return {
      forward: keys.has("KeyW") || keys.has("ArrowUp"),
      back: keys.has("KeyS") || keys.has("ArrowDown"),
      left: keys.has("KeyA") || keys.has("ArrowLeft"),
      right: keys.has("KeyD") || keys.has("ArrowRight"),
      moveX: touchMove.x,
      moveY: touchMove.y,
      camYaw: player.camYaw,
      lookX,
    };
  }

  function bindStick(el, knob, store, onEnd) {
    if (!el) return;
    let id = null;
    const dead = 0.14;
    function setFromTouch(t) {
      const r = el.getBoundingClientRect();
      const max = r.width * 0.42;
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const s = Math.min(1, len / max);
      dx = (dx / len) * s;
      dy = (dy / len) * s;
      const mag = Math.hypot(dx, dy);
      if (mag < dead) {
        store.x = 0;
        store.y = 0;
      } else {
        const adj = Math.min(1, (mag - dead) / (1 - dead));
        store.x = (dx / mag) * adj;
        store.y = (dy / mag) * adj;
      }
      if (knob) knob.style.transform = `translate(${dx * max}px, ${dy * max}px)`;
    }
    function reset() {
      id = null;
      store.x = 0;
      store.y = 0;
      if (knob) knob.style.transform = "translate(0, 0)";
      onEnd?.();
    }
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      id = e.pointerId;
      setFromTouch(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      setFromTouch(e);
    });
    el.addEventListener("pointerup", (e) => {
      if (e.pointerId !== id) return;
      reset();
    });
    el.addEventListener("pointercancel", (e) => {
      if (e.pointerId !== id) return;
      reset();
    });
  }

  function bindTouch() {
    bindStick(document.getElementById("joy"), document.getElementById("joy-knob"), touchMove);
    bindStick(document.getElementById("look-joy"), document.getElementById("look-knob"), touchLook);
    const use = document.getElementById("btn-use");
    const craftBtn = document.getElementById("btn-craft-touch");
    const invBtn = document.getElementById("btn-inv-touch");
    const scanBtn = document.getElementById("btn-scan-touch");
    use?.addEventListener("click", (e) => {
      e.preventDefault();
      if (playing && !menusOpen()) interact();
    });
    craftBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!playing) return;
      if (craftOpen()) {
        const rec = firstReadyRecipe(player, world);
        if (rec) {
          onCraft(rec.id);
          return;
        }
      }
      const open = toggleCraft(player, world);
      if (open) document.exitPointerLock?.();
    });
    invBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!playing) return;
      const open = toggleInv(player);
      if (open) document.exitPointerLock?.();
    });
    const holdScan = (on) => {
      touchScan = on;
      scanBtn?.classList.toggle("held", on);
    };
    scanBtn?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      holdScan(true);
    }, { passive: false });
    scanBtn?.addEventListener("touchend", () => holdScan(false));
    scanBtn?.addEventListener("touchcancel", () => holdScan(false));
    scanBtn?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      holdScan(true);
    });
    window.addEventListener("mouseup", () => holdScan(false));
  }

  function applyLookStick(dt) {
    const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.35);
    const ax = curve(touchLook.x) * 2.55;
    const ay = curve(touchLook.y) * 1.65;
    player.lookVelX = THREE.MathUtils.damp(player.lookVelX || 0, ax, 8.5, dt);
    player.lookVelY = THREE.MathUtils.damp(player.lookVelY || 0, ay, 8.5, dt);
    player.camYaw = (player.camYaw || 0) + player.lookVelX * dt;
    player.pitch = THREE.MathUtils.clamp((player.pitch || 0) + player.lookVelY * dt, -0.22, 0.62);
  }

  function placeCamera(dt) {
    const inside = isSheltered(player.root.position.x, player.root.position.z);
    const camYaw = player.camYaw || 0;
    const dist = inside ? 6.1 : 15.4;
    const height = (inside ? 2.15 : 5.05) + player.pitch * (inside ? 1.4 : 3.4);
    const desired = new THREE.Vector3(
      player.root.position.x + Math.sin(camYaw) * dist,
      player.root.position.y + height,
      player.root.position.z + Math.cos(camYaw) * dist
    );
    camera.position.lerp(desired, 1 - Math.pow(0.012, dt));
    const segs = world.terrainSegments || 168;
    const minY = meshHeightAt(camera.position.x, camera.position.z, segs, heightAt) + (inside ? 1.35 : 1.85);
    if (camera.position.y < minY) camera.position.y = minY;
    if (!inside) {
      const habDx = camera.position.x - 0;
      const habDz = camera.position.z - 8;
      const habR = Math.hypot(habDx, habDz);
      if (habR < 8.2 && camera.position.y < 6.4) {
        camera.position.x = (habDx / (habR || 1)) * 8.2;
        camera.position.z = 8 + (habDz / (habR || 1)) * 8.2;
      }
      const labDx = camera.position.x + 12.35;
      const labDz = camera.position.z - 8;
      const labR = Math.hypot(labDx, labDz);
      if (labR < 3.9 && camera.position.y < 4.6) {
        camera.position.x = -12.35 + (labDx / (labR || 1)) * 3.9;
        camera.position.z = 8 + (labDz / (labR || 1)) * 3.9;
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
    const lookY = player.root.position.y + (inside ? 1.28 : 1.18);
    camera.lookAt(player.root.position.x, lookY, player.root.position.z);
  }

  function fitCanvas() {
    const w = Math.round(window.visualViewport?.width || innerWidth);
    const h = Math.round(window.visualViewport?.height || innerHeight);
    if (w < 8 || h < 8) return;
    syncOrientationClass();
    camera.fov = isMobileView() ? (h > w ? 52 : 42) : 48;
    camera.aspect = w / h;
    camera.far = mobile ? 720 : 900;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", fitCanvas);
  window.visualViewport?.addEventListener("resize", fitCanvas);
  window.addEventListener("pagehide", () => {
    if (playing) persist();
  });
  fitCanvas();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scanning = playing && (keys.has("KeyF") || touchScan);

    if (player.placing) {
      const spot = resolvePlacement(world, player.placing, player);
      setGhost(world, player.placing, spot);
    } else {
      setGhost(world, null);
    }

    if (playing && !needsLandscape()) {
      applyLookStick(dt);
      const result = updatePlayer(player, dt, inputState(), world);
      if (result.blackout) toast(t("warnO2"));
      if (result.inside && !player.enteredHab) {
        player.enteredHab = true;
        toast(t("enterHab"));
      }
      if (
        player.tools.hammer &&
        !player.sawStillYard &&
        !world.stations.some((s) => s.type === "still")
      ) {
        const pad = YARD_PADS.find((p) => p.station === "still");
        if (pad && Math.hypot(player.root.position.x - pad.x, player.root.position.z - pad.z) < 9) {
          player.sawStillYard = true;
          toast(t("stillYardHint"));
          pushLog("HAB", t("stillYardHint"));
        }
      }
      updateWorld(world, dt, player.root.position, scanning, true);
      for (const ev of consumeHabEvents(world.hab)) {
        if (ev === "cable-snap") {
          toast(t("cableSnapped"));
          pushLog("HAB", t("cableFailHint"));
        }
        if (ev === "earth-heard") {
          toast(t("earthHeard"));
          pushLog("HAB", t("earthHeard"));
          maybeGoal();
        }
      }
      {
        const still = world.stations.find((s) => s.type === "still");
        const running = !!(still && stillCanRun(still, world));
        const dx = still ? still.x - camera.position.x : 0;
        const dz = still ? still.z - camera.position.z : 1;
        const dist = still ? Math.hypot(player.root.position.x - still.x, player.root.position.z - still.z) : 99;
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const toLen = Math.hypot(dx, dz) || 1;
        const pan = running ? (dx / toLen) * camRight.x + (dz / toLen) * camRight.z : 0;
        tickStillSpatial({ running, dist, pan });
      }
      setAmbience({
        storm: world.storm,
        inside: result.inside,
        sealed: world.habSealed,
        night: world.daylight < 0.28,
        leak: !world.habSealed,
        o2: player.oxygen,
        grid: !!world.hab?.gridOn,
        heater: !!(world.hab?.heaterOn && world.hab?.gridOn),
      });
      if (scanning) {
        scanAcc += dt;
        if (scanAcc > 0.35) {
          scanAcc = 0;
          let nodeType = null;
          let nodeD = 99;
          for (const n of world.nodes) {
            if (n.taken) continue;
            const d = Math.hypot(player.root.position.x - n.mesh.position.x, player.root.position.z - n.mesh.position.z);
            if (d < nodeD) {
              nodeD = d;
              nodeType = n.type;
            }
          }
          let outpostKind = null;
          let outpostD = 99;
          for (const o of world.outposts || []) {
            if (o.kind === "hab") continue;
            const d = Math.hypot(player.root.position.x - o.x, player.root.position.z - o.z);
            if (d < outpostD) {
              outpostD = d;
              outpostKind = o.kind;
            }
          }
          const nearest = pickScanTarget({
            nodeType,
            nodeD,
            inside: result.inside,
            sealed: world.habSealed,
            outpostKind,
            outpostD,
            heldId: player.heldId,
            pocketIds: pocketSlots(player).map(([id]) => id),
          });
          const entry = noteScan(world, nearest);
          if (entry) toast(`${t("scanned")} · ${loc(entry)}`);
        }
      } else {
        scanAcc = 0;
      }
      saveAcc += dt;
      if (saveAcc > 22) {
        saveAcc = 0;
        persist();
      }
      placeCamera(dt);
      if (currentGoal(journal)?.id === "escape") maybeGoal();
      updateHud({ player, world, journal, scanning, camera, inside: result.inside });
    } else if (playing) {
      placeCamera(dt);
      updateHud({
        player,
        world,
        journal,
        scanning: false,
        camera,
        inside: isSheltered(player.root.position.x, player.root.position.z),
      });
    } else {
      const drift = now * 0.00007;
      camera.position.set(10.5 + Math.sin(drift) * 1.4, mobile ? 7.2 : 6.55, 26 + Math.cos(drift) * 1.4);
      camera.lookAt(1.2, mobile ? 4.6 : 1.7, 12.5);
      updateWorld(world, dt, { x: 0, y: 0, z: 8 }, false, false);
    }

    if (!mobile) renderer.toneMappingExposure = 0.92 + world.daylight * 0.38 - world.storm * 0.1;
    else renderer.toneMappingExposure = 1.4;
    lookX *= 0.6;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
