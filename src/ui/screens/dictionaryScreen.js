// src/ui/screens/dictionaryScreen.js
//
// Écran Dictionnaire (§4.1) : les mots appris, recherche en français ou en russe, accent
// affiché. « Appris » = au moins une carte de ce mot déjà présentée (reps > 0) — même
// définition que « mots sus » de l'écran Progrès, pour rester cohérent.

import { h, appRoot } from '../dom.js';
import { withStressMark } from '../../core/text.js';
import { parseCardId } from '../../core/cards.js';

function learnedWordIds(app) {
  const ids = new Set();
  for (const [id, card] of Object.entries(app.progress.state.cards)) {
    if (id.startsWith('word:') && card.reps > 0) ids.add(parseCardId(id).elementId);
  }
  return ids;
}

function entryHtml(word) {
  const stressed = withStressMark(word.ru, word.stress);
  return `
    <button type="button" class="dictionary-entry" data-act="play-word" data-text="${h(word.ru)}">
      <span class="dictionary-ru" lang="ru">${h(stressed)}</span>
      <span class="dictionary-fr">${h(word.fr)}</span>
    </button>
  `;
}

/** @param {string} [query] - filtre en cours (russe ou français, insensible à la casse) */
export function renderDictionary(app, query = '') {
  const learned = learnedWordIds(app);
  const words = app.content.words
    .filter((w) => learned.has(w.id))
    .filter((w) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return w.ru.toLowerCase().includes(q) || w.fr.toLowerCase().includes(q);
    })
    .sort((a, b) => a.fr.localeCompare(b.fr, 'fr'));

  appRoot().innerHTML = `
    <section class="screen screen-dictionary">
      <h1>Dictionnaire</h1>
      <input
        type="search"
        id="dictionary-search"
        class="word-input"
        data-act-input="search-dictionary"
        placeholder="Chercher en russe ou en français"
        value="${h(query)}"
        aria-label="Chercher un mot"
      />
      ${
        words.length > 0
          ? `<div class="dictionary-list">${words.map(entryHtml).join('')}</div>`
          : `<p class="settings-hint">
              ${
                learned.size === 0
                  ? "Aucun mot appris pour l'instant — fais quelques séances."
                  : 'Aucun mot ne correspond à cette recherche.'
              }
            </p>`
      }
      <button type="button" class="btn-link" data-act="go-home">Retour</button>
    </section>
  `;
  const input = document.getElementById('dictionary-search');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length); // curseur à la fin après re-rendu
  }
}
