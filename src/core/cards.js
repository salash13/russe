// src/core/cards.js
//
// Registre des types de cartes (§4.3). Une carte = un élément + une facette, identifiée par
// une chaîne typée : "letter:v:son", "word:moloko:fr-ru", "ending:acc-fem-sg", "aspect:delat".
//
// Règle centrale du projet, reprise de l'audit du thaï (§11, défaut critique) :
// **toute carte planifiée par le SRS doit pouvoir être présentée**. Le thaï planifiait des
// syllabes qu'aucun exercice ne savait afficher ; le compteur de révisions gonflait sans fin.
// Ici, chaque type de carte s'enregistre avec la façon dont il se présente, et `isPresentable`
// permet de le vérifier automatiquement (voir tests/cards.test.mjs et son usage dans session.js).

const registry = new Map();

/** Découpe un identifiant de carte "type:elementId[:facette]" en ses parties. */
export function parseCardId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Identifiant de carte invalide : ${JSON.stringify(id)}`);
  }
  const [type, elementId, facet] = id.split(':');
  if (!type || !elementId) {
    throw new Error(`Identifiant de carte invalide : "${id}" (attendu "type:élément[:facette]")`);
  }
  return { type, elementId, facet: facet ?? null };
}

/** Construit un identifiant de carte à partir de ses parties. */
export function makeCardId(type, elementId, facet = null) {
  return facet ? `${type}:${elementId}:${facet}` : `${type}:${elementId}`;
}

/**
 * Déclare un type de carte.
 * @param {string} type - ex. "letter", "word", "ending", "aspect"
 * @param {object} def
 * @param {string[]} [def.facets] - facettes valides pour ce type (omis = toute facette acceptée)
 * @param {(parsed: {type:string, elementId:string, facet:string|null}, content: unknown) => boolean} [def.canPresent]
 *   vérification supplémentaire (ex. l'élément existe bien dans le contenu chargé)
 */
export function registerCardType(type, def = {}) {
  registry.set(type, def);
}

/** Le type de carte enregistré, ou undefined s'il n'existe pas. */
export function getCardType(type) {
  return registry.get(type);
}

/**
 * Est-ce que cette carte peut être présentée par un exercice existant ?
 * Toute carte qui échoue ce test ne doit jamais être planifiée par le SRS (voir session.js).
 */
export function isPresentable(id, content = null) {
  let parsed;
  try {
    parsed = parseCardId(id);
  } catch {
    return false;
  }
  const def = registry.get(parsed.type);
  if (!def) return false;
  if (def.facets && parsed.facet != null && !def.facets.includes(parsed.facet)) return false;
  if (typeof def.canPresent === 'function') return def.canPresent(parsed, content);
  return true;
}

/** Réinitialise le registre. Utilitaire de test uniquement — jamais utilisé par l'app. */
export function resetCardRegistry() {
  registry.clear();
}
