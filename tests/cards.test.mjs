import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCardId,
  makeCardId,
  registerCardType,
  getCardType,
  isPresentable,
  resetCardRegistry,
} from '../src/core/cards.js';

test('parseCardId découpe type, élément, facette', () => {
  assert.deepEqual(parseCardId('letter:v:son'), { type: 'letter', elementId: 'v', facet: 'son' });
  assert.deepEqual(parseCardId('aspect:delat'), { type: 'aspect', elementId: 'delat', facet: null });
});

test('parseCardId rejette un identifiant mal formé', () => {
  assert.throws(() => parseCardId(''));
  assert.throws(() => parseCardId('sansdeuxpoints'));
  assert.throws(() => parseCardId(':vide'));
});

test('makeCardId reconstruit l\'identifiant, avec ou sans facette', () => {
  assert.equal(makeCardId('letter', 'v', 'son'), 'letter:v:son');
  assert.equal(makeCardId('aspect', 'delat'), 'aspect:delat');
});

test('isPresentable : false pour un type jamais enregistré', () => {
  resetCardRegistry();
  assert.equal(isPresentable('inconnu:x'), false);
});

test('isPresentable : true une fois le type enregistré, sans contrainte de facette', () => {
  resetCardRegistry();
  registerCardType('test-mot', {});
  assert.equal(isPresentable('test-mot:dom:fr-ru'), true);
  assert.equal(isPresentable('test-mot:dom'), true);
});

test('isPresentable : rejette une facette non déclarée', () => {
  resetCardRegistry();
  registerCardType('test-lettre', { facets: ['son', 'cursive'] });
  assert.equal(isPresentable('test-lettre:v:son'), true);
  assert.equal(isPresentable('test-lettre:v:inexistante'), false);
});

test('isPresentable : délègue à canPresent quand fourni (ex. l\'élément existe dans le contenu)', () => {
  resetCardRegistry();
  const content = { mots: new Set(['dom']) };
  registerCardType('test-mot2', {
    canPresent: (parsed, c) => c?.mots.has(parsed.elementId) ?? false,
  });
  assert.equal(isPresentable('test-mot2:dom', content), true);
  assert.equal(isPresentable('test-mot2:absent', content), false);
});

test('getCardType renvoie undefined pour un type non enregistré', () => {
  resetCardRegistry();
  assert.equal(getCardType('rien'), undefined);
});
