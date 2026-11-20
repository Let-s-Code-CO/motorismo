/**
 * Motorismo service worker (spec 006, HU-02). Plain JavaScript, served as is from /sw.js.
 *
 * Its only job: when opening or reloading a page fails for lack of network, answer with the
 * "Sin conexión" page instead of the browser's error (CA-09), under the same address, so
 * «Reintentar» reloads where the person was going (CA-11).
 *
 * RN-02: it keeps nothing but that page and its icon (the same for everyone). It never stores the
 * app's pages or anyone's data, and any other request (page data, Server Actions, Supabase, the
 * app's scripts) goes to the network exactly as without it. Changing what is kept means a new
 * CACHE name: the old one is deleted on activate.
 */
const CACHE = 'motorismo-offline-v1';
const OFFLINE_PAGE = '/offline';
const OFFLINE_ICON = '/icons/icon-192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_PAGE, OFFLINE_ICON]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_PAGE).then((page) => page || Response.error())
      )
    );
    return;
  }

  const url = new URL(request.url);
  if (
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname === OFFLINE_ICON
  ) {
    event.respondWith(caches.match(OFFLINE_ICON).then((icon) => icon || fetch(request)));
  }
});
