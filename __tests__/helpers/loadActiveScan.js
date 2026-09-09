// Extrait la section "SCAN ACTIF" du script inline de index.html (ni bundler ni
// modules : tout est un seul <script> global) et l'évalue dans un sandbox
// jsdom, sans exécuter le reste de l'app (pas de fetch réel, pas d'init
// globale). Même approche que loadPlaybookRunner.js.
//
// Bornes repérées par le texte des commentaires de section — pas par numéro de
// ligne — pour rester robuste si index.html est réédité au-dessus.

const fs = require('fs');
const path = require('path');

const START_MARKER = '// SCAN ACTIF — vérification active autorisée (complément du scan passif)';
const END_MARKER = 'let toastTimer;';

function extractActiveScanSource() {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER, start);
  if (start === -1 || end === -1) {
    throw new Error(
      `Impossible de localiser la section "Scan Actif" dans index.html ` +
      `(marqueurs "${START_MARKER}" / "${END_MARKER}" introuvables — le fichier a été ` +
      `réorganisé, mettre à jour les marqueurs dans loadActiveScan.js).`
    );
  }
  return html.slice(start, end);
}

/**
 * Instancie une copie fraîche et isolée de la section "Scan Actif". Les
 * dépendances globales (currentUser, apiCall, apiCallEx, showToast, escHtml)
 * sont injectées — seules les fonctions pures (couverture d'autorisation,
 * badges) sont exercées par les tests, le DOM n'est jamais touché.
 */
function loadActiveScan({ currentUser, apiCall, apiCallEx, showToast, escHtml } = {}) {
  const source = extractActiveScanSource();
  const body = `
    ${source}
    return {
      activeScanAuthCoversNow,
      activeScanHasCoveringAuth,
      activeScanCanManage,
      activeScanClientParam,
      activeScanSeverityBadge,
      activeScanAuthStatusBadge,
      activeScanFindingStatusBadge,
      activeScanFmtWindow,
      activeScanFmtDate,
    };
  `;
  const factory = new Function('currentUser', 'apiCall', 'apiCallEx', 'showToast', 'escHtml', body);
  return factory(
    currentUser || null,
    apiCall || (async () => null),
    apiCallEx || (async () => ({ ok: false, error: 'apiCallEx non stubbé dans ce test' })),
    showToast || (() => {}),
    escHtml || ((s) => String(s == null ? '' : s).replace(/</g, '&lt;')),
  );
}

module.exports = { loadActiveScan, extractActiveScanSource };
