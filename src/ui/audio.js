// src/ui/audio.js
//
// Synthèse vocale ru-RU (§6.5). Pas de minuterie permanente : la synthèse n'est réveillée
// que pendant une lecture. Rappel du §8 : la synthèse place mal certains accents, elle ne
// doit jamais servir de référence pour la place de l'accent tonique — seulement pour le
// son général d'une lettre ou d'un mot.
//
// Piège connu sur Chrome/Android : la liste des voix arrive parfois de façon asynchrone
// (évènement "voiceschanged"), après le chargement de la page.
//
// Piège connu sur Safari/WebKit, plus tenace : getVoices() peut renvoyer un tableau vide
// pendant plusieurs secondes après le chargement, sans que "voiceschanged" se déclenche de
// façon fiable pour autant — alors même que la voix existe au niveau du système (confirmé
// ici : `say -v Milena` fonctionne, mais speechSynthesis.getVoices() reste vide un bon
// moment). On retente donc activement getVoices() à intervalles courts pendant quelques
// secondes au démarrage (primeVoices()), sans jamais bloquer un appel à speak() déclenché
// par un tapotement (un blocage casserait le geste utilisateur exigé par certains
// navigateurs pour autoriser le son).

let cachedVoice = null;
let voicesLoaded = false;

function refreshVoiceCache() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (voices.length > 0) voicesLoaded = true;
  cachedVoice = voices.find((v) => v.lang === 'ru-RU') ?? voices.find((v) => v.lang?.startsWith('ru')) ?? null;
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

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = slow ? 0.6 : 1;
  if (cachedVoice) utterance.voice = cachedVoice;
  // eslint-disable-next-line no-console -- utile pour diagnostiquer un appareil muet
  utterance.onerror = (event) => console.warn('Synthèse vocale : échec de la lecture', event.error);

  const synth = window.speechSynthesis;
  const startSpeaking = () => synth.speak(utterance);

  // Bug connu de Chrome/Safari (desktop et mobile) : enchaîner cancel() puis speak() dans
  // le même tick peut faire disparaître l'utterance en silence, surtout si le moteur
  // n'était pas déjà en train de parler (le cancel() est asynchrone en coulisses). On
  // n'annule donc que s'il y a réellement quelque chose en cours, avec un court délai
  // avant de reparler pour laisser l'annulation se terminer.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(startSpeaking, 50);
  } else {
    startSpeaking();
  }
}
