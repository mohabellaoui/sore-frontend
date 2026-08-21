// Extrait la section "PLAYBOOK RUNNER" du script inline de index.html (il n'y
// a ni bundler ni modules dans ce frontend — tout est un seul <script> global)
// et l'évalue dans un sandbox jsdom, sans exécuter le reste de l'app (pas de
// fetch réel, pas de timers, pas d'init globale déclenchée).
//
// Repère les bornes par le texte des commentaires de section — pas par
// numéro de ligne, pour rester robuste si index.html est réédité au-dessus.

const fs = require('fs');
const path = require('path');

const START_MARKER = '// PLAYBOOK RUNNER — Exécution des playbooks';
const END_MARKER = '// CASES — Case Management';

function extractPlaybookRunnerSource() {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER, start);
  if (start === -1 || end === -1) {
    throw new Error(
      `Impossible de localiser la section Playbook Runner dans index.html ` +
      `(marqueurs "${START_MARKER}" / "${END_MARKER}" introuvables — le fichier a été réorganisé, ` +
      `mettre à jour les marqueurs dans loadPlaybookRunner.js).`
    );
  }
  return html.slice(start, end);
}

/**
 * Instancie une copie fraîche et isolée du Playbook Runner (pbList/pbRunnerState
 * partent à null, comme au chargement réel d'une page — utile pour simuler un
 * rechargement de page entre deux tests).
 */
function loadPlaybookRunner({ escHtml, showToast, apiCall, socCurrentAlerts } = {}) {
  const source = extractPlaybookRunnerSource();
  const body = `
    ${source}
    return {
      openPlaybookRunner,
      launchPlaybookForAlert,
      loadPlaybooks,
      getPlaybooksCache,
      markStepDone,
      startEscalate,
      cancelEscalate,
      confirmEscalate,
      closePlaybookRunner,
      finishPlaybook,
      renderPlaybookRunner,
      getState: () => pbRunnerState,
      getPbList: () => pbList,
      setPbList: (list) => { pbList = list; },
    };
  `;
  const factory = new Function('escHtml', 'showToast', 'apiCall', 'socCurrentAlerts', body);
  return factory(
    escHtml || ((s) => String(s == null ? '' : s).replace(/</g, '&lt;')),
    showToast || (() => {}),
    apiCall || (async () => { throw new Error('apiCall non stubbé dans ce test'); }),
    socCurrentAlerts || []
  );
}

module.exports = { loadPlaybookRunner, extractPlaybookRunnerSource };
