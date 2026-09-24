// src/core/storage.js
//
// Point unique de lecture/écriture de la progression (§6.1 : « toute écriture de
// progression passe par Storage »). Ne dépend pas de `localStorage` directement : on lui
// injecte un `backend` ({ getItem, setItem }), ce qui le rend testable dans Node avec un
// faux stockage en mémoire, et permettra plus tard d'en changer (§6.7, synchronisation).
//
// Règles du §6.3, reprises de l'audit du thaï :
//   - un état illisible n'est **jamais écrasé** : on le signale pour export tel quel ;
//   - une copie de secours est prise avant tout import ou réinitialisation ;
//   - `migrate()` s'applique à chaque chargement ET à chaque import.

import { migrate, emptyState } from './migrate.js';

const KEY = 'russe:progress';
const BACKUP_KEY = 'russe:progress:backup';

/**
 * @param {{getItem(key:string): string|null, setItem(key:string, value:string): void}} backend
 * @param {{key?: string, backupKey?: string}} [options]
 */
export function createStorage(backend, { key = KEY, backupKey = BACKUP_KEY } = {}) {
  function readRaw() {
    return backend.getItem(key);
  }

  /**
   * Charge la progression. Ne lève jamais : en cas d'état illisible, renvoie
   * `{ corrupted: true, raw }` pour que l'app propose l'export tel quel sans rien écraser.
   */
  function load() {
    const raw = readRaw();
    if (raw == null) return { state: emptyState(), corrupted: false, raw: null };
    try {
      const parsed = JSON.parse(raw);
      const state = migrate(parsed);
      return { state, corrupted: false, raw };
    } catch {
      return { state: null, corrupted: true, raw };
    }
  }

  /** Copie l'état actuellement enregistré dans la clé de secours, s'il y en a un. */
  function backup() {
    const raw = readRaw();
    if (raw != null) backend.setItem(backupKey, raw);
  }

  /** Enregistre un état déjà valide (au schéma courant). Prend une copie de secours avant. */
  function save(state) {
    backup();
    backend.setItem(key, JSON.stringify(state));
  }

  /**
   * Importe un état depuis un texte JSON (fichier importé par l'utilisateur, §6.7).
   * Ne modifie rien si le texte est invalide ou si la migration échoue.
   * @returns {{ok: true, state: object} | {ok: false, error: 'json'|'schema'}}
   */
  function importState(rawText) {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { ok: false, error: 'json' };
    }
    let migrated;
    try {
      migrated = migrate(parsed);
    } catch {
      return { ok: false, error: 'schema' };
    }
    backup();
    backend.setItem(key, JSON.stringify(migrated));
    return { ok: true, state: migrated };
  }

  /** Le contenu JSON brut actuellement enregistré (pour le bouton « exporter »). */
  function exportRaw() {
    return readRaw();
  }

  /** Réinitialisation complète (zone « danger », §4.1). Prend une copie de secours avant. */
  function reset() {
    backup();
    const state = emptyState();
    backend.setItem(key, JSON.stringify(state));
    return state;
  }

  return { load, save, importState, exportRaw, reset, backup };
}

/** Petit backend en mémoire, utilisé par les tests (et comme filet si localStorage est indisponible). */
export function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}
