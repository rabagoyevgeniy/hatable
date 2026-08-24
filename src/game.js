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
import { heightAt } from "./noise.js";
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
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700);
  camera.position.set(6, 8, 32);

  const world = createWorld(scene);
  const player = createPlayer(scene);
  const journal = createJournal();

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
        world.ghost.visible = false;
        toast(t("cancelPlace"));
      }
      closeMenus();
    }
    if (e.code === "KeyE" && !menusOpen()) interact();
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
    const dist = 8.7;
    const height = 2.55 + player.pitch * 1.15;
    const target = new THREE.Vector3(
      player.root.position.x + Math.sin(player.yaw) * dist,
      player.root.position.y + height,
      player.root.position.z + Math.cos(player.yaw) * dist
    );
    camera.position.lerp(target, 1 - Math.pow(0.00025, dt));
    const minY = heightAt(camera.position.x, camera.position.z) + 1.55;
    if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(player.root.position.x, player.root.position.y + 1.32, player.root.position.z);
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
      camera.position.set(8, 10, 34);
      camera.lookAt(0, 2.2, 12);
      updateWorld(world, dt, { x: 0, y: 0, z: 8 }, false);
    }

    lookX *= 0.6;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
