// src/ui/screens/placementTest.js
//
// Test de départ (§3.2, spécifique à Ben) : un passage rapide sur les 33 lettres, dans les
// deux sens (son → lettre et lettre → son). Les lettres réussies dans les deux sens sont
// marquées « déjà connues » et planifiées directement en révision espacée FSRS, sans passer
// par une fiche de découverte ; les autres suivent le parcours normal (carte neuve, due
// aujourd'hui — elles seront découvertes à la première séance, voir sessionScreen.js).

import { h } from '../dom.js';
import { buildQuestion } from '../exercises.js';
import { questionScreenHtml } from '../questionView.js';
import { speak } from '../audio.js';
import { makeCardId } from '../../core/cards.js';
import { createCard, nextInterval, RATING } from '../../core/srs.js';
import { today, addDays } from '../../core/dates.js';

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Ь et Ъ ne se prononcent jamais seuls (§3.2, "son": "(muet)") : leur faire deviner "quelle
// lettre fait ce son" n'a pas de sens, et forcer la synthèse vocale à lire le caractère seul
// produit un charabia sans rapport (constaté en direct). On garde uniquement l'exercice
// "lettre → son" pour elles, où la bonne réponse est justement "(muet)".
function hasAudibleSound(letter) {
  return letter.sound !== '(muet)';
}

/** Sauvegarde la progression du test en cours, pour pouvoir la reprendre après un rechargement. */
function persistPlacementProgress(app) {
  const p = app.runtime.placement;
  app.progress.state.placementProgress = {
    items: p.items,
    index: p.index,
    results: Object.fromEntries(p.results),
  };
  app.storage.save(app.progress.state);
}

export function startPlacement(app) {
  const saved = app.progress.state.placementProgress;
  if (saved) {
    // Reprend là où on s'était arrêté (§ voir migrate.js pour la validation de forme).
    app.runtime.placement = {
      items: saved.items,
      index: saved.index,
      results: new Map(Object.entries(saved.results)),
    };
  } else {
    const items = [];
    for (const letter of app.content.letters) {
      if (hasAudibleSound(letter)) items.push({ letterId: letter.id, facet: 'lettre' });
      items.push({ letterId: letter.id, facet: 'son' });
    }
    app.runtime.placement = { items: shuffle(items), index: 0, results: new Map() };
    persistPlacementProgress(app); // sauvegardé tout de suite : un refresh à la 1ʳᵉ question reprend le même ordre
  }
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
  persistPlacementProgress(app);
  renderPlacementItem(app);
}

function finishPlacement(app) {
  const p = app.runtime.placement;
  const nowDay = today();
  const retention = app.progress.state.settings.retention ?? 0.9;
  const knownLetters = [];
  const toLearnLetters = [];

  for (const letter of app.content.letters) {
    const result = p.results.get(letter.id) ?? {};
    const audible = hasAudibleSound(letter);
    const known = audible ? result.son === true && result.lettre === true : result.son === true;
    const facets = audible ? ['son', 'lettre'] : ['son'];
    (known ? knownLetters : toLearnLetters).push(letter);
    for (const facet of facets) {
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
    // Le test de départ n'évalue que son/lettre (§3.2) : la cursive (exercices 5 et 6)
    // démarre toujours neuve, même pour une lettre déjà connue à l'oral.
    for (const cursiveFacet of ['cursive', 'trace']) {
      const id = makeCardId('letter', letter.id, cursiveFacet);
      app.progress.state.cards[id] = { difficulty: 5, stability: 0.5, reps: 0, lapses: 0, due: nowDay };
    }
  }

  app.progress.state.settings.placementDone = true;
  app.progress.state.placementProgress = null; // le test est fini, plus rien à reprendre
  app.storage.save(app.progress.state);
  app.runtime.screen = 'placement-result';
  renderPlacementResult(app, knownLetters, toLearnLetters);
}

/** Écran de résultat (§ demandé par Ben, absent à l'origine) : pas de correction question par
 * question pendant le test lui-même (ça reste un test rapide, sans souffler les réponses en
 * route), mais un bilan clair une fois fini. */
function renderPlacementResult(app, knownLetters, toLearnLetters) {
  const total = knownLetters.length + toLearnLetters.length;
  const letterChip = (l) => `<span class="letter-chip" lang="ru">${h(l.print)}</span>`;

  document.getElementById('app').innerHTML = `
    <section class="screen screen-placement-result">
      <h1>Test de départ terminé</h1>
      <p class="recap-score">${h(knownLetters.length)} / ${h(total)} lettres déjà connues</p>

      ${
        knownLetters.length > 0
          ? `<h2 class="result-heading">Déjà connues</h2>
             <p class="letter-chips">${knownLetters.map(letterChip).join(' ')}</p>`
          : ''
      }
      ${
        toLearnLetters.length > 0
          ? `<h2 class="result-heading">À apprendre</h2>
             <p class="letter-chips">${toLearnLetters.map(letterChip).join(' ')}</p>`
          : ''
      }

      <button type="button" class="btn-primary" data-act="go-home">Continuer</button>
    </section>
  `;
}

/**
 * Refait le test de départ depuis zéro, à la demande (§ voir home.js — sans ça, une fois le
 * test fini, rien ne permettait jamais d'y revenir). Efface les cartes de lettres créées par
 * le précédent passage — mais pas les cartes de mots ni le reste de la progression — pour
 * repartir sur un résultat propre plutôt que de mélanger deux passages.
 */
export function restartPlacement(app) {
  for (const key of Object.keys(app.progress.state.cards)) {
    if (key.startsWith('letter:')) delete app.progress.state.cards[key];
  }
  app.progress.state.settings.placementDone = false;
  app.progress.state.placementProgress = null;
  app.storage.save(app.progress.state);
  startPlacement(app);
}
