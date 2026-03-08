/**
 * sw.js — Service worker for caching video embed assets
 *
 * Caching strategies:
 *   - Hook clips, posters, HLS segments (.m4s, .mp4): Cache-first
 *     These are immutable (content-addressed keys), so cached versions
 *     are always valid. Instant playback for repeat viewers.
 *   - HLS manifests (.m3u8): Network-first with cache fallback
 *     Manifests may update (e.g., new renditions added), so always
 *     try the network first but fall back to cache if offline.
 */

const CACHE_NAME = "wai-embed-v2";

/** Check if this request should be cached at all */
function shouldCache(url) {
  const path = new URL(url).pathname;
  return (
    path.includes("/hook-clip.mp4") ||
    path.includes("/poster.jpg") ||
    path.endsWith(".m3u8") ||   // HLS manifests
    path.endsWith(".m4s") ||    // CMAF/fMP4 segments
    path.endsWith(".mp4")       // Init segments & full videos
  );
}

/** HLS manifests get network-first strategy */
function isManifest(url) {
  return new URL(url).pathname.endsWith(".m3u8");
}

self.addEventListener("fetch", (event) => {
  if (!shouldCache(event.request.url)) return;

  if (isManifest(event.request.url)) {
    // Network-first: manifests may update (new renditions, etc.)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first: segments and media files are immutable
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
  }
});

// Clean up old cache versions on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
});
