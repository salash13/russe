#!/usr/bin/env node
// scripts/validate-content.mjs
//
// Valide le contenu de `content/` avant publication (§6.8) : lancé par la CI à chaque push,
// et utilisable en local (`npm run validate`). Ne modifie jamais les fichiers de contenu,
// se contente de les lire et de signaler les erreurs.
//
// Les fonctions de vérification sont exportées pour être testées directement (voir
// tests/validate-content.test.mjs), sans dépendre du système de fichiers.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_DIR = path.join(ROOT, 'content');

export const EXPECTED_LETTER_COUNT = 33;
export const EXPECTED_LOT_COUNT = 5;
const REQUIRED_LETTER_FIELDS = ['id', 'print', 'lower', 'cursive', 'sound', 'hint', 'lot'];

/** Lit et parse un fichier JSON de content/. Lève une erreur claire s'il est absent ou invalide. */
export async function readContentJson(relativePath) {
  const full = path.join(CONTENT_DIR, relativePath);
  let raw;
  try {
    raw = await readFile(full, 'utf8');
  } catch {
    throw new Error(`Fichier introuvable : content/${relativePath}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON invalide dans content/${relativePath} : ${e.message}`);
  }
}

/**
 * Vérifie content/letters.json : 33 entrées, identifiants et caractères uniques,
 * champs requis présents, lot dans les bornes.
 * @returns {string[]} la liste des erreurs (vide si tout est bon)
 */
export function checkLetters(letters) {
  if (!Array.isArray(letters)) return ['letters.json doit contenir un tableau.'];

  const errors = [];
  if (letters.length !== EXPECTED_LETTER_COUNT) {
    errors.push(`letters.json doit contenir ${EXPECTED_LETTER_COUNT} lettres, en contient ${letters.length}.`);
  }

  const ids = new Set();
  const prints = new Set();
  const lowers = new Set();

  for (const letter of letters) {
    const label = letter?.id ?? '(sans id)';

    for (const field of REQUIRED_LETTER_FIELDS) {
      if (letter?.[field] === undefined || letter[field] === null || letter[field] === '') {
        errors.push(`Lettre "${label}" : champ "${field}" manquant.`);
      }
    }

    if (letter?.id) {
      if (ids.has(letter.id)) errors.push(`Identifiant de lettre dupliqué : "${letter.id}".`);
      ids.add(letter.id);
    }
    if (letter?.print) {
      if (prints.has(letter.print)) errors.push(`Caractère imprimé dupliqué : "${letter.print}".`);
      prints.add(letter.print);
    }
    if (letter?.lower) {
      if (lowers.has(letter.lower)) errors.push(`Caractère minuscule dupliqué : "${letter.lower}".`);
      lowers.add(letter.lower);
    }
    if (
      letter?.lot !== undefined &&
      (!Number.isInteger(letter.lot) || letter.lot < 1 || letter.lot > EXPECTED_LOT_COUNT)
    ) {
      errors.push(
        `Lettre "${label}" : lot invalide (${letter.lot}), attendu un entier entre 1 et ${EXPECTED_LOT_COUNT}.`
      );
    }
    if (letter?.examples !== undefined && !Array.isArray(letter.examples)) {
      errors.push(`Lettre "${label}" : "examples" doit être un tableau.`);
    }
  }

  return errors;
}

/**
 * Vérifie content/lots.json : exactement 5 lots numérotés 1 à 5, et sa cohérence avec
 * letters.json — chaque lettre appartient à exactement un lot, celui déclaré sur la lettre.
 * @returns {string[]} la liste des erreurs (vide si tout est bon)
 */
export function checkLots(lots, letters = []) {
  if (!Array.isArray(lots)) return ['lots.json doit contenir un tableau.'];

  const errors = [];
  if (lots.length !== EXPECTED_LOT_COUNT) {
    errors.push(`lots.json doit contenir ${EXPECTED_LOT_COUNT} lots, en contient ${lots.length}.`);
  }

  const seenIds = new Set();
  const letterToLot = new Map();

  for (const lot of lots) {
    if (!Number.isInteger(lot?.id) || lot.id < 1 || lot.id > EXPECTED_LOT_COUNT) {
      errors.push(`Lot avec un id invalide : ${JSON.stringify(lot?.id)}.`);
    } else if (seenIds.has(lot.id)) {
      errors.push(`Id de lot dupliqué : ${lot.id}.`);
    }
    seenIds.add(lot?.id);

    if (!lot?.title) errors.push(`Lot ${lot?.id} : titre manquant.`);
    if (!Array.isArray(lot?.letters) || lot.letters.length === 0) {
      errors.push(`Lot ${lot?.id} : "letters" doit être un tableau non vide.`);
      continue;
    }
    for (const letterId of lot.letters) {
      if (letterToLot.has(letterId)) {
        errors.push(`Lettre "${letterId}" présente dans plusieurs lots (${letterToLot.get(letterId)} et ${lot.id}).`);
      } else {
        letterToLot.set(letterId, lot.id);
      }
    }
  }

  if (Array.isArray(letters) && letters.length > 0) {
    const byId = new Map(letters.filter((l) => l?.id).map((l) => [l.id, l]));
    for (const id of byId.keys()) {
      if (!letterToLot.has(id)) {
        errors.push(`Lettre "${id}" n'appartient à aucun lot dans lots.json.`);
      } else {
        const declaredLot = byId.get(id).lot;
        if (declaredLot !== letterToLot.get(id)) {
          errors.push(
            `Lettre "${id}" : lot déclaré dans letters.json (${declaredLot}) différent de lots.json (${letterToLot.get(id)}).`
          );
        }
      }
    }
    for (const id of letterToLot.keys()) {
      if (!byId.has(id)) {
        errors.push(`lots.json référence la lettre "${id}", absente de letters.json.`);
      }
    }
  }

  return errors;
}

/** Résumé de couverture par lot (nombre de lettres), pour l'affichage en console. */
export function lotCoverage(lots) {
  if (!Array.isArray(lots)) return [];
  return lots.map((lot) => ({
    id: lot?.id,
    title: lot?.title,
    count: Array.isArray(lot?.letters) ? lot.letters.length : 0,
  }));
}

async function main() {
  const errors = [];
  let letters = null;
  let lots = null;

  try {
    letters = await readContentJson('letters.json');
  } catch (e) {
    errors.push(e.message);
  }
  try {
    lots = await readContentJson('lots.json');
  } catch (e) {
    errors.push(e.message);
  }

  if (letters !== null) errors.push(...checkLetters(letters));
  if (lots !== null) errors.push(...checkLots(lots, letters ?? []));

  if (errors.length === 0) {
    console.log(`✔ Contenu valide : ${letters.length} lettres réparties en ${lots.length} lots.`);
    for (const lot of lotCoverage(lots)) {
      console.log(`  - Lot ${lot.id} (${lot.title}) : ${lot.count} lettres`);
    }
    process.exit(0);
  } else {
    console.error(`✖ ${errors.length} erreur(s) de contenu :`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
}

// N'exécute la validation que si le script est lancé directement (pas quand il est
// importé, par exemple depuis un test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
