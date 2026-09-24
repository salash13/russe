// sw.js
//
// Service worker : mise en cache pour l'usage hors ligne réel (§6.6). Le nom du cache
// contient la version : il change à chaque publication pour ne jamais mélanger ancien
// code et nouveau contenu (les anciens caches sont supprimés à l'activation).

const CACHE_NAME = 'russe-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/ui/app.css',
  './src/ui/app.js',
  './src/ui/dom.js',
  './src/ui/audio.js',
  './src/ui/content.js',
  './src/ui/exercises.js',
  './src/ui/questionView.js',
  './src/ui/screens/home.js',
  './src/ui/screens/placementTest.js',
  './src/ui/screens/sessionScreen.js',
  './src/core/dates.js',
  './src/core/text.js',
  './src/core/cards.js',
  './src/core/srs.js',
  './src/core/migrate.js',
  './src/core/storage.js',
  './src/core/session.js',
  './content/letters.json',
  './content/lots.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord, réseau en secours (et mise à jour du cache quand le réseau répond) :
// l'app doit s'ouvrir même sans connexion, y compris juste après une mise à jour de contenu.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});
