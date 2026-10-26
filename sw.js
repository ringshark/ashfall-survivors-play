// Offline cache for the game's own big files (engine, game pack, scripts, icons). The page registers this right after the
// game has loaded; it then copies the files into its own cache (the browser still holds them from the load, so this is
// normally not a second download). Later visits start from the cache with no download at all, and the game still opens
// with no connection (co-op and the leaderboard need one). The name below changes whenever any of those files changes
// (scripts/stamp-sw.mjs writes it), so a new build is picked up on the next visit and the old copy is deleted.
// Artwork has a separate versioned cache so a game update does not discard it.
// The leaderboard and co-op services are never cached here.
const BUILD = "8b6c5ce9e644";
const CACHE = "ashfall-" + BUILD;
const ART_CACHE = "ashfall-art-v1";
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
      if (key.startsWith("ashfall-") && key !== CACHE && key !== ART_CACHE) await caches.delete(key);
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
  if (name === "art.json") {
    event.respondWith(artManifest(request));
    return;
  }
  if (name === "art.pck" && /^[a-f0-9]{12}$/.test(url.searchParams.get("v") || "")) {
    event.respondWith(artPack(request, event));
    return;
  }
  if (!FILES.includes(name)) return;
  event.respondWith(cacheFirst(request, keyOf(name)));
});

const artKey = (name, version) => keyOf(name) + "?v=" + version;

self.addEventListener("message", (event) => {
  const version = event.data?.version;
  if (event.data?.type !== "ashfall-art-reject" || !/^[a-f0-9]{12}$/.test(version || "")) return;
  event.waitUntil((async () => {
    const cache = await caches.open(ART_CACHE);
    await cache.delete(artKey("art.pck", version));
    await cache.delete(artKey("art.json", version));
    const current = await cache.match(keyOf("art.json"));
    if (current && (await current.json()).version === version) await cache.delete(keyOf("art.json"));
  })().catch(() => {}));
});

async function artManifest(request) {
  let cache;
  try { cache = await caches.open(ART_CACHE); } catch (_) { return fetch(request, { cache: "no-cache" }); }
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (!response.ok || response.status !== 200 || response.redirected) throw new Error("art manifest unavailable");
    const meta = await response.clone().json();
    if (!/^[a-f0-9]{12}$/.test(meta.version) || !Number.isSafeInteger(meta.bytes) || meta.bytes <= 0) throw new Error("invalid art manifest");
    try {
      await cache.put(artKey("art.json", meta.version), response.clone());
      // Only make a manifest the offline default once its matching pack exists.
      if (await cache.match(artKey("art.pck", meta.version))) await cache.put(keyOf("art.json"), response.clone());
    } catch (_) { /* a denied/full cache must not block the network response */ }
    return response;
  } catch (_) {
    return await cache.match(keyOf("art.json")) || new Response("Artwork unavailable", { status: 503 });
  }
}

async function artPack(request, event) {
  let cache;
  try { cache = await caches.open(ART_CACHE); } catch (_) { return fetch(request, { cache: "no-cache" }); }
  const key = request.url;
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(request, { cache: "no-cache" });
  if (response.ok && response.status === 200 && !response.redirected) {
    const copy = response.clone();
    event.waitUntil((async () => {
      try {
        const previous = await cache.match(keyOf("art.json"));
        const previousVersion = previous ? (await previous.json()).version : "";
        // A failed/truncated response rejects put(): don't promote its manifest.
        await cache.put(key, copy);
        const version = new URL(key).searchParams.get("v");
        const meta = await cache.match(artKey("art.json", version));
        if (meta) await cache.put(keyOf("art.json"), meta);
        // Keep the current and previous complete versions, not every release.
        for (const entry of await cache.keys()) {
          if (!entry.url.startsWith(self.registration.scope)) continue;
          const old = new URL(entry.url).searchParams.get("v");
          if (old && old !== version && old !== previousVersion) await cache.delete(entry);
        }
      } catch (_) { /* storage denied/full: the live response still works */ }
    })());
  }
  return response;
}

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
