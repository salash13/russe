# CLAUDE.md

Ce fichier guide toute session de travail sur ce dépôt. Le document de référence complet est
[`docs/PROJET-RUSSE.md`](docs/PROJET-RUSSE.md) — **à lire en entier avant toute décision de contenu
ou d'architecture**. Ce fichier-ci n'en est qu'un résumé opérationnel.

## Le projet en une phrase

Une application web (HTML/CSS/JS vanilla, PWA, hors ligne) pour que Ben apprenne le russe
(français → russe), avec répétition espacée FSRS, écrite pour corriger les défauts précis
relevés par l'audit du projet sœur `thai-fr` (voir §11 du document de référence).

## Règles non négociables

- **Zéro build, zéro dépendance npm.** Modules ES natifs (`<script type="module">`) uniquement.
- **Le cœur ne touche jamais le DOM** (`src/core/*`) : FSRS, séance, cartes, storage, migrations,
  dates, comparaison de texte. Testable dans Node sans navigateur.
- **Tout le HTML généré passe par `h()`/`esc()`** — jamais de concaténation brute (risque d'injection
  et de bug d'affichage).
- **Le contenu vit dans `content/*.json`, jamais dans le code.** Identifiants stables (`zh`, `dom`),
  jamais le caractère ou le mot lui-même comme clé.
- **`reviewed.ok` doit être vrai pour qu'un mot/phrase soit visible**, appliqué à la fois par
  `scripts/validate-content.mjs` et par l'app.
- **`units.json` fixe l'ordre d'introduction et le code le respecte** — pas de tirage aléatoire
  parmi tout le contenu déjà vu.
- **Toute carte planifiée par le SRS doit pouvoir être présentée.** C'est testé automatiquement
  (`node --test`) : c'était le bug critique de `thai-fr`.
- **Dates en heure locale** (`src/core/dates.js`), jamais UTC. Le changement de jour doit être
  détecté même pendant une session ouverte.
- **Import/migration ne doivent jamais écraser un état illisible.** Copie de secours avant tout
  import ou reset.
- **Français** : langue de l'interface, des commentaires de code, des noms de variables métier.
- Rien n'est en dur qui devrait venir du contenu ou d'une constante unique (ex. nombre de lettres,
  voix `ru-RU`) — c'est ce qui permettrait d'extraire un moteur multi-langues plus tard.

## Arborescence cible

Voir §6.2 du document de référence pour le détail. En résumé :

```
index.html, manifest.webmanifest, sw.js
src/core/    (srs.js, session.js, cards.js, storage.js, migrate.js, dates.js, text.js — sans DOM)
src/ui/      (screens/*.js, dom.js, audio.js, keyboard.js, app.css)
content/     (letters.json, rules.json, lots.json, units.json, words/, sentences/, grammar/, audio/)
scripts/     (serve.mjs, validate-content.mjs)
tests/*.test.mjs
.github/workflows/ci.yml
docs/PROJET-RUSSE.md
```

## Workflow

- **Le cœur (`src/core/`) et ses tests s'écrivent avant l'interface.** Ordre des 5 premières étapes :
  voir §9 du document de référence.
- `node --test` doit passer avant tout commit touchant `src/core/` ou `scripts/validate-content.mjs`.
- Toute nouvelle notion de contenu (lettre, mot, règle) doit avoir `reviewed: { by: "", date: "", ok: false }`
  tant qu'elle n'a pas été relue par un locuteur natif.
- Pas de jargon de développeur dans l'interface utilisateur.

## État actuel

Squelette du projet en cours de mise en place (v0.1, voir roadmap §9). Consulter le
« Journal des décisions » en fin de `docs/PROJET-RUSSE.md` pour l'historique.
