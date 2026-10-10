// src/ui/exercises.js
//
// Construit les questions des exercices du §4.2 :
//   1 (lettre → son) et 2 (son → lettre), pour une lettre et une facette donnée
//   marches 1 et 2 de l'échelle d'un mot (QCM : sens, puis reconnaître à l'oreille)
//   3 (lire à voix haute puis vérifier), pour un mot
//   4 (où est l'accent ?), pour un mot
//   7 (taper le mot entendu), pour un mot
//   9 (écrire en russe à partir du français), pour un mot
//   8 (paires minimales audio), pour une paire
//   11 (remettre les mots dans l'ordre) et 12 (dictée), pour une phrase
//
// Piège trouvé en diagnostiquant avec Ben (25/09/2026, mesuré via `say` : ~1,3s contre
// ~0,3s) : demander à la synthèse vocale de lire une lettre MAJUSCULE isolée la fait épeler
// en entier (« заглавная буква тэ » = « lettre majuscule T »), alors que la minuscule
// isolée donne juste le son attendu. Le texte donné à la synthèse pour une lettre utilise
// donc toujours la minuscule (audio.js#speak), jamais la majuscule.

import { splitSyllables, withStressMark, sentenceTokens } from '../core/text.js';

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors(letters, correctId, count = 3) {
  const others = letters.filter((l) => l.id !== correctId);
  return shuffle(others).slice(0, count);
}

/** Le feedback qui explique la règle (§2.4) : le faux-ami s'il y en a un, sinon l'indice. */
function explanationFor(letter) {
  return letter.falseFriend ?? letter.hint;
}

/**
 * @param {object} letter - une entrée de content/letters.json
 * @param {'son'|'lettre'} facet - "son" = exercice 1 (lettre → son), "lettre" = exercice 2 (son → lettre)
 * @param {object[]} allLetters - le reste des lettres, pour tirer des distracteurs
 */
export function buildQuestion(letter, facet, allLetters) {
  const distractors = pickDistractors(allLetters, letter.id);

  if (facet === 'son') {
    const options = shuffle([letter, ...distractors]);
    return {
      kind: 'son',
      prompt: `${letter.print} ${letter.lower}`,
      label: 'Quel son fait cette lettre ?',
      correctId: letter.id,
      explanation: explanationFor(letter),
      choices: options.map((l) => ({ id: l.id, label: l.sound })),
    };
  }

  if (facet === 'cursive') {
    // Exercice 5 : reconnaître la cursive. Police décorative approximative (voir l'avertissement
    // affiché avec, app.css) — l'app ne prétend jamais que c'est la vraie écriture scolaire.
    const options = shuffle([letter, ...distractors]);
    return {
      kind: 'cursive',
      prompt: `${letter.print} ${letter.lower}`,
      promptClass: 'cursive',
      label: 'Quelle lettre imprimée est-ce ?',
      correctId: letter.id,
      explanation: explanationFor(letter),
      choices: options.map((l) => ({ id: l.id, label: `${l.print} ${l.lower}`, lang: 'ru' })),
    };
  }

  // facet === 'lettre' : on entend le son, on choisit la lettre correspondante.
  // audioText utilise la MINUSCULE, jamais la majuscule (voir la note en tête de fichier :
  // une majuscule isolée fait dire à la synthèse vocale « lettre majuscule X » en entier).
  const options = shuffle([letter, ...distractors]);
  return {
    kind: 'lettre',
    audioText: letter.lower,
    label: 'Quelle lettre entends-tu ?',
    correctId: letter.id,
    explanation: explanationFor(letter),
    choices: options.map((l) => ({ id: l.id, label: `${l.print} ${l.lower}`, lang: 'ru' })),
  };
}

/**
 * Exercice 7 (§4.2) : écouter un mot et le taper au clavier. La tolérance de saisie
 * (ё/е, accent, majuscules, "presque") est appliquée par core/text.js#compareAnswer, pas ici.
 * @param {object} word - une entrée de content/words/*.json
 */
export function buildWordListening(word) {
  return {
    kind: 'type',
    audioText: word.ru,
    label: 'Écoute et tape le mot que tu entends',
    expected: word.ru,
    explanation: `${word.ru} — ${word.fr}`,
  };
}

/**
 * Exercice 9 (§4.2) : voir le mot en français et l'écrire en russe. Production pure, sans
 * audio avant de répondre (il donnerait la réponse) : le mot est joué avec la correction.
 * @param {object} word - une entrée de content/words/*.json (vocabulaire A1+, "fr" sans cyrillique)
 */
export function buildFrRuQuestion(word) {
  return {
    kind: 'fr-ru',
    prompt: word.fr,
    label: 'Écris ce mot en russe',
    expected: word.ru,
    audioText: word.ru,
    explanation: word.note ? `${word.ru} — ${word.fr}. ${word.note}` : `${word.ru} — ${word.fr}`,
  };
}

/**
 * Exercice 6 (§4.2) : tracer une lettre en cursive avec le doigt. Auto-évalué, comme
 * l'exercice 3 : sans données de référence fiables sur le tracé exact (§8 du document —
 * aucune police fiable trouvée, voir app.css), l'app ne peut pas juger un tracé, seulement
 * montrer une forme approximative et laisser l'utilisateur s'auto-évaluer.
 * @param {object} letter - une entrée de content/letters.json
 */
export function buildTraceQuestion(letter) {
  return {
    kind: 'trace',
    displayLetter: `${letter.print} ${letter.lower}`,
    label: 'Trace cette lettre avec ton doigt, puis vérifie',
    explanation: `${letter.print} ${letter.lower} — ${letter.hint}`,
  };
}

/**
 * Exercice 3 (§4.2) : lire un mot à voix haute, puis vérifier avec l'audio. Auto-évalué :
 * l'app ne peut pas juger la prononciation, c'est la note choisie ensuite (§4.3) qui compte
 * comme résultat.
 * @param {object} word - une entrée de content/words/*.json
 * @param {{showStress?: boolean}} [options] - accent affiché ou non (§2.7 : « toujours
 *   stocké, affiché au début, puis retiré progressivement comme une béquille » — réglage
 *   "accent affiché" de l'écran Réglages)
 */
export function buildReadAloudQuestion(word, { showStress = true } = {}) {
  return {
    kind: 'read',
    displayRu: showStress ? withStressMark(word.ru, word.stress) : word.ru,
    audioText: word.ru,
    label: 'Lis ce mot à voix haute, puis vérifie',
    explanation: `${word.ru} — ${word.fr}`,
  };
}

/**
 * Exercice 8 (§4.2) : paires minimales audio (брат/брать, за́мок/замо́к). L'un des deux mots
 * est tiré au hasard et joué ; les deux choix affichent TOUJOURS l'accent, quel que soit le
 * réglage "accent affiché" — pour за́мок/замо́к (même orthographe), le masquer rendrait les
 * deux choix strictement identiques et l'exercice impossible à répondre par la vue.
 * @param {object} pair - une entrée de content/pairs.json
 * @param {Map<string, object>} wordsById
 */
export function buildPairQuestion(pair, wordsById) {
  const wordA = wordsById.get(pair.wordA);
  const wordB = wordsById.get(pair.wordB);
  const played = Math.random() < 0.5 ? wordA : wordB;
  return {
    kind: 'pair',
    audioText: played.ru,
    label: 'Lequel des deux entends-tu ?',
    correctId: played.id,
    explanation: `${withStressMark(wordA.ru, wordA.stress)} (${wordA.fr}) / ${withStressMark(wordB.ru, wordB.stress)} (${wordB.fr}) — ${pair.note}`,
    choices: shuffle([wordA, wordB]).map((w) => ({
      id: w.id,
      label: withStressMark(w.ru, w.stress),
      lang: 'ru',
    })),
  };
}

/**
 * Exercice 4 (§4.2) : toucher la syllabe accentuée. `word.stress` (1 = première syllabe)
 * vient du contenu (§5.3) ; le découpage en syllabes suit core/text.js#splitSyllables.
 * @param {object} word - une entrée de content/words/*.json, avec au moins 2 syllabes
 */
export function buildAccentQuestion(word) {
  const syllables = splitSyllables(word.ru);
  const correctIndex = word.stress - 1;
  return {
    kind: 'accent',
    label: 'Où est l\'accent ?',
    syllables,
    correctIndex,
    // Affiché dans le feedback en cas d'erreur : la syllabe accentuée en majuscules.
    expected: syllables.map((s, i) => (i === correctIndex ? s.toUpperCase() : s)).join('-'),
    explanation: `${word.ru} — ${word.fr}`,
  };
}

/** Ce que le feedback d'une phrase explique (§2.4) : la traduction, puis la note s'il y en a une. */
function sentenceExplanation(sentence) {
  return sentence.note ? `${sentence.fr} — ${sentence.note}` : sentence.fr;
}

/**
 * Les tuiles de l'exercice 11, dans l'ordre de la phrase. Un mot qui ouvre une phrase perd
 * sa majuscule : sinon la tuile « Меня » ou « А » donnerait d'emblée le début de chaque
 * phrase. Les noms propres ailleurs (« Бен ») gardent la leur.
 */
function orderTiles(ru) {
  const tiles = [];
  let startsSentence = true;
  for (const chunk of ru.split(/\s+/)) {
    const [token] = sentenceTokens(chunk);
    if (token) tiles.push(startsSentence ? token.charAt(0).toLowerCase() + token.slice(1) : token);
    if (/[.!?…]$/.test(chunk)) startsSentence = true;
    else if (token) startsSentence = false;
  }
  return tiles;
}

/**
 * Exercice 11 (§4.2) : remettre les mots d'une phrase dans l'ordre, la traduction française
 * servant de guide. Les tuiles sont mélangées, jamais présentées déjà dans le bon ordre.
 * @param {object} sentence - une entrée de content/sentences/*.json (au moins 3 mots)
 */
export function buildOrderQuestion(sentence) {
  const tiles = orderTiles(sentence.ru);
  let shuffled = shuffle(tiles);
  for (let tries = 0; tries < 10 && shuffled.join(' ') === tiles.join(' '); tries++) shuffled = shuffle(tiles);
  return {
    kind: 'ordre',
    label: 'Remets les mots dans l\'ordre',
    fr: sentence.fr,
    tiles: shuffled,
    sentence: sentence.ru,
    alternatives: sentence.orderAlternatives ?? [],
    audioText: sentence.ru,
    expected: sentence.ru,
    explanation: sentenceExplanation(sentence),
  };
}

/**
 * Exercice 12 (§4.2) : écouter une phrase et l'écrire. La ponctuation est ignorée à la
 * correction (core/text.js#compareSentence), en plus de la tolérance habituelle.
 * @param {object} sentence - une entrée de content/sentences/*.json
 */
export function buildDictationQuestion(sentence) {
  return {
    kind: 'dictee',
    audioText: sentence.ru,
    label: 'Écoute et écris la phrase',
    expected: sentence.ru,
    explanation: sentenceExplanation(sentence),
  };
}

/**
 * Des mots pour servir de mauvaises réponses à un QCM sur `word` : d'abord ceux de la même
 * unité (même thème, donc pas éliminables d'un coup d'œil), puis les autres. Jamais un mot
 * qui s'écrit pareil (замок / замок) ni qui a la même traduction : il serait juste aussi.
 */
function wordDistractors(word, allWords, count = 3) {
  const candidates = allWords.filter(
    (w) => w.reviewed?.ok === true && w.id !== word.id && w.ru !== word.ru && w.fr !== word.fr
  );
  const sameUnit = shuffle(candidates.filter((w) => w.unit === word.unit));
  const others = shuffle(candidates.filter((w) => w.unit !== word.unit));
  return [...sameUnit, ...others].slice(0, count);
}

/**
 * Marche 1 de l'échelle d'un mot (core/seeding.js#wordLevels) : lire le mot russe, choisir
 * sa traduction parmi 4. Le premier contact après la fiche de découverte est un QCM (§2.3).
 * @param {object} word
 * @param {object[]} allWords - tout le vocabulaire chargé, pour les mauvaises réponses
 * @param {{showStress?: boolean}} [options] - accent affiché ou non (réglage, §2.7)
 */
export function buildMeaningQuestion(word, allWords, { showStress = true } = {}) {
  const options = shuffle([word, ...wordDistractors(word, allWords)]);
  return {
    kind: 'sens',
    prompt: showStress ? withStressMark(word.ru, word.stress) : word.ru,
    promptClass: 'prompt-word',
    label: 'Que veut dire ce mot ?',
    correctId: word.id,
    audioText: null,
    explanation: `${word.ru} — ${word.fr}`,
    choices: options.map((w) => ({ id: w.id, label: w.fr })),
  };
}

/**
 * Marche 2 : entendre le mot et le retrouver parmi 4 mots russes écrits (QCM). Fait le lien
 * entre le son et l'écrit avant de demander de le produire (marche 4).
 */
export function buildRecognizeQuestion(word, allWords) {
  const options = shuffle([word, ...wordDistractors(word, allWords)]);
  return {
    kind: 'reconnaitre',
    audioText: word.ru,
    label: 'Quel mot entends-tu ?',
    correctId: word.id,
    explanation: `${word.ru} — ${word.fr}`,
    choices: options.map((w) => ({ id: w.id, label: w.ru, lang: 'ru' })),
  };
}
