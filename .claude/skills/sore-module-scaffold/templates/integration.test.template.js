// __tests__/integration/__ROUTE__.integration.test.js
// Gabarit — supertest contre postgres-test réel. Adapter les helpers aux noms réels
// (grep __tests__/helpers avant d'écrire : ne pas supposer leurs signatures).
const request = require('supertest');
const app = require('../helpers/app');
// const { createTenant, tokenFor, resetDb } = require('../helpers/...'); // ← vérifier par grep

describe('__ROUTE__ — sécurité et isolation', () => {
  let tenantA, tenantB, adminA, clientA, adminB, resourceA;

  beforeAll(async () => {
    // await resetDb();
    // tenantA = await createTenant(); tenantB = await createTenant();
    // adminA = tokenFor(tenantA, 'admin'); clientA = tokenFor(tenantA, 'client'); adminB = tokenFor(tenantB, 'admin');
    // resourceA = await <créer une ressource pour tenantA>;
  });

  test('401 sans JWT', async () => {
    const res = await request(app).get('/api/__ROUTE__');
    expect(res.status).toBe(401);
  });

  test('403 rôle insuffisant (message générique)', async () => {
    const res = await request(app).post('/api/__ROUTE__').set('Authorization', `Bearer ${clientA}`).send({});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/tenant|module|domain/i);
  });

  test('404 (pas 403) sur ressource d\'un autre tenant', async () => {
    const res = await request(app).get(`/api/__ROUTE__/${resourceA.id}`).set('Authorization', `Bearer ${adminB}`);
    expect(res.status).toBe(404);
  });

  test('tenant_id du body ignoré (dérivé de req.user)', async () => {
    const res = await request(app).post('/api/__ROUTE__').set('Authorization', `Bearer ${adminA}`)
      .send({ /* payload valide */ tenant_id: tenantB.id });
    expect([200, 201]).toContain(res.status);
    // expect(res.body.tenant_id).toBe(tenantA.id);
  });

  test('happy path + entrée CHRONICLE', async () => {
    // const res = await request(app)...;
    // const { rows } = await db.query("SELECT 1 FROM chronicle_entries WHERE action = '__MODULE___...' ORDER BY created_at DESC LIMIT 1");
    // expect(rows).toHaveLength(1);
  });
});
