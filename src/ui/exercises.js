// src/ui/exercises.js
//
// Construit les questions des exercices du §4.2 :
//   1 (lettre → son) et 2 (son → lettre), pour une lettre et une facette donnée
//   7 (taper le mot entendu), pour un mot

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

  // facet === 'lettre' : on entend le son, on choisit la lettre correspondante.
  const options = shuffle([letter, ...distractors]);
  return {
    kind: 'lettre',
    audioText: letter.print,
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
