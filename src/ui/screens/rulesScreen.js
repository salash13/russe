// src/ui/screens/rulesScreen.js
//
// Écran des règles de lecture N0 (§3.2) : content/rules.json n'avait encore aucun
// consommateur dans l'interface. Simple liste dans l'ordre pédagogique déclaré par le
// contenu (§2.6 : l'ordre d'introduction est respecté par le code, jamais retrié). Comme
// pour les mots et les paires (§5.5), une règle non relue (`reviewed.ok`) reste invisible —
// appliqué ici en plus de scripts/validate-content.mjs, jamais l'un sans l'autre.

import { h, appRoot } from '../dom.js';

export function renderRules(app) {
  const rules = [...app.content.rules]
    .filter((rule) => rule.reviewed?.ok === true)
    .sort((a, b) => a.order - b.order);

  appRoot().innerHTML = `
    <section class="screen screen-rules">
      <h1>Règles de lecture</h1>
      ${
        rules.length > 0
          ? `<div class="rules-list">
              ${rules
                .map(
                  (rule) => `
                <article class="rule-card">
                  <h2 class="rule-title">${h(rule.order)}. ${h(rule.title)}</h2>
                  <p class="rule-explanation">${h(rule.explanation)}</p>
                </article>`
                )
                .join('')}
            </div>`
          : `<p class="settings-hint">Aucune règle relue pour l'instant.</p>`
      }
      <button type="button" class="btn-primary" data-act="go-home">Retour</button>
    </section>
  `;
}
