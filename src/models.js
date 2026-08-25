import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

const BASE = import.meta.env.BASE_URL || "/";

const URLS = {
  still: "models/still.glb",
  plot: "models/plot.glb",
  solar: "models/solar.glb",
  radio: "models/radio.glb",
  rover: "models/rover.glb",
  pathfinder: "models/pathfinder.glb",
  mav: "models/mav.glb",
  ice: "models/ice.glb",
  scrap: "models/scrap.glb",
  rock: "models/rock.glb",
  potato: "models/potato.glb",
  fabric: "models/fabric.glb",
  tape: "models/tape.glb",
  hydrazine: "models/hydrazine.glb",
  locker: "models/locker.glb",
  bunk: "models/bunk.glb",
  hammer: "models/hammer.glb",
  soil: "models/soil.glb",
  crate: "models/crate.glb",
  wire: "models/wire.glb",
  comms: "models/comms.glb",
  solarcell: "models/solarcell.glb",
  desk: "models/desk.glb",
  farm: "models/farm.glb",
  "watney-walk": "models/watney-walk.glb",
  "watney-idle": "models/watney-idle.glb",
  "watney-run": "models/watney-run.glb",
};

const BOOT_IDS = [
  "scrap",
  "rock",
  "locker",
  "bunk",
  "crate",
  "ice",
  "fabric",
  "tape",
  "potato",
  "soil",
  "hammer",
  "watney-walk",
  "watney-idle",
];

function urlFor(id) {
  return `${BASE}${URLS[id]}`;
}

const cache = {};
let pending = null;

function polishMaterial(mat) {
  if (!mat) return;
  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = 8;
    mat.map.needsUpdate = true;
  }
  if (mat.emissiveMap) {
    mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    mat.emissiveMap.anisotropy = 8;
  }
  if (mat.normalMap) mat.normalMap.anisotropy = 8;
  if (mat.roughnessMap) mat.roughnessMap.anisotropy = 8;
  if (mat.metalnessMap) mat.metalnessMap.anisotropy = 8;
  if (typeof mat.envMapIntensity === "number") mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.2);
  else mat.envMapIntensity = 1.2;
  if (typeof mat.roughness === "number" && mat.roughness > 0.92 && !mat.transmission) {
    mat.roughness = 0.76;
  }
  mat.needsUpdate = true;
}

function polishObject(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (Array.isArray(o.material)) {
      o.material = o.material.map((mat) => {
        if (mat?.isMeshBasicMaterial) {
          const std = new THREE.MeshStandardMaterial({
            map: mat.map,
            color: mat.color,
            transparent: mat.transparent,
            opacity: mat.opacity,
            roughness: 0.55,
            metalness: 0.12,
            envMapIntensity: 1.2,
          });
          polishMaterial(std);
          return std;
        }
        polishMaterial(mat);
        return mat;
      });
    } else if (o.material?.isMeshBasicMaterial) {
      o.material = new THREE.MeshStandardMaterial({
        map: o.material.map,
        color: o.material.color,
        transparent: o.material.transparent,
        opacity: o.material.opacity,
        roughness: 0.55,
        metalness: 0.12,
        envMapIntensity: 1.2,
      });
      polishMaterial(o.material);
    } else {
      polishMaterial(o.material);
    }
  });
}

export function preloadModels() {
  if (pending) return pending;
  const loader = new GLTFLoader();
  pending = loadIds(loader, BOOT_IDS);
  return pending;
}

export function preloadRest() {
  const rest = Object.keys(URLS).filter((id) => !BOOT_IDS.includes(id));
  return loadIds(new GLTFLoader(), rest);
}

function loadIds(loader, ids) {
  return Promise.all(
    ids.map(
      (id) =>
        new Promise((resolve) => {
          if (!URLS[id]) return resolve(null);
          if (cache[id]) return resolve(id);
          loader.load(
            urlFor(id),
            (gltf) => {
              polishObject(gltf.scene);
              cache[id] = gltf;
              resolve(id);
            },
            undefined,
            () => resolve(null)
          );
        })
    )
  ).then((loaded) => {
    const ok = loaded.filter(Boolean);
    console.info(`[stranded] meshy +${ok.length} (${Object.keys(cache).length} cached)`);
    return loaded;
  });
}

export function hasModel(id) {
  return !!cache[id];
}

function fitRoot(root, fit) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  root.scale.multiplyScalar(fit / max);
  const after = new THREE.Box3().setFromObject(root);
  root.position.y -= after.min.y;
  return root;
}

export function takeModel(id, fit = 2.4) {
  const src = cache[id];
  if (!src) return null;
  const clone = src.scene.clone(true);
  return fitRoot(clone, fit);
}

/** Skinned Watney with walk/idle clips if Meshy rig files are present. */
export function takeCharacter(fit = 1.92) {
  const walk = cache["watney-walk"] || cache["watney-idle"];
  if (!walk) return null;
  const root = cloneSkinned(walk.scene);
  polishObject(root);
  fitRoot(root, fit);
  const mixer = new THREE.AnimationMixer(root);
  const walkClip = (cache["watney-walk"]?.animations || [])[0] || walk.animations[0];
  const idleClip = (cache["watney-idle"]?.animations || [])[0];
  const runClip = (cache["watney-run"]?.animations || [])[0];
  const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
  const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  const runAction = runClip ? mixer.clipAction(runClip) : null;
  idleAction?.play();
  walkAction?.play();
  runAction?.play();
  if (idleAction) idleAction.enabled = true;
  if (walkAction) {
    walkAction.enabled = true;
    walkAction.setEffectiveWeight(0);
  }
  if (runAction) {
    runAction.enabled = true;
    runAction.setEffectiveWeight(0);
  }
  return { root, mixer, walkAction, idleAction, runAction };
}
