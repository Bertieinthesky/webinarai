/**
 * sw.js — Service worker for caching video embed assets
 *
 * Cache-first strategy for hook clips and poster frames.
 * These assets are immutable (content-addressed keys), so
 * cached versions are always valid.
 */

const CACHE_NAME = "wai-embed-v1";

// Match hook clips and poster images by path pattern
function shouldCache(url) {
  const path = new URL(url).pathname;
  return path.includes("/hook-clip.mp4") || path.includes("/poster.jpg");
}

self.addEventListener("fetch", (event) => {
  if (!shouldCache(event.request.url)) return;

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
});
