// src/core/migrate.js
//
// Fait évoluer un état enregistré (ancien format) vers le format courant. S'applique à
// **chaque chargement et à chaque import** (§6.3) — jamais seulement à l'import, sinon un
// vieil état resté sur un appareil ne serait jamais réparé.
//
// Différence volontaire avec le thaï (§11) : si l'état n'est pas exploitable, on lève une
// erreur plutôt que de renvoyer un état par défaut en silence — c'est à l'appelant
// (storage.js) de décider de ne rien écraser et de proposer l'export tel quel.

export const CURRENT_SCHEMA = 1;

function assertObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error("État invalide : ce n'est pas un objet.");
  }
}

function defaults() {
  return {
    schema: CURRENT_SCHEMA,
    appVersion: null,
    contentVersion: null,
    cards: {},
    settings: {},
    days: [],
    stats: {},
  };
}

// Une étape par version : migrations[n] fait passer un état du schéma n au schéma n+1.
// Exemple à venir : migrations[1] = (state) => ({ ...state, unNouveauChamp: valeur }).
const migrations = {
  // Rien encore : le schéma 1 est le premier.
};

/**
 * Fait évoluer un état brut (venant du stockage ou d'un import) vers le schéma courant.
 * @throws si l'état n'est pas un objet exploitable, si le champ "schema" est absent ou
 *   invalide, si le schéma est plus récent que celui connu, ou s'il manque une migration.
 */
export function migrate(raw) {
  assertObject(raw);

  // Le champ "schema" doit être présent : c'est lui qui distingue un vrai état de cette
  // app (même ancien) d'un fichier qui n'en est pas un. On ne le devine jamais — un état
  // sans "schema" est traité comme non reconnu plutôt que comme "le plus ancien possible",
  // pour ne pas fabriquer silencieusement un état faux à partir de données étrangères.
  if (typeof raw.schema !== 'number' || Number.isNaN(raw.schema)) {
    throw new Error('État invalide : le champ "schema" est manquant ou invalide.');
  }
  if (raw.schema > CURRENT_SCHEMA) {
    throw new Error(`Schéma ${raw.schema} plus récent que celui connu (${CURRENT_SCHEMA}).`);
  }

  let state = { ...raw };
  while (state.schema < CURRENT_SCHEMA) {
    const step = migrations[state.schema];
    if (!step) {
      throw new Error(`Pas de migration disponible depuis le schéma ${state.schema}.`);
    }
    state = step(state);
    state.schema += 1;
  }

  // Complète les champs manquants avec les valeurs par défaut, sans écraser ceux présents.
  state = { ...defaults(), ...state, schema: CURRENT_SCHEMA };

  // Garde-fous de forme, même sur un état déjà au bon schéma (un champ corrompu isolé
  // ne doit pas rendre tout l'état inexploitable).
  if (typeof state.cards !== 'object' || state.cards === null || Array.isArray(state.cards)) {
    state.cards = {};
  }
  if (typeof state.settings !== 'object' || state.settings === null || Array.isArray(state.settings)) {
    state.settings = {};
  }
  if (!Array.isArray(state.days)) state.days = [];
  if (typeof state.stats !== 'object' || state.stats === null || Array.isArray(state.stats)) {
    state.stats = {};
  }

  return state;
}

/** L'état vide d'une progression toute neuve (première visite, ou après réinitialisation). */
export function emptyState() {
  return defaults();
}
