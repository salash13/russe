// src/ui/screens/progressScreen.js
//
// Écran Progrès (§4.1) : calendrier des jours pratiqués, mots sus, temps passé, les 5
// points faibles, erreurs par type.

import { h } from '../dom.js';
import {
  today,
  monthKey,
  daysInMonthList,
  isoWeekday,
  practicedDaysInMonth,
  computeStreak,
} from '../../core/dates.js';
import { parseCardId } from '../../core/cards.js';

const TYPE_LABELS = { letter: 'Lettres', word: 'Mots', pair: 'Paires minimales' };

/** Une phrase courte identifiant une carte, pour la liste des points faibles. */
function describeCard(app, id) {
  const { type, elementId, facet } = parseCardId(id);
  if (type === 'letter') {
    const letter = app.content.lettersById.get(elementId);
    return letter ? `${letter.print} ${letter.lower} (${facet})` : id;
  }
  if (type === 'word') {
    const word = app.content.wordsById.get(elementId);
    return word ? `${word.ru} — ${word.fr}` : id;
  }
  if (type === 'pair') {
    const pair = app.content.pairsById.get(elementId);
    if (!pair) return id;
    const wordA = app.content.wordsById.get(pair.wordA);
    const wordB = app.content.wordsById.get(pair.wordB);
    return `${wordA?.ru ?? '?'} / ${wordB?.ru ?? '?'}`;
  }
  return id;
}

function calendarHtml(monthKeyStr, practicedSet) {
  const days = daysInMonthList(monthKeyStr);
  const firstOffset = isoWeekday(days[0]) - 1; // cases vides avant le 1er (semaine commence lundi)
  const cells = [];
  for (let i = 0; i < firstOffset; i++) cells.push('<span class="calendar-cell calendar-cell-empty"></span>');
  for (const day of days) {
    const dayNum = Number(day.slice(-2));
    const practiced = practicedSet.has(day);
    cells.push(`<span class="calendar-cell${practiced ? ' calendar-cell-practiced' : ''}">${dayNum}</span>`);
  }
  return `<div class="calendar-grid">${cells.join('')}</div>`;
}

export function renderProgress(app) {
  const state = app.progress.state;
  const nowDay = today();
  const month = monthKey(nowDay);
  const practicedSet = new Set(state.days);

  // Mots sus : au moins une carte "word:<id>:*" déjà présentée (reps > 0), un mot compté une fois.
  const knownWordIds = new Set();
  for (const [id, card] of Object.entries(state.cards)) {
    if (id.startsWith('word:') && card.reps > 0) knownWordIds.add(parseCardId(id).elementId);
  }

  const minutesByDay = state.stats.minutesByDay ?? {};
  const minutesThisMonth = Object.entries(minutesByDay)
    .filter(([day]) => monthKey(day) === month)
    .reduce((sum, [, m]) => sum + m, 0);

  // Les 5 cartes qui ont échoué le plus souvent (lapses), à difficulté décroissante en cas d'égalité.
  const weakCards = Object.entries(state.cards)
    .filter(([, card]) => card.reps > 0 && card.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].difficulty - a[1].difficulty)
    .slice(0, 5);

  const errorsByType = state.stats.errorsByType ?? {};

  document.getElementById('app').innerHTML = `
    <section class="screen screen-progress">
      <h1>Progrès</h1>

      <h2 class="settings-heading">Jours pratiqués — ${h(month)}</h2>
      <div class="calendar-weekdays">
        <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
      </div>
      ${calendarHtml(month, practicedSet)}
      <p class="settings-hint">
        ${h(practicedDaysInMonth(state.days, nowDay))} jour(s) ce mois-ci · série de ${h(computeStreak(state.days, nowDay))} jour(s)
      </p>

      <h2 class="settings-heading">Vocabulaire</h2>
      <p class="progress-figure">${h(knownWordIds.size)} mot${knownWordIds.size === 1 ? '' : 's'} déjà pratiqué${knownWordIds.size === 1 ? '' : 's'}</p>

      <h2 class="settings-heading">Temps passé ce mois-ci</h2>
      <p class="progress-figure">${h(Math.round(minutesThisMonth))} min</p>

      <h2 class="settings-heading">Points faibles</h2>
      ${
        weakCards.length > 0
          ? `<ul class="weak-list">
              ${weakCards
                .map(
                  ([id, card]) =>
                    `<li>${h(describeCard(app, id))} — ${h(card.lapses)} échec${card.lapses === 1 ? '' : 's'}</li>`
                )
                .join('')}
            </ul>`
          : `<p class="settings-hint">Pas encore assez de données.</p>`
      }

      <h2 class="settings-heading">Erreurs par type</h2>
      ${
        Object.keys(errorsByType).length > 0
          ? `<ul class="weak-list">
              ${Object.entries(errorsByType)
                .map(([type, count]) => `<li>${h(TYPE_LABELS[type] ?? type)} : ${h(count)}</li>`)
                .join('')}
            </ul>`
          : `<p class="settings-hint">Pas encore d'erreur enregistrée.</p>`
      }

      <button type="button" class="btn-link" data-act="go-home">Retour</button>
    </section>
  `;
}
