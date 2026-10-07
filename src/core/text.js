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

// Lettres latines qui ont exactement la même forme qu'une lettre cyrillique. Tapées avec le
// clavier de l'ordinateur au lieu du clavier russe à l'écran, elles sont invisibles à l'œil
// mais ce sont d'autres caractères : sans cette table, « такси » écrit avec un « c » latin
// était compté faux, sans que rien à l'écran ne permette de comprendre pourquoi (signalé par
// Ben le 07/10/2026). Seules les formes vraiment identiques sont converties : un « b » ou un
// « t » minuscules ne ressemblent pas à в ou т, ils restent des fautes.
const LATIN_LOOKALIKES = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', c: 'с', e: 'е', k: 'к', o: 'о', p: 'р', x: 'х', y: 'у',
};
const LATIN_LOOKALIKE_RE = new RegExp(`[${Object.keys(LATIN_LOOKALIKES).join('')}]`, 'g');

/** Remplace les lettres latines identiques à une lettre cyrillique par cette lettre. */
export function fixLatinLookalikes(text) {
  return text.replace(LATIN_LOOKALIKE_RE, (ch) => LATIN_LOOKALIKES[ch]);
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
  const fixed = fixLatinLookalikes(input);
  const latin = fixed !== input;
  const a = normalize(fixed);
  const b = normalize(expected);
  if (a === b) return { correct: true, close: false, distance: 0, latin };
  const distance = levenshtein(a, b);
  return { correct: false, close: distance === 1, distance, latin, diff: diffParts(a, b) };
}

/**
 * Où deux chaînes diffèrent : le préfixe commun, la partie différente de chaque côté, le
 * suffixe commun. Sert au « presque » du §4.2, qui doit montrer la différence et pas
 * seulement la bonne réponse.
 * @returns {{before: string, typed: string, expected: string, after: string}}
 */
export function diffParts(typed, expected) {
  let start = 0;
  while (start < typed.length && start < expected.length && typed[start] === expected[start]) start++;
  let end = 0;
  while (
    end < typed.length - start &&
    end < expected.length - start &&
    typed[typed.length - 1 - end] === expected[expected.length - 1 - end]
  ) {
    end++;
  }
  return {
    before: expected.slice(0, start),
    typed: typed.slice(start, typed.length - end),
    expected: expected.slice(start, expected.length - end),
    after: expected.slice(expected.length - end),
  };
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

// Ponctuation retirée pour découper ou comparer une phrase (§5.4) : elle ne fait pas partie
// des mots, ni de ce qu'on demande de taper en dictée (exercice 12, §4.2).
const PUNCTUATION = /[.,!?;:…«»"„“”()—–-]/g;

/**
 * Les mots d'une phrase russe, ponctuation retirée, dans l'ordre. C'est cette numérotation
 * (à partir de 1) que suivent les champs "stress" et "words" d'une phrase (§5.4) : un tiret
 * de dialogue isolé ("Спасибо! — Пожалуйста.") ne compte pas comme un mot.
 * @param {string} sentence
 * @returns {string[]}
 */
export function sentenceTokens(sentence) {
  return sentence
    .split(/\s+/)
    .map((chunk) => chunk.replace(PUNCTUATION, ''))
    .filter((token) => token.length > 0);
}

/**
 * Remet les marques d'accent tonique dans une phrase en gardant sa ponctuation d'origine.
 * @param {string} sentence
 * @param {[number, number][]} stress - paires [n° du mot, n° de la syllabe], à partir de 1 (§5.4)
 */
export function sentenceWithStress(sentence, stress) {
  const bySlot = new Map(stress.map(([position, syllable]) => [position, syllable]));
  let position = 0;
  return sentence
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s*$/.test(chunk) || chunk.replace(PUNCTUATION, '').length === 0) return chunk;
      position++;
      // Un monosyllabe n'est jamais marqué (convention russe : « как », pas « ка́к ») — il
      // n'y a qu'une voyelle, aucune hésitation possible. La ponctuation ne contient aucune
      // voyelle : withStressMark peut s'appliquer au morceau entier ("Привет!").
      if (!bySlot.has(position) || splitSyllables(chunk).length < 2) return chunk;
      return withStressMark(chunk, bySlot.get(position));
    })
    .join('');
}

/**
 * Compare une phrase tapée (dictée, exercice 12) à la phrase attendue : même tolérance que
 * compareAnswer, et la ponctuation est ignorée des deux côtés.
 */
export function compareSentence(input, expected) {
  return compareAnswer(sentenceTokens(input).join(' '), sentenceTokens(expected).join(' '));
}

/**
 * Exercice 11 (§4.2) : la réponse est-elle la phrase dans le bon ordre ? Compare les mots
 * eux-mêmes et pas leurs positions, pour qu'un mot présent deux fois (« очень, очень »)
 * soit accepté quelle que soit la tuile choisie en premier.
 * @param {string[]} answerTokens - les tuiles dans l'ordre choisi
 * @param {string} sentence - la phrase attendue
 */
export function isCorrectOrder(answerTokens, sentence) {
  const expected = sentenceTokens(sentence).map(normalize);
  const given = answerTokens.map(normalize);
  return given.length === expected.length && given.every((token, i) => token === expected[i]);
}
