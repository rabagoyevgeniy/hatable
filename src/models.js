import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const URLS = {
  still: "/models/still.glb",
  plot: "/models/plot.glb",
  solar: "/models/solar.glb",
  radio: "/models/radio.glb",
  rover: "/models/rover.glb",
  pathfinder: "/models/pathfinder.glb",
  mav: "/models/mav.glb",
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
              cache[id] = gltf.scene;
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

export function takeModel(id, fit = 2.4) {
  const src = cache[id];
  if (!src) return null;
  const clone = src.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  clone.scale.multiplyScalar(fit / max);
  const after = new THREE.Box3().setFromObject(clone);
  clone.position.y -= after.min.y;
  return clone;
}
