// src/ui/screens/progressScreen.js
//
// Écran Progrès (§4.1) : calendrier des jours pratiqués (navigable mois par mois), répartition
// de ce qui est pratiqué par type, taux de réussite global, cartes en attente/en retard, les 5
// points faibles, erreurs par type.

import { h } from '../dom.js';
import {
  today,
  monthKey,
  shiftMonth,
  daysInMonthList,
  isoWeekday,
  diffDays,
  practicedDaysInMonth,
  computeStreak,
} from '../../core/dates.js';
import { parseCardId } from '../../core/cards.js';
import { DEFAULT_OVERDUE_LIMIT_DAYS } from '../../core/session.js';

const TYPE_LABELS = { letter: 'Lettres', word: 'Mots', pair: 'Paires minimales' };
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function monthLabel(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

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

/** Combien d'éléments distincts (une lettre/un mot/une paire compte une fois) sont déjà pratiqués. */
function countByType(cards) {
  const seen = { letter: new Set(), word: new Set(), pair: new Set() };
  for (const [id, card] of Object.entries(cards)) {
    if (card.reps === 0) continue;
    const { type, elementId } = parseCardId(id);
    seen[type]?.add(elementId);
  }
  return { letters: seen.letter.size, words: seen.word.size, pairs: seen.pair.size };
}

/**
 * Cartes en attente aujourd'hui : combien sont en retard (au-delà du seuil qui bloque le
 * neuf, §4.3) et combien sont neuves et prêtes à être découvertes. Répond directement à la
 * question « pourquoi je ne vois pas de nouveau mot ? ».
 */
function waitingCounts(cards, nowDay) {
  let overdue = 0;
  let newWaiting = 0;
  for (const card of Object.values(cards)) {
    if (card.due > nowDay) continue;
    if (card.reps > 0) {
      if (diffDays(nowDay, card.due) > DEFAULT_OVERDUE_LIMIT_DAYS) overdue++;
    } else {
      newWaiting++;
    }
  }
  return { overdue, newWaiting };
}

/** @param {string} [monthOverride] - mois affiché ('AAAA-MM'), par défaut le mois en cours */
export function renderProgress(app, monthOverride) {
  const state = app.progress.state;
  const nowDay = today();
  const month = monthOverride ?? monthKey(nowDay);
  const isCurrentMonth = month === monthKey(nowDay);
  const practicedSet = new Set(state.days);

  const byType = countByType(state.cards);
  const totalLetters = app.content.letters.length;
  const totalWords = app.content.words.length;
  const totalPairs = app.content.pairs.length;

  const minutesByDay = state.stats.minutesByDay ?? {};
  const minutesThisMonth = Object.entries(minutesByDay)
    .filter(([day]) => monthKey(day) === month)
    .reduce((sum, [, m]) => sum + m, 0);

  const totalCorrect = state.stats.totalCorrect ?? 0;
  const totalWrong = state.stats.totalWrong ?? 0;
  const totalAnswers = totalCorrect + totalWrong;
  const successRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null;

  const { overdue, newWaiting } = waitingCounts(state.cards, nowDay);

  // Les 5 cartes qui ont échoué le plus souvent (lapses), à difficulté décroissante en cas d'égalité.
  const weakCards = Object.entries(state.cards)
    .filter(([, card]) => card.reps > 0 && card.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].difficulty - a[1].difficulty)
    .slice(0, 5);

  const errorsByType = state.stats.errorsByType ?? {};

  document.getElementById('app').innerHTML = `
    <section class="screen screen-progress">
      <h1>Progrès</h1>

      <div class="month-nav">
        <button type="button" class="btn-link" data-act="progress-prev-month" data-value="${h(month)}">◀</button>
        <h2 class="settings-heading month-nav-label">${h(monthLabel(month))}</h2>
        <button type="button" class="btn-link" data-act="progress-next-month" data-value="${h(month)}">▶</button>
      </div>
      ${calendarHtml(month, practicedSet)}
      <p class="settings-hint">
        ${h(practicedDaysInMonth(state.days, month + '-01'))} jour(s) ce mois-ci
        ${isCurrentMonth && computeStreak(state.days, nowDay) > 0 ? ` · série de ${h(computeStreak(state.days, nowDay))} jour(s)` : ''}
      </p>

      <h2 class="settings-heading">Vocabulaire pratiqué</h2>
      <ul class="weak-list">
        <li>Lettres : ${h(byType.letters)} / ${h(totalLetters)}</li>
        <li>Mots : ${h(byType.words)} / ${h(totalWords)}</li>
        <li>Paires minimales : ${h(byType.pairs)} / ${h(totalPairs)}</li>
      </ul>

      <h2 class="settings-heading">Temps passé — ${h(monthLabel(month))}</h2>
      <p class="progress-figure">${h(Math.round(minutesThisMonth))} min</p>

      <h2 class="settings-heading">Taux de réussite global</h2>
      <p class="progress-figure">${successRate === null ? '—' : `${h(successRate)} %`}</p>
      ${totalAnswers > 0 ? `<p class="settings-hint">${h(totalCorrect)} bonne(s) réponse(s) sur ${h(totalAnswers)}</p>` : ''}

      <h2 class="settings-heading">Cartes en attente aujourd'hui</h2>
      <p class="settings-hint">
        ${overdue} carte(s) en retard de révision (plus de ${DEFAULT_OVERDUE_LIMIT_DAYS} jours — bloque l'arrivée de nouveau contenu tant que ce n'est pas résorbé)<br>
        ${newWaiting} carte(s) neuve(s) prête(s) à être découverte(s)
      </p>

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

/** Décale le mois affiché de `delta` (-1 ou +1) et réaffiche. */
export function shiftProgressMonth(app, currentMonth, delta) {
  renderProgress(app, shiftMonth(currentMonth, delta));
}
