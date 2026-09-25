// src/ui/screens/sessionScreen.js
//
// Écran de séance (§4.1, §4.3) : compose la séance depuis le cœur SRS (core/session.js),
// montre une fiche de découverte minimale avant toute carte neuve (§2.2 — jamais de quiz sur
// un élément jamais vu), présente les exercices (QCM sur les lettres, saisie sur les mots),
// applique la note choisie par l'utilisateur, et boucle jusqu'à la fin. Une carte ratée
// revient avant la fin de la séance (comportement de core/session.js#createSessionQueue).

import { h } from '../dom.js';
import { buildQuestion, buildWordListening } from '../exercises.js';
import { questionScreenHtml } from '../questionView.js';
import { keyboardHtml } from '../keyboard.js';
import { speak, hasRussianVoice } from '../audio.js';
import { compareAnswer } from '../../core/text.js';
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

function audioWarningHtml() {
  return hasRussianVoice() === false
    ? `<p class="audio-warning">🔇 Aucune voix russe trouvée sur cet appareil — voir les
       paramètres de synthèse vocale pour en installer une.</p>`
    : '';
}

/** Fiche de découverte minimale (§2.2), avant d'être interrogé — une par type de contenu. */
function renderDiscovery(app, id) {
  const { type, elementId } = parseCardId(id);
  if (type === 'word') return renderWordDiscovery(app, elementId);
  return renderLetterDiscovery(app, elementId);
}

function renderLetterDiscovery(app, elementId) {
  const letter = app.content.lettersById.get(elementId);
  app.runtime.audioText = letter.print;

  document.getElementById('app').innerHTML = `
    <section class="screen screen-discovery" aria-live="polite">
      <p class="prompt-letter" lang="ru">${h(letter.print)} ${h(letter.lower)}</p>
      <p class="letter-sound">« ${h(letter.sound)} » — ${h(letter.hint)}</p>
      ${letter.falseFriend ? `<p class="letter-warning">⚠️ ${h(letter.falseFriend)}</p>` : ''}
      <button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>
      ${audioWarningHtml()}
      <button type="button" class="btn-primary" data-act="reveal">Je suis prêt</button>
    </section>
  `;
  speak(letter.print);
}

function renderWordDiscovery(app, elementId) {
  const word = app.content.wordsById.get(elementId);
  app.runtime.audioText = word.ru;

  document.getElementById('app').innerHTML = `
    <section class="screen screen-discovery" aria-live="polite">
      <p class="prompt-letter" lang="ru">${h(word.ru)}</p>
      <p class="letter-sound">« ${h(word.pron ?? word.ru)} » — ${h(word.fr)}</p>
      <button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>
      ${audioWarningHtml()}
      <button type="button" class="btn-primary" data-act="reveal">Je suis prêt</button>
    </section>
  `;
  speak(word.ru);
}

export function onSessionReveal(app) {
  app.runtime.discovered.add(app.runtime.currentCardId);
  renderQuestion(app, app.runtime.currentCardId);
}

function renderQuestion(app, id) {
  const { type, elementId, facet } = parseCardId(id);
  const position = app.runtime.queue.total - app.runtime.queue.remaining + 1;
  const progressLabel = `${position} / ${app.runtime.queue.total}`;

  if (type === 'word') {
    const word = app.content.wordsById.get(elementId);
    const question = buildWordListening(word);
    app.runtime.currentQuestion = question;
    app.runtime.audioText = question.audioText ?? null;
    renderTypingScreen(question, progressLabel);
    if (question.audioText) speak(question.audioText);
    return;
  }

  const letter = app.content.lettersById.get(elementId);
  const question = buildQuestion(letter, facet, app.content.letters);
  app.runtime.currentQuestion = question;
  app.runtime.audioText = question.audioText ?? null;
  document.getElementById('app').innerHTML = questionScreenHtml(question, { progressLabel, act: 'answer' });
  if (question.audioText) speak(question.audioText);
}

/** Exercice 7 (§4.2) : écouter, taper au clavier cyrillique à l'écran, valider. */
function renderTypingScreen(question, progressLabel) {
  document.getElementById('app').innerHTML = `
    <section class="screen screen-question" aria-live="polite">
      <p class="session-progress">${h(progressLabel)}</p>
      <button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>
      ${audioWarningHtml()}
      <h2 class="question-text">${h(question.label)}</h2>
      <input id="word-input" class="word-input" type="text" lang="ru" autocomplete="off"
        autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Ta réponse en russe" />
      ${keyboardHtml('word-input')}
      <button type="button" class="btn-primary" data-act="submit-typed">Valider</button>
    </section>
  `;
  document.getElementById('word-input')?.focus();
}

export function onSessionAnswer(app, choiceId) {
  const question = app.runtime.currentQuestion;
  app.runtime.pendingCorrect = choiceId === question.correctId;
  renderFeedback(app, app.runtime.pendingCorrect, question);
}

/** Valide la saisie de l'exercice 7, avec la tolérance de core/text.js#compareAnswer. */
export function onSessionSubmitTyped(app) {
  const input = document.getElementById('word-input');
  const question = app.runtime.currentQuestion;
  const result = compareAnswer(input?.value ?? '', question.expected);
  app.runtime.pendingCorrect = result.correct;
  renderFeedback(app, result.correct, question, result);
}

const RATING_LABELS = [
  [RATING.AGAIN, 'À revoir'],
  [RATING.HARD, 'Difficile'],
  [RATING.GOOD, 'Bien'],
  [RATING.EASY, 'Facile'],
];

/** Le feedback explique la règle (§2.4), et une note est suggérée selon la justesse (§4.3). */
function renderFeedback(app, correct, question, result = null) {
  const suggested = correct ? RATING.GOOD : RATING.AGAIN;
  let statusLine;
  if (correct) {
    statusLine = `✔ Bien joué. ${question.explanation}`;
  } else if (question.expected && result?.close) {
    statusLine = `✎ Presque : la bonne réponse est « ${question.expected} ». ${question.explanation}`;
  } else if (question.expected) {
    statusLine = `✖ Pas tout à fait : la bonne réponse est « ${question.expected} ». ${question.explanation}`;
  } else {
    statusLine = `✖ Pas tout à fait. ${question.explanation}`;
  }

  document.getElementById('app').innerHTML = `
    <section class="screen screen-feedback" role="status" aria-live="polite">
      <p class="feedback ${correct ? 'feedback-ok' : 'feedback-ko'}">${h(statusLine)}</p>
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
