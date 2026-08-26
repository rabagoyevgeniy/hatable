import * as THREE from "three";
import { applyDom, toggleLang, t, loc } from "./i18n.js";
import { startAudio, setAmbience, pickupTone, deliverTone, sleepTone, tickStill, switchTone } from "./audio.js";
import { RECIPES, SURVIVAL, HAB_LEAK, YARD_PADS } from "./data.js";
import { createWorld, updateWorld, placeStation, resolvePlacement, setGhost, spawnNode, updatePlotVisual, refreshOutpostModels, isMobileView } from "./world.js";
import { repairStillPump, stillCanRun } from "./systems/machines.js";
import { TANK_SIP_L, TANK_MIN_L, TANK_SIP_THIRST } from "./systems/survival.js";
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
import { noteScan } from "./systems/science.js";

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
  const mobile = isMobileView();
  if (mobile) document.body.classList.add("mobile");

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    failIfMajorPerformanceCaveat: false,
  });
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
  const camera = new THREE.PerspectiveCamera(mobile ? 64 : 52, innerWidth / innerHeight, 0.12, mobile ? 720 : 900);
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
  const coarse = isMobileView();
  let touchScan = false;
  let saveAcc = 0;
  let scanAcc = 0;

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
      if (player) renderCraft(player);
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
        if (world.hab.waterTank < TANK_MIN_L) {
          toast(t("tankEmpty"));
          return;
        }
        world.hab.waterTank -= TANK_SIP_L;
        player.thirst = Math.min(100, player.thirst + TANK_SIP_THIRST);
        player.drank = true;
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
    player.yaw -= e.movementX * 0.0022;
    player.pitch = THREE.MathUtils.clamp(player.pitch + e.movementY * 0.0016, -0.35, 0.85);
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
      toast(rec.station === "seal" ? t("patchedHome") : rec.station === "still" ? t("fuelStillHint") : `${t("placed")} · ${loc(rec.title)}`);
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
      const open = toggleHabConsole(world);
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
    if (hit.kind === "still-repair") {
      if (!player.tools.hammer || !takeItems(player, { wire: 1, scrap: 1 })) {
        toast(t("needPumpParts"));
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
    if (hit.kind === "still-fuel") {
      const fuel = count(player, "hydrazine") > 0 ? "hydrazine" : "ice";
      takeItems(player, { [fuel]: 1 });
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
    if (hit.kind === "plant") {
      takeItems(player, { potato: 1 });
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
    const scanBtn = document.getElementById("btn-scan-touch");
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

  function placeCamera(dt) {
    const inside = Math.hypot(player.root.position.x, player.root.position.z - 8) < 6.4;
    const portrait = innerHeight > innerWidth;
    const dist = inside ? (mobile ? 3.35 : 3.85) : mobile ? (portrait ? 6.35 : 7.2) : 9.2;
    const height = (inside ? 1.62 : mobile ? (portrait ? 3.05 : 2.75) : 2.55) + player.pitch * (portrait ? 0.85 : 1.15);
    const target = new THREE.Vector3(
      player.root.position.x + Math.sin(player.yaw) * dist,
      player.root.position.y + height,
      player.root.position.z + Math.cos(player.yaw) * dist
    );
    camera.position.lerp(target, 1 - Math.pow(0.00025, dt));
    const minY = heightAt(camera.position.x, camera.position.z) + (mobile ? 1.32 : 1.55);
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
    const lookAhead = mobile && !inside ? 1.55 : 0;
    const lookY = player.root.position.y + (mobile ? 1.38 : 1.32);
    camera.lookAt(
      player.root.position.x - Math.sin(player.yaw) * lookAhead,
      lookY,
      player.root.position.z - Math.cos(player.yaw) * lookAhead
    );
  }

  function fitCanvas() {
    const w = Math.round(window.visualViewport?.width || innerWidth);
    const h = Math.round(window.visualViewport?.height || innerHeight);
    if (w < 8 || h < 8) return;
    camera.fov = mobile ? (h > w ? 62 : 55) : 52;
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

    if (playing) {
      const result = updatePlayer(player, dt, inputState(), world);
      if (result.blackout) toast(t("warnO2"));
      if (result.inside && !player.enteredHab) {
        player.enteredHab = true;
        toast(t("enterHab"));
      }
      updateWorld(world, dt, player.root.position, scanning, true);
      tickStill(
        dt,
        world.stations.some((s) => stillCanRun(s, world))
      );
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
          let nearest = null;
          let nd = 5.2;
          for (const n of world.nodes) {
            if (n.taken) continue;
            const d = Math.hypot(player.root.position.x - n.mesh.position.x, player.root.position.z - n.mesh.position.z);
            if (d < nd) {
              nd = d;
              nearest = n.type;
            }
          }
          if (!nearest && result.inside) nearest = world.habSealed ? "hab" : "leak";
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
