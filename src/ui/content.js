// src/ui/content.js
//
// Charge le contenu (§5) et déclare comment les cartes de lettres se présentent (§4.3),
// pour que `isPresentable` (src/core/cards.js) sache les reconnaître.

import { registerCardType } from '../core/cards.js';
import { makeCardId } from '../core/cards.js';

let cache = null;

/** Charge (une seule fois) letters.json et lots.json, et enregistre le type de carte "letter". */
export async function loadContent() {
  if (cache) return cache;

  const [letters, lots] = await Promise.all([
    fetch('content/letters.json').then((r) => r.json()),
    fetch('content/lots.json').then((r) => r.json()),
  ]);
  const lettersById = new Map(letters.map((l) => [l.id, l]));
  cache = { letters, lots, lettersById };

  // Une carte "letter:<id>:son" ou "letter:<id>:lettre" ne peut être présentée que si la
  // lettre existe encore dans le contenu chargé (§4.3 : toute carte planifiée doit pouvoir
  // être présentée).
  registerCardType('letter', {
    facets: ['son', 'lettre'],
    canPresent: (parsed) => lettersById.has(parsed.elementId),
  });

  return cache;
}

/** Les deux identifiants de carte associés à une lettre (facette "son" et facette "lettre"). */
export function letterCardIds(letterId) {
  return [makeCardId('letter', letterId, 'son'), makeCardId('letter', letterId, 'lettre')];
}
