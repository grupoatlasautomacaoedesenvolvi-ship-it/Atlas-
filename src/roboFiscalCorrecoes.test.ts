import { describe, it, expect, vi } from 'vitest';
import {
  getRoboConfig,
  getRoboLogs,
  getLearnedRules,
  processarArquivosComRobo
} from './lib/roboFiscalService';
import { fetchEscritorioInfo } from './lib/clientService';

// Mock do Firestore para evitar chamadas reais nos testes unitários
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(true),
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'mocked_id' }),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  limit: vi.fn()
}));

// Mock do Firebase App para inicialização
vi.mock('./lib/firebase', () => ({
  db: {},
  safeWrite: async (fn: any) => fn ? fn() : null
}));

describe('Correções de Segurança e Redundância do Robô Fiscal', () => {

  it('1. Deve bloquear requisições sem escritorioId em getRoboConfig', async () => {
    // @ts-ignore - forçando chamada sem parâmetro para validar a guarda de segurança
    await expect(getRoboConfig(undefined)).rejects.toThrow(/escritorioId é obrigatório/);
  });

  it('2. Deve bloquear requisições sem escritorioId em fetchEscritorioInfo', async () => {
    // @ts-ignore - forçando chamada sem parâmetro
    await expect(fetchEscritorioInfo(undefined)).rejects.toThrow(/escritorioId é obrigatório/);
  });

  it('3. Não deve retornar historico de logs ficticios para um escritorio novo', async () => {
    const logs = await getRoboLogs(50, 'escritorio-novo-123');
    expect(logs).toEqual([]);
    expect(logs.length).toBe(0);
  });

  it('4. Não deve retornar regras aprendidas ficticias com status pendente', async () => {
    const regras = await getLearnedRules('escritorio-novo-123');
    expect(regras).toEqual([]);
    expect(regras.length).toBe(0);
  });

  it('5. Deve rotular a simulacao claramente como dado ficticio e definir isSimulacao', async () => {
    const resultado = await processarArquivosComRobo({
      spedData: null,
      xmls: [],
      matrizRules: [],
      escritorioId: 'escritorio-teste-123',
      isSimulacao: true
    });

    // O retorno traz as regras criadas e o resumo do processamento
    expect(resultado).toHaveProperty('resumo');
    expect(resultado).toHaveProperty('inconsistencias');
    expect(resultado).toHaveProperty('novasRegrasAprendidas');

    // O log gravado no localStorage deve conter o rótulo de simulação
    const logsStr = localStorage.getItem('atlas_robo_logs_escritorio-teste-123');
    expect(logsStr).not.toBeNull();
    const logsArr = JSON.parse(logsStr!);
    expect(logsArr.length).toBeGreaterThan(0);
    const ultimoLog = logsArr[0];

    expect(ultimoLog.isSimulacao).toBe(true);
    expect(ultimoLog.clienteNome).toBe('Simulação de Teste (dado fictício)');
    expect(ultimoLog.mensagem).toContain('Simulação de teste executada');
  });

});
