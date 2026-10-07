// src/core/seeding.js
//
// Décide quelles cartes neuves créer à partir du contenu relu (§5.5) et de l'ordre des
// unités (§2.6, content/units.json) — sans dépendance au DOM, testable dans Node. Séparé de
// src/ui/content.js (qui ne garde que le chargement par fetch() et la déclaration des types
// de carte) : cette logique décide QUOI créer, content.js s'occupe seulement de charger les
// données depuis lesquelles elle décide.

import { makeCardId, parseCardId } from './cards.js';
import { splitSyllables, sentenceTokens } from './text.js';

/**
 * Une unité absente de units.json (ex. "n0-lecture", "n0-pairs" : contenu de lecture
 * d'avant le programme A1) est toujours débloquée. Une unité du programme A1 ne l'est que
 * si toutes les unités qui la précèdent (ordre de units.json) ont déjà la totalité de leurs
 * mots relus introduits au moins une fois (une carte avec reps > 0) — §2.6 : « une règle à
 * la fois, dans l'ordre », jamais de nouveau contenu qui arrive en vrac. Une unité encore
 * vide (aucun mot relu qui lui appartient) ne bloque personne : il n'y a rien à introduire.
 */
export function isUnitUnlocked(unitId, { units, words, cards }) {
  const target = units.find((u) => u.id === unitId);
  if (!target) return true;

  const introduced = (wordId) =>
    Object.entries(cards).some(([id, card]) => {
      const parsed = parseCardId(id);
      return parsed.type === 'word' && parsed.elementId === wordId && card.reps > 0;
    });

  return units
    .filter((u) => u.order < target.order)
    .every((prior) =>
      words.filter((w) => w.unit === prior.id && w.reviewed?.ok === true).every((w) => introduced(w.id))
    );
}

/**
 * Ajoute une carte neuve (due aujourd'hui) pour chaque paire relue (elle et ses deux mots)
 * qui n'a pas encore de carte, et dont l'unité des deux mots est débloquée.
 * @returns {number} le nombre de cartes ajoutées
 */
export function seedPairCards(cardsState, pairs, wordsById, todayKey, units = [], words = []) {
  let added = 0;
  for (const pair of pairs) {
    if (pair.reviewed?.ok !== true) continue;
    const wordA = wordsById.get(pair.wordA);
    const wordB = wordsById.get(pair.wordB);
    if (wordA?.reviewed?.ok !== true || wordB?.reviewed?.ok !== true) continue;
    if (!isUnitUnlocked(wordA.unit, { units, words, cards: cardsState })) continue;
    if (!isUnitUnlocked(wordB.unit, { units, words, cards: cardsState })) continue;
    const id = makeCardId('pair', pair.id);
    if (cardsState[id]) continue;
    cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
    added++;
  }
  return added;
}

/**
 * Les facettes d'un mot, c'est-à-dire les exercices qui le travaillent (§4.2) :
 *   - "ecoute" (7, taper le mot entendu) et "lecture" (3, lire à voix haute) : toujours ;
 *   - "accent" (4, où est l'accent ?) : à partir de 2 syllabes, sinon la question n'en est pas une ;
 *   - "fr-ru" (9, écrire en russe à partir du français) : seulement pour le vocabulaire du
 *     programme (unité présente dans units.json, A1+). Les mots de lecture N0 sont des mots
 *     transparents (такси = taxi) : la consigne française y donnerait déjà la réponse.
 * Même fonction pour créer les cartes (ici) et décider si elles sont présentables
 * (src/ui/content.js) : les deux ne peuvent pas diverger (§4.3).
 */
export function wordFacets(word, units = []) {
  const facets = ['ecoute'];
  if (splitSyllables(word.ru).length >= 2) facets.push('accent');
  facets.push('lecture');
  if (units.some((u) => u.id === word.unit)) facets.push('fr-ru');
  return facets;
}

/**
 * Ajoute une carte neuve (due aujourd'hui) pour chaque mot relu dont l'unité est débloquée
 * et qui n'a pas encore de carte, afin qu'il entre dans le cycle normal de séance
 * (découverte puis révision espacée). Les mots non relus n'obtiennent jamais de carte : ils
 * resteront invisibles (§5.5). Les mots d'une unité pas encore débloquée non plus : ils
 * attendront que l'unité précédente soit introduite en entier (§2.6).
 * @returns {number} le nombre de cartes ajoutées
 */
export function seedWordCards(cardsState, words, todayKey, units = []) {
  let added = 0;
  for (const word of words) {
    if (word.reviewed?.ok !== true) continue;
    if (!isUnitUnlocked(word.unit, { units, words, cards: cardsState })) continue;
    for (const facet of wordFacets(word, units)) {
      const id = makeCardId('word', word.id, facet);
      if (cardsState[id]) continue;
      cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
      added++;
    }
  }
  return added;
}

/** Nombre minimal de mots pour que « remettre dans l'ordre » (exercice 11) ait un sens. */
export const MIN_TOKENS_FOR_ORDER = 3;

/** Les facettes d'une phrase : la dictée toujours, l'ordre seulement à partir de 3 mots. */
export function sentenceFacets(sentence) {
  return sentenceTokens(sentence.ru).length >= MIN_TOKENS_FOR_ORDER ? ['ordre', 'dictee'] : ['dictee'];
}

/**
 * Ajoute une carte neuve (due aujourd'hui) pour chaque facette de chaque phrase relue
 * (§5.5) dont l'unité est débloquée (§2.6) et dont tous les mots du vocabulaire qu'elle
 * référence (champ "words", §5.4) ont déjà été introduits au moins une fois : on ne fait
 * pas remettre dans l'ordre une phrase faite de mots jamais vus (§2.2). Les mots marqués
 * null (prénom, tournure expliquée dans la note de la phrase) ne bloquent rien.
 * @returns {number} le nombre de cartes ajoutées
 */
export function seedSentenceCards(cardsState, sentences, words, todayKey, units = []) {
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const introduced = (wordId) =>
    Object.entries(cardsState).some(([id, card]) => {
      const parsed = parseCardId(id);
      return parsed.type === 'word' && parsed.elementId === wordId && card.reps > 0;
    });

  let added = 0;
  for (const sentence of sentences) {
    if (sentence.reviewed?.ok !== true) continue;
    if (!isUnitUnlocked(sentence.unit, { units, words, cards: cardsState })) continue;
    const wordIds = (sentence.words ?? []).filter((id) => id != null);
    if (!wordIds.every((id) => wordsById.get(id)?.reviewed?.ok === true && introduced(id))) continue;
    for (const facet of sentenceFacets(sentence)) {
      const id = makeCardId('sentence', sentence.id, facet);
      if (cardsState[id]) continue;
      cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
      added++;
    }
  }
  return added;
}
