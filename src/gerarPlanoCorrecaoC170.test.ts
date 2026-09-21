import { describe, it, expect, vi } from 'vitest';
import {
  gerarPlanoCorrecaoC170,
  getLearnedRules
} from './lib/roboFiscalService';
import { SpedData, StateTaxRule, Achado } from './types';

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

describe('gerarPlanoCorrecaoC170 - Consolidação de Auditoria e Matriz', () => {
  const ESCRITORIO_ID = 'escritorio-teste-c170';

  const SPED_DIVERGENTE: SpedData = {
    header: {
      dtIni: '01012025',
      dtFin: '31012025',
      nome: 'Empresa Teste C170 LTDA',
      cnpj: '11222333000144',
      uf: 'SP'
    },
    documents: [
      {
        id: 'doc_101',
        indOper: '1', // Saída
        numDoc: '101',
        serie: '1',
        chvNfe: '35250111222333000144550010000001011234567890',
        dtDoc: '01012025',
        vlDoc: 500,
        emitenteOrDest: 'CLI001',
        cnpjEmit: '11222333000144',
        chaveValida: true,
        codSit: '00',
        codMod: '55',
        numeroLinhaOriginal: 5,
        items: [
          {
            docId: 'doc_101',
            numItem: '1',
            codItem: 'COD_BEBIDA',
            descrItem: 'REFRIGERANTE LATA 350ML',
            ncm: '22021000',
            cfop: '5102', // Divergente: deveria ser 5405 para ST
            cstIcms: '060', // ST
            qtd: 10,
            unid: 'UN',
            vlItem: 100,
            vlBcIcms: 100, // Divergente: CST 060 deve ter BC e ICMS zerados
            aliqIcms: 18,
            vlIcms: 18,
            numeroLinhaOriginal: 10
          }
        ]
      }
    ],
    reconciliation: [],
    apuracao: null
  };

  const MATRIZ_ST: StateTaxRule[] = [
    {
      id: 'rule_2202',
      uf: 'SP',
      ncmPrefix: '2202',
      expectedCst: '060',
      expectedCfop: ['5405'],
      expectedAliqIcms: 0,
      descricao: 'Bebidas não alcoólicas com ST em SP'
    }
  ];

  it('1. Deve exigir escritorioId obrigatoriamente por seguranca', async () => {
    // @ts-ignore
    await expect(gerarPlanoCorrecaoC170({ escritorioId: undefined })).rejects.toThrow(
      /escritorioId é obrigatório/
    );
  });

  it('2. Deve consolidar Matriz e Auditoria em um plano unico por item C170 corrigindo CST, CFOP e ICMS', async () => {
    const achadoAuditoria: Achado = {
      id: 'achado_cst_1',
      tipo: 'CST_CFOP_INCOMPATIVEL',
      severidade: 'alta',
      titulo: 'Incompatibilidade de CST e CFOP no C170',
      descricao: 'CFOP 5102 incompatível com CST 060 para venda de produto com ST.',
      docId: 'doc_101',
      numDoc: '101',
      serie: '1',
      numItem: '1',
      codItem: 'COD_BEBIDA',
      correcaoSugerida: [
        { campo: 'cfop', valorDeclarado: '5102', valorSugerido: '5405', origemSugestao: 'Matriz/Auditoria' }
      ],
      statusRevisao: 'pendente'
    };

    const resultado = await gerarPlanoCorrecaoC170({
      spedData: SPED_DIVERGENTE,
      matrizRules: MATRIZ_ST,
      achados: [achadoAuditoria],
      escritorioId: ESCRITORIO_ID
    });

    expect(resultado.itensCorrecao.length).toBe(1);
    const itemPlan = resultado.itensCorrecao[0];

    // Validações de consolidação do plano
    expect(itemPlan.numDoc).toBe('101');
    expect(itemPlan.cstDeclarado).toBe('060');
    expect(itemPlan.cfopDeclarado).toBe('5102');

    // Correções consolidadas
    expect(itemPlan.cstSugerido).toBe('060');
    expect(itemPlan.cfopSugerido).toBe('5405'); // CFOP corrigido para ST
    expect(itemPlan.vlBcIcmsSugerido).toBe(0); // BC zerada para CST 060
    expect(itemPlan.vlIcmsSugerido).toBe(0);   // ICMS zerado para CST 060
    expect(itemPlan.aliqIcmsSugerida).toBe(0);

    expect(itemPlan.precisaCorrecao).toBe(true);
    expect(itemPlan.status).toBe('pendente'); // Invariante: status do plano é pendente
  });

  it('3. Deve aplicar a invariante status: pendente para qualquer novo aprendizado', async () => {
    const spedSemMatriz: SpedData = {
      header: {
        dtIni: '01012025',
        dtFin: '31012025',
        nome: 'Empresa Teste Aprendizado',
        cnpj: '99888777000166',
        uf: 'SP'
      },
      documents: [
        {
          id: 'doc_202',
          indOper: '1',
          numDoc: '202',
          serie: '1',
          chvNfe: '35250199888777000166550010000002021234567890',
          dtDoc: '01012025',
          vlDoc: 300,
          emitenteOrDest: 'CLI002',
          cnpjEmit: '99888777000166',
          chaveValida: true,
          codSit: '00',
          codMod: '55',
          numeroLinhaOriginal: 20,
          items: [
            {
              docId: 'doc_202',
              numItem: '1',
              codItem: 'COD_NOVO_NCM',
              descrItem: 'SUPLEMENTO ALIMENTAR PROTEICO',
              ncm: '21069090',
              cfop: '5102',
              cstIcms: '000',
              qtd: 1,
              unid: 'UN',
              vlItem: 300,
              vlBcIcms: 300,
              aliqIcms: 18,
              vlIcms: 54,
              numeroLinhaOriginal: 25
            }
          ]
        }
      ],
      reconciliation: [],
      apuracao: null
    };

    const resultado = await gerarPlanoCorrecaoC170({
      spedData: spedSemMatriz,
      matrizRules: [], // Sem Matriz para forçar novo aprendizado
      escritorioId: ESCRITORIO_ID
    });

    expect(resultado.novasRegrasAprendidas.length).toBe(1);
    const regraAprendida = resultado.novasRegrasAprendidas[0];

    // Cláusula pétrea: status é SEMPRE pendente
    expect(regraAprendida.status).toBe('pendente');

    // Valida persistência no localStorage
    const salvasStr = localStorage.getItem(`atlas_robo_learned_rules_${ESCRITORIO_ID}`);
    expect(salvasStr).not.toBeNull();
    const salvasArr = JSON.parse(salvasStr!);
    expect(salvasArr[0].status).toBe('pendente');
  });
});
