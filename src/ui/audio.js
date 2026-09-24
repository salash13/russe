// src/ui/audio.js
//
// Synthèse vocale ru-RU (§6.5). Pas de minuterie permanente : la synthèse n'est réveillée
// que pendant une lecture. Rappel du §8 : la synthèse place mal certains accents, elle ne
// doit jamais servir de référence pour la place de l'accent tonique — seulement pour le
// son général d'une lettre ou d'un mot.

let cachedVoice = null;

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  cachedVoice = voices.find((v) => v.lang === 'ru-RU') ?? voices.find((v) => v.lang?.startsWith('ru')) ?? null;
  return cachedVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // La liste des voix peut arriver après le premier appel : on la relit à chaque changement.
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}

/**
 * Prononce un texte russe.
 * @param {string} text
 * @param {{slow?: boolean}} [options] - `slow` ralentit le débit (bouton 🐢, §4.5)
 */
export function speak(text, { slow = false } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = slow ? 0.6 : 1;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
