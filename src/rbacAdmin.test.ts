import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from './server/createApp';

vi.mock('./lib/firebase-admin.ts', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'token-super') return { uid: 'uid-super', email: 'super@atlas.com' };
      if (token === 'token-admin-a') return { uid: 'uid-admin-a', email: 'admina@escritorioa.com' };
      if (token === 'token-admin-b') return { uid: 'uid-admin-b', email: 'adminb@escritoriob.com' };
      throw new Error('Invalid token');
    }),
    updateUser: vi.fn(async () => ({})),
    getUser: vi.fn(async (uid: string) => ({ uid, email: `${uid}@atlas.com` })),
    generatePasswordResetLink: vi.fn(async () => 'https://reset.link')
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ id: 'new-esc-id' }))
    }))
  }
}));

vi.mock('./lib/firestore-rest-fallback.ts', () => ({
  fetchDocWithFallback: vi.fn(async (path: string) => {
    if (path === 'usuarios/uid-super') return { data: { papel: 'super_admin', escritorioId: '' } };
    if (path === 'usuarios/uid-admin-a') return { data: { papel: 'admin_escritorio', escritorioId: 'escritorio-A' } };
    if (path === 'usuarios/uid-colab-a') return { data: { papel: 'colaborador', escritorioId: 'escritorio-A' } };
    if (path === 'usuarios/uid-colab-b') return { data: { papel: 'colaborador', escritorioId: 'escritorio-B' } };
    if (path === 'usuarios/uid-missing') return null;
    return null;
  }),
  queryCollectionWithFallback: vi.fn(async () => []),
  setDocWithFallback: vi.fn(async () => ({})),
  deleteDocWithFallback: vi.fn(async () => ({}))
}));

describe('RBAC e Isolamento Multi-tenant - Gestão de Usuários', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await createApp();
  });

  it('admin_escritorio: tentar mudar escritorioId de um usuario gera 403', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-a')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ escritorioId: 'escritorio-B' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Apenas super_admin pode mover usuários entre escritórios.');
  });

  it('admin_escritorio: definir papel admin_escritorio é permitido', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-a')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ papel: 'admin_escritorio' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin_escritorio: definir papel colaborador é permitido', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-a')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ papel: 'colaborador' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin_escritorio: tentar promover usuario a super_admin gera 403', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-a')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ papel: 'super_admin' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Admin de escritório não pode promover usuários a super_admin.');
  });

  it('admin_escritorio: editar usuario de outro escritorio gera 403', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-b')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ nome: 'Novo Nome' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Usuário não encontrado ou fora do seu escritório.');
  });

  it('admin_escritorio: quando o doc do alvo não carrega (null) nega com 403', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-missing')
      .set('Authorization', 'Bearer token-admin-a')
      .send({ nome: 'Novo Nome' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Usuário não encontrado ou fora do seu escritório.');
  });

  it('super_admin: pode alterar escritorioId e papel para super_admin', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/uid-colab-a')
      .set('Authorization', 'Bearer token-super')
      .send({ escritorioId: 'escritorio-B', papel: 'super_admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
