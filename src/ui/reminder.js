// src/ui/reminder.js
//
// Génère un fichier .ics de rappel quotidien (§4.4 : « Ajouter un rappel quotidien à mon
// calendrier », plutôt que des notifications qui culpabilisent). Heure flottante (sans
// fuseau horaire) : la plupart des agendas l'interprètent à l'heure locale de l'appareil qui
// l'importe, ce qui est le comportement voulu ici.

function pad(n) {
  return String(n).padStart(2, '0');
}

/** @param {{hour?: number, minute?: number}} [options] - heure locale du rappel, par défaut 19h00 */
export function buildDailyReminderIcs({ hour = 19, minute = 0 } = {}) {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const start = `${y}${m}${d}T${pad(hour)}${pad(minute)}00`;

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute + 15, 0);
  const endStr = `${y}${m}${d}T${pad(end.getHours())}${pad(end.getMinutes())}00`;

  const stamp = `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Russe//FR',
    'BEGIN:VEVENT',
    `UID:russe-rappel-${now.getTime()}@salash13.github.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${endStr}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Séance de russe',
    "DESCRIPTION:Ouvre l'app et fais ta séance du jour.",
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Déclenche le téléchargement du rappel, pour que l'utilisateur l'ouvre avec son agenda. */
export function downloadDailyReminder() {
  const ics = buildDailyReminderIcs();
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'russe-rappel-quotidien.ics';
  a.click();
  URL.revokeObjectURL(url);
}
