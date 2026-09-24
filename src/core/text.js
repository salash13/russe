// src/core/text.js
//
// Comparaison d'une saisie avec la réponse attendue, avec la tolérance décrite au §4.2 :
// е accepté à la place de ё, accent tonique ignoré, majuscules ignorées. Une faute d'une
// seule lettre est signalée « presque » plutôt que simplement fausse.

const STRESS_MARK = '́'; // accent aigu combinant, utilisé pour marquer la syllabe tonique (напр. молоко́)

/** Retire les marques d'accent tonique combinantes d'un texte russe accentué. */
export function stripStress(text) {
  return text.normalize('NFC').replace(new RegExp(STRESS_MARK, 'g'), '');
}

/** Normalise une chaîne pour la comparaison : accent, ё/е, casse, espaces superflus. */
export function normalize(text) {
  return stripStress(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Distance de Levenshtein : nombre minimal d'insertions/suppressions/substitutions. */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // suppression
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution (ou caractère correct si cost = 0)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Compare une saisie à la réponse attendue avec la tolérance du §4.2.
 * @param {string} input - ce que l'utilisateur a tapé
 * @param {string} expected - la réponse attendue (peut porter un accent tonique)
 * @returns {{correct: boolean, close: boolean, distance: number}}
 *   `close` signale une faute d'une seule lettre (« presque »), à afficher avec la différence.
 */
export function compareAnswer(input, expected) {
  const a = normalize(input);
  const b = normalize(expected);
  if (a === b) return { correct: true, close: false, distance: 0 };
  const distance = levenshtein(a, b);
  return { correct: false, close: distance === 1, distance };
}
