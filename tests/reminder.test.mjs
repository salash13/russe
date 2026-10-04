import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyReminderIcs } from '../src/ui/reminder.js';

function parseLines(ics) {
  const fields = {};
  for (const line of ics.split('\r\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    fields[line.slice(0, i)] = line.slice(i + 1);
  }
  return fields;
}

test('buildDailyReminderIcs : structure VCALENDAR/VEVENT minimale', () => {
  const ics = buildDailyReminderIcs();
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('BEGIN:VEVENT\r\n'));
  assert.ok(ics.includes('END:VEVENT\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY\r\n'));
});

test('buildDailyReminderIcs : heure flottante par défaut (19h00, durée 15 min)', () => {
  const { DTSTART, DTEND } = parseLines(buildDailyReminderIcs());
  assert.equal(DTSTART.slice(-6), '190000');
  assert.equal(DTEND.slice(-6), '191500');
  assert.equal(DTSTART.slice(0, 8), DTEND.slice(0, 8)); // même jour civil
});

test('buildDailyReminderIcs : heure personnalisée', () => {
  const { DTSTART, DTEND } = parseLines(buildDailyReminderIcs({ hour: 7, minute: 30 }));
  assert.equal(DTSTART.slice(-6), '073000');
  assert.equal(DTEND.slice(-6), '074500');
});

test("buildDailyReminderIcs : un débordement de minutes passe correctement à l'heure suivante", () => {
  const { DTSTART, DTEND } = parseLines(buildDailyReminderIcs({ hour: 19, minute: 50 }));
  assert.equal(DTSTART.slice(-6), '195000');
  assert.equal(DTEND.slice(-6), '200500');
  assert.equal(DTSTART.slice(0, 8), DTEND.slice(0, 8));
});

test('buildDailyReminderIcs : DTSTART correspond à la date du jour en heure locale', () => {
  const now = new Date();
  const { DTSTART } = parseLines(buildDailyReminderIcs());
  assert.equal(Number(DTSTART.slice(0, 4)), now.getFullYear());
  assert.equal(Number(DTSTART.slice(4, 6)), now.getMonth() + 1);
  assert.equal(Number(DTSTART.slice(6, 8)), now.getDate());
});

test('buildDailyReminderIcs : DTSTAMP est un horodatage UTC bien formé', () => {
  const { DTSTAMP } = parseLines(buildDailyReminderIcs());
  assert.match(DTSTAMP, /^\d{8}T\d{6}Z$/);
});

test('buildDailyReminderIcs : UID différent à chaque appel (jamais deux événements identiques)', async () => {
  const uidA = parseLines(buildDailyReminderIcs()).UID;
  await new Promise((resolve) => setTimeout(resolve, 2)); // garantit un getTime() différent
  const uidB = parseLines(buildDailyReminderIcs({ hour: 8 })).UID;
  assert.notEqual(uidA, uidB);
});
