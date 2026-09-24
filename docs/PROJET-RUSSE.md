# PROJET — Apprendre le russe (français → russe)

> Document de fondation. À lire **en entier** avant toute décision de contenu ou d'architecture.
> Inspiré du projet `thai-fr` (`~/Sites/thai-fr`, en ligne sur https://salash13.github.io/Thai/),
> dont on reprend ce qui marche et dont on corrige les défauts relevés par l'audit du 24/09/2026 (§11).

### Qui apprend, et pour quoi

- **Ben**, francophone, autodidacte, pas développeur. Il a déjà appris tout l'alphabet cyrillique,
  mais il y a longtemps : **il faut le réactiver**, pas l'enseigner de zéro.
- Objectifs, tous visés : **parler**, **lire**, **comprendre à l'écoute**, **écrire** (taper en cyrillique).
- Appareils : **Mac et téléphone**, en alternance. La progression doit pouvoir passer de l'un à l'autre.

### Décisions déjà prises

| Sujet | Décision |
|---|---|
| Organisation | **Projet séparé** dans `~/Sites/russe`, dépôt Git à part. Pas de moteur multi-langues pour l'instant, mais le code est écrit pour qu'on puisse l'extraire plus tard (§6.2). |
| Technique | HTML + CSS + JavaScript classiques, **modules ES natifs**, zéro build, zéro dépendance npm. Même philosophie que `thai-fr` : ouvrable et modifiable dans dix ans. |
| Hébergement | GitHub Pages, comme le thaï. |
| Compte | Aucun. Progression locale + export/import. Synchronisation entre appareils : v1.x (§6.7). |
| Contenu | Dans `content/*.json`, **jamais dans le code**. |
| Hors ligne | Oui, pour de vrai : application installable (PWA) avec service worker. |
| Répétition espacée | **FSRS** (§4.3), avec 4 boutons de note. |

---

## 1. Le pari du projet

Le russe est plus facile à **démarrer** que le thaï (alphabet de 33 lettres, pas de tons, espaces entre les
mots), mais plus dur à **tenir** : 6 cas, 3 genres, l'aspect des verbes, les verbes de mouvement,
et surtout un **accent tonique mobile qui n'est pas écrit** et qui change la prononciation des voyelles.

Donc :
- le niveau 0 (lecture) est **court** (1 à 3 semaines, et moins pour Ben qui a déjà vu l'alphabet) ;
- l'effort principal porte sur **le vocabulaire avec son accent**, **les terminaisons de cas**
  et **l'écoute** ;
- l'app doit faire **produire** (taper, dire, écrire) et pas seulement reconnaître dans un QCM.
  C'est le principal manque du projet thaï.

## 2. Principes pédagogiques

1. **Lire d'abord, mais vite.** On ne s'attarde pas sur l'alphabet : on passe aux mots réels dès que possible.
2. **Découvrir avant d'être interrogé.** Chaque nouvel élément passe par une **fiche de découverte**
   (voir, écouter, exemple, astuce) avant d'entrer dans la révision. *Le thaï quizzait sur des lettres jamais vues.*
3. **Produire avant de voir la réponse.** Autant que possible : taper le mot, choisir la terminaison, dire à voix haute.
   Le QCM sert à débuter un élément, pas à le consolider.
4. **Le feedback explique la règle.** Chaque correction dit *pourquoi* (repris du thaï, c'est son point fort).
5. **Pièges ciblés.** Chaque mauvaise réponse proposée correspond à une erreur précise
   (faux-ami visuel, mauvais accent, mauvais cas, mauvais aspect). Repris du thaï.
6. **Une règle à la fois, dans l'ordre.** L'ordre d'introduction est défini dans `content/units.json`
   et **respecté par le code**. *Le thaï tirait au hasard parmi toutes les voyelles dès le début, contrairement à son propre programme.*
7. **L'accent tonique fait partie du mot.** Il est toujours stocké, affiché au début (молоко́), puis
   retiré progressivement comme une béquille.
8. **Réapprendre dans la séance.** Une carte ratée revient avant la fin de la séance.
9. **Du vrai russe relu par un natif.** Rien n'est publié sans relecture (`reviewed.ok`, §5.5).
10. **Pas de culpabilité.** Pas de vies, pas de classement, pas de message de reproche.

## 3. Le programme

### 3.1 Vue d'ensemble

| Niveau | Durée indicative | Contenu | Objectif mesurable |
|---|---|---|---|
| **N0 Réactivation / Lecture** | 1-3 semaines | 33 lettres, dur/mou, accent et réduction, cursive | Lire à voix haute 50 mots inconnus accentués avec 90 % de justesse ; reconnaître la cursive |
| **A1** | ~3-4 mois | ~700 mots ; nominatif, accusatif, prépositionnel ; présent, passé ; genre | 90 % de réussite sur les terminaisons de ces 3 cas ; se présenter 2 minutes |
| **A2** | ~6 mois | ~1 500 mots ; 6 cas singulier et pluriel ; aspect ; futur ; verbes de mouvement | Choisir le bon aspect dans 80 % des phrases à trous |
| **B1** | ensuite | ~2 800 mots ; participes ; textes authentiques ; ты/вы | Lire un article simple, suivre une vidéo lente |

### 3.2 N0 — Réactivation et lecture

**Test de départ (spécifique à Ben).** Au premier lancement, un test de 5 minutes sur les 33 lettres
(son → lettre et lettre → son). Les lettres réussies sont marquées « déjà connues » et planifiées
directement en révision espacée, sans fiche de découverte. Les autres suivent le parcours normal.

**Les lots** :
1. **Lettres familières** : А, К, М, О, Т (même forme, même son qu'en français).
2. **Faux-amis visuels** : В (v), Е (ié), Н (n), Р (r), С (s), У (ou), Х (kh). Lot prioritaire,
   avec des distracteurs dédiés (Р ≠ p, Н ≠ h, В ≠ b).
3. **Lettres nouvelles mais faciles** : Б, Г, Д, З, И, Л, П, Ф, Э.
4. **Lettres nouvelles difficiles** : Ж, Ц, Ч, Ш, Щ, Ы, Й, Ю, Я, Ё.
5. **Les signes** : Ь (signe mou), Ъ (signe dur).

**Les règles de lecture, dans cet ordre** :
1. Voyelles « dures » (а э ы о у) et « molles » (я е и ё ю) : la voyelle molle adoucit la consonne d'avant.
2. Le signe mou ь.
3. **L'accent tonique** : où il tombe, comment il est marqué dans l'app.
4. **La réduction** : о non accentué se dit presque « a », е/я non accentués se disent presque « i ».
5. **Dévoisement final** : хлеб se dit [khliep], год se dit [got].
6. **Assimilation** : вокзал se dit [vagzal].
7. **La cursive** : т s'écrit comme un m, д comme un g, и comme un u, etc. Le tracé au doigt, repris du thaï,
   devient vraiment utile ici.

**Les mots de lecture** : dès le lot 1, on lit des **mots transparents réels** (такси, метро, ресторан, кофе, мама)
plutôt que des pseudo-syllabes. *Le thaï utilisait des syllabes aléatoires sans sens.*

### 3.3 A1 — Parler de soi et se débrouiller

Unités thématiques, chacune avec : ~30 mots, 1 point de grammaire, 10 à 20 phrases, 1 petit dialogue audio.

Ordre proposé : se présenter · la famille · les nombres et les prix · la nourriture et le café ·
se déplacer (métro, taxi) · le temps et les jours · la maison · les loisirs · la santé · au magasin.

Grammaire A1, introduite une notion par unité :
genre des noms → présent (1re et 2e conjugaison) → accusatif → prépositionnel (в/на + lieu) →
passé (-л, -ла, -ло, -ли) → хотеть/мочь → génitif de base (у меня есть / нет) → nombres + génitif.

### 3.4 A2 et B1 (esquisse)

Datif et instrumental, pluriel des 6 cas, **aspect perfectif/imperfectif** (enseigné par paires :
делать/сделать), futur, **verbes de mouvement** (идти/ходить, ехать/ездить), impératif, comparatif, participes.
À détailler quand A1 sera fini et relu.

### 3.5 Volume de contenu

| Niveau | Mots | Phrases | Dialogues audio |
|---|---|---|---|
| N0 | ~150 mots de lecture | — | — |
| A1 | ~700 | ~500 | 10 |
| A2 | +800 | +800 | 15 |

## 4. Cahier des charges produit

### 4.1 Écrans

1. **Accueil** : un seul gros bouton **« Ma séance »** (5, 10 ou 15 min selon le réglage), l'anneau de l'objectif du jour,
   les jours pratiqués ce mois-ci, la prochaine unité.
2. **Leçon** : fiche de découverte d'une unité (explication courte, puis mise en pratique immédiate).
3. **Séance** : les exercices, avec une vraie fin (récapitulatif : réussites, cartes ratées, « à demain »).
4. **Alphabet** : les 33 lettres, imprimées et en cursive, avec audio et tracé.
5. **Dictionnaire** : les mots appris, recherche en français ou en russe, accent affiché.
6. **Progrès** : calendrier des jours pratiqués, mots sus, temps passé, les 5 points faibles, erreurs par type.
7. **Réglages** : objectif, audio automatique oui/non, vitesse de l'audio, accent affiché oui/non/progressif,
   mode sombre, taille du texte, export/import, **zone « danger »** séparée pour « tout effacer ».

Pas de jargon de développeur dans l'interface. *Le thaï affichait des références à la doc du projet.*

### 4.2 Types d'exercices

| # | Exercice | Compétence | Niveau |
|---|---|---|---|
| 1 | Lettre → son (QCM) | lire | N0 |
| 2 | Son → lettre (audio, QCM) | écouter | N0 |
| 3 | Lire un mot à voix haute puis vérifier avec l'audio (auto-évaluation) | lire, parler | N0+ |
| 4 | **Où est l'accent ?** (toucher la syllabe accentuée) | lire, parler | N0+ |
| 5 | Cursive → imprimé | lire | N0 |
| 6 | Tracer une lettre en cursive | écrire | N0 |
| 7 | **Taper le mot** entendu ou traduit (clavier cyrillique à l'écran) | écrire | N0+ |
| 8 | Paires minimales audio (брат/брать, за́мок/замо́к) | écouter | N0+ |
| 9 | Français → russe (taper) / russe → français (QCM puis taper) | vocabulaire | A1+ |
| 10 | **Choisir la terminaison** (phrase à trou, cas) | grammaire | A1+ |
| 11 | Remettre les mots d'une phrase dans l'ordre | grammaire | A1+ |
| 12 | Dictée d'une phrase | écouter, écrire | A1+ |
| 13 | Dialogue : écouter puis répondre (QCM, puis à voix haute) | oral | A1+ |
| 14 | Choisir l'aspect (делать/сделать) | grammaire | A2 |

**Tolérance à la saisie** : е accepté à la place de ё, accent tonique ignoré, majuscules ignorées.
Une faute d'une seule lettre est signalée « presque » et montre la différence.

### 4.3 Répétition espacée — FSRS

- **Algorithme FSRS** (version 4.5 ou 5), écrit en JS pur dans `src/core/srs.js` (~150 lignes),
  avec les paramètres par défaut publiés. Rétention visée : **0,9**, réglable.
- **4 boutons après chaque réponse** : À revoir · Difficile · Bien · Facile.
  Pour un QCM, l'app propose la note selon la justesse et le temps, l'utilisateur peut la corriger.
- **Une carte = un élément + une facette**, avec un **identifiant typé** :
  `letter:zh:son`, `word:dom:fr-ru`, `ending:acc-fem-sg`, `aspect:delat`.
- **Registre des types d'exercices** : chaque type de carte déclare comment il se présente.
  **Toute carte planifiée doit pouvoir être présentée**. Un test automatique le vérifie.
  *C'est le bug critique du thaï : les syllabes lues étaient planifiées puis ignorées, le compteur gonflait sans fin
  et, au-delà de 40, plus aucune lettre nouvelle n'apparaissait.*
- **Composition d'une séance** : ~70 % de révisions dues, ~30 % de nouveau ; au-delà d'un seuil de retard (réglable),
  plus de nouveau. Les cartes ratées reviennent dans la même séance.
- La grammaire (terminaisons, paires d'aspect) est planifiée comme des cartes, pas seulement le vocabulaire.

### 4.4 Motivation — et ce qu'on refuse

- Objectif du jour **réglable** (5 / 10 / 15 min), petite célébration quand il est atteint.
- **Série calculée à l'heure locale**, 1 jour de repos gratuit par semaine, et mise en avant de
  « X jours pratiqués ce mois-ci » plutôt que de la série seule.
- Une seule réponse ne suffit pas à valider la journée : il faut finir une séance.
- On refuse : les vies, les classements, les notifications culpabilisantes, les badges à collectionner.
- Rappel : un bouton « Ajouter un rappel quotidien à mon calendrier » (fichier `.ics`), plutôt que des notifications.

### 4.5 Contraintes produit

- Fonctionne **hors ligne**, installable sur iPhone et Mac (PWA), avec un encart qui explique
  « Ajouter à l'écran d'accueil » sur iPhone.
- Utilisable **au doigt** (cibles ≥ 44 px) et **au clavier** (1-4, Entrée, Espace pour l'audio).
- **Mode sombre** qui suit le système, avec un bouton pour forcer.
- Taille du texte réglable (A− / A+).
- Accessibilité : `lang="ru"` sur tout texte russe, `aria-live` sur le résultat, `aria-current` sur l'onglet actif,
  aucune information portée uniquement par la couleur.
- Audio : lecture automatique désactivable, bouton **vitesse lente** (🐢).

## 5. Format des données

### 5.1 Arborescence

```
content/
  letters.json      les 33 lettres (imprimé, cursive, son, lot, faux-ami, exemples)
  rules.json        règles de lecture N0 (réduction, dévoisement, assimilation…)
  lots.json         lots de lettres de N0
  units.json        ordre des unités et de ce qu'elles introduisent
  words/a1-*.json   vocabulaire par unité
  sentences/*.json  phrases par unité
  grammar/*.json    tables de terminaisons, paires d'aspect
  audio/            enregistrements optionnels (.mp3), prioritaires sur la synthèse
```

Les clés sont des **identifiants stables** (`zh`, `dom`), jamais le caractère ou le mot lui-même.

### 5.2 Une lettre

```json
{
  "id": "v", "print": "В", "lower": "в", "cursive": "В в",
  "sound": "v", "hint": "comme le v de « vache »",
  "falseFriend": "ressemble à un B latin",
  "lot": 2, "examples": ["word:voda", "word:vino"]
}
```

### 5.3 Un mot

```json
{
  "id": "moloko", "ru": "молоко", "stress": 3,
  "fr": "lait", "pos": "nom", "gender": "n",
  "pron": "ma-la-KO",
  "forms": { "gen.sg": "молока" },
  "unit": "a1-04", "freq": 612,
  "audio": null,
  "reviewed": { "by": "", "date": "", "ok": false }
}
```

- `stress` : numéro de la syllabe accentuée (en partant de 1). **Obligatoire.**
- `pron` : prononciation « lisible par un francophone », réduction comprise, syllabe accentuée en MAJUSCULES.
  Béquille retirée progressivement.
- Le ё est toujours écrit ё dans le contenu (l'app peut l'afficher en е plus tard, comme dans les vrais textes).

### 5.4 Une phrase

```json
{
  "id": "a1-01-s03", "ru": "Меня зовут Бен.", "stress": [[1,2],[2,2],[3,1]],
  "fr": "Je m'appelle Ben.", "words": ["menja", "zvat", null],
  "grammar": ["acc-pronoun"], "unit": "a1-01",
  "reviewed": { "by": "", "date": "", "ok": false }
}
```

### 5.5 Règles d'écriture du contenu

- Tout mot ou phrase porte `reviewed: { by, date, ok }` et **reste invisible tant que `ok` est faux**.
  Le script de validation et l'app appliquent cette règle. *Le thaï la décrivait mais ne l'appliquait pas.*
- Pas de paroles de chansons complètes (droits) : extraits courts seulement.
- Chaque unité est complète et relue avant de passer à la suivante.

## 6. Technique

### 6.1 Principes

- Modules ES natifs (`<script type="module">`), zéro build, zéro dépendance.
- **Le cœur ne touche jamais le DOM** (répétition espacée, séance, migrations, validation), pour pouvoir le tester dans Node.
- Tout le HTML généré passe par une fonction d'échappement (`esc()` / `h()`), jamais de concaténation brute.
- Toute écriture de progression passe par `Storage`.
- Le français est la langue de l'interface, des commentaires et des noms métier.

### 6.2 Arborescence du dépôt

```
index.html
manifest.webmanifest
sw.js                  service worker (cache versionné)
src/
  core/                sans DOM, testé
    srs.js             FSRS
    session.js         composition d'une séance
    cards.js           registre des types de cartes
    storage.js         lecture/écriture + sauvegarde de secours
    migrate.js         migrations de la progression
    dates.js           jour local, série
    text.js            comparaison de saisie (ё/е, accent, majuscules)
  ui/
    screens/*.js       un fichier par écran
    dom.js             h(), esc(), rendu
    audio.js           synthèse ru-RU + enregistrements
    keyboard.js        clavier cyrillique à l'écran
  app.css
content/               cf. §5
assets/fonts/ assets/icons/
scripts/
  serve.mjs            serveur local (repris du thaï)
  validate-content.mjs
tests/*.test.mjs       node --test
.github/workflows/ci.yml   tests + validation à chaque push
.nojekyll
CLAUDE.md
docs/PROJET-RUSSE.md   ce document
```

Tout ce qui est spécifique au russe (nombre de lettres, voix `ru-RU`, phrase de test audio) vient du contenu ou
d'une constante unique, jamais écrit en dur à plusieurs endroits. *Le thaï avait « 44 » et « th » un peu partout.*
C'est ce qui permettra plus tard d'extraire un moteur commun si on le veut.

### 6.3 Progression, sauvegarde, migrations

- État enregistré : `{ schema, appVersion, contentVersion, cards, settings, days, stats }`.
- `migrate(state)` s'applique **à chaque chargement et à chaque import**.
- Import : l'état est validé ; en cas d'erreur, rien n'est écrasé et un message clair s'affiche.
- Avant tout import ou réinitialisation, **copie de secours** automatique de l'état précédent.
- Si l'état stocké est illisible, on ne l'écrase pas : on propose de l'exporter tel quel.
- Rappel doux : « dernière sauvegarde il y a 14 jours ».

### 6.4 Dates

Tout en **heure locale** (`dates.js`). Le changement de jour est détecté **aussi pendant une session ouverte**.
*Le thaï utilisait l'heure UTC : le jour changeait à 2 h du matin en France.*

### 6.5 Audio

- Web Speech API en `ru-RU` (voix Milena sur Mac et iPhone, de bonne qualité).
- La synthèse place mal certains accents : pour les **paires minimales** et les mots piégeux,
  enregistrements (`content/audio/`, prioritaires). Sources possibles : enregistrements d'un natif, Forvo (licence à vérifier).
- Pas de minuterie permanente : la synthèse n'est « réveillée » que pendant une lecture.

### 6.6 Hors ligne et déploiement

- `sw.js` précharge HTML, JS, CSS, JSON et polices ; le nom du cache contient la version, mise à jour à chaque release,
  pour ne jamais mélanger ancien code et nouveau contenu.
- GitHub Pages depuis `main`, chemins relatifs, `.nojekyll`.

### 6.7 Mac ↔ téléphone

- **v1.0** : export/import d'un fichier JSON (via AirDrop ou iCloud Drive), en un bouton.
- **v1.x (à décider)** : synchronisation automatique. Pistes, par ordre de simplicité : fichier dans iCloud Drive,
  gist GitHub privé, petite base en ligne (Supabase). Le point unique `Storage` permet de le brancher sans toucher au reste.

### 6.8 Qualité

- `node --test` : FSRS, composition de séance, **« toute carte planifiée est présentable »**, migrations,
  comparaison de saisie, validateur. Générateur aléatoire à graine pour des tests reproductibles.
- `scripts/validate-content.mjs` : 33 lettres uniques, `stress` présent et dans les bornes, `reviewed` bien formé,
  références entre fichiers valides, statistiques de couverture par unité.
- CI GitHub Actions : tests + validation à chaque push.

## 7. Relecture par un natif

Même principe que le thaï : une checklist de questions fermées par mot et par phrase
(le mot est-il naturel ? l'accent est-il bon ? la traduction est-elle juste ? le registre ты/вы est-il cohérent ?).
**À trouver** : une personne russophone pour relire (cf. §10).

## 8. Risques et pièges

- **L'accent tonique** : une erreur dans `stress` s'apprend et se grave. Relecture obligatoire.
- **Enrichir l'app avant d'avoir du contenu** : même règle que le thaï, le contenu du niveau en cours d'abord.
- **Trop de grammaire trop tôt** : une notion par unité, toujours dans des phrases.
- **Perdre sa progression** : c'est la seule copie, d'où migrations, sauvegarde de secours et rappel d'export.
- **La synthèse vocale** : pratique mais imparfaite ; ne jamais s'en servir comme référence pour l'accent.

## 9. Roadmap

| Version | Contenu |
|---|---|
| **v0.1** | Squelette : modules, `Storage`, `dates.js`, FSRS testé, registre de cartes, PWA, CI. 33 lettres, test de départ, fiches de découverte, exercices 1, 2, 5. |
| **v0.2** | Règles de lecture N0, mots transparents, exercices 3, 4, 7, 8, clavier cyrillique, cursive (6). N0 complet. |
| **v0.3** | Écran Progrès, réglages complets, mode sombre, audio lent, rappel calendrier. |
| **v0.4** | A1 unités 1-3 (mots, phrases, exercices 9-11), dictionnaire. |
| **v0.5+** | Reste de A1, dialogues audio (12, 13). |
| **v1.0** | A1 complet et relu par un natif. |
| **v1.x** | Synchronisation Mac ↔ téléphone, A2. |

### Les 5 premières étapes concrètes

1. `git init` dans `~/Sites/russe`, créer le dépôt GitHub, écrire `CLAUDE.md` à partir de ce document.
2. Écrire `src/core/` (dates, storage, migrate, srs, cards, session) **avec leurs tests** avant toute interface.
3. Écrire `content/letters.json` (33 lettres) et `lots.json`, puis le validateur.
4. Interface minimale : Accueil → test de départ → séance → récapitulatif. Manifest + service worker.
5. Déployer sur GitHub Pages et l'installer sur l'iPhone.

## 10. Questions ouvertes (à trancher par Ben)

- **Nom du projet** et de l'URL (ex. `salash13.github.io/Russe/`).
- **Relecteur natif** : quelqu'un dans ton entourage ?
- **Registre** : on commence au **ты** (familier) ou au **вы** (poli) ?
- **Contexte** : pourquoi le russe (voyage, famille, travail, séries) ? Ça oriente le vocabulaire des unités A1.
- **Synchronisation** : l'export/import manuel suffit-il au début ?
- **Temps par jour** réaliste : 5, 10, 15 minutes ?

## 11. Annexe — Audit de thai-fr (24/09/2026)

Trois audits indépendants (pédagogie, technique, expérience d'usage), faits en lecture seule sur `thai-fr` v0.3.

**À reprendre** : le contenu dans le JSON et son validateur ; le feedback qui explique la règle ;
les distracteurs ciblés ; le frein anti-noyade ; le déblocage par lot à 80 % ; le point unique `Storage` ;
le gestionnaire unique `data-act` ; zéro dépendance ; l'export JSON ; la gamification sobre.

**Défauts à ne pas reproduire** (et à corriger dans le thaï) :

| Gravité | Défaut dans thai-fr | Réponse dans le projet russe |
|---|---|---|
| Critique | Les syllabes `S:` sont planifiées mais jamais présentées (`nextQ`, app.js ~l.471) : le compteur gonfle, les séances finissent sur « 0/0 », au-delà de 40 plus de lettres nouvelles | Registre de types de cartes + test « toute carte planifiée est présentable » (§4.3) |
| Critique | Un import mal formé casse l'app de façon permanente ; le champ `v` n'est jamais lu | Validation, `migrate()`, sauvegarde de secours (§6.3) |
| Élevée | Jour calculé en UTC (`today()`, app.js l.54) ; pas de changement de jour en session | `dates.js` en heure locale (§6.4) |
| Élevée | État illisible écrasé sans avertissement au démarrage | On n'écrase jamais, on propose l'export (§6.3) |
| Élevée | « Hors ligne » annoncé mais ni manifest ni service worker ; messages contradictoires sur le double-clic | PWA réelle (§6.6) |
| Élevée | Quiz sur des éléments jamais présentés | Fiche de découverte (§2.2) |
| Élevée | Voyelles et marques tirées au hasard, contrairement à l'ordre prévu | `units.json` respecté par le code (§2.6) |
| Moyenne | Presque que du QCM de reconnaissance ; 3 types d'exercices sur 12 prévus | 14 types dont plusieurs de production (§4.2) |
| Moyenne | Pas de réapprentissage dans la séance | Cartes ratées reprises avant la fin (§4.3) |
| Moyenne | SM-2 simplifié, note binaire, seuil fixe de 6 s | FSRS, 4 boutons (§4.3) |
| Moyenne | `reviewed` ni validé ni filtré | Appliqué par le validateur et l'app (§5.5) |
| Moyenne | Objectif fixe à 20, série validée par une seule réponse, onglet Lire sans fin | Objectif réglable, séance avec vraie fin (§4.4) |
| Moyenne | « 44 », « th » écrits en dur ; app.js de 685 lignes en une seule fonction ; aucun test | Modules, constantes uniques, `node --test` + CI (§6) |
| Faible | Pas de `lang`, pas d'`aria-live`, état par la couleur seule, pas de mode sombre, `innerHTML` sans échappement | §4.5 et §6.1 |

## Journal des décisions

- **24/09/2026** — Projet séparé du thaï. Vanilla JS en modules, zéro build. FSRS. PWA dès la v0.1.
  N0 raccourci par un test de départ (Ben connaît déjà l'alphabet). Objectifs : les 4 compétences. Mac + téléphone.
