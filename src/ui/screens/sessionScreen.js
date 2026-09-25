// src/ui/screens/sessionScreen.js
//
// Écran de séance (§4.1, §4.3) : compose la séance depuis le cœur SRS (core/session.js),
// montre une fiche de découverte minimale avant toute carte neuve (§2.2 — jamais de quiz sur
// un élément jamais vu), présente les exercices (QCM sur les lettres, saisie sur les mots),
// applique la note choisie par l'utilisateur, et boucle jusqu'à la fin. Une carte ratée
// revient avant la fin de la séance (comportement de core/session.js#createSessionQueue).

import { h } from '../dom.js';
import {
  buildQuestion,
  buildWordListening,
  buildAccentQuestion,
  buildReadAloudQuestion,
  buildPairQuestion,
  buildTraceQuestion,
} from '../exercises.js';
import { questionScreenHtml } from '../questionView.js';
import { keyboardHtml } from '../keyboard.js';
import { speak, hasRussianVoice } from '../audio.js';
import { compareAnswer, withStressMark } from '../../core/text.js';
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
  if (type === 'pair') return renderPairDiscovery(app, elementId);
  if (type === 'word') return renderWordDiscovery(app, elementId);
  return renderLetterDiscovery(app, elementId);
}

function renderLetterDiscovery(app, elementId) {
  const letter = app.content.lettersById.get(elementId);
  // Minuscule pour l'audio, jamais la majuscule (voir la note en tête de exercises.js :
  // une majuscule isolée fait épeler "lettre majuscule X" en entier à la synthèse vocale).
  app.runtime.audioText = letter.lower;

  document.getElementById('app').innerHTML = `
    <section class="screen screen-discovery" aria-live="polite">
      <p class="prompt-letter" lang="ru">${h(letter.print)} ${h(letter.lower)}</p>
      <p class="prompt-letter cursive" lang="ru">${h(letter.print)} ${h(letter.lower)}</p>
      <p class="audio-warning">✎ Cursive : police décorative approximative, pas la vraie écriture scolaire russe.</p>
      <p class="letter-sound">« ${h(letter.sound)} » — ${h(letter.hint)}</p>
      ${letter.falseFriend ? `<p class="letter-warning">⚠️ ${h(letter.falseFriend)}</p>` : ''}
      <button type="button" class="btn-audio" data-act="play-audio" aria-label="Écouter">🔊</button>
      ${audioWarningHtml()}
      <button type="button" class="btn-primary" data-act="reveal">Je suis prêt</button>
    </section>
  `;
  speak(letter.lower);
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

/** Fiche de découverte de l'exercice 8 (§4.2) : les deux mots de la paire, côte à côte. */
function renderPairDiscovery(app, elementId) {
  const pair = app.content.pairsById.get(elementId);
  const wordA = app.content.wordsById.get(pair.wordA);
  const wordB = app.content.wordsById.get(pair.wordB);
  app.runtime.audioText = wordA.ru; // pour Espace/🔊 : au moins un des deux à rejouer

  document.getElementById('app').innerHTML = `
    <section class="screen screen-discovery" aria-live="polite">
      <p class="question-text">Deux mots qui se ressemblent — écoute la différence</p>
      <div class="pair-words">
        ${[wordA, wordB]
          .map(
            (w) => `
          <button type="button" class="pair-word" data-act="play-word" data-text="${h(w.ru)}" lang="ru">
            <span class="pair-word-ru">${h(withStressMark(w.ru, w.stress))}</span>
            <span class="pair-word-fr">${h(w.fr)}</span>
          </button>`
          )
          .join('')}
      </div>
      <p class="letter-sound">${h(pair.note)}</p>
      ${audioWarningHtml()}
      <button type="button" class="btn-primary" data-act="reveal">Je suis prêt</button>
    </section>
  `;
}

export function onSessionReveal(app) {
  app.runtime.discovered.add(app.runtime.currentCardId);
  renderQuestion(app, app.runtime.currentCardId);
}

function renderQuestion(app, id) {
  const { type, elementId, facet } = parseCardId(id);
  const position = app.runtime.queue.total - app.runtime.queue.remaining + 1;
  const progressLabel = `${position} / ${app.runtime.queue.total}`;

  if (type === 'letter' && facet === 'trace') {
    const letter = app.content.lettersById.get(elementId);
    const question = buildTraceQuestion(letter);
    app.runtime.currentQuestion = question;
    app.runtime.audioText = null; // exercice visuel : rien à écouter
    renderTraceScreen(question, progressLabel);
    return;
  }

  if (type === 'pair') {
    const pair = app.content.pairsById.get(elementId);
    const question = buildPairQuestion(pair, app.content.wordsById);
    app.runtime.currentQuestion = question;
    app.runtime.audioText = question.audioText;
    document.getElementById('app').innerHTML = questionScreenHtml(question, { progressLabel, act: 'answer' });
    speak(question.audioText);
    return;
  }

  if (type === 'word' && facet === 'accent') {
    const word = app.content.wordsById.get(elementId);
    const question = buildAccentQuestion(word);
    app.runtime.currentQuestion = question;
    app.runtime.audioText = null; // exercice visuel : rien à écouter par défaut
    renderAccentScreen(question, progressLabel);
    return;
  }

  if (type === 'word' && facet === 'lecture') {
    const word = app.content.wordsById.get(elementId);
    const question = buildReadAloudQuestion(word);
    app.runtime.currentQuestion = question;
    app.runtime.audioText = question.audioText;
    renderReadAloudScreen(question, progressLabel);
    return;
  }

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

/** Exercice 4 (§4.2) : toucher la syllabe accentuée. Une syllabe = un bouton, réponse immédiate. */
function renderAccentScreen(question, progressLabel) {
  document.getElementById('app').innerHTML = `
    <section class="screen screen-question" aria-live="polite">
      <p class="session-progress">${h(progressLabel)}</p>
      <h2 class="question-text">${h(question.label)}</h2>
      <div class="syllables" role="group">
        ${question.syllables
          .map(
            (syllable, i) => `
          <button type="button" class="syllable" data-act="accent-answer" data-index="${i}" lang="ru">
            ${h(syllable)}
          </button>`
          )
          .join('')}
      </div>
    </section>
  `;
}

/** Exercice 3 (§4.2) : lire à voix haute, accent affiché (§2.7), puis vérifier avec l'audio. */
function renderReadAloudScreen(question, progressLabel) {
  document.getElementById('app').innerHTML = `
    <section class="screen screen-question" aria-live="polite">
      <p class="session-progress">${h(progressLabel)}</p>
      <p class="prompt-letter" lang="ru">${h(question.displayRu)}</p>
      <p class="question-text">${h(question.label)}</p>
      <button type="button" class="btn-primary" data-act="reveal-read">🔊 Vérifier</button>
      ${audioWarningHtml()}
    </section>
  `;
}

/**
 * Joue l'audio et enchaîne directement sur la note (§4.3) : l'app ne peut pas juger la
 * prononciation, seule la note choisie ensuite compte comme résultat (auto-évaluation).
 */
export function onReadAloudReveal(app) {
  const question = app.runtime.currentQuestion;
  speak(question.audioText);
  app.runtime.pendingCorrect = null;
  renderFeedback(app, null, question);
}

/** Exercice 6 (§4.2) : tracer une lettre en cursive avec le doigt, puis vérifier (auto-évalué). */
function renderTraceScreen(question, progressLabel) {
  document.getElementById('app').innerHTML = `
    <section class="screen screen-question" aria-live="polite">
      <p class="session-progress">${h(progressLabel)}</p>
      <p class="prompt-letter cursive" lang="ru">${h(question.displayLetter)}</p>
      <p class="audio-warning">✎ Police décorative approximative, pas la vraie écriture scolaire russe.</p>
      <p class="question-text">${h(question.label)}</p>
      <button type="button" class="btn-primary" data-act="reveal-trace">Vérifier</button>
    </section>
  `;
}

/** Auto-évaluation de l'exercice 6, même principe que l'exercice 3 (onReadAloudReveal). */
export function onTraceReveal(app) {
  app.runtime.pendingCorrect = null;
  renderFeedback(app, null, app.runtime.currentQuestion);
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

/** Valide la réponse de l'exercice 4 (§4.2) : l'index de syllabe touché. */
export function onSessionAccentAnswer(app, index) {
  const question = app.runtime.currentQuestion;
  app.runtime.pendingCorrect = index === question.correctIndex;
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

/**
 * Le feedback explique la règle (§2.4), et une note est suggérée selon la justesse (§4.3).
 * `correct` vaut `null` pour un exercice auto-évalué (lecture à voix haute, §4.2 exercice 3) :
 * l'app ne peut pas juger, alors elle ne prétend pas — pas de ✔/✖, la note choisie décide.
 */
function renderFeedback(app, correct, question, result = null) {
  const suggested = correct === false ? RATING.AGAIN : RATING.GOOD;
  let statusLine;
  let toneClass;
  if (correct === null) {
    statusLine = `${question.explanation} Comment ça s'est passé ?`;
    toneClass = 'feedback-neutral';
  } else if (correct) {
    statusLine = `✔ Bien joué. ${question.explanation}`;
    toneClass = 'feedback-ok';
  } else if (question.expected && result?.close) {
    statusLine = `✎ Presque : la bonne réponse est « ${question.expected} ». ${question.explanation}`;
    toneClass = 'feedback-ko';
  } else if (question.expected) {
    statusLine = `✖ Pas tout à fait : la bonne réponse est « ${question.expected} ». ${question.explanation}`;
    toneClass = 'feedback-ko';
  } else {
    statusLine = `✖ Pas tout à fait. ${question.explanation}`;
    toneClass = 'feedback-ko';
  }

  document.getElementById('app').innerHTML = `
    <section class="screen screen-feedback" role="status" aria-live="polite">
      <p class="feedback ${toneClass}">${h(statusLine)}</p>
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

  // Auto-évaluation (lecture à voix haute, §4.2 exercice 3) : pendingCorrect est null, donc
  // c'est la note elle-même qui décide de ce qui compte comme réussi pour le récapitulatif.
  const correct = app.runtime.pendingCorrect ?? rating >= RATING.GOOD;
  app.runtime.results[correct ? 'correct' : 'wrong']++;
  app.runtime.queue.answer(id, correct);

  renderSessionStep(app);
}

/** Rejoue l'audio de la question ou de la fiche de découverte en cours. */
export function replayCurrentAudio(app) {
  if (app.runtime.audioText) speak(app.runtime.audioText);
}

/** Joue un mot précis (fiche de découverte de l'exercice 8 : les deux mots d'une paire). */
export function onPlayWord(app, text) {
  app.runtime.audioText = text; // pour que Espace/🔊 rejoue ce même mot ensuite
  speak(text);
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
