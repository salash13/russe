// src/ui/dom.js
//
// Rendu minimal, sans framework (§6.1). Toute valeur interpolée dans un template passe par
// h() : jamais de concaténation brute qui laisserait passer du HTML non voulu.

/** Échappe une valeur pour une insertion sûre dans du HTML (&, <, >, ", '). */
export function h(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Le conteneur racine de l'application (id="app" dans index.html). */
export function appRoot() {
  return document.getElementById('app');
}
