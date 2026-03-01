const CACHE_NAME = 'ocr-leet-v1';
const SHARE_CACHE = 'share-target-cache';
const CDN_CACHE = 'ocr-leet-cdn-v1';

// Derive absolute base URL from scope (handles any deployment path)
const BASE = self.registration.scope;

const SHELL_FILES = [
  BASE,
  BASE + 'manifest.json',
  BASE + 'css/main.css',
  BASE + 'js/app.js',
  BASE + 'js/share-target.js',
  BASE + 'js/dot-grid.js',
  BASE + 'js/ocr.js',
  BASE + 'icons/icon-192.svg',
  BASE + 'icons/icon-512.svg'
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== SHARE_CACHE && key !== CDN_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: handle share target POST + cache-first for everything else ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle the Web Share Target POST
  if (url.pathname.endsWith('/share-target') && request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await request.formData();
          const image = formData.get('image');
          if (image) {
            const cache = await caches.open(SHARE_CACHE);
            // Store with Content-Type so we can reconstruct the blob later
            await cache.put(
              'shared-image',
              new Response(image, { headers: { 'Content-Type': image.type || 'image/png' } })
            );
          }
        } catch (err) {
          console.error('SW: failed to store shared image', err);
        }
        // Redirect to main app — browser will load it and JS checks ?shared=1
        return Response.redirect(BASE + '?shared=1', 303);
      })()
    );
    return;
  }

  // Only cache-intercept GET requests
  if (request.method !== 'GET') return;

  // CDN assets (OpenCV.js, Tesseract.js + tessdata): cache-first into CDN_CACHE
  if (request.url.includes('jsdelivr.net') || request.url.includes('tessdata.projectnaptha.com')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CDN_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return new Response('Offline — CDN asset unavailable', { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      // Navigation requests: serve cached shell regardless of query params
      if (request.mode === 'navigate') {
        const cached = await caches.match(BASE);
        if (cached) return cached;
      }

      // Cache-first
      const cached = await caches.match(request);
      if (cached) return cached;

      // Network fallback + cache the response
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Offline with no cache — nothing to serve
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
