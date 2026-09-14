const CACHE_NAME = 'cuaderno-vallecas-v3';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cacheamos peticiones GET del propio origen (no el CDN de Chart.js ni Google Fonts)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  // "Red primero": si hay internet, coge siempre la versión más nueva del
  // servidor (y actualiza la copia guardada). Solo si no hay conexión,
  // usa la última copia guardada — así una actualización de la app no se
  // queda "pillada" en una versión vieja mientras tengas internet.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
