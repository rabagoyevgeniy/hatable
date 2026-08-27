/**
 * Third-person orbit stick — player-view mapping, no Three.js.
 *
 * Camera sits at (sin(yaw)*dist, cos(yaw)*dist) and looks at the astronaut.
 * At yaw=0 the camera is on +Z, looking −Z; screen-right is world +X.
 *
 * Thumb right (+stickX) must look toward screen-right → yaw decreases.
 * Thumb up is negative DOM Y; looking up means pitch decreases (camera lowers).
 * Mouse look already uses camYaw -= movementX; stick matches that sign.
 */

export const LOOK_DEAD = 0.11;
export const LOOK_CURVE = 1.28;
export const LOOK_YAW_RATE = 2.75;
export const LOOK_PITCH_RATE = 1.55;
export const LOOK_PITCH_MIN = -0.22;
export const LOOK_PITCH_MAX = 0.62;
export const LOOK_DAMP = 16;

export function curveAxis(v, exp = LOOK_CURVE) {
  if (!v) return 0;
  return Math.sign(v) * Math.pow(Math.abs(v), exp);
}

export function lookRates(stickX = 0, stickY = 0) {
  return {
    yawRate: -curveAxis(stickX) * LOOK_YAW_RATE,
    pitchRate: curveAxis(stickY) * LOOK_PITCH_RATE,
  };
}

export function cameraLookXZ(camYaw) {
  return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
}

export function cameraOffsetXZ(camYaw, dist) {
  return { x: Math.sin(camYaw) * dist, z: Math.cos(camYaw) * dist };
}

export function clampPitch(pitch) {
  return Math.max(LOOK_PITCH_MIN, Math.min(LOOK_PITCH_MAX, pitch));
}
