import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, createMemoryBackend } from '../src/core/storage.js';
import { CURRENT_SCHEMA } from '../src/core/migrate.js';

test('load sur un stockage vide renvoie un état neuf, non corrompu', () => {
  const storage = createStorage(createMemoryBackend());
  const { state, corrupted } = storage.load();
  assert.equal(corrupted, false);
  assert.equal(state.schema, CURRENT_SCHEMA);
  assert.deepEqual(state.cards, {});
});

test('save puis load renvoie le même état', () => {
  const storage = createStorage(createMemoryBackend());
  const state = { schema: CURRENT_SCHEMA, appVersion: '0.1.0', contentVersion: null, cards: { a: 1 }, settings: {}, days: [], stats: {} };
  storage.save(state);
  const loaded = storage.load();
  assert.equal(loaded.corrupted, false);
  assert.deepEqual(loaded.state.cards, { a: 1 });
  assert.equal(loaded.state.appVersion, '0.1.0');
});

test('un JSON illisible en stockage n\'est jamais écrasé : corrupted vrai, raw préservé', () => {
  const backend = createMemoryBackend();
  backend.setItem('russe:progress', '{ ceci n\'est pas du JSON valide');
  const storage = createStorage(backend);
  const { state, corrupted, raw } = storage.load();
  assert.equal(corrupted, true);
  assert.equal(state, null);
  assert.equal(raw, '{ ceci n\'est pas du JSON valide');
});

test('save prend une copie de secours avant d\'écraser', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  const first = { schema: CURRENT_SCHEMA, appVersion: 'v1', contentVersion: null, cards: {}, settings: {}, days: [], stats: {} };
  storage.save(first);
  const second = { ...first, appVersion: 'v2' };
  storage.save(second);
  const backup = JSON.parse(backend.getItem('russe:progress:backup'));
  assert.equal(backup.appVersion, 'v1');
  const current = JSON.parse(backend.getItem('russe:progress'));
  assert.equal(current.appVersion, 'v2');
});

test('importState avec un JSON invalide échoue sans rien modifier', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  const original = { schema: CURRENT_SCHEMA, appVersion: 'original', contentVersion: null, cards: {}, settings: {}, days: [], stats: {} };
  storage.save(original);
  const result = storage.importState('{ pas du json');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'json');
  const stillThere = JSON.parse(backend.getItem('russe:progress'));
  assert.equal(stillThere.appVersion, 'original');
});

test('importState avec un schéma invalide échoue sans rien modifier', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  const original = { schema: CURRENT_SCHEMA, appVersion: 'original', contentVersion: null, cards: {}, settings: {}, days: [], stats: {} };
  storage.save(original);
  const result = storage.importState(JSON.stringify({ pasDeSchema: true }));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'schema');
  const stillThere = JSON.parse(backend.getItem('russe:progress'));
  assert.equal(stillThere.appVersion, 'original');
});

test('importState valide remplace l\'état et prend une copie de secours', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  const original = { schema: CURRENT_SCHEMA, appVersion: 'original', contentVersion: null, cards: {}, settings: {}, days: [], stats: {} };
  storage.save(original);
  const imported = { schema: CURRENT_SCHEMA, appVersion: 'importé', contentVersion: null, cards: { x: 1 }, settings: {}, days: [], stats: {} };
  const result = storage.importState(JSON.stringify(imported));
  assert.equal(result.ok, true);
  assert.equal(result.state.appVersion, 'importé');
  const backup = JSON.parse(backend.getItem('russe:progress:backup'));
  assert.equal(backup.appVersion, 'original');
});

test('reset repart d\'un état vide et prend une copie de secours', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  storage.save({ schema: CURRENT_SCHEMA, appVersion: 'avant', contentVersion: null, cards: { a: 1 }, settings: {}, days: [], stats: {} });
  const reset = storage.reset();
  assert.deepEqual(reset.cards, {});
  const backup = JSON.parse(backend.getItem('russe:progress:backup'));
  assert.equal(backup.appVersion, 'avant');
});

test('exportRaw renvoie exactement le JSON stocké', () => {
  const backend = createMemoryBackend();
  const storage = createStorage(backend);
  const state = { schema: CURRENT_SCHEMA, appVersion: 'v1', contentVersion: null, cards: {}, settings: {}, days: [], stats: {} };
  storage.save(state);
  assert.equal(storage.exportRaw(), JSON.stringify(state));
});
