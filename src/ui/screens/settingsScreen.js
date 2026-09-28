// src/ui/screens/settingsScreen.js
//
// Écran Réglages (§4.1) : objectif quotidien, audio, accent affiché, apparence (mode sombre
// forçable, taille du texte), rappel calendrier, sauvegarde (export/import), et une zone
// « danger » séparée pour tout effacer — jamais mélangée avec le reste (§4.1).

import { h } from '../dom.js';

function toggleButton(act, label, active) {
  return `
    <button type="button" class="setting-toggle${active ? ' setting-toggle-active' : ''}" data-act="${h(act)}">
      ${active ? '✔' : '—'} ${h(label)}
    </button>
  `;
}

function choiceButtons(act, options, currentValue) {
  return `
    <div class="settings-row">
      ${options
        .map(
          ([value, label]) => `
        <button type="button" class="setting-choice${value === currentValue ? ' setting-choice-active' : ''}"
          data-act="${h(act)}" data-value="${h(value)}">${h(label)}</button>`
        )
        .join('')}
    </div>
  `;
}

/** @param {{importMessage?: string}} [options] - message transitoire après un import (§6.3) */
export function renderSettings(app, { importMessage = '' } = {}) {
  const s = app.progress.state.settings;
  const goal = s.goalMinutes ?? 10;
  const autoAudio = s.autoAudio !== false;
  const slowAudio = s.slowAudio === true;
  const showStress = s.showStress !== 'never';
  const theme = s.theme ?? 'system';
  const textSize = s.textSize ?? 'normal';

  document.getElementById('app').innerHTML = `
    <section class="screen screen-settings">
      <h1>Réglages</h1>

      <h2 class="settings-heading">Objectif quotidien</h2>
      ${choiceButtons('set-goal', [['5', '5 min'], ['10', '10 min'], ['15', '15 min']], String(goal))}

      <h2 class="settings-heading">Audio</h2>
      ${toggleButton('toggle-auto-audio', 'Lecture automatique', autoAudio)}
      ${toggleButton('toggle-slow-audio', 'Toujours à vitesse lente 🐢', slowAudio)}

      <h2 class="settings-heading">Accent tonique</h2>
      ${toggleButton('toggle-show-stress', "Afficher l'accent (exercice 3, lecture à voix haute)", showStress)}

      <h2 class="settings-heading">Apparence</h2>
      ${choiceButtons(
        'set-theme',
        [
          ['system', 'Système'],
          ['light', 'Clair'],
          ['dark', 'Sombre'],
        ],
        theme
      )}
      ${choiceButtons(
        'set-text-size',
        [
          ['normal', 'A'],
          ['large', 'A+'],
          ['larger', 'A++'],
        ],
        textSize
      )}

      <h2 class="settings-heading">Rappel</h2>
      <button type="button" class="btn-secondary" data-act="download-reminder">
        Ajouter un rappel quotidien à mon calendrier
      </button>

      <h2 class="settings-heading">Sauvegarde</h2>
      <button type="button" class="btn-secondary" data-act="export-progress">Exporter ma progression</button>
      <label class="btn-secondary settings-file-label">
        Importer une sauvegarde
        <input type="file" accept="application/json" data-act-change="import-progress" />
      </label>
      ${importMessage ? `<p class="settings-hint" aria-live="polite">${h(importMessage)}</p>` : ''}

      <h2 class="settings-heading settings-danger-heading">Zone danger</h2>
      <button type="button" class="btn-danger" data-act="reset-everything">Tout effacer</button>

      <button type="button" class="btn-link" data-act="go-home">Retour</button>
    </section>
  `;
}
