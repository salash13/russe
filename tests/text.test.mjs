import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripStress, normalize, levenshtein, compareAnswer, splitSyllables, withStressMark, diffParts } from '../src/core/text.js';

test('stripStress retire l\'accent aigu combinant', () => {
  assert.equal(stripStress('молоко́'), 'молоко');
  assert.equal(stripStress('молоко'), 'молоко'); // rien à retirer
});

test('normalize ignore la casse, l\'accent, et confond ё/е', () => {
  assert.equal(normalize('МолокО́'), 'молоко');
  assert.equal(normalize('ёлка'), 'елка');
  assert.equal(normalize('  Привет   мир  '), 'привет мир');
});

test('levenshtein : distance nulle pour deux chaînes identiques', () => {
  assert.equal(levenshtein('дом', 'дом'), 0);
});

test('levenshtein : une substitution, une insertion, une suppression', () => {
  assert.equal(levenshtein('дом', 'дам'), 1); // substitution
  assert.equal(levenshtein('дом', 'домa'), 1); // insertion
  assert.equal(levenshtein('дом', 'до'), 1); // suppression
});

test('compareAnswer : réponse correcte malgré accent, casse et ё/е', () => {
  const result = compareAnswer('молоко', 'молоко́');
  assert.equal(result.correct, true);
  assert.equal(result.close, false);
});

test('compareAnswer : ё accepté à la place de е et inversement', () => {
  assert.equal(compareAnswer('ёлка', 'елка').correct, true);
  assert.equal(compareAnswer('елка', 'ёлка').correct, true);
});

test('compareAnswer : une faute d\'une seule lettre est signalée "presque"', () => {
  const result = compareAnswer('малоко', 'молоко');
  assert.equal(result.correct, false);
  assert.equal(result.close, true);
  assert.equal(result.distance, 1);
});

test('compareAnswer : une faute de plusieurs lettres n\'est pas "presque"', () => {
  const result = compareAnswer('стол', 'молоко');
  assert.equal(result.correct, false);
  assert.equal(result.close, false);
});

test('splitSyllables : découpe correspondant au style "pron" du contenu (§5.3)', () => {
  assert.deepEqual(splitSyllables('мама'), ['ма', 'ма']);
  assert.deepEqual(splitSyllables('молоко'), ['мо', 'ло', 'ко']);
  assert.deepEqual(splitSyllables('ресторан'), ['ре', 'сто', 'ран']);
  assert.deepEqual(splitSyllables('такси'), ['та', 'кси']);
});

test('splitSyllables : conserve la casse d\'origine', () => {
  assert.deepEqual(splitSyllables('Мама'), ['Ма', 'ма']);
});

test('splitSyllables : un mot sans voyelle (garde-fou) renvoie le mot entier', () => {
  assert.deepEqual(splitSyllables('ъ'), ['ъ']);
});

test('splitSyllables : les syllabes mises bout à bout reforment le mot', () => {
  for (const word of ['мама', 'молоко', 'ресторан', 'такси', 'кофе', 'банан', 'кино', 'футбол']) {
    assert.equal(splitSyllables(word).join(''), word);
  }
});

test('withStressMark : place l\'accent après la voyelle de la bonne syllabe', () => {
  assert.equal(withStressMark('молоко', 3), 'молоко́');
  assert.equal(withStressMark('мама', 1), 'ма́ма');
  assert.equal(withStressMark('ресторан', 3), 'рестора́н');
});

test('withStressMark : stripStress annule withStressMark', () => {
  for (const [word, stress] of [['мама', 1], ['ресторан', 3], ['такси', 2]]) {
    assert.equal(stripStress(withStressMark(word, stress)), word);
  }
});

test('compareAnswer : une lettre latine identique à la cyrillique est acceptée, et signalée', () => {
  // « такси » avec un « а » et un « с » latins (clavier de l'ordinateur) : identique à l'œil.
  const result = compareAnswer('тaкcи', 'такси');
  assert.equal(result.correct, true);
  assert.equal(result.latin, true);
  assert.equal(compareAnswer('такси', 'такси').latin, false);
  // Majuscules latines aussi (« ТАКСИ » tapé en partie au clavier latin).
  assert.equal(compareAnswer('TAKCИ', 'такси').correct, true);
});

test("compareAnswer : une lettre latine qui ne ressemble pas reste une faute", () => {
  assert.equal(compareAnswer('taksi', 'такси').correct, false);
});

test('compareAnswer : le « presque » donne la partie différente', () => {
  const result = compareAnswer('такса', 'такси');
  assert.equal(result.close, true);
  assert.deepEqual(result.diff, { before: 'такс', typed: 'а', expected: 'и', after: '' });
});

test('diffParts : lettre oubliée ou en trop', () => {
  assert.deepEqual(diffParts('таки', 'такси'), { before: 'так', typed: '', expected: 'с', after: 'и' });
  assert.deepEqual(diffParts('таксси', 'такси'), { before: 'такс', typed: 'с', expected: '', after: 'и' });
});

test("withStressMark : ё n'est jamais marqué, il est toujours accentué", () => {
  assert.equal(withStressMark('ребёнок', 2), 'ребёнок');
  assert.equal(withStressMark('молоко', 3), 'молоко́');
});
