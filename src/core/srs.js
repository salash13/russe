// src/core/srs.js
//
// FSRS (Free Spaced Repetition Scheduler), version 4.5 — mêmes formules et mêmes poids
// par défaut publiés que la référence open-spaced-repetition/fsrs4anki (§4.3). Fonctions
// pures uniquement : pas de DOM, pas de date "réelle" lue ici (les clés de jour viennent
// de dates.js et sont passées en paramètre), testable dans Node sans rien simuler.
//
// Vocabulaire FSRS :
//   - stabilité (S)   : nombre de jours pour que la probabilité de rappel tombe à 90 %.
//   - difficulté (D)  : entre 1 (très facile) et 10 (très difficile).
//   - rétrievabilité (R) : probabilité de rappel au moment de la révision, selon le temps écoulé.

/** Poids par défaut publiés de FSRS v4.5 (w0 à w16). Ne pas modifier sans changer de version. */
export const DEFAULT_WEIGHTS = Object.freeze([
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
  0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
]);

/** Les 4 notes possibles après une réponse (§4.3). */
export const RATING = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });

// À t = S (stabilité), R doit valoir 0.9 par définition : (1 + S/(9S))^-1 = (10/9)^-1 = 0.9.
const DECAY_FACTOR = 9;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Probabilité de rappel après `elapsedDays` jours, pour une stabilité `stability`. */
export function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (DECAY_FACTOR * stability), -1);
}

function initialStability(rating, w) {
  return Math.max(w[rating - 1], 0.1);
}

function initialDifficulty(rating, w) {
  const d = w[4] - (rating - 3) * w[5];
  return clamp(d, 1, 10);
}

function nextDifficulty(difficulty, rating, w) {
  const meanReversionTarget = initialDifficulty(RATING.EASY, w);
  const d = difficulty - w[6] * (rating - 3);
  const reverted = w[7] * meanReversionTarget + (1 - w[7]) * d;
  return clamp(reverted, 1, 10);
}

function nextRecallStability(difficulty, stability, r, rating, w) {
  const hardPenalty = rating === RATING.HARD ? w[15] : 1;
  const easyBonus = rating === RATING.EASY ? w[16] : 1;
  const factor =
    1 +
    Math.exp(w[8]) *
      (11 - difficulty) *
      Math.pow(stability, -w[9]) *
      (Math.exp((1 - r) * w[10]) - 1) *
      hardPenalty *
      easyBonus;
  return stability * factor;
}

function nextForgetStability(difficulty, stability, r, w) {
  const s =
    w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14]);
  // La stabilité après un oubli ne doit jamais dépasser la stabilité d'avant l'oubli.
  return Math.min(s, stability);
}

/**
 * Intervalle en jours (entier ≥ 1) avant la prochaine révision pour atteindre la
 * rétention visée (0.9 par défaut, réglable — §4.3).
 */
export function nextInterval(stability, requestedRetention = 0.9) {
  const interval = DECAY_FACTOR * stability * (1 / requestedRetention - 1);
  return Math.max(1, Math.round(interval));
}

/**
 * État FSRS initial d'une carte neuve, à partir de sa toute première note.
 * @param {number} rating - une valeur de RATING
 * @param {number[]} [weights]
 */
export function createCard(rating, weights = DEFAULT_WEIGHTS) {
  return {
    difficulty: initialDifficulty(rating, weights),
    stability: initialStability(rating, weights),
    reps: 1,
    lapses: rating === RATING.AGAIN ? 1 : 0,
  };
}

/**
 * Fait évoluer une carte après une révision (carte déjà vue au moins une fois).
 * @param {{difficulty:number, stability:number, reps:number, lapses:number}} card
 * @param {number} rating - une valeur de RATING
 * @param {number} elapsedDays - jours écoulés depuis la dernière révision
 * @param {number} [requestedRetention]
 * @param {number[]} [weights]
 */
export function reviewCard(card, rating, elapsedDays, requestedRetention = 0.9, weights = DEFAULT_WEIGHTS) {
  const r = retrievability(elapsedDays, card.stability);
  const difficulty = nextDifficulty(card.difficulty, rating, weights);
  const stability =
    rating === RATING.AGAIN
      ? nextForgetStability(card.difficulty, card.stability, r, weights)
      : nextRecallStability(card.difficulty, card.stability, r, rating, weights);
  return {
    difficulty,
    stability: Math.max(stability, 0.1),
    reps: card.reps + 1,
    lapses: card.lapses + (rating === RATING.AGAIN ? 1 : 0),
  };
}
