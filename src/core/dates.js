// src/core/dates.js
//
// Calculs de date en **heure locale**, jamais en UTC (voir §6.4 du document de fondation :
// le bug du projet thaï calculait le jour en UTC, ce qui le faisait changer à 2h du matin
// en France). Aucune fonction ici ne touche au DOM ; tout est testable dans Node.
//
// Une "clé de jour" est une chaîne 'AAAA-MM-JJ' représentant un jour local, jamais un Date
// avec une heure : ça évite les décalages de fuseau horaire dans le reste du code.

/** Clé de jour 'AAAA-MM-JJ' pour un objet Date donné (par défaut : maintenant), en heure locale. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** La clé du jour local d'aujourd'hui. */
export function today() {
  return dayKey(new Date());
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Reconstruit un Date local (minuit) à partir d'une clé de jour. */
export function keyToDate(key) {
  const { y, m, d } = parseKey(key);
  return new Date(y, m - 1, d);
}

/** Ajoute (ou retire, si négatif) un nombre de jours à une clé de jour. */
export function addDays(key, days) {
  const { y, m, d } = parseKey(key);
  return dayKey(new Date(y, m - 1, d + days));
}

/** Différence en jours entre deux clés (a - b). Positif si a est après b. */
export function diffDays(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((keyToDate(a).getTime() - keyToDate(b).getTime()) / msPerDay);
}

/** Mois local 'AAAA-MM' d'une clé de jour. */
export function monthKey(key) {
  return key.slice(0, 7);
}

/** Jour de la semaine ISO d'une clé (1 = lundi ... 7 = dimanche). */
export function isoWeekday(key) {
  const js = keyToDate(key).getDay(); // 0 = dimanche en JS
  return js === 0 ? 7 : js;
}

/**
 * Nombre de jours pratiqués distincts qui tombent dans le même mois que `refKey`
 * (par défaut aujourd'hui). Sert à l'écran d'accueil : « X jours pratiqués ce mois-ci »
 * (§4.4), mise en avant plutôt que la seule série.
 */
export function practicedDaysInMonth(practicedDays, refKey = today()) {
  const month = monthKey(refKey);
  return [...new Set(practicedDays)].filter((k) => monthKey(k) === month).length;
}

/**
 * Série de jours pratiqués d'affilée, en heure locale, avec **un jour de repos gratuit
 * par semaine glissante de 7 jours** (§4.4) : un jour manqué ne casse pas la série s'il
 * n'y en a pas eu d'autre dans les 7 jours qui suivent (calendaires). Un deuxième jour
 * manqué dans la même fenêtre arrête la série.
 *
 * Le jour de repos ne compte pas comme un jour pratiqué : voir `practicedDaysInMonth`
 * pour ce chiffre séparé.
 *
 * @param {Iterable<string>} practicedDays - clés 'AAAA-MM-JJ' des jours où une séance a été finie
 * @param {string} [refKey] - jour de référence (par défaut aujourd'hui)
 * @returns {number} longueur de la série, en jours
 */
export function computeStreak(practicedDays, refKey = today()) {
  const practiced = new Set(practicedDays);
  // Si le jour de référence n'a pas encore été pratiqué, ça ne casse pas la série pour
  // autant (la séance du jour n'est peut-être simplement pas encore faite) : on commence
  // l'évaluation la veille.
  let cursor = practiced.has(refKey) ? refKey : addDays(refKey, -1);
  let streak = 0;
  const restDaysUsed = []; // clés des jours de repos consommés, le plus récent en tête

  // Garde-fou : une série ne remonte jamais indéfiniment (protège aussi contre une
  // erreur de logique qui bouclerait sans fin).
  for (let i = 0; i < 100000; i++) {
    if (practiced.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
      continue;
    }

    // Jour non pratiqué : un jour de repos n'est valable que 7 jours glissants après
    // avoir été consommé. On libère ceux qui sont sortis de cette fenêtre.
    while (restDaysUsed.length && diffDays(restDaysUsed[0], cursor) >= 7) {
      restDaysUsed.shift();
    }
    if (restDaysUsed.length === 0) {
      restDaysUsed.push(cursor);
      cursor = addDays(cursor, -1);
      continue;
    }
    break; // deuxième jour manqué dans la même fenêtre de 7 jours : la série s'arrête ici
  }
  return streak;
}
