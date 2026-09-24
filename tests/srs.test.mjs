import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING,
  DEFAULT_WEIGHTS,
  retrievability,
  createCard,
  reviewCard,
  nextInterval,
} from '../src/core/srs.js';

test('retrievability vaut 1 juste après la révision (0 jour écoulé)', () => {
  assert.equal(retrievability(0, 5), 1);
});

test('retrievability vaut ~0.9 quand le temps écoulé égale la stabilité (définition de S)', () => {
  const r = retrievability(10, 10);
  assert.ok(Math.abs(r - 0.9) < 1e-9, `attendu ~0.9, obtenu ${r}`);
});

test('retrievability diminue quand le temps écoulé augmente', () => {
  const r1 = retrievability(5, 10);
  const r2 = retrievability(20, 10);
  assert.ok(r2 < r1);
});

test('createCard : une note plus haute donne une stabilité initiale plus grande', () => {
  const again = createCard(RATING.AGAIN);
  const hard = createCard(RATING.HARD);
  const good = createCard(RATING.GOOD);
  const easy = createCard(RATING.EASY);
  assert.ok(again.stability < hard.stability);
  assert.ok(hard.stability < good.stability);
  assert.ok(good.stability < easy.stability);
});

test('createCard : la difficulté reste dans [1, 10]', () => {
  for (const rating of [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY]) {
    const card = createCard(rating);
    assert.ok(card.difficulty >= 1 && card.difficulty <= 10);
  }
});

test('reviewCard avec Encore (Again) fait chuter la stabilité et compte un oubli', () => {
  const card = createCard(RATING.GOOD);
  const reviewed = reviewCard(card, RATING.AGAIN, 5);
  assert.ok(reviewed.stability <= card.stability);
  assert.equal(reviewed.lapses, card.lapses + 1);
  assert.equal(reviewed.reps, card.reps + 1);
});

test('reviewCard avec Bien (Good) après un délai raisonnable augmente la stabilité', () => {
  const card = createCard(RATING.GOOD);
  const reviewed = reviewCard(card, RATING.GOOD, 3);
  assert.ok(reviewed.stability > card.stability);
  assert.equal(reviewed.lapses, 0);
});

test('reviewCard : la difficulté reste dans [1, 10] après plusieurs révisions', () => {
  let card = createCard(RATING.GOOD);
  for (let i = 0; i < 20; i++) {
    card = reviewCard(card, RATING.AGAIN, 1);
    assert.ok(card.difficulty >= 1 && card.difficulty <= 10);
  }
  card = createCard(RATING.GOOD);
  for (let i = 0; i < 20; i++) {
    card = reviewCard(card, RATING.EASY, 10);
    assert.ok(card.difficulty >= 1 && card.difficulty <= 10);
  }
});

test('nextInterval augmente avec la stabilité', () => {
  assert.ok(nextInterval(20) > nextInterval(5));
});

test('nextInterval augmente quand la rétention visée diminue (on peut attendre plus longtemps)', () => {
  assert.ok(nextInterval(10, 0.8) > nextInterval(10, 0.95));
});

test('nextInterval est toujours un entier >= 1', () => {
  const i = nextInterval(0.01, 0.99);
  assert.ok(Number.isInteger(i));
  assert.ok(i >= 1);
});

test('DEFAULT_WEIGHTS contient bien les 17 poids publiés (w0 à w16)', () => {
  assert.equal(DEFAULT_WEIGHTS.length, 17);
});
