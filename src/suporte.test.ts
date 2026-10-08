import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from './server/createApp';

// Mocks
vi.mock('./lib/firebase-admin.ts', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'token-super') return { uid: 'uid-super', email: 'super@atlas.com', name: 'Super Admin' };
      if (token === 'token-user-a') return { uid: 'uid-user-a', email: 'usera@officea.com', name: 'User A' };
      if (token === 'token-user-b') return { uid: 'uid-user-b', email: 'userb@officea.com', name: 'User B' };
      throw new Error('Invalid token');
    }),
  },
  adminDb: {
    collection: vi.fn((path: string) => {
      const mockCollection: any = {
        where: vi.fn(() => mockCollection),
        orderBy: vi.fn(() => mockCollection),
        get: vi.fn(async () => ({
          docs: path === 'chamados' ? [
            { id: 'cham-1', data: () => ({ autorUid: 'uid-user-a', protocolo: 'SUP-2026-000001', titulo: 'Ticket A' }) }
          ] : []
        })),
        doc: vi.fn((id: string) => ({
          get: vi.fn(async () => ({
            exists: id === 'cham-1',
            id: id,
            data: () => ({ autorUid: 'uid-user-a', protocolo: 'SUP-2026-000001', titulo: 'Ticket A', status: 'ABERTO' })
          })),
          update: vi.fn(async () => ({})),
          collection: vi.fn(() => mockCollection),
        })),
        add: vi.fn(async () => ({ id: 'new-id' }))
      };
      return mockCollection;
    }),
    runTransaction: vi.fn(async (cb) => cb({
      get: vi.fn(async () => ({ exists: false })),
      set: vi.fn()
    }))
  }
}));

vi.mock('./lib/firestore-rest-fallback.ts', () => ({
  fetchDocWithFallback: vi.fn(async (path: string) => {
    if (path === 'usuarios/uid-super') return { data: { papel: 'super_admin', escritorioId: '' } };
    if (path === 'usuarios/uid-user-a') return { data: { papel: 'colaborador', escritorioId: 'escritorio-A' } };
    if (path === 'usuarios/uid-user-b') return { data: { papel: 'colaborador', escritorioId: 'escritorio-A' } };
    return null;
  }),
  queryCollectionWithFallback: vi.fn(async () => []),
  setDocWithFallback: vi.fn(async () => ({})),
  deleteDocWithFallback: vi.fn(async () => ({}))
}));

// Mock do suporteService para não enviar emails reais durante os testes
vi.mock('./server/suporteService', () => ({
  getNextProtocol: vi.fn(async () => 'SUP-2026-000123'),
  notifyNewTicket: vi.fn(async () => {}),
  notifyUserResponse: vi.fn(async () => {}),
  notifyAdminResponse: vi.fn(async () => {}),
  notifyStatusChange: vi.fn(async () => {})
}));

describe('Módulo Suporte - Backend', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await createApp();
  });

  it('Usuário comum vê apenas seus próprios chamados', async () => {
    const res = await request(app)
      .get('/api/suporte/chamados')
      .set('Authorization', 'Bearer token-user-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // No mock do adminDb.collection('chamados').get() acima, retornamos 1 chamado de 'uid-user-a'
    expect(res.body.chamados.length).toBe(1);
  });

  it('Colaborador não consegue ler chamado de outro usuário (403)', async () => {
    // Tentando acessar cham-1 que pertence a uid-user-a usando token de uid-user-b
    const res = await request(app)
      .get('/api/suporte/chamados/cham-1')
      .set('Authorization', 'Bearer token-user-b');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Acesso negado');
  });

  it('super_admin vê chamados de todos os usuários', async () => {
    const res = await request(app)
      .get('/api/suporte/chamados')
      .set('Authorization', 'Bearer token-super');

    expect(res.status).toBe(200);
    expect(res.body.chamados.length).toBeGreaterThan(0);
  });

  it('Usuário comum não consegue alterar status nem prioridade via PATCH (403)', async () => {
    const res = await request(app)
      .patch('/api/suporte/chamados/cham-1')
      .set('Authorization', 'Bearer token-user-a')
      .send({ status: 'RESOLVIDO', prioridade: 'CRITICA' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Apenas suporte pode alterar metadados');
  });

  it('super_admin consegue alterar status e prioridade via PATCH', async () => {
    const res = await request(app)
      .patch('/api/suporte/chamados/cham-1')
      .set('Authorization', 'Bearer token-super')
      .send({ status: 'EM_ANALISE', prioridade: 'ALTA' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Escritório e autor enviados no corpo do POST são ignorados (vêm do token)', async () => {
    // Mocking getNextProtocol to check if it's called
    const res = await request(app)
      .post('/api/suporte/chamados')
      .set('Authorization', 'Bearer token-user-a')
      .send({
        tipo: 'ERRO',
        titulo: 'Bug no SPED',
        descricao: 'Não carrega arquivo zip',
        autorUid: 'HACKER-UID', // Deve ser ignorado
        escritorioId: 'HACKER-ESC' // Deve ser ignorado
      });

    expect(res.status).toBe(200);
    expect(res.body.chamado.autorUid).toBe('uid-user-a');
    expect(res.body.chamado.escritorioId).toBe('escritorio-A');
  });
});
