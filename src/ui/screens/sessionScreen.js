// src/ui/screens/sessionScreen.js
//
// Écran de séance (§4.1, §4.3) : compose la séance depuis le cœur SRS (core/session.js),
// montre une fiche de découverte minimale avant toute carte neuve (§2.2 — jamais de quiz sur
// un élément jamais vu), présente les exercices 1 et 2 sur les lettres, applique la note
// choisie par l'utilisateur, et boucle jusqu'à la fin. Une carte ratée revient avant la fin
// de la séance (comportement de core/session.js#createSessionQueue).

import { h } from '../dom.js';
import { buildQuestion } from '../exercises.js';
import { questionScreenHtml } from '../questionView.js';
import { speak, hasRussianVoice } from '../audio.js';
import { composeSession, createSessionQueue } from '../../core/session.js';
import { createCard, reviewCard, nextInterval, RATING } from '../../core/srs.js';
import { today, addDays, diffDays } from '../../core/dates.js';
import { parseCardId } from '../../core/cards.js';
import { renderHome } from './home.js';

const DEFAULT_SESSION_SIZE = 10;

export function startSession(app) {
  const composed = composeSession(app.progress.state.cards, {
    today: today(),
    size: app.progress.state.settings.sessionSize ?? DEFAULT_SESSION_SIZE,
    content: app.content,
  });
  app.runtime.queue = createSessionQueue(composed.cardIds);
  app.runtime.results = { correct: 0, wrong: 0 };
  app.runtime.discovered = new Set();
  app.runtime.screen = 'session';
  renderSessionStep(app);
}

function isNewCard(app, id) {
  const card = app.progress.state.cards[id];
  return !card || card.reps === 0;
}

function renderSessionStep(app) {
  const id = app.runtime.queue.next();
  if (id == null) return finishSession(app);

  app.runtime.currentCardId = id;
  if (isNewCard(app, id) && !app.runtime.discovered.has(id)) {
    return renderDiscovery(app, id);
  }
  renderQuestion(app, id);
}

/** Fiche de découverte minimale (§2.2) : la lettre, son son, son astuce, avant d'être interrogé. */
function renderDiscovery(app, id) {
  const { elementId } = parseCardId(id);
  const letter = app.content.lettersById.get(elementId);
  app.runtime.audioText = letter.print;

  document.getElementById('app').innerHTML = `
    <section class="screen screen-discovery" aria-live="polite">
      <p class="prompt-letter" lang="ru">${h(letter.print)} ${h(letter.lower)}</p>
      <p class="letter-sound">« ${h(letter.sound)} » — ${h(letter.hint)}</p>
      ${letter.falseFriend ? `<p class="letter-warning">⚠️ ${h(letter.falseFriend)}</p>` : ''}
      <button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>
      ${
        hasRussianVoice() === false
          ? `<p class="audio-warning">🔇 Aucune voix russe trouvée sur cet appareil — voir les
             paramètres de synthèse vocale pour en installer une.</p>`
          : ''
      }
      <button type="button" class="btn-primary" data-act="reveal">Je suis prêt</button>
    </section>
  `;
  speak(letter.print);
}

export function onSessionReveal(app) {
  app.runtime.discovered.add(app.runtime.currentCardId);
  renderQuestion(app, app.runtime.currentCardId);
}

function renderQuestion(app, id) {
  const { elementId, facet } = parseCardId(id);
  const letter = app.content.lettersById.get(elementId);
  const question = buildQuestion(letter, facet, app.content.letters);
  app.runtime.currentQuestion = question;
  app.runtime.audioText = question.audioText ?? null;

  const position = app.runtime.queue.total - app.runtime.queue.remaining + 1;
  document.getElementById('app').innerHTML = questionScreenHtml(question, {
    progressLabel: `${position} / ${app.runtime.queue.total}`,
    act: 'answer',
  });
  if (question.audioText) speak(question.audioText);
}

export function onSessionAnswer(app, choiceId) {
  const question = app.runtime.currentQuestion;
  app.runtime.pendingCorrect = choiceId === question.correctId;
  renderFeedback(app, app.runtime.pendingCorrect, question);
}

const RATING_LABELS = [
  [RATING.AGAIN, 'À revoir'],
  [RATING.HARD, 'Difficile'],
  [RATING.GOOD, 'Bien'],
  [RATING.EASY, 'Facile'],
];

/** Le feedback explique la règle (§2.4), et une note est suggérée selon la justesse (§4.3). */
function renderFeedback(app, correct, question) {
  const suggested = correct ? RATING.GOOD : RATING.AGAIN;
  document.getElementById('app').innerHTML = `
    <section class="screen screen-feedback" role="status" aria-live="polite">
      <p class="feedback ${correct ? 'feedback-ok' : 'feedback-ko'}">
        ${correct ? '✔ Bien joué.' : '✖ Pas tout à fait.'} ${h(question.explanation)}
      </p>
      <div class="choices" role="group" aria-label="Note">
        ${RATING_LABELS.map(
          ([value, label]) => `
          <button type="button" class="choice rating${value === suggested ? ' rating-suggested' : ''}"
            data-act="rate" data-rating="${value}" data-key="${value}">
            <span class="choice-key">${value}</span> ${h(label)}
          </button>`
        ).join('')}
      </div>
    </section>
  `;
}

export function onSessionRate(app, rating) {
  const id = app.runtime.currentCardId;
  const nowDay = today();
  const retention = app.progress.state.settings.retention ?? 0.9;
  const existing = app.progress.state.cards[id];

  const updated =
    !existing || existing.reps === 0
      ? createCard(rating)
      : reviewCard(existing, rating, Math.max(diffDays(nowDay, existing.lastReviewDay ?? nowDay), 0), retention);
  updated.due = addDays(nowDay, nextInterval(updated.stability, retention));
  updated.lastReviewDay = nowDay;
  app.progress.state.cards[id] = updated;
  app.storage.save(app.progress.state);

  const correct = app.runtime.pendingCorrect;
  app.runtime.results[correct ? 'correct' : 'wrong']++;
  app.runtime.queue.answer(id, correct);

  renderSessionStep(app);
}

/** Rejoue l'audio de la question ou de la fiche de découverte en cours. */
export function replayCurrentAudio(app) {
  if (app.runtime.audioText) speak(app.runtime.audioText);
}

function finishSession(app) {
  const nowDay = today();
  if (!app.progress.state.days.includes(nowDay)) {
    app.progress.state.days.push(nowDay);
  }
  app.storage.save(app.progress.state);

  const { correct, wrong } = app.runtime.results;
  const total = correct + wrong;
  document.getElementById('app').innerHTML = `
    <section class="screen screen-recap">
      <h1>Séance terminée</h1>
      <p class="recap-score">${h(correct)} / ${h(total)} bonnes réponses</p>
      <button type="button" class="btn-primary" data-act="go-home">À demain</button>
    </section>
  `;
}
