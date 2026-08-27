/** Phone / coarse-pointer detection. Kept tiny to avoid gfx ↔ world import cycles. */
export function isMobileView() {
  if (typeof window === "undefined") return false;
  const w = window.visualViewport?.width || innerWidth;
  const h = window.visualViewport?.height || innerHeight;
  const phoneLandscape = Math.max(w, h) <= 920 && Math.min(w, h) <= 540;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    Math.min(w, h) <= 480 ||
    phoneLandscape
  );
}

export function isPortraitView() {
  if (typeof window === "undefined") return false;
  const w = window.visualViewport?.width || innerWidth;
  const h = window.visualViewport?.height || innerHeight;
  return h > w;
}

/** Phones play in landscape. Portrait pauses the world and shows «Поверните телефон». */
export function needsLandscape() {
  return isMobileView() && isPortraitView();
}

export function syncOrientationClass() {
  if (typeof document === "undefined") return false;
  const lock = needsLandscape();
  document.body.classList.toggle("need-landscape", lock);
  const el = document.getElementById("rotate-phone");
  if (el) el.classList.toggle("hidden", !lock);
  return lock;
}
