import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requireAuth, AuthRequest } from './src/middleware/auth';

// Mock express app
const app = express();
app.use(express.json());

// Apply middleware to test routes
app.get('/api/ncm-referencia/buscar/2710', requireAuth, (req, res) => res.json({ ok: true }));
app.post('/api/ncm-referencia/importar', requireAuth, (req: AuthRequest, res) => res.json({ escritorioIdReal: req.escritorioId }));
app.get('/api/fiscal/ncm-referencia', requireAuth, (req, res) => res.json({ ok: true }));

// Mock Firebase Admin
vi.mock('./src/lib/firebase-admin.ts', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token) => {
      if (token === 'invalid-token') throw new Error('Invalid');
      const parts = token.split('-');
      return { uid: parts[1] || 'user-uid' };
    })
  }
}));
vi.mock('./src/lib/firestore-rest-fallback.ts', () => ({
  fetchDocWithFallback: async (path: string) => {
    const uid = path.replace('usuarios/', '');
    if (uid === 'A') return { data: { papel: 'admin_escritorio', escritorioId: 'escritorio-A' } };
    if (uid === 'B') return { data: { papel: 'colaborador', escritorioId: 'escritorio-B' } };
    if (uid === 'super') return { data: { papel: 'super_admin' } };
    return null;
  },
  queryCollectionWithFallback: async () => [],
  setDocWithFallback: async () => ({})
}));

describe('middleware de autenticação (Cloud SQL)', () => {
  it('rejeita requisição sem token', async () => {
    const res = await request(app).get('/api/ncm-referencia/buscar/2710');
    expect(res.status).toBe(401);
  });

  it('nunca usa escritorioId do corpo da requisição, só do token verificado', async () => {
    const tokenEscritorioA = 'valid-A'; // uid A -> escritorio-A
    const res = await request(app)
      .post('/api/ncm-referencia/importar')
      .set('Authorization', `Bearer ${tokenEscritorioA}`)
      .send({ escritorioId: 'escritorio-B', registros: [] });
    
    // Confirma que a resposta usa o escritorio do token (escritorio-A), nao o do body
    expect(res.status).toBe(200);
    expect(res.body.escritorioIdReal).toBe('escritorio-A');
  });

  it('super_admin recebe 403 ao tentar acessar rota /api/fiscal/*', async () => {
    const tokenSuperAdmin = 'valid-super'; // uid super -> super_admin
    const res = await request(app)
      .get('/api/fiscal/ncm-referencia')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Super admin não acessa dados fiscais de escritórios');
  });
});
