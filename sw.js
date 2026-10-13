const CACHE = "simpenlink-v5";   // naikkan angkanya tiap kali daftar ASSETS berubah
const TIMEOUT = 4000;            // jaringan yang diam selama ini dianggap gagal
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

// Respons hasil redirect ditolak browser saat dipakai membuka halaman (ERR_FAILED),
// jadi dibungkus ulang menjadi respons biasa.
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Satu file yang hilang tidak membatalkan pemasangan. cache:"reload" = ambil yang segar.
    await Promise.allSettled(ASSETS.map(async (a) => {
      const res = await fetch(new Request(a, { cache: "reload" }));
      if (res.ok) await cache.put(a, await clean(res));
    }));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: versi terbaru dulu, cache sebagai cadangan offline.
async function handle(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);

  if (navigator.onLine !== false) {   // jelas-jelas offline: langsung ke cache
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
      const res = await fetch(req, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const copy = res.clone();
        e.waitUntil((async () => cache.put(req, await clean(copy)))());
      }
      return res;
    } catch {}
  }

  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === "navigate") {
    const page = (await cache.match("./")) || (await cache.match("index.html"));
    if (page) return page;
  }
  return Response.error();
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(handle(e));
});