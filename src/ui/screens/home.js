// src/ui/screens/home.js
//
// Écran d'accueil (§4.1) : un seul gros bouton, l'anneau de l'objectif du jour, l'essentiel
// des chiffres de motivation sobre (§4.4 — pas de série mise en avant seule, mais les jours
// pratiqués ce mois-ci).

import { h, appRoot } from '../dom.js';
import { today, practicedDaysInMonth, computeStreak } from '../../core/dates.js';

/** Anneau SVG de l'objectif du jour (§4.1) : minutes déjà pratiquées aujourd'hui / objectif. */
function goalRingHtml(todayMinutes, goalMinutes) {
  const ratio = goalMinutes > 0 ? Math.min(todayMinutes / goalMinutes, 1) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);
  const reached = ratio >= 1;
  const label = `${Math.round(todayMinutes)} minute${Math.round(todayMinutes) === 1 ? '' : 's'} sur ${goalMinutes} aujourd'hui`;

  return `
    <svg class="goal-ring" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${h(label)}">
      <circle cx="60" cy="60" r="${radius}" class="goal-ring-bg" />
      <circle cx="60" cy="60" r="${radius}" class="goal-ring-fg${reached ? ' goal-ring-reached' : ''}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 60 60)" />
      <text x="60" y="56" text-anchor="middle" class="goal-ring-text">${reached ? '✔' : `${Math.round(ratio * 100)}%`}</text>
      <text x="60" y="76" text-anchor="middle" class="goal-ring-subtext">${h(goalMinutes)} min</text>
    </svg>
  `;
}

export function renderHome(app) {
  const { state } = app.progress;
  const placementDone = state.settings.placementDone === true;
  const placementInProgress = state.placementProgress != null;
  const nowDay = today();
  const monthCount = practicedDaysInMonth(state.days, nowDay);
  const streak = computeStreak(state.days, nowDay);
  const goalMinutes = state.settings.goalMinutes ?? 10;
  const todayMinutes = state.stats.minutesByDay?.[nowDay] ?? 0;

  const root = appRoot();
  root.innerHTML = `
    <section class="screen screen-home">
      <h1 lang="ru">Русский</h1>
      <p class="tagline">Apprendre le russe, à ton rythme.</p>
      ${goalRingHtml(todayMinutes, goalMinutes)}
      ${
        placementDone
          ? `<button type="button" class="btn-primary" data-act="start-session">Ma séance</button>`
          : placementInProgress
            ? `<button type="button" class="btn-primary" data-act="start-placement">Reprendre le test de départ</button>`
            : `<button type="button" class="btn-primary" data-act="start-placement">Commencer le test de départ</button>`
      }
      <p class="stats">
        ${monthCount} jour${monthCount === 1 ? '' : 's'} pratiqué${monthCount === 1 ? '' : 's'} ce mois-ci
        ${streak > 0 ? ` · série de ${h(streak)} jour${streak === 1 ? '' : 's'}` : ''}
      </p>
      ${
        placementDone
          ? `<button type="button" class="btn-link" data-act="restart-placement">Refaire le test de départ</button>`
          : ''
      }
      <div class="home-links">
        <button type="button" class="btn-link" data-act="show-alphabet">Alphabet</button>
        <button type="button" class="btn-link" data-act="show-dictionary">Dictionnaire</button>
        <button type="button" class="btn-link" data-act="show-progress">Progrès</button>
        <button type="button" class="btn-link" data-act="show-rules">Règles de lecture</button>
        <button type="button" class="btn-link" data-act="show-settings">Réglages</button>
      </div>
    </section>
  `;
}
