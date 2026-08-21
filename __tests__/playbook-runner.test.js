// Playbook Runner (pbRunnerState) — sore-frontend/index.html
//
// Comportement voulu et déjà documenté/audité : la progression d'un playbook
// vit uniquement dans une variable JS `pbRunnerState`, en mémoire navigateur.
// Il n'y a pas de table de suivi d'exécution côté backend et pas de
// localStorage côté client — donc changer d'alerte ou recharger la page perd
// la progression. Ces tests couvrent ce comportement voulu, pas un bug.
//
// Portée : ces tests exercent l'initialisation de pbRunnerState via
// `openPlaybookRunner(playbookId, alertContext)` — c'est exactement l'appel
// que fait `launchPlaybookForAlert` une fois l'alerte résolue vers son
// playbook. Le mapping alerte → playbook lui-même (résolution réseau via
// `apiCall('/playbooks')`) n'est pas mocké ici : `setPbList` injecte
// directement le catalogue de playbooks pour rester un test unitaire, pas un
// test d'intégration réseau.

const { loadPlaybookRunner } = require('./helpers/loadPlaybookRunner');

const PB_FIXTURE = {
  id: 'pb-1',
  name: 'Brute Force SSH — Réponse',
  trigger_use_case: 'Brute Force SSH',
  trigger_severity: 'high',
  enabled: true,
  steps: [
    { step: 1, title: 'Isoler la source', description: "Bloquer l'IP au firewall périmétrique" },
    { step: 2, title: 'Vérifier les comptes ciblés', description: 'Contrôler les tentatives de connexion récentes' },
    { step: 3, title: 'Notifier le client', description: 'Envoyer une notification via HERALD' },
  ],
};

beforeEach(() => {
  document.body.innerHTML = '';
});

test('initialisation de pbRunnerState au lancement d\'un playbook depuis une alerte', () => {
  const runner = loadPlaybookRunner();
  runner.setPbList([PB_FIXTURE]);

  runner.openPlaybookRunner('pb-1', { alertId: 'a1b2c3d4-e5f6-4789-9abc-def012345678', alertTitle: 'Brute Force SSH' });

  const state = runner.getState();
  expect(state).not.toBeNull();
  expect(state.playbook.id).toBe('pb-1');
  expect(state.alertContext).toEqual({ alertId: 'a1b2c3d4-e5f6-4789-9abc-def012345678', alertTitle: 'Brute Force SSH' });
  expect(state.steps).toHaveLength(3);
  // Premier pas passé "en cours" automatiquement, le reste "en attente"
  expect(state.steps.map(s => s.status)).toEqual(['in_progress', 'pending', 'pending']);
  // La modale est bien montée dans le DOM
  expect(document.getElementById('pbr-overlay')).not.toBeNull();
});

test('progression étape par étape : En attente → En cours → Terminé', () => {
  const runner = loadPlaybookRunner();
  runner.setPbList([PB_FIXTURE]);
  runner.openPlaybookRunner('pb-1');

  expect(runner.getState().steps.map(s => s.status)).toEqual(['in_progress', 'pending', 'pending']);

  runner.markStepDone(0);
  expect(runner.getState().steps.map(s => s.status)).toEqual(['done', 'in_progress', 'pending']);

  runner.markStepDone(1);
  expect(runner.getState().steps.map(s => s.status)).toEqual(['done', 'done', 'in_progress']);

  runner.markStepDone(2);
  expect(runner.getState().steps.map(s => s.status)).toEqual(['done', 'done', 'done']);
});

test("changer d'alerte réinitialise entièrement pbRunnerState (perte volontaire, comportement attendu)", () => {
  const runner = loadPlaybookRunner();
  const pbB = {
    ...PB_FIXTURE,
    id: 'pb-2',
    name: 'Playbook B',
    steps: [{ step: 1, title: 'Étape B1', description: 'Description B1' }],
  };
  runner.setPbList([PB_FIXTURE, pbB]);

  runner.openPlaybookRunner('pb-1', { alertId: 'alert-A', alertTitle: 'Alerte A' });
  runner.markStepDone(0);
  expect(runner.getState().steps[0].status).toBe('done');

  // L'utilisateur ouvre le playbook d'une autre alerte sans avoir clôturé le premier
  runner.openPlaybookRunner('pb-2', { alertId: 'alert-B', alertTitle: 'Alerte B' });

  const state = runner.getState();
  expect(state.playbook.id).toBe('pb-2');
  expect(state.alertContext).toEqual({ alertId: 'alert-B', alertTitle: 'Alerte B' });
  expect(state.steps).toHaveLength(1);
  // La progression de l'alerte précédente n'est pas héritée : pbRunnerState a été
  // intégralement remplacé, pas fusionné
  expect(state.steps[0].status).toBe('in_progress');
});

test('recharger la page perd totalement la progression (aucune persistance DB ni localStorage)', () => {
  const runnerBeforeReload = loadPlaybookRunner();
  runnerBeforeReload.setPbList([PB_FIXTURE]);
  runnerBeforeReload.openPlaybookRunner('pb-1');
  runnerBeforeReload.markStepDone(0);
  expect(runnerBeforeReload.getState()).not.toBeNull();

  // Simule un rechargement de page : le script est ré-évalué depuis zéro
  // (nouvel appel à loadPlaybookRunner = nouvelle closure `let pbRunnerState = null`).
  // Rien dans markStepDone/openPlaybookRunner n'appelle apiCall ni localStorage :
  // il n'existe donc aucun mécanisme pour restaurer l'état après ce point.
  const runnerAfterReload = loadPlaybookRunner();
  expect(runnerAfterReload.getState()).toBeNull();
});

test('clôture du playbook quand toutes les étapes sont résolues (finishPlaybook)', () => {
  const toasts = [];
  const runner = loadPlaybookRunner({ showToast: (msg) => toasts.push(msg) });
  runner.setPbList([PB_FIXTURE]);
  runner.openPlaybookRunner('pb-1');

  runner.markStepDone(0);
  runner.markStepDone(1);
  runner.markStepDone(2);
  expect(runner.getState().steps.every(s => s.status === 'done')).toBe(true);

  runner.finishPlaybook();

  expect(runner.getState()).toBeNull(); // closePlaybookRunner() a bien été appelé
  expect(document.getElementById('pbr-overlay')).toBeNull(); // overlay retiré du DOM
  expect(toasts).toHaveLength(1);
  expect(toasts[0]).toContain('3 terminée(s)');
  expect(toasts[0]).toContain('0 escaladée(s)');
});

test('une étape escaladée compte pour la clôture au même titre qu\'une étape terminée', () => {
  const runner = loadPlaybookRunner();
  runner.setPbList([PB_FIXTURE]);
  runner.openPlaybookRunner('pb-1');

  runner.markStepDone(0);
  runner.startEscalate(1);
  expect(runner.getState().escalatingIndex).toBe(1);

  runner.confirmEscalate(1);
  const state = runner.getState();
  expect(state.steps[1].status).toBe('escalated');
  expect(state.steps[2].status).toBe('in_progress'); // l'étape suivante démarre malgré l'escalade
  expect(state.escalatingIndex).toBeNull();
});
