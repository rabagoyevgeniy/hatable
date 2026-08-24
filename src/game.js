import * as THREE from "three";
import { applyDom, toggleLang, t, getLang } from "./i18n.js";
import { startAudio, setStormAudio, pickupTone, deliverTone } from "./audio.js";
import { createWorld, updateWorld } from "./world.js";
import {
  createPlayer,
  updatePlayer,
  pickupCargo,
  dropTopCargo,
  takeMatching,
  respawnAtLastRest,
} from "./player.js";
import { createCampaign, currentOrder, spawnOrderCargo, completeOrder, orderText } from "./campaign.js";
import { bindUi, showHud, updateHud, findInteract, pushLog, toast, showEnd, togglePack } from "./ui.js";

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
  const campaign = createCampaign();

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
      beginOrder();
      canvas.requestPointerLock?.();
    },
    lang() {
      toggleLang();
    },
  });

  canvas.addEventListener("click", () => {
    if (playing) canvas.requestPointerLock?.();
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
      togglePack();
    }
    if (e.code === "KeyE") interact();
    if (e.code === "KeyQ") {
      dropTopCargo(player, world, false);
    }
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

  function beginOrder() {
    const order = currentOrder(campaign);
    if (!order) return;
    spawnOrderCargo(world, order);
    const text = orderText(order);
    pushLog(text.from, text.log);
    if (order.storm) toast(t("storm"));
  }

  function interact() {
    const order = currentOrder(campaign);
    const hit = findInteract(player, world, order);
    if (!hit) return;
    if (hit.kind === "pickup") {
      if (pickupCargo(player, hit.crate)) pickupTone();
    } else if (hit.kind === "deliver") {
      const delivered = takeMatching(player, order.need);
      hit.outpost.connected = true;
      player.lastRestId = hit.outpost.id;
      player.oxygen = 100;
      player.stamina = 100;
      const result = completeOrder(campaign, delivered);
      deliverTone();
      toast(`+${result.likes} ${t("likesGain")}`);
      if (campaign.finished) {
        hit.outpost.connected = true;
        showEnd(campaign, player);
        playing = false;
        document.exitPointerLock?.();
        return;
      }
      beginOrder();
    } else if (hit.kind === "rest") {
      hit.outpost.connected = true;
      player.lastRestId = hit.outpost.id;
      player.oxygen = Math.min(100, player.oxygen + 45);
      player.stamina = 100;
      player.balance = 0;
      toast(t("connected"));
    }
  }

  function inputState() {
    return {
      forward: keys.has("KeyW") || keys.has("ArrowUp"),
      back: keys.has("KeyS") || keys.has("ArrowDown"),
      left: keys.has("KeyA") || keys.has("ArrowLeft"),
      right: keys.has("KeyD") || keys.has("ArrowRight"),
      brace: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      lookX,
    };
  }

  function placeCamera(dt) {
    const yaw = player.yaw;
    const pitch = player.pitch;
    const dist = 6.2;
    const height = 1.7 + pitch * 0.4;
    const ox = Math.sin(yaw) * dist;
    const oz = Math.cos(yaw) * dist;
    const target = new THREE.Vector3(
      player.root.position.x + ox,
      player.root.position.y + height,
      player.root.position.z + oz
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
    scanning = playing && keys.has("KeyC");

    if (playing) {
      const result = updatePlayer(player, dt, inputState(), world);
      if (result.stumbled) toast(t("stumble"));
      if (result.blackout) {
        respawnAtLastRest(player, world);
        toast(getLang() === "ru" ? "О₂ НА НУЛЕ — ВОЗВРАТ К МАЯКУ" : "O₂ GONE — RETURNED TO BEACON");
      }
      updateWorld(world, dt, player.root.position, scanning);
      setStormAudio(world.storm);
      placeCamera(dt);
      updateHud({ player, world, campaign, order: currentOrder(campaign), scanning, camera });
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
