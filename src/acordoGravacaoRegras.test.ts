import { describe, it, expect, vi } from 'vitest';
import {
  processarArquivosComRobo,
  approveLearnedRule
} from './lib/roboFiscalService';
import { LearnedTaxRule, SpedData } from './types';

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

// Mock do serviço da Matriz Tributária para capturar gravações sem afetar banco
vi.mock('./lib/matrizService', () => ({
  saveGlobalStateTaxMatrix: vi.fn().mockResolvedValue(undefined)
}));

// Mock do Firebase App para inicialização
vi.mock('./lib/firebase', () => ({
  db: {},
  safeWrite: async (fn: any) => fn ? fn() : null
}));

describe('Acordo de Gravação de Regras Aprendidas do Robô Fiscal', () => {

  const SPED_NOVO_PADRAO: SpedData = {
    header: {
      dtIni: '01012025',
      dtFin: '31012025',
      nome: 'Empresa Teste Regras LTDA',
      cnpj: '11222333000144',
      uf: 'SP'
    },
    documents: [
      {
        id: 'doc_1',
        indOper: '0',
        numDoc: '101',
        serie: '1',
        chvNfe: '35250111222333000144550010000001011234567890',
        dtDoc: '01012025',
        vlDoc: 2500,
        emitenteOrDest: 'FOR001',
        cnpjEmit: '11222333000144',
        chaveValida: true,
        codSit: '00',
        codMod: '55',
        numeroLinhaOriginal: 5,
        items: [
          {
            docId: 'doc_1',
            numItem: '1',
            codItem: 'COD1',
            descrItem: 'REFRIGERANTE LATA 350ML',
            ncm: '22021000', // Refrigerante
            cfop: '5405',
            cstIcms: '060',  // ST
            qtd: 10,
            unid: 'UN',
            vlItem: 50,
            vlBcIcms: 0,
            aliqIcms: 0,
            vlIcms: 0,
            numeroLinhaOriginal: 10
          }
        ]
      }
    ],
    reconciliation: [],
    apuracao: null
  };

  it('1. Novas regras aprendidas devem SEMPRE ser gravadas com status "pendente"', { timeout: 30000 }, async () => {
    const resultado = await processarArquivosComRobo({
      spedData: SPED_NOVO_PADRAO,
      xmls: [],
      cliente: {
        id: 'cli_1',
        nome: 'Empresa Teste Regras LTDA',
        uf: 'SP',
        cnpj: '11222333000144',
        regimeTributario: 'Simples Nacional',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      },
      matrizRules: [], // Matriz vazia força o aprendizado do padrão do item
      escritorioId: 'escritorio-acordo-123'
    });

    expect(resultado.novasRegrasAprendidas.length).toBeGreaterThan(0);
    const regraGerada = resultado.novasRegrasAprendidas[0];

    // Cláusula pétrea do Acordo: Toda regra gerada automaticamente é PENDENTE
    expect(regraGerada.status).toBe('pendente');

    // Verifica se foi salva no localStorage com status pendente
    const salvasStr = localStorage.getItem('atlas_robo_learned_rules_escritorio-acordo-123');
    expect(salvasStr).not.toBeNull();
    const salvasArr: LearnedTaxRule[] = JSON.parse(salvasStr!);
    expect(salvasArr[0].status).toBe('pendente');
  });

  it('2. Apenas mediante ação explícita (approveLearnedRule) a regra passa para "aprovado" e entra na Matriz', async () => {
    // 1. Prepara a regra no estado 'pendente' no localStorage
    const regraPendente: LearnedTaxRule = {
      id: 'rule_pendente_teste',
      uf: 'SP',
      ncmPrefix: '2202',
      learnedCst: '060',
      learnedCfop: ['5405'],
      descricao: 'Refrigerante Lata ST',
      confiancaPercentual: 90,
      amostrasAnalisadas: 10,
      status: 'pendente',
      criadoEm: new Date().toISOString()
    };

    localStorage.setItem(
      'atlas_robo_learned_rules_escritorio-acordo-123',
      JSON.stringify([regraPendente])
    );

    // 2. Chama a função de aprovação
    const novaMatriz = await approveLearnedRule(
      'rule_pendente_teste',
      [], // Matriz atual vazia
      'escritorio-acordo-123'
    );

    // 3. Valida que a regra agora está no catálogo oficial da Matriz
    expect(novaMatriz.length).toBe(1);
    expect(novaMatriz[0].ncmPrefix).toBe('2202');
    expect(novaMatriz[0].expectedCst).toBe('060');

    // 4. Valida que o status no banco de aprendizados mudou para "aprovado"
    const salvasStr = localStorage.getItem('atlas_robo_learned_rules_escritorio-acordo-123');
    const salvasArr: LearnedTaxRule[] = JSON.parse(salvasStr!);
    expect(salvasArr[0].status).toBe('aprovado');
  });

});
