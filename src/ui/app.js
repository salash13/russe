// src/ui/app.js
//
// Point d'entrée de l'interface (§6.1) : charge la progression et le contenu, affiche
// l'écran courant, et centralise les interactions via un seul gestionnaire d'événements
// lisant l'attribut data-act (repris du thaï, §11 — « à reprendre »), plutôt que d'attacher
// un écouteur par bouton.

import { createStorage } from '../core/storage.js';
import { today } from '../core/dates.js';
import { loadContent, seedWordCards } from './content.js';
import { primeVoices } from './audio.js';
import { insertChar, backspace } from './keyboard.js';
import { renderHome } from './screens/home.js';
import { startPlacement, onPlacementAnswer, restartPlacement } from './screens/placementTest.js';
import {
  startSession,
  onSessionAnswer,
  onSessionAccentAnswer,
  onSessionSubmitTyped,
  onReadAloudReveal,
  onSessionRate,
  onSessionReveal,
  replayCurrentAudio,
} from './screens/sessionScreen.js';

const backend = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

const app = {
  storage: createStorage(backend),
  progress: null,
  content: null,
  runtime: {},
};

function renderCorrupted() {
  document.getElementById('app').innerHTML = `
    <section class="screen screen-error">
      <h1>Progression illisible</h1>
      <p>La sauvegarde enregistrée sur cet appareil n'a pas pu être lue. Rien n'a été
        effacé : tu peux l'exporter telle quelle avant de continuer.</p>
      <button type="button" class="btn-primary" data-act="export-corrupted">Exporter telle quelle</button>
    </section>
  `;
}

function exportCorrupted() {
  const raw = app.progress.raw ?? '';
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `russe-sauvegarde-illisible-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function boot() {
  primeVoices(); // charge la liste des voix tôt, avant le premier tapotement (§audio.js)
  app.progress = app.storage.load();
  if (app.progress.corrupted) {
    renderCorrupted();
    return;
  }
  app.content = await loadContent();

  // Chaque mot relu (§5.5 : reviewed.ok) qui n'a pas encore de carte en obtient une, neuve,
  // due aujourd'hui — c'est ce qui le fait entrer dans le cycle normal de séance. Un mot non
  // relu n'obtient jamais de carte : il reste invisible.
  const added = seedWordCards(app.progress.state.cards, app.content.words, today());
  if (added > 0) app.storage.save(app.progress.state);

  renderHome(app);
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'start-placement':
      startPlacement(app);
      break;
    case 'restart-placement':
      // Destructif pour les cartes de lettres (pas pour le reste) : on demande confirmation.
      if (window.confirm('Refaire le test de départ ? Ta progression sur les lettres sera remise à zéro (le reste de ta progression est conservé).')) {
        restartPlacement(app);
      }
      break;
    case 'placement-answer':
      onPlacementAnswer(app, el.dataset.choice);
      break;
    case 'start-session':
      startSession(app);
      break;
    case 'answer':
      onSessionAnswer(app, el.dataset.choice);
      break;
    case 'accent-answer':
      onSessionAccentAnswer(app, Number(el.dataset.index));
      break;
    case 'submit-typed':
      onSessionSubmitTyped(app);
      break;
    case 'reveal-read':
      onReadAloudReveal(app);
      break;
    case 'rate':
      onSessionRate(app, Number(el.dataset.rating));
      break;
    case 'reveal':
      onSessionReveal(app);
      break;
    case 'play-audio':
      replayCurrentAudio(app);
      break;
    case 'go-home':
      renderHome(app);
      break;
    case 'export-corrupted':
      exportCorrupted();
      break;
    case 'kbd-key': {
      const input = document.getElementById(el.dataset.target);
      if (input) insertChar(input, el.dataset.char);
      break;
    }
    case 'kbd-backspace': {
      const input = document.getElementById(el.dataset.target);
      if (input) backspace(input);
      break;
    }
    case 'kbd-space': {
      const input = document.getElementById(el.dataset.target);
      if (input) insertChar(input, ' ');
      break;
    }
    default:
      break;
  }
});

// Clavier (§4.5) : 1-4 pour choisir, Espace pour rejouer l'audio, Entrée pour valider une
// saisie. Les raccourcis 1-4 et Espace sont désactivés pendant la frappe dans le champ de
// saisie (exercice 7), sinon ils empêcheraient de taper ces caractères-là.
document.addEventListener('keydown', (event) => {
  const typing = document.activeElement?.tagName === 'INPUT';

  if (!typing && ['1', '2', '3', '4'].includes(event.key)) {
    document.querySelector(`[data-key="${event.key}"]`)?.click();
  } else if (!typing && event.key === ' ') {
    const btn = document.querySelector('[data-act="play-audio"]');
    if (btn) {
      event.preventDefault();
      btn.click();
    }
  } else if (event.key === 'Enter') {
    const submit = document.querySelector('[data-act="submit-typed"]');
    if (submit) {
      event.preventDefault();
      submit.click();
    }
  }
});

boot();
