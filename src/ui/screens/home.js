// src/ui/screens/home.js
//
// Écran d'accueil (§4.1) : un seul gros bouton, l'essentiel des chiffres de motivation
// sobre (§4.4 — pas de série mise en avant seule, mais les jours pratiqués ce mois-ci).

import { h } from '../dom.js';
import { today, practicedDaysInMonth, computeStreak } from '../../core/dates.js';

export function renderHome(app) {
  const { state } = app.progress;
  const placementDone = state.settings.placementDone === true;
  const monthCount = practicedDaysInMonth(state.days, today());
  const streak = computeStreak(state.days, today());

  const root = document.getElementById('app');
  root.innerHTML = `
    <section class="screen screen-home">
      <h1 lang="ru">Русский</h1>
      <p class="tagline">Apprendre le russe, à ton rythme.</p>
      ${
        placementDone
          ? `<button type="button" class="btn-primary" data-act="start-session">Ma séance</button>`
          : `<button type="button" class="btn-primary" data-act="start-placement">Commencer le test de départ</button>`
      }
      <p class="stats">
        ${monthCount} jour${monthCount === 1 ? '' : 's'} pratiqué${monthCount === 1 ? '' : 's'} ce mois-ci
        ${streak > 0 ? ` · série de ${h(streak)} jour${streak === 1 ? '' : 's'}` : ''}
      </p>
    </section>
  `;
}
