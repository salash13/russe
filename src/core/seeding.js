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
 * Crée la carte d'une paire relue (elle et ses deux mots) une fois que le sens des deux mots
 * est acquis (marche 1 de l'échelle) : distinguer брат de брать à l'oreille n'a d'intérêt
 * qu'une fois qu'on sait ce que chacun veut dire. Une carte de paire jamais présentée dont
 * les conditions ne sont plus remplies est retirée (comme pour les mots).
 * @returns {number} le nombre de cartes ajoutées ou retirées
 */
export function seedPairCards(cardsState, pairs, wordsById, todayKey, units = [], words = []) {
  const meaningKnown = (word) => isAcquired(cardsState[makeCardId('word', word.id, 'sens')]);
  let changes = 0;
  for (const pair of pairs) {
    const wordA = wordsById.get(pair.wordA);
    const wordB = wordsById.get(pair.wordB);
    const available =
      pair.reviewed?.ok === true &&
      [wordA, wordB].every(
        (w) =>
          w?.reviewed?.ok === true && isUnitUnlocked(w.unit, { units, words, cards: cardsState }) && meaningKnown(w)
      );
    const id = makeCardId('pair', pair.id);
    if (available && !cardsState[id]) {
      cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
      changes++;
    } else if (!available && cardsState[id]?.reps === 0) {
      delete cardsState[id];
      changes++;
    }
  }
  return changes;
}

/**
 * Une carte est « acquise » quand sa mémoire tient au moins 3 jours selon FSRS (§4.3) : il
 * faut en pratique l'avoir réussie, puis la réussir encore lors d'une révision espacée (une
 * première bonne réponse seule donne ~2,4 jours ; une erreur fait retomber sous le seuil).
 * C'est le critère unique pour monter d'une marche, partout dans ce fichier.
 */
export const ACQUIRED_STABILITY_DAYS = 3;

export function isAcquired(card) {
  return card != null && card.reps > 0 && card.stability >= ACQUIRED_STABILITY_DAYS;
}

/**
 * Les marches d'un mot, de la plus facile à la plus dure (§2.3 : le QCM pour débuter, la
 * production pour consolider). Signalé par Ben le 10/10/2026 : un mot nouveau passait
 * directement de la fiche de découverte à « écoute et tape le mot » — trop dur d'un coup.
 *   1. "sens"        voir le mot russe, choisir sa traduction (QCM) ;
 *   2. "reconnaitre" entendre le mot, le choisir parmi 4 mots russes (QCM) ;
 *   3. "lecture"     lire à voix haute (exercice 3) et "accent" (exercice 4, 2 syllabes ou plus) ;
 *   4. "ecoute"      taper le mot entendu (exercice 7) et "fr-ru" (exercice 9, seulement pour
 *                    le vocabulaire du programme A1+ : sur un mot transparent N0 comme такси,
 *                    la consigne française donnerait la réponse).
 * @returns {string[][]} les facettes de chaque marche, dans l'ordre
 */
export function wordLevels(word, units = []) {
  const reading = ['lecture'];
  if (splitSyllables(word.ru).length >= 2) reading.push('accent');
  const production = ['ecoute'];
  if (units.some((u) => u.id === word.unit)) production.push('fr-ru');
  return [['sens'], ['reconnaitre'], reading, production];
}

/**
 * Toutes les facettes possibles d'un mot, toutes marches confondues. Sert à décider si une
 * carte est présentable (src/ui/content.js) — une carte déjà créée le reste, même si l'on
 * change plus tard les règles de déblocage (§4.3 : toute carte planifiée est présentable).
 */
export function wordFacets(word, units = []) {
  return wordLevels(word, units).flat();
}

/**
 * Les lettres (identifiants de content/letters.json) dont un mot a besoin pour être lu.
 * @param {Map<string, object>} lettersByLower - lettre minuscule → entrée de letters.json
 */
export function lettersOfWord(word, lettersByLower) {
  const ids = new Set();
  for (const ch of word.ru.toLowerCase()) {
    const letter = lettersByLower.get(ch);
    if (letter) ids.add(letter.id);
  }
  return [...ids];
}

/**
 * Les facettes d'un mot débloquées en ce moment : la première marche, puis chaque marche
 * suivante dès que toutes les cartes de la précédente sont acquises.
 */
export function unlockedWordFacets(word, cardsState, units = []) {
  const unlocked = [];
  for (const level of wordLevels(word, units)) {
    unlocked.push(...level);
    const done = level.every((facet) => isAcquired(cardsState[makeCardId('word', word.id, facet)]));
    if (!done) break;
  }
  return unlocked;
}

/**
 * Met les cartes de mots en accord avec l'échelle (§2.3) et l'ordre des unités (§2.6) :
 *   - un mot relu (§5.5), d'une unité débloquée, et dont toutes les lettres sont acquises
 *     (§3.2 : on ne lit que des mots faits de lettres déjà sues — Ben avait reçu кино sans
 *     maîtriser le н, faux-ami du H latin) reçoit une carte neuve pour chaque facette
 *     débloquée qu'il n'a pas encore ;
 *   - une carte jamais présentée (reps = 0) d'une facette qui n'est pas (ou plus) débloquée
 *     est retirée : elle n'a aucun historique à perdre, elle sera recréée le moment venu.
 *     Une carte déjà travaillée n'est jamais retirée.
 * @param {object[]|null} letters - content/letters.json ; null = pas de contrôle des lettres
 * @returns {number} le nombre de cartes ajoutées ou retirées (0 = rien à enregistrer)
 */
export function seedWordCards(cardsState, words, todayKey, units = [], letters = null) {
  const lettersByLower = letters ? new Map(letters.map((l) => [l.lower, l])) : null;
  const lettersKnown = (word) =>
    !lettersByLower ||
    lettersOfWord(word, lettersByLower).every((id) => isAcquired(cardsState[makeCardId('letter', id, 'son')]));

  let changes = 0;
  for (const word of words) {
    const available =
      word.reviewed?.ok === true &&
      isUnitUnlocked(word.unit, { units, words, cards: cardsState }) &&
      lettersKnown(word);
    const unlocked = available ? unlockedWordFacets(word, cardsState, units) : [];

    for (const facet of wordFacets(word, units)) {
      const id = makeCardId('word', word.id, facet);
      if (unlocked.includes(facet)) {
        if (cardsState[id]) continue;
        cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
        changes++;
      } else if (cardsState[id] && cardsState[id].reps === 0) {
        delete cardsState[id];
        changes++;
      }
    }
  }
  return changes;
}

/** Nombre minimal de mots pour que « remettre dans l'ordre » (exercice 11) ait un sens. */
export const MIN_TOKENS_FOR_ORDER = 3;

/**
 * Les facettes d'une phrase, dans l'ordre de l'échelle : remettre dans l'ordre (exercice 11,
 * à partir de 3 mots) d'abord, la dictée (exercice 12, plus dure) ensuite.
 */
export function sentenceFacets(sentence) {
  return sentenceTokens(sentence.ru).length >= MIN_TOKENS_FOR_ORDER ? ['ordre', 'dictee'] : ['dictee'];
}

/**
 * Met les cartes de phrases en accord avec l'échelle : une phrase relue (§5.5), d'une unité
 * débloquée (§2.6), dont le sens de tous les mots du vocabulaire référencés (champ "words",
 * §5.4) est acquis (§2.2 : pas de phrase faite de mots pas encore sus) reçoit sa première
 * facette, puis la suivante (la dictée) une fois la précédente acquise. Les mots marqués
 * null (prénom, tournure expliquée dans la note) ne bloquent rien. Comme pour les mots, une
 * carte jamais présentée d'une facette qui n'est pas (ou plus) débloquée est retirée.
 * @returns {number} le nombre de cartes ajoutées ou retirées
 */
export function seedSentenceCards(cardsState, sentences, words, todayKey, units = []) {
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const meaningKnown = (wordId) =>
    wordsById.get(wordId)?.reviewed?.ok === true && isAcquired(cardsState[makeCardId('word', wordId, 'sens')]);

  let changes = 0;
  for (const sentence of sentences) {
    const available =
      sentence.reviewed?.ok === true &&
      isUnitUnlocked(sentence.unit, { units, words, cards: cardsState }) &&
      (sentence.words ?? []).filter((id) => id != null).every(meaningKnown);

    const facets = sentenceFacets(sentence);
    const unlocked = [];
    if (available) {
      for (const facet of facets) {
        unlocked.push(facet);
        if (!isAcquired(cardsState[makeCardId('sentence', sentence.id, facet)])) break;
      }
    }
    for (const facet of facets) {
      const id = makeCardId('sentence', sentence.id, facet);
      if (unlocked.includes(facet)) {
        if (cardsState[id]) continue;
        cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
        changes++;
      } else if (cardsState[id]?.reps === 0) {
        delete cardsState[id];
        changes++;
      }
    }
  }
  return changes;
}
