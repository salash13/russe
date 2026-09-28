// src/ui/theme.js
//
// Applique le mode sombre forçable et la taille du texte (§4.5) selon les réglages. Par
// défaut ("system"), rien n'est posé : le mode sombre suit prefers-color-scheme via app.css
// seul, sans intervention de JS. Un choix explicite ("light"/"dark") pose data-theme, qui
// gagne sur la préférence système (voir les règles CSS correspondantes dans app.css).

export function applyTheme(settings) {
  const root = document.documentElement;

  const theme = settings?.theme ?? 'system';
  if (theme === 'dark' || theme === 'light') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }

  const textSize = settings?.textSize ?? 'normal';
  if (textSize === 'normal') {
    root.removeAttribute('data-text-size');
  } else {
    root.setAttribute('data-text-size', textSize);
  }
}
