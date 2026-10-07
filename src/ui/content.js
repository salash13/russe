// src/ui/content.js
//
// Charge le contenu (§5) et déclare comment chaque type de carte se présente (§4.3), pour
// que `isPresentable` (src/core/cards.js) sache les reconnaître. La décision de QUELLES
// cartes créer à partir de ce contenu vit dans src/core/seeding.js (sans DOM, testée) —
// ce fichier-ci ne fait que charger les données via fetch().

import { registerCardType } from '../core/cards.js';
import { splitSyllables } from '../core/text.js';
import { sentenceFacets } from '../core/seeding.js';

let cache = null;

/**
 * Charge (une seule fois) letters.json, lots.json, rules.json, pairs.json, units.json et
 * tous les fichiers de content/words/ et content/sentences/ (listés dans leur index.json — le
 * navigateur ne peut pas lister un dossier lui-même), et enregistre les types de carte
 * "letter", "word", "pair" et "sentence".
 */
export async function loadContent() {
  if (cache) return cache;

  const [letters, lots, rules, pairs, units, wordIndex, sentenceIndex] = await Promise.all([
    fetch('content/letters.json').then((r) => r.json()),
    fetch('content/lots.json').then((r) => r.json()),
    fetch('content/rules.json').then((r) => r.json()),
    fetch('content/pairs.json').then((r) => r.json()),
    fetch('content/units.json').then((r) => r.json()),
    fetch('content/words/index.json').then((r) => r.json()),
    fetch('content/sentences/index.json').then((r) => r.json()),
  ]);

  const wordFiles = await Promise.all(
    wordIndex.map((name) => fetch(`content/words/${name}`).then((r) => r.json()))
  );
  const words = wordFiles.flat();
  const sentenceFiles = await Promise.all(
    sentenceIndex.map((name) => fetch(`content/sentences/${name}`).then((r) => r.json()))
  );
  const sentences = sentenceFiles.flat();

  const lettersById = new Map(letters.map((l) => [l.id, l]));
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const pairsById = new Map(pairs.map((p) => [p.id, p]));
  const sentencesById = new Map(sentences.map((s) => [s.id, s]));
  cache = { letters, lots, rules, words, pairs, units, sentences, lettersById, wordsById, pairsById, sentencesById };

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

  // Une carte "sentence:<id>:ordre" (exercice 11, remettre les mots dans l'ordre) ou
  // "sentence:<id>:dictee" (exercice 12, dictée) ne peut être présentée que si la phrase
  // existe et a été relue (§5.5), et que la facette fait partie de celles que
  // core/seeding.js#sentenceFacets lui donne — la même fonction décide de la création des
  // cartes et de leur présentation, elles ne peuvent pas diverger (§4.3).
  registerCardType('sentence', {
    facets: ['ordre', 'dictee'],
    canPresent: (parsed) => {
      const sentence = sentencesById.get(parsed.elementId);
      if (!sentence || sentence.reviewed?.ok !== true) return false;
      return sentenceFacets(sentence).includes(parsed.facet);
    },
  });

  return cache;
}
