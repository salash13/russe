import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnitUnlocked,
  seedWordCards,
  seedPairCards,
  wordFacets,
  wordLevels,
  unlockedWordFacets,
  isAcquired,
} from '../src/core/seeding.js';

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

test('seedPairCards : crée la carte une fois le sens des deux mots acquis', () => {
  const units = [unit({ id: 'a1-01', order: 1 })];
  const wordA = word({ id: 'brat', unit: 'a1-01' });
  const wordB = word({ id: 'brat-verbe', unit: 'a1-01' });
  const words = [wordA, wordB];
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const pairs = [{ id: 'brat-brat', wordA: 'brat', wordB: 'brat-verbe', reviewed: { ok: true } }];
  const cards = { 'word:brat:sens': acquired() };

  assert.equal(seedPairCards(cards, pairs, wordsById, '2026-10-04', units, words), 0);
  cards['word:brat-verbe:sens'] = acquired();
  assert.equal(seedPairCards(cards, pairs, wordsById, '2026-10-04', units, words), 1);
  assert.ok(cards['pair:brat-brat']);
});

function acquired() {
  return { reps: 2, stability: 10, due: '2026-10-20' };
}

const letters = [
  { id: 'k', lower: 'к' }, { id: 'i', lower: 'и' }, { id: 'n', lower: 'н' }, { id: 'o', lower: 'о' },
];

test("isAcquired : une seule bonne réponse ne suffit pas, une révision espacée réussie oui", () => {
  assert.equal(isAcquired({ reps: 1, stability: 2.4 }), false);
  assert.equal(isAcquired({ reps: 2, stability: 8 }), true);
  assert.equal(isAcquired({ reps: 0, stability: 5 }), false);
  assert.equal(isAcquired(undefined), false);
});

test("wordLevels : du QCM vers la production ; fr-ru seulement pour l'A1+, accent dès 2 syllabes", () => {
  const units = [unit()];
  assert.deepEqual(wordLevels(word({ ru: 'привет', unit: 'a1-01' }), units), [
    ['sens'], ['reconnaitre'], ['lecture', 'accent'], ['ecoute', 'fr-ru'],
  ]);
  assert.deepEqual(wordLevels(word({ ru: 'я', unit: 'a1-01' }), units), [['sens'], ['reconnaitre'], ['lecture'], ['ecoute', 'fr-ru']]);
  // Mot de lecture N0 (такси = taxi) : la consigne française donnerait la réponse.
  assert.deepEqual(wordFacets(word({ ru: 'такси', unit: 'n0-lecture' }), units), ['sens', 'reconnaitre', 'lecture', 'accent', 'ecoute']);
});

test('unlockedWordFacets : une marche ne se débloque que quand la précédente est acquise', () => {
  const w = word({ ru: 'кино', unit: 'n0-lecture', id: 'kino' });
  assert.deepEqual(unlockedWordFacets(w, {}), ['sens']);
  // Réussi une fois seulement : pas encore acquis.
  assert.deepEqual(unlockedWordFacets(w, { 'word:kino:sens': { reps: 1, stability: 2.4 } }), ['sens']);
  const cards = { 'word:kino:sens': acquired(), 'word:kino:reconnaitre': acquired(), 'word:kino:lecture': acquired() };
  // accent pas encore acquis : la production reste fermée.
  assert.deepEqual(unlockedWordFacets(w, cards), ['sens', 'reconnaitre', 'lecture', 'accent']);
  cards['word:kino:accent'] = acquired();
  assert.deepEqual(unlockedWordFacets(w, cards), ['sens', 'reconnaitre', 'lecture', 'accent', 'ecoute']);
});

test("seedWordCards : un mot attend que toutes ses lettres soient acquises (кино sans н)", () => {
  const kino = word({ id: 'kino', ru: 'кино', unit: 'n0-lecture' });
  const cards = {
    'letter:k:son': acquired(),
    'letter:i:son': acquired(),
    'letter:o:son': acquired(),
    'letter:n:son': { reps: 1, stability: 0.4 }, // н raté : pas acquis
  };
  assert.equal(seedWordCards(cards, [kino], '2026-10-10', [], letters), 0);
  assert.ok(!cards['word:kino:sens']);
  cards['letter:n:son'] = acquired();
  assert.equal(seedWordCards(cards, [kino], '2026-10-10', [], letters), 1);
  assert.ok(cards['word:kino:sens']);
});

test("seedWordCards : ne crée que la première marche d'un mot nouveau", () => {
  const cards = {};
  seedWordCards(cards, [word({ ru: 'привет', id: 'privet' })], '2026-10-10', [unit()]);
  assert.deepEqual(Object.keys(cards), ['word:privet:sens']);
});

test('seedWordCards : retire une carte jamais vue au-dessus de la marche atteinte, garde les cartes travaillées', () => {
  const units = [unit()];
  const cards = {
    'word:privet:ecoute': { reps: 3, stability: 6, due: '2026-10-12' }, // déjà travaillée : gardée
    'word:privet:fr-ru': { reps: 0, stability: 0.5, due: '2026-10-07' }, // jamais vue, marche 4 : retirée
  };
  seedWordCards(cards, [word({ ru: 'привет', id: 'privet' })], '2026-10-10', units);
  assert.ok(cards['word:privet:ecoute']);
  assert.ok(!cards['word:privet:fr-ru']);
  assert.ok(cards['word:privet:sens']);
});
