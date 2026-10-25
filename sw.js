// Offline cache for the game's own big files (engine, game pack, scripts, icons). The page registers this right after the
// game has loaded; it then copies the files into its own cache (the browser still holds them from the load, so this is
// normally not a second download). Later visits start from the cache with no download at all, and the game still opens
// with no connection (co-op and the leaderboard need one). The name below changes whenever any of those files changes
// (scripts/stamp-sw.mjs writes it), so a new build is picked up on the next visit and the old copy is deleted.
// NOT cached on purpose: art.pck and art.json (the game keeps the art pack in its own storage and must always ask the
// network which version is newest), the leaderboard and the co-op servers.
const BUILD = "a823107cd923";
const CACHE = "ashfall-" + BUILD;
const FILES = ["index.html","index.js","index.wasm.gz","index.pck","index.audio.worklet.js","index.audio.position.worklet.js","phone-loader.js","phone-controls.js","phone-performance.js","manifest.webmanifest","favicon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","index.apple-touch-icon.png"];

const keyOf = (name) => new URL(name, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One file failing must not stop the rest: whatever is missing is cached when the page next asks for it.
    await Promise.allSettled(FILES.map(async (name) => {
      const response = await fetch(keyOf(name), { cache: "no-cache" });
      if (response.ok && response.status === 200 && !response.redirected) await cache.put(keyOf(name), response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("ashfall-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  const base = new URL(self.registration.scope).pathname;
  let name = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : "";
  if (name === "") name = "index.html";
  if (!FILES.includes(name)) return;
  event.respondWith(cacheFirst(request, keyOf(name)));
});

async function cacheFirst(request, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.status === 200 && !response.redirected) {
    try { await cache.put(key, response.clone()); } catch (_) { /* storage full: serve it uncached */ }
  }
  return response;
}
