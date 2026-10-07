import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentenceTokens, sentenceWithStress, compareSentence, isCorrectOrder } from '../src/core/text.js';
import { seedSentenceCards, sentenceFacets } from '../src/core/seeding.js';
import { parseCardId } from '../src/core/cards.js';

const reviewed = { by: 'test', date: '2026-10-07', ok: true };

function sentence(overrides = {}) {
  return {
    id: 'a1-01-s01', ru: 'Меня зовут Бен.', stress: [[1, 2], [2, 2], [3, 1]],
    fr: "Je m'appelle Ben.", words: ['menya', null, null], unit: 'a1-01', reviewed, ...overrides,
  };
}

function word(id, unit = 'a1-01') {
  return { id, ru: id, fr: id, unit, reviewed };
}

const units = [
  { id: 'a1-01', order: 1, level: 'A1', title: 'U1', words: ['menya'] },
  { id: 'a1-02', order: 2, level: 'A1', title: 'U2', words: ['mama'] },
];

test('sentenceTokens : retire la ponctuation et les tirets de dialogue isolés', () => {
  assert.deepEqual(sentenceTokens('Привет! Меня зовут Бен.'), ['Привет', 'Меня', 'зовут', 'Бен']);
  assert.deepEqual(sentenceTokens('Спасибо! — Пожалуйста.'), ['Спасибо', 'Пожалуйста']);
  assert.deepEqual(sentenceTokens('Хорошо, спасибо. А ты?'), ['Хорошо', 'спасибо', 'А', 'ты']);
});

test('sentenceWithStress : accentue chaque mot et garde la ponctuation', () => {
  assert.equal(sentenceWithStress('Меня зовут Бен.', [[1, 2], [2, 2], [3, 1]]), 'Меня́ зову́т Бен.');
  // Le tiret isolé ne compte pas comme un mot : le 2e mot reste « Пожалуйста ».
  assert.equal(sentenceWithStress('Спасибо! — Пожалуйста.', [[1, 2], [2, 2]]), 'Спаси́бо! — Пожа́луйста.');
  // Un monosyllabe n'est jamais marqué, même s'il a une entrée.
  assert.equal(sentenceWithStress('Как дела?', [[1, 1], [2, 2]]), 'Как дела́?');
  // Un mot sans entrée (monosyllabe atone, ex. « до ») reste tel quel.
  assert.equal(sentenceWithStress('Пока! До завтра.', [[1, 2], [3, 1]]), 'Пока́! До за́втра.');
});

test('compareSentence : ignore ponctuation, casse, accent et ё/е', () => {
  assert.equal(compareSentence('меня зовут бен', 'Меня зовут Бен.').correct, true);
  assert.equal(compareSentence('Хорошо спасибо а ты', 'Хорошо, спасибо. А ты?').correct, true);
  const close = compareSentence('меня завут бен', 'Меня зовут Бен.');
  assert.equal(close.correct, false);
  assert.equal(close.close, true);
});

test("isCorrectOrder : compare les mots, pas l'ordre des tuiles d'origine", () => {
  assert.equal(isCorrectOrder(['меня', 'зовут', 'Бен'], 'Меня зовут Бен.'), true);
  assert.equal(isCorrectOrder(['зовут', 'меня', 'Бен'], 'Меня зовут Бен.'), false);
  assert.equal(isCorrectOrder(['меня', 'зовут'], 'Меня зовут Бен.'), false);
  assert.equal(isCorrectOrder(['очень', 'очень', 'приятно'], 'Очень, очень приятно!'), true);
});

test("sentenceFacets : pas d'exercice d'ordre en dessous de 3 mots", () => {
  assert.deepEqual(sentenceFacets(sentence()), ['ordre', 'dictee']);
  assert.deepEqual(sentenceFacets(sentence({ ru: 'Очень приятно!' })), ['dictee']);
});

test('seedSentenceCards : attend que les mots référencés soient introduits', () => {
  const words = [word('menya')];
  const cards = { 'word:menya:ecoute': { reps: 0, due: '2026-10-07' } };
  assert.equal(seedSentenceCards(cards, [sentence()], words, '2026-10-07', units), 0);

  cards['word:menya:ecoute'].reps = 1;
  assert.equal(seedSentenceCards(cards, [sentence()], words, '2026-10-07', units), 2);
  assert.ok(cards['sentence:a1-01-s01:ordre']);
  assert.ok(cards['sentence:a1-01-s01:dictee']);
  // Idempotent : rien de recréé au lancement suivant.
  assert.equal(seedSentenceCards(cards, [sentence()], words, '2026-10-07', units), 0);
});

test('seedSentenceCards : une phrase non relue reste invisible (§5.5)', () => {
  const cards = {};
  const s = sentence({ words: [null, null, null], reviewed: { by: '', date: '', ok: false } });
  assert.equal(seedSentenceCards(cards, [s], [], '2026-10-07', units), 0);
});

test("seedSentenceCards : respecte l'ordre des unités (§2.6)", () => {
  const words = [word('menya'), word('mama', 'a1-02')];
  const cards = { 'word:menya:ecoute': { reps: 0, due: '2026-10-07' } };
  const s = sentence({ id: 'a1-02-s01', unit: 'a1-02', words: [null, null, null] });
  assert.equal(seedSentenceCards(cards, [s], words, '2026-10-07', units), 0);
  cards['word:menya:ecoute'].reps = 1;
  assert.equal(seedSentenceCards(cards, [s], words, '2026-10-07', units), 2);
});

test('seedSentenceCards : ne crée que des facettes déclarées par sentenceFacets (toute carte présentable)', () => {
  const cards = {};
  const sentences = [
    sentence({ words: [null, null, null] }),
    sentence({ id: 'a1-01-s02', ru: 'Очень приятно!', stress: [[1, 1], [2, 2]], words: [null, null] }),
  ];
  seedSentenceCards(cards, sentences, [], '2026-10-07', units);
  for (const id of Object.keys(cards)) {
    const { elementId, facet } = parseCardId(id);
    const s = sentences.find((x) => x.id === elementId);
    assert.ok(sentenceFacets(s).includes(facet), `${id} n'est pas une facette présentable`);
  }
  assert.equal(Object.keys(cards).length, 3);
});
