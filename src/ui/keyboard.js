// src/ui/keyboard.js
//
// Clavier cyrillique à l'écran (§4.2, exercice 7 ; §6.2 arborescence cible). Sert à taper du
// russe sans dépendre d'une disposition clavier installée sur l'appareil — utile surtout au
// doigt, sur téléphone. Insère les caractères dans le champ ciblé (par son id) via le même
// gestionnaire data-act que le reste de l'app (app.js), pas un écouteur dédié.

const ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'],
];

/** @param {string} targetId - id de l'<input> dans lequel taper */
export function keyboardHtml(targetId) {
  return `
    <div class="keyboard" role="group" aria-label="Clavier cyrillique">
      ${ROWS.map(
        (row) => `
        <div class="keyboard-row">
          ${row
            .map(
              (ch) =>
                `<button type="button" class="key" data-act="kbd-key" data-target="${targetId}" data-char="${ch}" lang="ru">${ch}</button>`
            )
            .join('')}
        </div>`
      ).join('')}
      <div class="keyboard-row">
        <button type="button" class="key key-wide" data-act="kbd-backspace" data-target="${targetId}" aria-label="Effacer">⌫</button>
        <button type="button" class="key key-wide" data-act="kbd-space" data-target="${targetId}" aria-label="Espace">␣</button>
      </div>
    </div>
  `;
}

/** Insère un caractère à la position du curseur, en respectant une éventuelle sélection. */
export function insertChar(inputEl, char) {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  inputEl.value = inputEl.value.slice(0, start) + char + inputEl.value.slice(end);
  const pos = start + char.length;
  inputEl.setSelectionRange(pos, pos);
  inputEl.focus();
}

/** Efface le caractère précédent le curseur, ou la sélection si elle n'est pas vide. */
export function backspace(inputEl) {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  if (start === end && start > 0) {
    inputEl.value = inputEl.value.slice(0, start - 1) + inputEl.value.slice(end);
    inputEl.setSelectionRange(start - 1, start - 1);
  } else {
    inputEl.value = inputEl.value.slice(0, start) + inputEl.value.slice(end);
    inputEl.setSelectionRange(start, start);
  }
  inputEl.focus();
}
