// src/core/text.js
//
// Comparaison d'une saisie avec la réponse attendue, avec la tolérance décrite au §4.2 :
// е accepté à la place de ё, accent tonique ignoré, majuscules ignorées. Une faute d'une
// seule lettre est signalée « presque » plutôt que simplement fausse.

const STRESS_MARK = '́'; // accent aigu combinant, utilisé pour marquer la syllabe tonique (напр. молоко́)
const RUSSIAN_VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я']);

/** Retire les marques d'accent tonique combinantes d'un texte russe accentué. */
export function stripStress(text) {
  return text.normalize('NFC').replace(new RegExp(STRESS_MARK, 'g'), '');
}

/**
 * Insère la marque d'accent tonique après la voyelle de la syllabe accentuée (§2.7 :
 * l'accent est toujours stocké et affiché au début, ex. молоко́). `stress` est le numéro de
 * la syllabe (= de la voyelle), en partant de 1, comme dans content/words/*.json.
 */
export function withStressMark(word, stress) {
  const lower = word.toLowerCase();
  let vowelCount = 0;
  for (let i = 0; i < word.length; i++) {
    if (RUSSIAN_VOWELS.has(lower[i])) {
      vowelCount++;
      if (vowelCount === stress) {
        return word.slice(0, i + 1) + STRESS_MARK + word.slice(i + 1);
      }
    }
  }
  return word; // "stress" hors bornes : ne devrait pas arriver sur du contenu validé
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

/**
 * Découpe un mot russe en syllabes, par la règle de l'attaque maximale (les consonnes entre
 * deux voyelles rejoignent la syllabe suivante) : мама → ма-ма, ресторан → ре-сто-ран.
 * Sert à l'exercice 4 (« Où est l'accent ? », §4.2) : ce n'est pas un découpage
 * phonologiquement parfait dans tous les cas, mais il correspond à la convention déjà
 * utilisée dans le champ "pron" du contenu (§5.3, ex. "ma-la-KO").
 * @param {string} word
 * @returns {string[]} les syllabes, dans l'ordre, casse d'origine conservée
 */
export function splitSyllables(word) {
  const lower = word.toLowerCase();
  const vowelIndices = [];
  for (let i = 0; i < lower.length; i++) {
    if (RUSSIAN_VOWELS.has(lower[i])) vowelIndices.push(i);
  }
  if (vowelIndices.length === 0) return [word];

  const starts = [0];
  for (let i = 1; i < vowelIndices.length; i++) {
    starts.push(vowelIndices[i - 1] + 1);
  }
  return starts.map((start, i) => word.slice(start, i + 1 < starts.length ? starts[i + 1] : word.length));
}
