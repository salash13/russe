import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUnitUnlocked, seedWordCards, seedPairCards } from '../src/core/seeding.js';

function word(overrides = {}) {
  return { id: 'ya', ru: 'я', fr: 'je', unit: 'a1-01', reviewed: { ok: true }, ...overrides };
}

function unit(overrides = {}) {
  return { id: 'a1-01', order: 1, level: 'A1', title: 'Se présenter', words: [], ...overrides };
}

test('isUnitUnlocked : toujours vrai pour une unité absente de units.json (ex. contenu N0)', () => {
  const unlocked = isUnitUnlocked('n0-lecture', { units: [unit()], words: [], cards: {} });
  assert.equal(unlocked, true);
});

test('isUnitUnlocked : la première unité est toujours débloquée', () => {
  const unlocked = isUnitUnlocked('a1-01', { units: [unit({ order: 1 })], words: [], cards: {} });
  assert.equal(unlocked, true);
});

test("isUnitUnlocked : une unité suivante reste verrouillée tant que l'unité précédente n'est pas introduite", () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  const words = [word({ id: 'ya', unit: 'a1-01' }), word({ id: 'ty', unit: 'a1-01' })];
  // Aucune carte encore présentée (reps à 0) : a1-02 doit rester verrouillée.
  const cards = {
    'word:ya:ecoute': { reps: 0 },
    'word:ty:ecoute': { reps: 0 },
  };
  assert.equal(isUnitUnlocked('a1-02', { units, words, cards }), false);
});

test("isUnitUnlocked : se débloque une fois que tous les mots relus de l'unité précédente ont été présentés", () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  const words = [word({ id: 'ya', unit: 'a1-01' }), word({ id: 'ty', unit: 'a1-01' })];
  const cards = {
    'word:ya:ecoute': { reps: 2 },
    'word:ty:ecoute': { reps: 1 },
  };
  assert.equal(isUnitUnlocked('a1-02', { units, words, cards }), true);
});

test('isUnitUnlocked : un mot non relu de l\'unité précédente ne bloque pas la suivante', () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  const words = [
    word({ id: 'ya', unit: 'a1-01', reviewed: { ok: true } }),
    word({ id: 'secret', unit: 'a1-01', reviewed: { ok: false } }), // pas encore relu : invisible, ne compte pas
  ];
  const cards = { 'word:ya:ecoute': { reps: 1 } };
  assert.equal(isUnitUnlocked('a1-02', { units, words, cards }), true);
});

test('isUnitUnlocked : une unité encore vide (aucun mot relu) ne bloque pas la suivante', () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  assert.equal(isUnitUnlocked('a1-02', { units, words: [], cards: {} }), true);
});

test("seedWordCards : ne crée aucune carte pour un mot dont l'unité est verrouillée", () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  const words = [
    word({ id: 'ya', unit: 'a1-01' }),
    word({ id: 'novy', unit: 'a1-02' }), // unité pas encore débloquée
  ];
  const cards = {}; // a1-01 jamais introduite : a1-02 reste verrouillée
  const added = seedWordCards(cards, words, '2026-10-04', units);

  assert.ok(Object.keys(cards).some((id) => id.startsWith('word:ya:')));
  assert.ok(!Object.keys(cards).some((id) => id.startsWith('word:novy:')));
  assert.equal(added, Object.keys(cards).length);
});

test('seedWordCards : sans "units" fourni, aucun verrouillage (comportement par défaut préservé)', () => {
  const words = [word({ id: 'novy', unit: 'a1-02' })];
  const cards = {};
  seedWordCards(cards, words, '2026-10-04');
  assert.ok(Object.keys(cards).some((id) => id.startsWith('word:novy:')));
});

test("seedPairCards : ne crée aucune carte si l'un des deux mots est d'une unité verrouillée", () => {
  const units = [unit({ id: 'a1-01', order: 1 }), unit({ id: 'a1-02', order: 2 })];
  const wordA = word({ id: 'brat', unit: 'a1-01' });
  const wordB = word({ id: 'novy', unit: 'a1-02' });
  const words = [wordA, wordB];
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const pairs = [{ id: 'brat-novy', wordA: 'brat', wordB: 'novy', reviewed: { ok: true } }];
  const cards = {};

  const added = seedPairCards(cards, pairs, wordsById, '2026-10-04', units, words);

  assert.equal(added, 0);
  assert.deepEqual(cards, {});
});

test('seedPairCards : crée la carte une fois les deux unités débloquées', () => {
  const units = [unit({ id: 'a1-01', order: 1 })];
  const wordA = word({ id: 'brat', unit: 'a1-01' });
  const wordB = word({ id: 'brat-verbe', unit: 'a1-01' });
  const words = [wordA, wordB];
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const pairs = [{ id: 'brat-brat', wordA: 'brat', wordB: 'brat-verbe', reviewed: { ok: true } }];
  const cards = {};

  const added = seedPairCards(cards, pairs, wordsById, '2026-10-04', units, words);

  assert.equal(added, 1);
  assert.ok(cards['pair:brat-brat']);
});
