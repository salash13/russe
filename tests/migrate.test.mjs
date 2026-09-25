import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, emptyState, CURRENT_SCHEMA } from '../src/core/migrate.js';

test('emptyState a la forme attendue, au schéma courant', () => {
  const state = emptyState();
  assert.equal(state.schema, CURRENT_SCHEMA);
  assert.deepEqual(state.cards, {});
  assert.deepEqual(state.settings, {});
  assert.deepEqual(state.days, []);
  assert.deepEqual(state.stats, {});
});

test('migrate accepte un état déjà au schéma courant et le renvoie tel quel', () => {
  const state = { schema: CURRENT_SCHEMA, cards: { a: 1 }, settings: { x: 1 }, days: ['2026-01-01'], stats: {} };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cards, { a: 1 });
  assert.deepEqual(migrated.days, ['2026-01-01']);
});

test('migrate rejette une valeur qui n\'est pas un objet', () => {
  assert.throws(() => migrate(null));
  assert.throws(() => migrate('texte'));
  assert.throws(() => migrate(42));
  assert.throws(() => migrate([1, 2, 3]));
});

test('migrate rejette un état venu d\'un schéma futur inconnu', () => {
  assert.throws(() => migrate({ schema: CURRENT_SCHEMA + 1 }));
});

test('migrate répare les champs de forme incorrecte sans tout jeter', () => {
  const migrated = migrate({ schema: CURRENT_SCHEMA, cards: 'pas un objet', days: 'pas un tableau' });
  assert.deepEqual(migrated.cards, {});
  assert.deepEqual(migrated.days, []);
});

test('migrate rejette un état sans champ "schema" (format non reconnu)', () => {
  // On ne devine jamais un schéma manquant : mieux vaut échouer proprement que de
  // fabriquer silencieusement un état faux à partir de données étrangères.
  assert.throws(() => migrate({ cards: {} }));
});

test('migrate complète les champs manquants avec les valeurs par défaut', () => {
  const migrated = migrate({ schema: CURRENT_SCHEMA });
  assert.deepEqual(migrated.cards, {});
  assert.equal(migrated.appVersion, null);
  assert.equal(migrated.placementProgress, null);
});

test('migrate conserve une progression de test de départ bien formée', () => {
  const placementProgress = { items: [{ letterId: 'a', facet: 'son' }], index: 1, results: { a: { son: true } } };
  const migrated = migrate({ schema: CURRENT_SCHEMA, placementProgress });
  assert.deepEqual(migrated.placementProgress, placementProgress);
});

test('migrate remet à null une progression de test de départ mal formée', () => {
  const migrated = migrate({ schema: CURRENT_SCHEMA, placementProgress: { items: 'pas un tableau' } });
  assert.equal(migrated.placementProgress, null);
});
