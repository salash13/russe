// src/ui/app.js
//
// Point d'entrée de l'interface (§6.1) : charge la progression et le contenu, affiche
// l'écran courant, et centralise les interactions via un seul gestionnaire d'événements
// lisant l'attribut data-act (repris du thaï, §11 — « à reprendre »), plutôt que d'attacher
// un écouteur par bouton.

import { createStorage } from '../core/storage.js';
import { today } from '../core/dates.js';
import { loadContent, seedWordCards, seedPairCards } from './content.js';
import { primeVoices } from './audio.js';
import { insertChar, backspace } from './keyboard.js';
import { applyTheme } from './theme.js';
import { downloadDailyReminder } from './reminder.js';
import { renderHome } from './screens/home.js';
import { renderRules } from './screens/rulesScreen.js';
import { renderSettings } from './screens/settingsScreen.js';
import { renderProgress, shiftProgressMonth } from './screens/progressScreen.js';
import { renderAlphabet } from './screens/alphabetScreen.js';
import { renderDictionary } from './screens/dictionaryScreen.js';
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
  onPlayWord,
  onTraceReveal,
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

function downloadJson(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCorrupted() {
  downloadJson(app.progress.raw ?? '', `russe-sauvegarde-illisible-${Date.now()}.json`);
}

/** Bouton « Exporter ma progression » de l'écran Réglages (§6.7 : sync Mac ↔ téléphone). */
function exportProgress() {
  const raw = app.storage.exportRaw();
  if (raw) downloadJson(raw, `russe-progression-${today()}.json`);
}

async function boot() {
  primeVoices(); // charge la liste des voix tôt, avant le premier tapotement (§audio.js)
  app.progress = app.storage.load();
  if (app.progress.corrupted) {
    renderCorrupted();
    return;
  }
  applyTheme(app.progress.state.settings); // mode sombre/taille de texte, avant le premier rendu
  app.content = await loadContent();

  // Chaque mot relu (§5.5 : reviewed.ok) qui n'a pas encore de carte en obtient une, neuve,
  // due aujourd'hui — c'est ce qui le fait entrer dans le cycle normal de séance. Un mot non
  // relu n'obtient jamais de carte : il reste invisible.
  const addedWords = seedWordCards(app.progress.state.cards, app.content.words, today());
  const addedPairs = seedPairCards(app.progress.state.cards, app.content.pairs, app.content.wordsById, today());
  if (addedWords > 0 || addedPairs > 0) app.storage.save(app.progress.state);

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
    case 'reveal-trace':
      onTraceReveal(app);
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
    case 'play-word':
      onPlayWord(app, el.dataset.text);
      break;
    case 'go-home':
      renderHome(app);
      break;
    case 'show-rules':
      renderRules(app);
      break;
    case 'show-settings':
      renderSettings(app);
      break;
    case 'show-progress':
      renderProgress(app);
      break;
    case 'progress-prev-month':
      shiftProgressMonth(app, el.dataset.value, -1);
      break;
    case 'progress-next-month':
      shiftProgressMonth(app, el.dataset.value, 1);
      break;
    case 'show-alphabet':
      renderAlphabet(app);
      break;
    case 'show-dictionary':
      renderDictionary(app);
      break;
    case 'export-corrupted':
      exportCorrupted();
      break;
    case 'set-goal':
      app.progress.state.settings.goalMinutes = Number(el.dataset.value);
      app.storage.save(app.progress.state);
      renderSettings(app);
      break;
    case 'toggle-auto-audio':
      app.progress.state.settings.autoAudio = app.progress.state.settings.autoAudio === false;
      app.storage.save(app.progress.state);
      renderSettings(app);
      break;
    case 'toggle-slow-audio':
      app.progress.state.settings.slowAudio = app.progress.state.settings.slowAudio !== true;
      app.storage.save(app.progress.state);
      renderSettings(app);
      break;
    case 'toggle-show-stress':
      app.progress.state.settings.showStress = app.progress.state.settings.showStress === 'never' ? 'always' : 'never';
      app.storage.save(app.progress.state);
      renderSettings(app);
      break;
    case 'set-theme':
      app.progress.state.settings.theme = el.dataset.value;
      app.storage.save(app.progress.state);
      applyTheme(app.progress.state.settings);
      renderSettings(app);
      break;
    case 'set-text-size':
      app.progress.state.settings.textSize = el.dataset.value;
      app.storage.save(app.progress.state);
      applyTheme(app.progress.state.settings);
      renderSettings(app);
      break;
    case 'download-reminder':
      downloadDailyReminder();
      break;
    case 'export-progress':
      app.storage.save(app.progress.state); // exporte l'état le plus frais, pas un état en retard
      exportProgress();
      break;
    case 'reset-everything':
      if (
        window.confirm(
          'Tout effacer ? Toute ta progression (lettres, mots, réglages, séries) sera définitivement perdue sur cet appareil. Une copie de secours est gardée, mais aucun bouton ne la restaure encore.'
        )
      ) {
        const state = app.storage.reset();
        app.progress = { state, corrupted: false, raw: null };
        applyTheme(state.settings);
        renderHome(app);
      }
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

// Import d'une sauvegarde (écran Réglages) : un <input type="file"> n'émet pas de "click"
// utile pour data-act, mais un "change" quand un fichier est choisi — géré à part.
document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-act-change="import-progress"]');
  if (!el) return;
  const file = el.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = app.storage.importState(String(reader.result));
    if (result.ok) {
      app.progress = { state: result.state, corrupted: false, raw: null };
      applyTheme(app.progress.state.settings);
      renderSettings(app, { importMessage: '✔ Import réussi.' });
    } else {
      const message = result.error === 'json' ? '✖ Fichier illisible (pas un JSON valide).' : '✖ Format non reconnu.';
      renderSettings(app, { importMessage: message });
    }
  };
  reader.readAsText(file);
});

// Recherche en direct du Dictionnaire : un <input type="search"> n'émet pas de "click" ou
// "change" utile à chaque frappe, mais un "input" — géré à part, comme l'import de fichier.
document.addEventListener('input', (event) => {
  if (event.target.closest('[data-act-input="search-dictionary"]')) {
    renderDictionary(app, event.target.value);
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
