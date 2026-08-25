/** Phone / coarse-pointer detection. Kept tiny to avoid gfx ↔ world import cycles. */
export function isMobileView() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || innerWidth < 720;
}
