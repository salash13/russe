import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLetters, checkLots, lotCoverage } from '../scripts/validate-content.mjs';

function letter(overrides = {}) {
  return {
    id: 'a', print: 'А', lower: 'а', cursive: 'А а', sound: 'a', hint: 'comme le a de « papa »',
    lot: 1, examples: [],
    ...overrides,
  };
}

test('checkLetters : aucune erreur pour un tableau bien formé', () => {
  const letters = [letter({ id: 'a', print: 'А', lower: 'а' }), letter({ id: 'k', print: 'К', lower: 'к' })];
  // On ne teste pas le compte de 33 ici (voir test dédié) : seulement la forme.
  const errors = checkLetters(letters).filter((e) => !e.includes('doit contenir'));
  assert.deepEqual(errors, []);
});

test('checkLetters : signale un nombre de lettres différent de 33', () => {
  const errors = checkLetters([letter()]);
  assert.ok(errors.some((e) => e.includes('33')));
});

test('checkLetters : signale un champ requis manquant', () => {
  const errors = checkLetters([letter({ hint: undefined })]);
  assert.ok(errors.some((e) => e.includes('hint')));
});

test('checkLetters : signale un id dupliqué', () => {
  const errors = checkLetters([letter({ id: 'a' }), letter({ id: 'a', print: 'Б', lower: 'б' })]);
  assert.ok(errors.some((e) => e.includes('dupliqué') && e.includes('"a"')));
});

test('checkLetters : signale un caractère imprimé dupliqué même avec des ids différents', () => {
  const errors = checkLetters([letter({ id: 'a' }), letter({ id: 'a2', print: 'А' })]);
  assert.ok(errors.some((e) => e.includes('Caractère imprimé dupliqué')));
});

test('checkLetters : signale un lot hors bornes', () => {
  const errors = checkLetters([letter({ lot: 6 })]);
  assert.ok(errors.some((e) => e.includes('lot invalide')));
});

test('checkLetters : rejette un tableau absent', () => {
  assert.deepEqual(checkLetters({ pas: 'un tableau' }), ['letters.json doit contenir un tableau.']);
});

test('checkLots : aucune erreur pour des lots cohérents avec les lettres', () => {
  const letters = [letter({ id: 'a', lot: 1 }), letter({ id: 'k', print: 'К', lower: 'к', lot: 1 })];
  const lots = [
    { id: 1, title: 'Lot 1', letters: ['a', 'k'] },
  ];
  const errors = checkLots(lots, letters).filter((e) => !e.includes('doit contenir 5'));
  assert.deepEqual(errors, []);
});

test('checkLots : signale une lettre absente de tout lot', () => {
  const letters = [letter({ id: 'a', lot: 1 }), letter({ id: 'k', print: 'К', lower: 'к', lot: 1 })];
  const lots = [{ id: 1, title: 'Lot 1', letters: ['a'] }];
  const errors = checkLots(lots, letters);
  assert.ok(errors.some((e) => e.includes('"k"') && e.includes("n'appartient à aucun lot")));
});

test('checkLots : signale une lettre présente dans deux lots', () => {
  const lots = [
    { id: 1, title: 'Lot 1', letters: ['a'] },
    { id: 2, title: 'Lot 2', letters: ['a'] },
  ];
  const errors = checkLots(lots, []);
  assert.ok(errors.some((e) => e.includes('plusieurs lots')));
});

test('checkLots : signale une incohérence entre le lot déclaré sur la lettre et lots.json', () => {
  const letters = [letter({ id: 'a', lot: 2 })];
  const lots = [{ id: 1, title: 'Lot 1', letters: ['a'] }];
  const errors = checkLots(lots, letters);
  assert.ok(errors.some((e) => e.includes('différent')));
});

test('checkLots : signale une référence à une lettre inexistante', () => {
  const lots = [{ id: 1, title: 'Lot 1', letters: ['fantome'] }];
  const errors = checkLots(lots, [letter({ id: 'a' })]);
  assert.ok(errors.some((e) => e.includes('fantome') && e.includes('absente de letters.json')));
});

test('lotCoverage résume le nombre de lettres par lot', () => {
  const lots = [{ id: 1, title: 'Lot 1', letters: ['a', 'k'] }, { id: 2, title: 'Lot 2', letters: ['v'] }];
  assert.deepEqual(lotCoverage(lots), [
    { id: 1, title: 'Lot 1', count: 2 },
    { id: 2, title: 'Lot 2', count: 1 },
  ]);
});

test('le vrai content/letters.json et content/lots.json sont valides', async () => {
  const { readContentJson } = await import('../scripts/validate-content.mjs');
  const letters = await readContentJson('letters.json');
  const lots = await readContentJson('lots.json');
  assert.deepEqual(checkLetters(letters), []);
  assert.deepEqual(checkLots(lots, letters), []);
});
