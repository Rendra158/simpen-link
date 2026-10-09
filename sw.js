const CACHE = "simpenlink-v1";
const ASSETS = [
  "./", "index.html", "settings.html",
  "base.css", "layout.css", "settings.css", "spotlight.css",
  "store.js", "data.js", "system.js", "settings.js", "spotlight.js",
  "Image/LOGO.svg", "Image/info.txt",
  "Image/link.svg", "Image/more.svg", "Image/copy.svg",
  "Image/cancel.svg", "Image/info.svg", "Image/edit.svg",
  "Image/icon-192.png", "Image/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: selalu ambil versi terbaru, cache hanya sebagai cadangan offline
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});