import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

const URLS = {
  still: "/models/still.glb",
  plot: "/models/plot.glb",
  solar: "/models/solar.glb",
  radio: "/models/radio.glb",
  rover: "/models/rover.glb",
  pathfinder: "/models/pathfinder.glb",
  mav: "/models/mav.glb",
  "watney-walk": "/models/watney-walk.glb",
  "watney-idle": "/models/watney-idle.glb",
  "watney-run": "/models/watney-run.glb",
};

const cache = {};
let pending = null;

export function preloadModels() {
  if (pending) return pending;
  const loader = new GLTFLoader();
  pending = Promise.all(
    Object.entries(URLS).map(
      ([id, url]) =>
        new Promise((resolve) => {
          loader.load(
            url,
            (gltf) => {
              gltf.scene.traverse((o) => {
                if (o.isMesh) {
                  o.castShadow = true;
                  o.receiveShadow = true;
                }
              });
              cache[id] = gltf;
              resolve(id);
            },
            undefined,
            () => resolve(null)
          );
        })
    )
  );
  return pending;
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
