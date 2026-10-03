// src/core/session.js
//
// Composition d'une séance (§4.3) : environ 70 % de révisions dues et 30 % de nouveau ;
// au-delà d'un seuil de retard réglable, plus de nouveau tant que le retard n'est pas
// résorbé. Une fois la séance commencée, les cartes ratées reviennent avant la fin (§2.8).
//
// Garde-fou repris de l'audit du thaï (§11, §4.3) : chaque carte candidate passe par
// `isPresentable` avant d'être retenue. Une carte non présentable est signalée dans
// `skipped` plutôt que d'être silencieusement planifiée puis jamais montrée.

import { diffDays } from './dates.js';
import { isPresentable, parseCardId } from './cards.js';

const DEFAULT_NEW_RATIO = 0.3;
// Seuil de retard réglable (§4.3) au-delà duquel plus de neuf. Exporté pour que l'écran
// Progrès explique le blocage avec le même chiffre, jamais une valeur dupliquée à la main.
export const DEFAULT_OVERDUE_LIMIT_DAYS = 3;

/**
 * Espace les cartes qui portent sur le même élément (ex. les 3 facettes "ecoute"/"accent"/
 * "lecture" d'un même mot) au lieu de les laisser collées : sinon, répondre à la première
 * donne quasiment la réponse de la suivante, et ça ne teste plus grand-chose (signalé par
 * Ben). Glouton classique (type "task scheduler") : à chaque étape, prend dans le groupe qui
 * a le plus de cartes restantes parmi ceux différents du précédent — sans ça, un simple
 * round-robin épuise vite les petits groupes et laisse les grands se recoller en fin de
 * liste. L'ordre relatif à l'intérieur de chaque groupe est conservé. Quand un seul groupe a
 * encore des cartes, deux cartes du même élément redeviennent inévitables (principe des
 * tiroirs) — c'est un dernier recours, pas le cas normal.
 */
function declump(cardIds) {
  const groups = new Map(); // "type:élément" -> ids restants, dans l'ordre d'origine
  for (const id of cardIds) {
    const { type, elementId } = parseCardId(id);
    const key = `${type}:${elementId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  const keys = [...groups.keys()];

  const result = [];
  let lastKey = null;
  while (result.length < cardIds.length) {
    let best = null;
    for (const key of keys) {
      if (key === lastKey) continue;
      const bucket = groups.get(key);
      if (bucket.length === 0) continue;
      if (!best || bucket.length > groups.get(best).length) best = key;
    }
    if (!best) {
      // Aucune alternative au dernier groupe placé : on est forcé de le reprendre.
      best = keys.find((key) => groups.get(key).length > 0);
    }
    result.push(groups.get(best).shift());
    lastKey = best;
  }
  return result;
}

/**
 * @param {Record<string, {due: string, reps: number}>} cards - état SRS de toutes les cartes, indexé par id
 * @param {object} options
 * @param {string} options.today - jour courant ('AAAA-MM-JJ', voir dates.js)
 * @param {number} options.size - nombre de cartes visées pour la séance
 * @param {number} [options.newRatio] - part visée de cartes neuves (défaut 0.3)
 * @param {number} [options.overdueLimitDays] - au-delà, on arrête d'introduire du neuf
 * @param {unknown} [options.content] - transmis à isPresentable pour vérifier chaque carte
 * @returns {{cardIds: string[], dueCount: number, newCount: number, skipped: string[]}}
 */
export function composeSession(cards, options) {
  const {
    today,
    size,
    newRatio = DEFAULT_NEW_RATIO,
    overdueLimitDays = DEFAULT_OVERDUE_LIMIT_DAYS,
    content = null,
  } = options;

  const skipped = [];
  const due = [];
  const fresh = [];

  for (const [id, card] of Object.entries(cards)) {
    if (card.due > today) continue; // pas encore dû
    if (!isPresentable(id, content)) {
      skipped.push(id); // ne devrait jamais arriver côté contenu relu : signalé, jamais ignoré en silence
      continue;
    }
    if (card.reps > 0) due.push({ id, card });
    else fresh.push({ id, card });
  }

  // Les plus en retard d'abord.
  const byDueAsc = (a, b) => (a.card.due < b.card.due ? -1 : a.card.due > b.card.due ? 1 : 0);
  due.sort(byDueAsc);
  fresh.sort(byDueAsc);

  const overdueCount = due.filter((d) => diffDays(today, d.card.due) > overdueLimitDays).length;
  const allowNew = overdueCount === 0;

  const targetNew = allowNew ? Math.round(size * newRatio) : 0;
  const targetDue = size - targetNew;

  const chosenDue = due.slice(0, targetDue);
  let chosenNew = allowNew ? fresh.slice(0, targetNew) : [];

  // S'il manque des cartes pour atteindre la taille visée, on comble avec l'autre catégorie
  // plutôt que de finir une séance plus courte que prévu.
  let remaining = size - chosenDue.length - chosenNew.length;
  if (remaining > 0 && allowNew) {
    const extra = fresh.slice(chosenNew.length, chosenNew.length + remaining);
    chosenNew = chosenNew.concat(extra);
    remaining -= extra.length;
  }
  if (remaining > 0) {
    const extra = due.slice(chosenDue.length, chosenDue.length + remaining);
    chosenDue.push(...extra);
  }

  return {
    cardIds: declump([...chosenDue, ...chosenNew].map((c) => c.id)),
    dueCount: chosenDue.length,
    newCount: chosenNew.length,
    skipped,
  };
}

/**
 * File d'attente d'une séance en cours (§2.8, §4.3) : une carte ratée est réinsérée plus
 * loin dans la file pour repasser avant la fin, au lieu d'être simplement reportée au
 * lendemain.
 * @param {string[]} cardIds - ordre initial (venant de composeSession)
 * @param {{requeueDelay?: number}} [options] - nombre de cartes à intercaler avant qu'une carte ratée ne revienne
 */
export function createSessionQueue(cardIds, { requeueDelay = 3 } = {}) {
  const items = cardIds.map((id) => ({ id, done: false }));
  let cursor = 0;

  function advanceCursor() {
    while (cursor < items.length && items[cursor].done) cursor++;
  }

  return {
    /** L'identifiant de la prochaine carte à présenter, ou null si la séance est finie. */
    next() {
      advanceCursor();
      return cursor < items.length ? items[cursor].id : null;
    },
    /** Enregistre la réponse à la carte actuellement présentée (doit correspondre à `next()`). */
    answer(id, correct) {
      advanceCursor();
      const item = items[cursor];
      if (!item || item.id !== id) {
        throw new Error('La carte répondue ne correspond pas à la carte en cours.');
      }
      if (correct) {
        item.done = true;
        cursor++;
      } else {
        items.splice(cursor, 1);
        const insertAt = Math.min(cursor + requeueDelay, items.length);
        items.splice(insertAt, 0, { id, done: false });
      }
    },
    get finished() {
      return items.every((i) => i.done);
    },
    get remaining() {
      return items.filter((i) => !i.done).length;
    },
    get total() {
      return items.length;
    },
  };
}
