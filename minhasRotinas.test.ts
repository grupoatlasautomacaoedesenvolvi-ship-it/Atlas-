import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreDb = new Map<string, any>();

vi.mock('./src/lib/firebase', () => ({ db: {}, safeWrite: async (fn: any) => fn ? fn() : null }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: any, ...path: string[]) => ({ __coll: path.join('/') }),
  doc: (_db: any, ...path: string[]) => ({ __path: path.join('/') }),
  getDocs: async (ref: any) => {
    const docs = Array.from(firestoreDb.entries())
      .filter(([k]) => k.startsWith(ref.__coll + '/'))
      .map(([id, data]) => ({ id: id.split('/').pop(), data: () => data }));
    return { docs };
  },
  setDoc: async (ref: any, data: any) => { firestoreDb.set(ref.__path, data); },
  deleteDoc: async (ref: any) => { firestoreDb.delete(ref.__path); },
  query: (c: any) => c, where: () => ({}),
}));

import { saveRotina, fetchRotinas } from './src/lib/rotinaService';
import { Rotina } from './src/types';

beforeEach(() => { firestoreDb.clear(); });

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
    const rotinaPrivada = criarRotina({ id: 'r1', userId: 'user-colaborador-1', visibilidade: 'Privado' });
    await saveRotina('escritorio-A', rotinaPrivada);

    const vistoPeloCriador = await fetchRotinas('escritorio-A', 'user-colaborador-1', 'colaborador');
    const vistoPorOutroColaborador = await fetchRotinas('escritorio-A', 'user-colaborador-2', 'colaborador');

    expect(vistoPeloCriador.some(r => r.id === 'r1')).toBe(true);
    expect(vistoPorOutroColaborador.some(r => r.id === 'r1')).toBe(false);
  });

  it('rotina "Todos" aparece pra qualquer colaborador do MESMO escritório', async () => {
    const rotinaPublica = criarRotina({ id: 'r2', userId: 'user-colaborador-1', visibilidade: 'Todos' });
    await saveRotina('escritorio-A', rotinaPublica);

    const vistoPorOutroColaborador = await fetchRotinas('escritorio-A', 'user-colaborador-2', 'colaborador');
    expect(vistoPorOutroColaborador.some(r => r.id === 'r2')).toBe(true);
  });

  it('rotina "Administradores" só aparece pra admin_escritorio/super_admin, nunca pra colaborador comum', async () => {
    const rotinaAdmin = criarRotina({ id: 'r3', userId: 'user-admin-1', creatorRole: 'admin_escritorio', visibilidade: 'Administradores' });
    await saveRotina('escritorio-A', rotinaAdmin);

    const vistoPorColaborador = await fetchRotinas('escritorio-A', 'user-colaborador-2', 'colaborador');
    const vistoPorAdmin = await fetchRotinas('escritorio-A', 'user-admin-2', 'admin_escritorio');

    expect(vistoPorColaborador.some(r => r.id === 'r3')).toBe(false);
    expect(vistoPorAdmin.some(r => r.id === 'r3')).toBe(true);
  });

  it('rotina de um escritório nunca aparece pra usuário de outro escritório', async () => {
    const rotinaPublicaA = criarRotina({ id: 'r4', escritorioId: 'escritorio-A', visibilidade: 'Todos' });
    await saveRotina('escritorio-A', rotinaPublicaA);

    const vistoDoEscritorioB = await fetchRotinas('escritorio-B', 'user-outro-escritorio', 'colaborador');
    expect(vistoDoEscritorioB.some(r => r.id === 'r4')).toBe(false);
  });
});
