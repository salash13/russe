import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripStress, normalize, levenshtein, compareAnswer } from '../src/core/text.js';

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
