// sw.js
//
// Service worker : mise en cache pour l'usage hors ligne réel (§6.6). Le nom du cache
// contient la version : il change à chaque publication pour ne jamais mélanger ancien
// code et nouveau contenu (les anciens caches sont supprimés à l'activation).

const CACHE_NAME = 'russe-v2';

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

// Réseau d'abord, cache en secours seulement si hors ligne. Pendant que le projet bouge
// encore beaucoup, "cache d'abord" a un vrai coût : une page déjà ouverte resert le vieux
// code tant que le nom du cache n'a pas changé, même après une correction poussée en ligne.
// "Réseau d'abord" élimine ce risque quand il y a du réseau, et garde le hors-ligne réel
// (§6.6) grâce au cache pris en secours.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
