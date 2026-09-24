// src/ui/audio.js
//
// Synthèse vocale ru-RU (§6.5). Pas de minuterie permanente : la synthèse n'est réveillée
// que pendant une lecture. Rappel du §8 : la synthèse place mal certains accents, elle ne
// doit jamais servir de référence pour la place de l'accent tonique — seulement pour le
// son général d'une lettre ou d'un mot.
//
// Deux pièges rencontrés et corrigés en diagnostiquant en direct avec Ben (24/09/2026) :
//
// 1. Chrome propose souvent DEUX voix russes : une locale (ex. "Milena", `localService:
//    true`, fonctionne hors ligne) et une "en ligne" (ex. "Google русский", `localService:
//    false`, passe par un serveur Google). Laisser le navigateur choisir seul via `lang`
//    peut sélectionner la voix en ligne, qui échoue en silence si ce service n'est pas
//    joignable. On sélectionne donc toujours explicitement une voix locale quand il y en a
//    une.
//
// 2. Sur certains navigateurs (notamment Safari/WebKit), getVoices() peut renvoyer un
//    tableau vide pendant plusieurs secondes après le chargement, sans que "voiceschanged"
//    se déclenche de façon fiable. On retente donc activement getVoices() à intervalles
//    courts pendant quelques secondes au démarrage (primeVoices()).
//
// (Un Chrome install sur un Mac particulier s'est aussi révélé avoir sa propre implémentation
// de speechSynthesis durablement cassée — aucun son, dans aucune configuration, alors que
// Firefox et la commande `say` du système fonctionnaient très bien. Rien à corriger côté
// code dans ce cas : c'est à l'utilisateur de changer de navigateur.)

let cachedVoice = null;
let voicesLoaded = false;

function refreshVoiceCache() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (voices.length > 0) voicesLoaded = true;
  const ru = voices.filter((v) => v.lang === 'ru-RU' || v.lang?.startsWith('ru'));
  cachedVoice = ru.find((v) => v.localService) ?? ru[0] ?? null;
  return voices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoiceCache);
}

/** À appeler tôt (au démarrage de l'app) pour que la voix soit déjà en cache au premier tapotement. */
export function primeVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  refreshVoiceCache();
  if (voicesLoaded) return;
  let attempts = 0;
  const retry = setInterval(() => {
    attempts++;
    refreshVoiceCache();
    if (voicesLoaded || attempts >= 20) clearInterval(retry); // ~5 secondes au total
  }, 250);
}

/**
 * Vrai si une voix russe a été trouvée sur cet appareil. Tant que `primeVoices()` (ou un
 * premier `speak()`) n'a pas encore reçu la liste des voix, renvoie `null` (indéterminé)
 * plutôt que `false`, pour ne pas afficher un avertissement à tort pendant le chargement.
 */
export function hasRussianVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  if (!voicesLoaded) return null;
  return cachedVoice != null;
}

/**
 * Prononce un texte russe.
 * @param {string} text
 * @param {{slow?: boolean}} [options] - `slow` ralentit le débit (bouton 🐢, §4.5)
 */
export function speak(text, { slow = false } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  if (!voicesLoaded) refreshVoiceCache();

  // Annule toute lecture en cours ou en attente avant de parler : sans ça, les lectures
  // s'empilent dans la file du navigateur, et si l'utilisateur avance plus vite que la
  // voix ne parle, on peut entendre une ancienne question pendant que l'écran en affiche
  // déjà une nouvelle (une seule chose à la fois doit être audible).
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = slow ? 0.6 : 1;
  if (cachedVoice) utterance.voice = cachedVoice;
  // eslint-disable-next-line no-console -- utile pour diagnostiquer un appareil muet
  utterance.onerror = (event) => console.warn('Synthèse vocale : échec de la lecture', event.error);
  window.speechSynthesis.speak(utterance);
}
