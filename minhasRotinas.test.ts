import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreDb = new Map<string, any>();

// Mock global fetch for API endpoints /api/escritorio/rotinas
vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
  const urlStr = url.toString();
  const headers = (init?.headers || {}) as Record<string, string>;
  const authHeader = headers['Authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  // token format in test: "<uid>|<papel>|<escritorioId>"
  const parts = token.split('|');
  const uid = parts[0] || 'user-colaborador-1';
  const papel = parts[1] || 'colaborador';
  const userEscritorioId = parts[2] || 'escritorio-A';

  if (urlStr.includes('/api/escritorio/rotinas')) {
    if (init?.method === 'POST') {
      const body = JSON.parse((init.body as string) || '{}');
      const rotina = body.rotina;
      if (rotina) {
        const key = `escritorios/${rotina.escritorioId}/rotinas/${rotina.id}`;
        firestoreDb.set(key, { ...rotina, userId: rotina.userId || uid, creatorRole: rotina.creatorRole || papel });
      }
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    } else {
      // GET
      const prefix = `escritorios/${userEscritorioId}/rotinas/`;
      const todas = Array.from(firestoreDb.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([_, v]) => v);

      const visiveis = todas.filter((r: any) => {
        if (r.userId === uid) return true;
        if (r.visibilidade === 'Privado') return false;
        if (r.visibilidade === 'Todos') return true;
        if (r.visibilidade === 'Administradores') {
          return papel === 'admin_escritorio' || papel === 'super_admin';
        }
        return false;
      });

      return {
        ok: true,
        json: async () => ({ success: true, rotinas: visiveis })
      };
    }
  }
  return { ok: false, status: 404, json: async () => ({}) };
});

import { saveRotina, fetchRotinas } from './src/lib/rotinaService';
import { Rotina } from './src/types';

beforeEach(() => {
  firestoreDb.clear();
  localStorage.clear();
});

function setUserToken(uid: string, papel: string, escritorioId: string) {
  localStorage.setItem('atlas_auth_token', `${uid}|${papel}|${escritorioId}`);
}

function criarRotina(overrides: Partial<Rotina>): Rotina {
  return {
    id: `rot_${Math.random()}`, escritorioId: 'escritorio-A', userId: 'user-colaborador-1',
    userNome: 'Colaborador 1', creatorRole: 'colaborador', titulo: 'Rotina teste',
    descricao: '', recorrencia: 'Mensal', prazoInfo: '', checklist: [], concluida: false,
    tipo: 'Rotina', visibilidade: 'Privado', criadoEm: '', atualizadoEm: '', ...overrides
  };
}

describe('Minhas Rotinas — controle pessoal x compartilhado', () => {
  it('rotina Privada só aparece pra quem criou, nunca pra outro colaborador', async () => {
    setUserToken('user-colaborador-1', 'colaborador', 'escritorio-A');
    const rotinaPrivada = criarRotina({ id: 'r1', userId: 'user-colaborador-1', visibilidade: 'Privado' });
    await saveRotina('escritorio-A', rotinaPrivada);

    setUserToken('user-colaborador-1', 'colaborador', 'escritorio-A');
    const vistoPeloCriador = await fetchRotinas('escritorio-A');

    setUserToken('user-colaborador-2', 'colaborador', 'escritorio-A');
    const vistoPorOutroColaborador = await fetchRotinas('escritorio-A');

    expect(vistoPeloCriador.some(r => r.id === 'r1')).toBe(true);
    expect(vistoPorOutroColaborador.some(r => r.id === 'r1')).toBe(false);
  });

  it('rotina "Todos" aparece pra qualquer colaborador do MESMO escritório', async () => {
    setUserToken('user-colaborador-1', 'colaborador', 'escritorio-A');
    const rotinaPublica = criarRotina({ id: 'r2', userId: 'user-colaborador-1', visibilidade: 'Todos' });
    await saveRotina('escritorio-A', rotinaPublica);

    setUserToken('user-colaborador-2', 'colaborador', 'escritorio-A');
    const vistoPorOutroColaborador = await fetchRotinas('escritorio-A');
    expect(vistoPorOutroColaborador.some(r => r.id === 'r2')).toBe(true);
  });

  it('rotina "Administradores" só aparece pra admin_escritorio/super_admin, nunca pra colaborador comum', async () => {
    setUserToken('user-admin-1', 'admin_escritorio', 'escritorio-A');
    const rotinaAdmin = criarRotina({ id: 'r3', userId: 'user-admin-1', creatorRole: 'admin_escritorio', visibilidade: 'Administradores' });
    await saveRotina('escritorio-A', rotinaAdmin);

    setUserToken('user-colaborador-2', 'colaborador', 'escritorio-A');
    const vistoPorColaborador = await fetchRotinas('escritorio-A');

    setUserToken('user-admin-2', 'admin_escritorio', 'escritorio-A');
    const vistoPorAdmin = await fetchRotinas('escritorio-A');

    expect(vistoPorColaborador.some(r => r.id === 'r3')).toBe(false);
    expect(vistoPorAdmin.some(r => r.id === 'r3')).toBe(true);
  });

  it('rotina de um escritório nunca aparece pra usuário de outro escritório', async () => {
    setUserToken('user-colaborador-1', 'colaborador', 'escritorio-A');
    const rotinaPublicaA = criarRotina({ id: 'r4', escritorioId: 'escritorio-A', visibilidade: 'Todos' });
    await saveRotina('escritorio-A', rotinaPublicaA);

    setUserToken('user-outro-escritorio', 'colaborador', 'escritorio-B');
    const vistoDoEscritorioB = await fetchRotinas('escritorio-B');
    expect(vistoDoEscritorioB.some(r => r.id === 'r4')).toBe(false);
  });
});
