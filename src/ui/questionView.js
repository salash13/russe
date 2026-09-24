// src/ui/questionView.js
//
// Bloc de rendu commun aux exercices 1 et 2 (§4.2), partagé par le test de départ
// (screens/placementTest.js) et la séance (screens/sessionScreen.js) pour ne pas dupliquer
// le balisage. Cibles tactiles ≥ 44px (§4.5) via .choice dans app.css ; touches 1-4 au
// clavier gérées par app.js (data-key).

import { h } from './dom.js';

/**
 * @param {object} question - venant de exercises.js#buildQuestion
 * @param {{progressLabel: string, act: string}} options - `act` = valeur de data-act à poser
 *   sur chaque bouton de choix (ex. "answer" en séance, "placement-answer" au test de départ)
 */
export function questionScreenHtml(question, { progressLabel, act }) {
  return `
    <section class="screen screen-question" aria-live="polite">
      <p class="session-progress">${h(progressLabel)}</p>
      ${
        question.audioText
          ? `<button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>`
          : `<p class="prompt-letter" lang="ru">${h(question.prompt)}</p>`
      }
      <h2 class="question-text">${h(question.label)}</h2>
      <div class="choices" role="group">
        ${question.choices
          .map(
            (c, i) => `
          <button type="button" class="choice" data-act="${h(act)}" data-choice="${h(c.id)}" data-key="${i + 1}">
            <span class="choice-key">${i + 1}</span> <span${c.lang ? ` lang="${h(c.lang)}"` : ''}>${h(c.label)}</span>
          </button>`
          )
          .join('')}
      </div>
    </section>
  `;
}
