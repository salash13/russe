import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { composeSession, createSessionQueue } from '../src/core/session.js';
import { registerCardType, resetCardRegistry } from '../src/core/cards.js';

beforeEach(() => {
  resetCardRegistry();
  registerCardType('test-mot', {});
});

function card(due, reps = 1) {
  return { due, reps };
}

test('composeSession : ne retient que les cartes dues (due <= today)', () => {
  const cards = {
    'test-mot:a': card('2026-09-20'),
    'test-mot:b': card('2026-09-25'), // pas encore due
  };
  const result = composeSession(cards, { today: '2026-09-24', size: 10 });
  assert.deepEqual(result.cardIds, ['test-mot:a']);
});

test('composeSession : respecte à peu près le ratio 70% dû / 30% neuf', () => {
  // Dues récentes (pas de retard) pour ne pas déclencher le seuil qui bloque le neuf.
  const cards = {};
  for (let i = 0; i < 10; i++) cards[`test-mot:due${i}`] = card('2026-09-24', 1);
  for (let i = 0; i < 10; i++) cards[`test-mot:new${i}`] = card('2026-09-24', 0);
  const result = composeSession(cards, { today: '2026-09-24', size: 10 });
  assert.equal(result.dueCount, 7);
  assert.equal(result.newCount, 3);
  assert.equal(result.cardIds.length, 10);
});

test('composeSession : au-delà du seuil de retard, plus de neuf', () => {
  const cards = {
    'test-mot:tresEnRetard': card('2026-09-01', 1), // très en retard
    'test-mot:nouveau': card('2026-09-01', 0),
  };
  const result = composeSession(cards, { today: '2026-09-24', size: 10, overdueLimitDays: 3 });
  assert.equal(result.newCount, 0);
  assert.ok(result.cardIds.includes('test-mot:tresEnRetard'));
  assert.ok(!result.cardIds.includes('test-mot:nouveau'));
});

test('composeSession : une carte non présentable est signalée dans skipped, jamais planifiée', () => {
  const cards = {
    'inconnu:x': card('2026-09-01', 1),
    'test-mot:ok': card('2026-09-01', 1),
  };
  const result = composeSession(cards, { today: '2026-09-24', size: 10 });
  assert.deepEqual(result.skipped, ['inconnu:x']);
  assert.deepEqual(result.cardIds, ['test-mot:ok']);
});

test('composeSession : comble avec l\'autre catégorie si une des deux manque', () => {
  // Dues récentes (pas de retard) : seulement 2 cartes à revoir, mais 8 cartes neuves
  // disponibles pour compléter la séance jusqu'à la taille visée.
  const cards = {};
  for (let i = 0; i < 2; i++) cards[`test-mot:due${i}`] = card('2026-09-22', 1);
  for (let i = 0; i < 8; i++) cards[`test-mot:new${i}`] = card('2026-09-22', 0);
  const result = composeSession(cards, { today: '2026-09-24', size: 10 });
  assert.equal(result.cardIds.length, 10); // complété malgré seulement 2 cartes dues
});

test('createSessionQueue : parcourt les cartes dans l\'ordre si tout est correct', () => {
  const queue = createSessionQueue(['a', 'b', 'c']);
  assert.equal(queue.next(), 'a');
  queue.answer('a', true);
  assert.equal(queue.next(), 'b');
  queue.answer('b', true);
  assert.equal(queue.next(), 'c');
  queue.answer('c', true);
  assert.equal(queue.next(), null);
  assert.equal(queue.finished, true);
});

test('createSessionQueue : une carte ratée revient avant la fin de la séance', () => {
  const queue = createSessionQueue(['a', 'b', 'c'], { requeueDelay: 1 });
  assert.equal(queue.next(), 'a');
  queue.answer('a', false); // ratée : revient plus loin
  assert.equal(queue.finished, false);
  assert.equal(queue.next(), 'b');
  queue.answer('b', true);
  assert.equal(queue.next(), 'a'); // repasse avant la fin de la séance
  queue.answer('a', true);
  assert.equal(queue.next(), 'c');
  queue.answer('c', true);
  assert.equal(queue.finished, true);
});

test('createSessionQueue : answer refuse une carte qui n\'est pas la carte en cours', () => {
  const queue = createSessionQueue(['a', 'b']);
  assert.throws(() => queue.answer('b', true));
});

test('createSessionQueue : remaining et total reflètent l\'avancement', () => {
  const queue = createSessionQueue(['a', 'b', 'c']);
  assert.equal(queue.total, 3);
  assert.equal(queue.remaining, 3);
  queue.answer('a', true);
  assert.equal(queue.remaining, 2);
});
