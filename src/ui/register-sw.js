// src/ui/register-sw.js
//
// Enregistrement du service worker, extrait d'index.html pour pouvoir poser une CSP sans
// 'unsafe-inline' sur les scripts (voir la balise <meta http-equiv="Content-Security-Policy">).

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Hors ligne indisponible sur ce navigateur : l'app reste utilisable en ligne.
    });
  });
}
