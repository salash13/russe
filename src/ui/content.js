// src/ui/content.js
//
// Charge le contenu (§5) et déclare comment chaque type de carte se présente (§4.3), pour
// que `isPresentable` (src/core/cards.js) sache les reconnaître.

import { registerCardType, makeCardId } from '../core/cards.js';
import { splitSyllables } from '../core/text.js';

let cache = null;

/**
 * Charge (une seule fois) letters.json, lots.json, rules.json, pairs.json et tous les
 * fichiers de content/words/ (listés dans words/index.json — le navigateur ne peut pas
 * lister un dossier lui-même), et enregistre les types de carte "letter", "word" et "pair".
 */
export async function loadContent() {
  if (cache) return cache;

  const [letters, lots, rules, pairs, wordIndex] = await Promise.all([
    fetch('content/letters.json').then((r) => r.json()),
    fetch('content/lots.json').then((r) => r.json()),
    fetch('content/rules.json').then((r) => r.json()),
    fetch('content/pairs.json').then((r) => r.json()),
    fetch('content/words/index.json').then((r) => r.json()),
  ]);

  const wordFiles = await Promise.all(
    wordIndex.map((name) => fetch(`content/words/${name}`).then((r) => r.json()))
  );
  const words = wordFiles.flat();

  const lettersById = new Map(letters.map((l) => [l.id, l]));
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const pairsById = new Map(pairs.map((p) => [p.id, p]));
  cache = { letters, lots, rules, words, pairs, lettersById, wordsById, pairsById };

  // Une carte "letter:<id>:son", "letter:<id>:lettre" ou "letter:<id>:cursive" (exercice 5,
  // reconnaître la cursive) ne peut être présentée que si la lettre existe encore dans le
  // contenu chargé (§4.3 : toute carte planifiée doit pouvoir être présentée). La facette
  // "lettre" (entendre le son, deviner la lettre) n'a pas de sens pour Ь/Ъ, qui n'ont aucun
  // son propre ("(muet)") : forcer la synthèse vocale à lire le caractère seul produit un
  // charabia sans rapport avec la lettre.
  registerCardType('letter', {
    facets: ['son', 'lettre', 'cursive', 'trace'],
    canPresent: (parsed) => {
      const letter = lettersById.get(parsed.elementId);
      if (!letter) return false;
      if (parsed.facet === 'lettre' && letter.sound === '(muet)') return false;
      return true;
    },
  });

  // Une carte "word:<id>:ecoute" (exercice 7, taper le mot entendu), "word:<id>:accent"
  // (exercice 4, où est l'accent ?) ou "word:<id>:lecture" (exercice 3, lire à voix haute
  // puis vérifier) ne peut être présentée que si le mot existe ET a été relu par un natif
  // (§2.9, §5.5 : rien n'est publié sans relecture — appliqué ici au niveau du SRS, pas
  // seulement à l'affichage). La facette "accent" n'a de sens que pour un mot d'au moins
  // deux syllabes : sur une seule syllabe, la question n'en est pas une.
  registerCardType('word', {
    facets: ['ecoute', 'accent', 'lecture'],
    canPresent: (parsed) => {
      const word = wordsById.get(parsed.elementId);
      if (!word || word.reviewed?.ok !== true) return false;
      if (parsed.facet === 'accent' && splitSyllables(word.ru).length < 2) return false;
      return true;
    },
  });

  // Une carte "pair:<id>" (exercice 8, §4.2 : paires minimales audio) ne peut être présentée
  // que si la paire ET ses deux mots ont été relus (§2.9, §5.5). Une paire dont un seul des
  // deux mots serait relu resterait ambiguë (on ne peut pas faire deviner "lequel des deux
  // tu entends" si l'app elle-même n'est sûre que d'un des deux).
  registerCardType('pair', {
    canPresent: (parsed) => {
      const pair = pairsById.get(parsed.elementId);
      if (!pair || pair.reviewed?.ok !== true) return false;
      const wordA = wordsById.get(pair.wordA);
      const wordB = wordsById.get(pair.wordB);
      return wordA?.reviewed?.ok === true && wordB?.reviewed?.ok === true;
    },
  });

  return cache;
}

/**
 * Ajoute une carte neuve (due aujourd'hui) pour chaque paire relue (elle et ses deux mots)
 * qui n'a pas encore de carte.
 * @returns {number} le nombre de cartes ajoutées
 */
export function seedPairCards(cardsState, pairs, wordsById, todayKey) {
  let added = 0;
  for (const pair of pairs) {
    if (pair.reviewed?.ok !== true) continue;
    const wordA = wordsById.get(pair.wordA);
    const wordB = wordsById.get(pair.wordB);
    if (wordA?.reviewed?.ok !== true || wordB?.reviewed?.ok !== true) continue;
    const id = makeCardId('pair', pair.id);
    if (cardsState[id]) continue;
    cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
    added++;
  }
  return added;
}

/**
 * Ajoute une carte neuve (due aujourd'hui) pour chaque mot relu qui n'a pas encore de carte,
 * afin qu'il entre dans le cycle normal de séance (découverte puis révision espacée). Les
 * mots non relus n'obtiennent jamais de carte : ils resteront invisibles (§5.5).
 * @returns {number} le nombre de cartes ajoutées
 */
export function seedWordCards(cardsState, words, todayKey) {
  let added = 0;
  for (const word of words) {
    if (word.reviewed?.ok !== true) continue;
    const facets = splitSyllables(word.ru).length >= 2 ? ['ecoute', 'accent', 'lecture'] : ['ecoute', 'lecture'];
    for (const facet of facets) {
      const id = makeCardId('word', word.id, facet);
      if (cardsState[id]) continue;
      cardsState[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: todayKey };
      added++;
    }
  }
  return added;
}

/** Les deux identifiants de carte associés à une lettre (facette "son" et facette "lettre"). */
export function letterCardIds(letterId) {
  return [makeCardId('letter', letterId, 'son'), makeCardId('letter', letterId, 'lettre')];
}
