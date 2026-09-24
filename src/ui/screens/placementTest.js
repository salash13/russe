// src/ui/screens/placementTest.js
//
// Test de départ (§3.2, spécifique à Ben) : un passage rapide sur les 33 lettres, dans les
// deux sens (son → lettre et lettre → son). Les lettres réussies dans les deux sens sont
// marquées « déjà connues » et planifiées directement en révision espacée FSRS, sans passer
// par une fiche de découverte ; les autres suivent le parcours normal (carte neuve, due
// aujourd'hui — elles seront découvertes à la première séance, voir sessionScreen.js).

import { buildQuestion } from '../exercises.js';
import { questionScreenHtml } from '../questionView.js';
import { speak } from '../audio.js';
import { makeCardId } from '../../core/cards.js';
import { createCard, nextInterval, RATING } from '../../core/srs.js';
import { today, addDays } from '../../core/dates.js';
import { renderHome } from './home.js';

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function startPlacement(app) {
  const items = [];
  for (const letter of app.content.letters) {
    items.push({ letterId: letter.id, facet: 'lettre' });
    items.push({ letterId: letter.id, facet: 'son' });
  }
  app.runtime.placement = { items: shuffle(items), index: 0, results: new Map() };
  app.runtime.screen = 'placement';
  renderPlacementItem(app);
}

function renderPlacementItem(app) {
  const p = app.runtime.placement;
  if (p.index >= p.items.length) return finishPlacement(app);

  const { letterId, facet } = p.items[p.index];
  const letter = app.content.lettersById.get(letterId);
  const question = buildQuestion(letter, facet, app.content.letters);
  app.runtime.currentQuestion = question;
  app.runtime.audioText = question.audioText ?? null;

  document.getElementById('app').innerHTML = questionScreenHtml(question, {
    progressLabel: `Test de départ · ${p.index + 1} / ${p.items.length}`,
    act: 'placement-answer',
  });
  if (question.audioText) speak(question.audioText);
}

export function onPlacementAnswer(app, choiceId) {
  const p = app.runtime.placement;
  const { letterId, facet } = p.items[p.index];
  const correct = choiceId === app.runtime.currentQuestion.correctId;
  const entry = p.results.get(letterId) ?? {};
  entry[facet] = correct;
  p.results.set(letterId, entry);
  p.index++;
  renderPlacementItem(app);
}

function finishPlacement(app) {
  const p = app.runtime.placement;
  const nowDay = today();
  const retention = app.progress.state.settings.retention ?? 0.9;

  for (const letter of app.content.letters) {
    const result = p.results.get(letter.id) ?? {};
    const known = result.son === true && result.lettre === true;
    for (const facet of ['son', 'lettre']) {
      const id = makeCardId('letter', letter.id, facet);
      if (known) {
        const card = createCard(RATING.GOOD);
        card.due = addDays(nowDay, nextInterval(card.stability, retention));
        card.lastReviewDay = nowDay;
        app.progress.state.cards[id] = card;
      } else {
        // Parcours normal : carte neuve, due aujourd'hui — découverte à la première séance.
        app.progress.state.cards[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: nowDay };
      }
    }
  }

  app.progress.state.settings.placementDone = true;
  app.storage.save(app.progress.state);
  app.runtime.screen = 'home';
  renderHome(app);
}
