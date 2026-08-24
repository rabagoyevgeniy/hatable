import * as THREE from "three";
import { applyDom, toggleLang, t, loc } from "./i18n.js";
import { startAudio, setStormAudio, pickupTone, deliverTone } from "./audio.js";
import { RECIPES, OUTPOSTS, SURVIVAL } from "./data.js";
import { createWorld, updateWorld, placeStation, placementSpot } from "./world.js";
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
} from "./player.js";
import { createJournal, currentGoal, goalText, checkProgress } from "./journal.js";
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

export function boot() {
  applyDom();

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 700);
  camera.position.set(8, 6, 22);

  const world = createWorld(scene);
  const player = createPlayer(scene);
  const journal = createJournal();

  const keys = new Set();
  let playing = false;
  let scanning = false;
  let lookX = 0;
  let last = performance.now();

  bindUi({
    start() {
      startAudio();
      playing = true;
      showHud();
      const g = currentGoal(journal);
      if (g) pushLog(goalText(g).from, goalText(g).log);
      canvas.requestPointerLock?.();
    },
    lang() {
      toggleLang();
      renderCraft(player);
    },
    craft: onCraft,
    consume(id) {
      if (storageOpen()) {
        if (transfer(player.inv, world.locker.storage, id, 1)) {
          pickupTone();
          renderInv(player);
          renderStorage(world);
        }
        return;
      }
      if (id === "potato" && count(player, "potato") <= 1 && !player.harvestedCrop) {
        toast(t("warnHunger"));
      }
      if (consumeItem(player, id)) {
        pickupTone();
        toast(id === "water" ? t("drank") : t("ate"));
        maybeGoal();
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
        world.ghost.visible = false;
        toast(t("cancelPlace"));
      }
      closeMenus();
    }
    if (e.code === "KeyE" && !menusOpen()) interact();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

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
      const spot = placementSpot(player);
      if (rec.near) {
        const site = OUTPOSTS.find((o) => o.id === rec.near);
        if (Math.hypot(spot.x - site.x, spot.z - site.z) > 14) {
          toast(t("needNear"));
          return;
        }
      }
      if (!takeItems(player, rec.need)) {
        toast(t("needMats"));
        return;
      }
      placeStation(world, rec.station, spot.x, spot.z);
      player.placing = null;
      world.ghost.visible = false;
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
      pickupTone();
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
      const result = trySleep(player, world);
      toast(t(result));
      return;
    }
    if (hit.kind === "still-fuel") {
      const fuel = count(player, "hydrazine") > 0 ? "hydrazine" : "ice";
      takeItems(player, { [fuel]: 1 });
      hit.station.fuel += fuel === "hydrazine" ? 50 : 28;
      pickupTone();
      return;
    }
    if (hit.kind === "still-take") {
      hit.station.water -= 1;
      addItem(player, "water", 1);
      pickupTone();
      maybeGoal();
      return;
    }
    if (hit.kind === "plant") {
      takeItems(player, { potato: 1 });
      hit.station.planted = true;
      hit.station.grow = 0;
      pickupTone();
      return;
    }
    if (hit.kind === "harvest-plot") {
      addItem(player, "potato", 2);
      player.harvestedCrop = true;
      hit.station.planted = false;
      hit.station.grow = 0;
      const plant = hit.station.mesh.getObjectByName("plant");
      if (plant) plant.visible = false;
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

  function inputState() {
    return {
      forward: keys.has("KeyW") || keys.has("ArrowUp"),
      back: keys.has("KeyS") || keys.has("ArrowDown"),
      left: keys.has("KeyA") || keys.has("ArrowLeft"),
      right: keys.has("KeyD") || keys.has("ArrowRight"),
      lookX,
    };
  }

  function placeCamera(dt) {
    const dist = 6.2;
    const height = 1.7 + player.pitch * 0.4;
    const target = new THREE.Vector3(
      player.root.position.x + Math.sin(player.yaw) * dist,
      player.root.position.y + height,
      player.root.position.z + Math.cos(player.yaw) * dist
    );
    camera.position.lerp(target, 1 - Math.pow(0.0004, dt));
    camera.lookAt(player.root.position.x, player.root.position.y + 1.45, player.root.position.z);
  }

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scanning = playing && keys.has("KeyF");

    if (player.placing) {
      const spot = placementSpot(player);
      world.ghost.visible = true;
      world.ghost.position.set(spot.x, spot.y + 0.6, spot.z);
    } else {
      world.ghost.visible = false;
    }

    if (playing) {
      const result = updatePlayer(player, dt, inputState(), world);
      if (result.blackout) toast(t("warnO2"));
      updateWorld(world, dt, player.root.position, scanning);
      setStormAudio(world.storm);
      placeCamera(dt);
      journal.sols = 19 + Math.floor(player.distance / 90);
      if (currentGoal(journal)?.id === "escape") maybeGoal();
      updateHud({ player, world, journal, scanning, camera });
    } else {
      camera.position.set(18, 9, 28);
      camera.lookAt(0, 2, 8);
      updateWorld(world, dt, { x: 0, y: 0, z: 8 }, false);
    }

    lookX *= 0.6;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
