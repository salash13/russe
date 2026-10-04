// src/ui/screens/alphabetScreen.js
//
// Écran Alphabet (§4.1) : les 33 lettres, imprimées et en cursive, avec audio. Groupées par
// lot (§3.2) pour garder la logique pédagogique visible, même en simple consultation. Le
// tracé (exercice 6) reste réservé à la séance — ici, c'est une vue de référence à parcourir,
// pas un exercice.

import { h, appRoot } from '../dom.js';

export function renderAlphabet(app) {
  const lots = [...app.content.lots].sort((a, b) => a.id - b.id);

  appRoot().innerHTML = `
    <section class="screen screen-alphabet">
      <h1>Alphabet</h1>
      <p class="settings-hint">Touche une lettre pour entendre son son.</p>
      ${lots
        .map(
          (lot) => `
        <h2 class="settings-heading">Lot ${h(lot.id)} — ${h(lot.title)}</h2>
        <div class="alphabet-grid">
          ${lot.letters
            .map((letterId) => app.content.lettersById.get(letterId))
            .filter(Boolean)
            .map(
              (letter) => `
            <button type="button" class="alphabet-card" data-act="play-word" data-text="${h(letter.lower)}">
              <span class="alphabet-print" lang="ru">${h(letter.print)} ${h(letter.lower)}</span>
              <span class="alphabet-cursive cursive" lang="ru">${h(letter.print)} ${h(letter.lower)}</span>
              <span class="alphabet-sound">« ${h(letter.sound)} »</span>
            </button>`
            )
            .join('')}
        </div>`
        )
        .join('')}
      <p class="audio-warning">✎ Cursive : police décorative approximative, pas la vraie écriture scolaire russe.</p>
      <button type="button" class="btn-link" data-act="go-home">Retour</button>
    </section>
  `;
}
