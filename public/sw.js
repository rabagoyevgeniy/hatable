const SHELL = "stranded-shell-v3";
const MODELS = "stranded-models-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(["./", "./index.html", "./manifest.webmanifest"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, MODELS]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isModel = url.pathname.includes("/models/");
  if (isModel) {
    event.respondWith(
      caches.open(MODELS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html") || url.pathname.endsWith("/"))) {
          caches.open(SHELL).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
