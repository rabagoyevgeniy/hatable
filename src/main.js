import "./style.css";
import { boot } from "./game.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
const install = document.getElementById("install-hint");
if (install && standalone) install.classList.add("hidden");

boot();
