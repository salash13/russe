// src/ui/screens/progressScreen.js
//
// Écran Progrès (§4.1) : calendrier des jours pratiqués (navigable mois par mois), répartition
// de ce qui est pratiqué par type, taux de réussite global, cartes en attente/en retard, les 5
// points faibles, erreurs par type.
//
// Mise en forme : tuiles de stats pour les chiffres isolés, barres (meters) pour les
// proportions (lettres/mots/paires pratiqués sur le total) plutôt que du texte "X / Y" nu —
// une proportion se lit d'un coup d'œil sur une barre, pas en faisant le calcul soi-même.

import { h, appRoot } from '../dom.js';
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

const TYPE_LABELS = { letter: 'Lettres', word: 'Mots', pair: 'Paires minimales', sentence: 'Phrases' };
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function monthLabel(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Tuile de stat isolée (§ dataviz : label en casse de phrase, valeur grande et sobre). */
function statTile(label, value, { hint = '', tone = '' } = {}) {
  return `
    <div class="stat-tile${tone ? ` stat-tile-${tone}` : ''}">
      <span class="stat-label">${h(label)}</span>
      <span class="stat-value">${h(value)}</span>
      ${hint ? `<span class="stat-hint">${h(hint)}</span>` : ''}
    </div>
  `;
}

/**
 * Barre de proportion : se lit d'un coup d'œil, pas besoin de calculer "X sur Y". Le
 * pourcentage passe par data-ratio plutôt que par un attribut style="" en dur dans le HTML
 * (posé ensuite via la CSSOM par applyMeterWidths) : pas besoin d'autoriser le style en
 * ligne dans la CSP de l'app pour ce seul usage.
 */
function meterRow(label, count, total) {
  const ratio = total > 0 ? Math.min(count / total, 1) : 0;
  return `
    <div>
      <div class="meter-label"><span>${h(label)}</span><span>${h(count)} / ${h(total)}</span></div>
      <div class="meter-track"><div class="meter-fill" data-ratio="${Math.round(ratio * 100)}"></div></div>
    </div>
  `;
}

function applyMeterWidths() {
  for (const el of document.querySelectorAll('.meter-fill')) {
    el.style.width = `${el.dataset.ratio}%`;
  }
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
  if (type === 'sentence') {
    const sentence = app.content.sentencesById.get(elementId);
    return sentence ? `${sentence.ru} — ${sentence.fr}` : id;
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
  const seen = { letter: new Set(), word: new Set(), pair: new Set(), sentence: new Set() };
  for (const [id, card] of Object.entries(cards)) {
    if (card.reps === 0) continue;
    const { type, elementId } = parseCardId(id);
    seen[type]?.add(elementId);
  }
  return { letters: seen.letter.size, words: seen.word.size, pairs: seen.pair.size, sentences: seen.sentence.size };
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
  const streak = computeStreak(state.days, nowDay);

  const byType = countByType(state.cards);
  const totalLetters = app.content.letters.length;
  const totalWords = app.content.words.length;
  const totalPairs = app.content.pairs.length;
  const totalSentences = app.content.sentences.filter((s) => s.reviewed?.ok === true).length;

  const minutesByDay = state.stats.minutesByDay ?? {};
  const minutesThisMonth = Object.entries(minutesByDay)
    .filter(([day]) => monthKey(day) === month)
    .reduce((sum, [, m]) => sum + m, 0);

  const totalCorrect = state.stats.totalCorrect ?? 0;
  const totalWrong = state.stats.totalWrong ?? 0;
  const totalAnswers = totalCorrect + totalWrong;
  const successRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null;

  const { overdue, newWaiting } = waitingCounts(state.cards, nowDay);

  const weakCards = Object.entries(state.cards)
    .filter(([, card]) => card.reps > 0 && card.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].difficulty - a[1].difficulty)
    .slice(0, 5);

  const errorsByType = state.stats.errorsByType ?? {};

  appRoot().innerHTML = `
    <section class="screen screen-progress">
      <h1>Progrès</h1>

      <div class="progress-card">
        <div class="month-nav">
          <button type="button" class="btn-link" data-act="progress-prev-month" data-value="${h(month)}">◀</button>
          <h2 class="progress-card-title month-nav-label">${h(monthLabel(month))}</h2>
          <button type="button" class="btn-link" data-act="progress-next-month" data-value="${h(month)}">▶</button>
        </div>
        <div class="calendar-weekdays">
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        ${calendarHtml(month, practicedSet)}
        <p class="settings-hint">
          ${h(practicedDaysInMonth(state.days, month + '-01'))} jour(s) ce mois-ci
          ${isCurrentMonth && streak > 0 ? ` · série de ${h(streak)} jour(s)` : ''}
        </p>
      </div>

      <div class="stat-row">
        ${statTile('Taux de réussite', successRate === null ? '—' : `${successRate}%`, {
          hint: totalAnswers > 0 ? `${totalCorrect} / ${totalAnswers} réponses` : 'Pas encore de données',
        })}
        ${statTile('Temps ce mois-ci', `${Math.round(minutesThisMonth)} min`)}
      </div>

      <div class="progress-card">
        <h2 class="progress-card-title">Vocabulaire pratiqué</h2>
        <div class="meter-list">
          ${meterRow('Lettres', byType.letters, totalLetters)}
          ${meterRow('Mots', byType.words, totalWords)}
          ${meterRow('Paires minimales', byType.pairs, totalPairs)}
          ${meterRow('Phrases', byType.sentences, totalSentences)}
        </div>
      </div>

      <div class="progress-card">
        <h2 class="progress-card-title">Cartes en attente aujourd'hui</h2>
        <div class="stat-row">
          ${statTile(overdue > 0 ? '⚠ En retard' : 'En retard', overdue, { tone: overdue > 0 ? 'warning' : '' })}
          ${statTile('Neuves prêtes', newWaiting)}
        </div>
        ${
          overdue > 0
            ? `<p class="settings-hint">Au-delà de ${DEFAULT_OVERDUE_LIMIT_DAYS} jours de retard, l'app arrête d'introduire du nouveau contenu tant que ce n'est pas résorbé.</p>`
            : ''
        }
      </div>

      <div class="progress-card">
        <h2 class="progress-card-title">Points faibles</h2>
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
      </div>

      <div class="progress-card">
        <h2 class="progress-card-title">Erreurs par type</h2>
        ${
          Object.keys(errorsByType).length > 0
            ? `<ul class="weak-list">
                ${Object.entries(errorsByType)
                  .map(([type, count]) => `<li>${h(TYPE_LABELS[type] ?? type)} : ${h(count)}</li>`)
                  .join('')}
              </ul>`
            : `<p class="settings-hint">Pas encore d'erreur enregistrée.</p>`
        }
      </div>

      <button type="button" class="btn-link" data-act="go-home">Retour</button>
    </section>
  `;
  applyMeterWidths();
}

/** Décale le mois affiché de `delta` (-1 ou +1) et réaffiche. */
export function shiftProgressMonth(app, currentMonth, delta) {
  renderProgress(app, shiftMonth(currentMonth, delta));
}
