// Onglet "Scan Actif" (sore-frontend/index.html) — couverture d'autorisation,
// badges, et confidentialité du nom interne.
//
// Ce que ces tests couvrent, et pourquoi :
//
//  1. activeScanAuthCoversNow() est la fonction PURE qui pilote l'état
//     activé/désactivé du bouton "Lancer le scan". Elle reflète la logique du
//     garde-fou backend getActiveAuthorization (status 'active' + expires_at
//     non dépassé + now dans la fenêtre testing_window) SANS rien recalculer
//     ni persister. Le backend reste la seule source de vérité et refuse de
//     toute façon (403 { code:'NO_ACTIVE_AUTHORIZATION' }) — un faux positif
//     ici ne fait qu'afficher un bouton qui échouera proprement.
//
//  2. Le mapping des badges (sévérité partagée avec le reste de l'app via la
//     classe .sev-badge ; libellés FR pour les statuts d'autorisation et de
//     finding).
//
//  3. Le nom interne du module backend n'apparaît nulle part dans la section
//     front, hors le chemin réel des routes /api/... (qui EST l'URL serveur).

const { loadActiveScan, extractActiveScanSource } = require('./helpers/loadActiveScan');

const HOUR = 3600 * 1000;
const isoFromNow = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

// Autorisation "couvrante" par défaut : active, fenêtre ouverte [-1h, +1h],
// expiration dans 48h. Chaque test écrase juste ce qu'il veut invalider.
function auth(overrides = {}) {
  return {
    status: 'active',
    expires_at: isoFromNow(48 * HOUR),
    testing_window: { start: isoFromNow(-HOUR), end: isoFromNow(HOUR) },
    ...overrides,
  };
}

describe('activeScanAuthCoversNow — garde-fou UX du bouton "Lancer le scan"', () => {
  const api = loadActiveScan();

  test('active + dans la fenêtre + non expirée → couvre', () => {
    expect(api.activeScanAuthCoversNow(auth())).toBe(true);
  });

  test("statut 'pending' → ne couvre pas (l'activation est un acte backend distinct)", () => {
    expect(api.activeScanAuthCoversNow(auth({ status: 'pending' }))).toBe(false);
  });

  test("statuts 'revoked' et 'expired' → ne couvrent pas", () => {
    expect(api.activeScanAuthCoversNow(auth({ status: 'revoked' }))).toBe(false);
    expect(api.activeScanAuthCoversNow(auth({ status: 'expired' }))).toBe(false);
  });

  test('fenêtre de test déjà terminée → ne couvre pas', () => {
    expect(api.activeScanAuthCoversNow(auth({ testing_window: { start: isoFromNow(-2 * HOUR), end: isoFromNow(-HOUR) } }))).toBe(false);
  });

  test('fenêtre de test pas encore commencée → ne couvre pas', () => {
    expect(api.activeScanAuthCoversNow(auth({ testing_window: { start: isoFromNow(HOUR), end: isoFromNow(2 * HOUR) } }))).toBe(false);
  });

  test('expires_at dépassé même si dans la fenêtre → ne couvre pas', () => {
    expect(api.activeScanAuthCoversNow(auth({ expires_at: isoFromNow(-1) }))).toBe(false);
  });

  test('now injecté explicitement — aucune dépendance à l\'horloge réelle', () => {
    const a = {
      status: 'active',
      expires_at: '2026-01-10T00:00:00Z',
      testing_window: { start: '2026-01-01T00:00:00Z', end: '2026-01-05T00:00:00Z' },
    };
    expect(api.activeScanAuthCoversNow(a, new Date('2026-01-03T12:00:00Z'))).toBe(true);
    expect(api.activeScanAuthCoversNow(a, new Date('2026-01-06T00:00:00Z'))).toBe(false);
    expect(api.activeScanAuthCoversNow(a, new Date('2025-12-31T00:00:00Z'))).toBe(false);
  });

  test('entrée nulle / malformée → robuste, ne jette pas', () => {
    expect(api.activeScanAuthCoversNow(null)).toBe(false);
    expect(api.activeScanAuthCoversNow(undefined)).toBe(false);
    expect(api.activeScanAuthCoversNow(auth({ expires_at: 'pas-une-date' }), new Date('2026-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('activeScanHasCoveringAuth — au moins une autorisation couvrante dans la liste', () => {
  const api = loadActiveScan();

  test('true dès qu\'une seule ligne couvre', () => {
    expect(api.activeScanHasCoveringAuth([auth({ status: 'pending' }), auth()])).toBe(true);
  });

  test('false sur liste vide, nulle, ou sans aucune ligne couvrante', () => {
    expect(api.activeScanHasCoveringAuth([])).toBe(false);
    expect(api.activeScanHasCoveringAuth(null)).toBe(false);
    expect(api.activeScanHasCoveringAuth([auth({ status: 'expired' }), auth({ status: 'pending' })])).toBe(false);
  });
});

describe('badges', () => {
  const api = loadActiveScan();

  test('sévérité → réutilise la classe .sev-badge partagée avec le reste de l\'app', () => {
    expect(api.activeScanSeverityBadge('critical')).toContain('sev-badge critical');
    expect(api.activeScanSeverityBadge('HIGH')).toContain('sev-badge high');
    expect(api.activeScanSeverityBadge('info')).toContain('sev-badge info');
    expect(api.activeScanSeverityBadge('valeur-inconnue')).toContain('sev-badge info');
    expect(api.activeScanSeverityBadge()).toContain('sev-badge info');
  });

  test('statut d\'autorisation → libellé FR', () => {
    expect(api.activeScanAuthStatusBadge('active')).toContain('Active');
    expect(api.activeScanAuthStatusBadge('pending')).toContain('En attente');
    expect(api.activeScanAuthStatusBadge('expired')).toContain('Expirée');
    expect(api.activeScanAuthStatusBadge('revoked')).toContain('Révoquée');
  });

  test('statut de finding → libellé FR', () => {
    expect(api.activeScanFindingStatusBadge('new')).toContain('Nouveau');
    expect(api.activeScanFindingStatusBadge('false_positive')).toContain('Faux positif');
    expect(api.activeScanFindingStatusBadge('remediated')).toContain('Corrigé');
  });

  test('fenêtre / date vides → tiret, ne jette pas', () => {
    expect(api.activeScanFmtWindow(null)).toContain('—');
    expect(api.activeScanFmtWindow({})).toContain('—');
    expect(api.activeScanFmtDate(null)).toContain('—');
    expect(api.activeScanFmtDate('pas-une-date')).toContain('—');
  });
});

describe('RBAC côté front (confort UX — le vrai contrôle est backend)', () => {
  test('activeScanCanManage() vrai pour admin/analyst, faux pour client', () => {
    expect(loadActiveScan({ currentUser: { role: 'admin' } }).activeScanCanManage()).toBe(true);
    expect(loadActiveScan({ currentUser: { role: 'analyst' } }).activeScanCanManage()).toBe(true);
    expect(loadActiveScan({ currentUser: { role: 'client' } }).activeScanCanManage()).toBe(false);
    expect(loadActiveScan({ currentUser: null }).activeScanCanManage()).toBe(false);
  });

  test('activeScanClientParam() — vide pour le rôle client (tenant résolu par le JWT)', () => {
    const clientApi = loadActiveScan({ currentUser: { role: 'client' } });
    expect(clientApi.activeScanClientParam()).toBe('');
  });

  test('activeScanClientParam() — vide pour admin tant qu\'aucun client n\'est sélectionné', () => {
    // activeScanSelectedClientId démarre à '' dans une instance fraîche
    const adminApi = loadActiveScan({ currentUser: { role: 'admin' } });
    expect(adminApi.activeScanClientParam()).toBe('');
  });
});

describe('confidentialité — le nom interne du module n\'apparaît pas côté client', () => {
  test('la section JS "Scan Actif" ne mentionne le nom interne que dans des chemins de route /api/…', () => {
    const src = extractActiveScanSource();
    // Seules occurrences tolérées : le segment de route réel (…/perseus/scan,
    // …/perseus/authorizations, …/perseus/findings) — c'est l'URL du serveur.
    const withoutRoutePaths = src.replace(/\/(?:api\/)?perseus\/[a-z]+/gi, '/<route>');
    expect(/perseus/i.test(withoutRoutePaths)).toBe(false);
  });

  test('le libellé "Scan Actif" est bien présent dans la section', () => {
    expect(extractActiveScanSource()).toContain('SCAN ACTIF');
  });
});
