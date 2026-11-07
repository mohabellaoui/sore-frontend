// __tests__/unit/agents/__MODULE__.test.js
// Gabarit — remplacer __MODULE__, __GUARD__, __CODE__ ; supprimer ce qui ne s'applique pas.
const agent = require('../../../src/agents/__MODULE__');

describe('__MODULE__ — guards', () => {
  test('__GUARD__ throw avec le code explicite (jamais un booléen silencieux)', async () => {
    await expect(agent.__GUARD__(/* entrée invalide */)).rejects.toThrow(/^__CODE__:/);
  });

  test('__GUARD__ ne retourne pas false sur entrée invalide', async () => {
    let returned;
    try { returned = await agent.__GUARD__(/* entrée invalide */); } catch (_) { returned = 'threw'; }
    expect(returned).toBe('threw');
  });

  test('__GUARD__ passe sur entrée valide', async () => {
    await expect(agent.__GUARD__(/* entrée valide */)).resolves.not.toThrow();
  });
});

describe('__MODULE__ — logique pure', () => {
  test.todo('cas nominal');
  test.todo('cas limite');
});
