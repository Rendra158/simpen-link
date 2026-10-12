const CACHE = "simpenlink-v2";
const ASSETS = [
  "./", "index.html", "settings.html", "manifest.json", "recommend.json",
  "base.css", "layout.css", "settings.css", "spotlight.css",
  "store.js", "data.js", "system.js", "settings.js", "spotlight.js", "backup.js",
  "Image/LOGO.svg", "Image/info.txt", "Image/info.en.txt",
  "Image/link.svg", "Image/list.svg", "Image/search.svg", "Image/edit.svg",
  "Image/more.svg", "Image/copy.svg", "Image/cancel.svg", "Image/info.svg",
  "Image/star.svg", "Image/pin.svg", "Image/n-pin.svg",
  "Image/no-logo.svg", "Image/open-close-note.svg",
  "Image/icon-192.png", "Image/icon-512.png"
];

self.addEventListener("install", (e) => {
  // Satu file yang hilang tidak membatalkan pemasangan (beda dengan addAll)
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((a) => c.add(a))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: selalu ambil versi terbaru, cache hanya cadangan offline.
// Hanya file dari situs sendiri yang berhasil (status 200) yang disimpan.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (sameOrigin && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || Response.error()))
  );
});