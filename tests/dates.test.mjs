import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey,
  addDays,
  diffDays,
  monthKey,
  isoWeekday,
  practicedDaysInMonth,
  computeStreak,
} from '../src/core/dates.js';

test('dayKey formate en heure locale, pas en UTC', () => {
  // 23h locales un 31 janvier : en UTC ça pourrait déjà être le 1er février selon le fuseau,
  // mais dayKey doit rester fidèle à l'heure locale de la machine qui l'appelle.
  const d = new Date(2026, 0, 31, 23, 30);
  assert.equal(dayKey(d), '2026-01-31');
});

test('addDays traverse les mois et les années', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // année bissextile
});

test('diffDays donne a - b en jours', () => {
  assert.equal(diffDays('2026-01-10', '2026-01-01'), 9);
  assert.equal(diffDays('2026-01-01', '2026-01-10'), -9);
  assert.equal(diffDays('2026-01-01', '2026-01-01'), 0);
});

test('monthKey extrait AAAA-MM', () => {
  assert.equal(monthKey('2026-09-24'), '2026-09');
});

test('isoWeekday : 1 = lundi ... 7 = dimanche', () => {
  assert.equal(isoWeekday('2026-09-21'), 1); // lundi
  assert.equal(isoWeekday('2026-09-27'), 7); // dimanche
});

test('practicedDaysInMonth compte les jours distincts du mois', () => {
  const days = ['2026-09-01', '2026-09-01', '2026-09-15', '2026-08-31'];
  assert.equal(practicedDaysInMonth(days, '2026-09-20'), 2);
});

test('computeStreak : série continue simple', () => {
  const days = ['2026-09-01', '2026-09-02', '2026-09-03'];
  assert.equal(computeStreak(days, '2026-09-03'), 3);
});

test('computeStreak : le jour courant pas encore pratiqué ne casse pas la série', () => {
  const days = ['2026-09-01', '2026-09-02'];
  assert.equal(computeStreak(days, '2026-09-03'), 2);
});

test('computeStreak : un jour de repos par semaine glissante ne casse pas la série', () => {
  // pratiqué lun-mar, repos mer, pratiqué jeu-ven
  const days = ['2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25'];
  assert.equal(computeStreak(days, '2026-09-25'), 4);
});

test('computeStreak : deux jours manqués dans la même semaine arrêtent la série', () => {
  const days = ['2026-09-21', '2026-09-24', '2026-09-25']; // manqué le 22 et le 23
  assert.equal(computeStreak(days, '2026-09-25'), 2); // seuls le 24 et le 25 comptent
});

test('computeStreak : aucun jour pratiqué donne une série de 0', () => {
  assert.equal(computeStreak([], '2026-09-25'), 0);
});
